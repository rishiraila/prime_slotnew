// src/app/api/meetings/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';

const ADMIN_COOKIE = 'admin_session';
const JWT_COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
  return res;
}

export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

async function requireUser(req) {
  if (DISABLE_AUTH) return { mode: 'test', uid: 'TEST_USER' };

  const jar = await cookies();

  // 1) try Bearer token (JWT from verify-widget-token)
  const auth =
    req.headers.get('authorization') ||
    req.headers.get('Authorization') ||
    '';
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { mode: 'member', uid: payload.sub, payload };
    } catch (e) {
      // ignore, try cookie
    }
  }

  // 2) try JWT cookie fallback
  const token = jar.get(JWT_COOKIE)?.value;
  if (token && JWT_SECRET) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { mode: 'member', uid: payload.sub, payload };
    } catch (e) {
      // ignore, try admin
    }
  }

  // 3) fallback: admin_session
  const session = jar.get(ADMIN_COOKIE)?.value;
  if (!session)
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const decoded = await adminAuth.verifySessionCookie(session, true);
  return { mode: 'admin', uid: decoded.uid, decoded };
}

// Robust approved check - supports multiple possible schema variants
function isMeetingApproved(meetingObj) {
  if (!meetingObj || typeof meetingObj !== 'object') return false;

  // explicit boolean flags
  if (meetingObj.approved === true) return true;
  if (meetingObj.isApproved === true) return true;

  // string status / approval fields
  if (
    typeof meetingObj.status === 'string' &&
    meetingObj.status.toLowerCase() === 'approved'
  )
    return true;
  if (
    typeof meetingObj.approval === 'string' &&
    meetingObj.approval.toLowerCase() === 'approved'
  )
    return true;

  // presence of timestamp / approvedAt
  if (meetingObj.approvedAt) return true;

  return false;
}

export async function GET(req) {
  try {
    const user = await requireUser(req);

    // Only allow member mode, as the task is for users in the token
    if (user.mode !== 'member') {
      return addCORS(
        NextResponse.json({ error: 'Not allowed' }, { status: 403 })
      );
    }

    const memberId = user.uid;

    // Query memberMeetings for the member
    const memberMeetingsRef = rtdb.ref(`/memberMeetings/${memberId}`);
    const memberMeetingsSnap = await memberMeetingsRef.once('value');
    const memberMeetings = memberMeetingsSnap.val();

    if (!memberMeetings) {
      return addCORS(NextResponse.json({ meetings: [] }, { status: 200 }));
    }

    const allMeetings = [];

    // Helper to fetch and push meeting into allMeetings if approved
    const pushMeetingIfApproved = (meetingId, eventIdForRecord, fullMeeting) => {
      if (!isMeetingApproved(fullMeeting)) return; // skip unapproved
      // normalize eventId for standalone to null
      const normalizedEventId =
        eventIdForRecord === 'standalone' ||
        eventIdForRecord === null ||
        eventIdForRecord === 'undefined'
          ? null
          : eventIdForRecord;
      allMeetings.push({
        meetingId,
        eventId: normalizedEventId,
        ...fullMeeting,
      });
    };

    // For each key under memberMeetings
    for (const eventIdKey of Object.keys(memberMeetings)) {
      // skip if value falsy
      const eventMeetings = memberMeetings[eventIdKey];
      if (!eventMeetings) continue;

      // Case A: eventIdKey === 'standalone' --> meetings stored in meetings_standalone
      if (eventIdKey === 'standalone') {
        for (const meetingId of Object.keys(eventMeetings)) {
          try {
            // attempt to read from meetings_standalone
            const snap = await rtdb
              .ref(`/meetings_standalone/${meetingId}`)
              .get();
            if (snap.exists()) {
              const val = snap.val();
              pushMeetingIfApproved(meetingId, null, val);
            } else {
              // fallback: maybe was stored under /meetings/<someEvent>/<meetingId>
              const fallbackSnap = await rtdb.ref(`/meetings/${meetingId}`).get();
              if (fallbackSnap.exists()) {
                const val = fallbackSnap.val();
                pushMeetingIfApproved(meetingId, null, val);
              }
            }
          } catch (err) {
            // ignore single-item failure, continue
            console.error(
              'Error fetching standalone meeting',
              meetingId,
              err.message || err
            );
          }
        }
        continue;
      }

      // Case B: eventIdKey is 'undefined' --> treat as standalone fallback
      if (eventIdKey === 'undefined') {
        for (const meetingId of Object.keys(eventMeetings)) {
          try {
            const snap = await rtdb
              .ref(`/meetings_standalone/${meetingId}`)
              .get();
            if (snap.exists()) {
              pushMeetingIfApproved(meetingId, null, snap.val());
            } else {
              // fallback: try /meetings/undefined/meetingId (if present)
              const fallbackSnap = await rtdb
                .ref(`/meetings/undefined/${meetingId}`)
                .get();
              if (fallbackSnap.exists()) {
                pushMeetingIfApproved(meetingId, null, fallbackSnap.val());
              }
            }
          } catch (err) {
            console.error(
              'Error fetching undefined-group meeting',
              meetingId,
              err.message || err
            );
          }
        }
        continue;
      }

      // General case: eventIdKey is an event id
      for (const meetingId of Object.keys(eventMeetings)) {
        try {
          // Quick-check: memberMeetings may contain metadata per meeting (to avoid extra reads)
          const meta = eventMeetings[meetingId];
          if (meta && typeof meta === 'object') {
            // If metadata explicitly indicates not-approved, skip early
            if (
              meta.approved === false ||
              meta.isApproved === false ||
              (typeof meta.status === 'string' &&
                meta.status.toLowerCase() === 'pending')
            ) {
              continue;
            }
            // If metadata explicitly indicates approved, we can try to fetch and push (still fetch to return full meeting)
            // fallthrough to fetch actual meeting node
          }

          // Try event-based meeting node first
          const fullMeetingSnap = await rtdb
            .ref(`/meetings/${eventIdKey}/${meetingId}`)
            .once('value');
          if (fullMeetingSnap.exists()) {
            pushMeetingIfApproved(meetingId, eventIdKey, fullMeetingSnap.val());
            continue;
          }

          // If not found under /meetings/{eventId}/{meetingId}, maybe it's stored as standalone
          const standaloneSnap = await rtdb
            .ref(`/meetings_standalone/${meetingId}`)
            .once('value');
          if (standaloneSnap.exists()) {
            pushMeetingIfApproved(meetingId, null, standaloneSnap.val());
            continue;
          }

          // Final fallback: sometimes stored under /meetings/{meetingId} (rare)
          const altSnap = await rtdb.ref(`/meetings/${meetingId}`).once('value');
          if (altSnap.exists()) {
            pushMeetingIfApproved(meetingId, null, altSnap.val());
            continue;
          }

          // Not found anywhere — skip
        } catch (err) {
          console.error(
            'Error fetching meeting',
            eventIdKey,
            meetingId,
            err.message || err
          );
        }
      }
    }

    return addCORS(NextResponse.json({ meetings: allMeetings }, { status: 200 }));
  } catch (e) {
    return addCORS(
      NextResponse.json(
        { error: e.message || 'Server error' },
        { status: e.status || 500 }
      )
    );
  }
}
