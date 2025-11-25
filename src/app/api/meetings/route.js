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
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

    // Helper to fetch and push meeting into allMeetings
    const pushMeeting = (meetingId, eventIdForRecord, fullMeeting) => {
      // normalize eventId for standalone to null
      const normalizedEventId = eventIdForRecord === 'standalone' || eventIdForRecord === null || eventIdForRecord === 'undefined' ? null : eventIdForRecord;
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
            const snap = await rtdb.ref(`/meetings_standalone/${meetingId}`).get();
            if (snap.exists()) pushMeeting(meetingId, null, snap.val());
            else {
              // fallback: maybe was stored under /meetings/<someEvent>/<meetingId>
              const fallbackSnap = await rtdb.ref(`/meetings/${meetingId}`).get();
              if (fallbackSnap.exists()) pushMeeting(meetingId, null, fallbackSnap.val());
            }
          } catch (err) {
            // ignore single-item failure, continue
            console.error('Error fetching standalone meeting', meetingId, err.message || err);
          }
        }
        continue;
      }

      // Case B: eventIdKey is some event id (normal grouped meetings)
      // eventMeetings is an object of meetingId -> metadata
      // But there are edge cases: sometimes there's an 'undefined' key or direct meetingId keys
      if (eventIdKey === 'undefined') {
        // treat as standalone: attempt to fetch from meetings_standalone using inner IDs
        for (const meetingId of Object.keys(eventMeetings)) {
          try {
            const snap = await rtdb.ref(`/meetings_standalone/${meetingId}`).get();
            if (snap.exists()) pushMeeting(meetingId, null, snap.val());
            else {
              // fallback: try /meetings/undefined/meetingId (if present)
              const fallbackSnap = await rtdb.ref(`/meetings/undefined/${meetingId}`).get();
              if (fallbackSnap.exists()) pushMeeting(meetingId, null, fallbackSnap.val());
            }
          } catch (err) {
            console.error('Error fetching undefined-group meeting', meetingId, err.message || err);
          }
        }
        continue;
      }

      // General case: eventIdKey is an event id
      for (const meetingId of Object.keys(eventMeetings)) {
        try {
          // Try event-based meeting node first
          const fullMeetingSnap = await rtdb.ref(`/meetings/${eventIdKey}/${meetingId}`).once('value');
          if (fullMeetingSnap.exists()) {
            pushMeeting(meetingId, eventIdKey, fullMeetingSnap.val());
            continue;
          }

          // If not found under /meetings/{eventId}/{meetingId}, maybe it's stored as standalone
          const standaloneSnap = await rtdb.ref(`/meetings_standalone/${meetingId}`).once('value');
          if (standaloneSnap.exists()) {
            pushMeeting(meetingId, null, standaloneSnap.val());
            continue;
          }

          // Final fallback: sometimes stored under /meetings/{meetingId} (rare)
          const altSnap = await rtdb.ref(`/meetings/${meetingId}`).once('value');
          if (altSnap.exists()) {
            pushMeeting(meetingId, null, altSnap.val());
            continue;
          }

          // Not found anywhere — skip
        } catch (err) {
          console.error('Error fetching meeting', eventIdKey, meetingId, err.message || err);
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
