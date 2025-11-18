export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';

const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';
const ADMIN_COOKIE = 'admin_session';
const JWT_COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';

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

  // 1) try JWT
  let token = null;
  const auth =
    req.headers.get('authorization') ||
    req.headers.get('Authorization') ||
    '';
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice('Bearer '.length).trim();
  }
  if (!token) {
    token = jar.get(JWT_COOKIE)?.value || null;
  }

  if (token && JWT_SECRET) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { mode: 'member', uid: payload.sub, payload };
    } catch (e) {
      // ignore, try admin
    }
  }

  // 2) fallback: admin_session
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

    // For each eventId, get all meetings for the member
    for (const eventId in memberMeetings) {
      const eventMeetings = memberMeetings[eventId];
      for (const meetingId in eventMeetings) {
        // Fetch full meeting details from /meetings/${eventId}/${meetingId}
        const fullMeetingSnap = await rtdb.ref(`/meetings/${eventId}/${meetingId}`).once('value');
        if (fullMeetingSnap.exists()) {
          const fullMeeting = fullMeetingSnap.val();
          allMeetings.push({
            meetingId,
            eventId,
            ...fullMeeting,
          });
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
