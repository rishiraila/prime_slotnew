export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';

const ADMIN_COOKIE = 'admin_session';
const JWT_COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';

async function requireUser(req) {
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

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

/* -------- POST /api/members/availability ---------- */
export async function POST(req) {
  try {
    await requireUser(req);
    const body = await req.json();
    const { aId, bId, eventId } = body;

    if (!aId || !bId) {
      return addCORS(NextResponse.json({ error: 'aId and bId required' }, { status: 400 }));
    }

    // Fetch meetings for the event
    let meetings = [];
    if (eventId) {
      const snap = await rtdb.ref(`/meetings/${eventId}`).get();
      if (snap.exists()) {
        meetings = Object.entries(snap.val()).map(([id, m]) => ({ id, ...m }));
      }
    } else {
      // If no eventId, fetch from all events (inefficient, but for completeness)
      const eventsSnap = await rtdb.ref('/events').get();
      if (eventsSnap.exists()) {
        const eventIds = Object.keys(eventsSnap.val());
        for (const eid of eventIds) {
          const snap = await rtdb.ref(`/meetings/${eid}`).get();
          if (snap.exists()) {
            const ms = Object.entries(snap.val()).map(([id, m]) => ({ id, eventId: eid, ...m }));
            meetings.push(...ms);
          }
        }
      }
    }

    // Filter meetings involving aId or bId
    const relevantMeetings = meetings.filter(m => m.aId === aId || m.bId === aId || m.aId === bId || m.bId === bId);

    // Collect unique member IDs
    const memberIds = new Set([aId, bId]);
    relevantMeetings.forEach(m => {
      memberIds.add(m.aId);
      memberIds.add(m.bId);
    });

    // Fetch member names
    const memberPromises = Array.from(memberIds).map(id => rtdb.ref(`/members/${id}`).get().then(snap => ({ id, name: snap.val()?.name || 'Unknown' })));
    const members = await Promise.all(memberPromises);
    const memberMap = {};
    members.forEach(m => memberMap[m.id] = m.name);

    // Format as events
    const events = relevantMeetings.map(meeting => {
      const start = meeting.scheduledAt;
      const end = start + (meeting.durationMin || 30) * 60000; // default 30 min
      const otherId = meeting.aId === aId ? meeting.bId : meeting.aId;
      const title = `Meeting with ${memberMap[otherId] || 'Unknown'}`;
      return {
        id: meeting.id,
        title,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        extendedProps: {
          meetingId: meeting.id,
          eventId: meeting.eventId || eventId,
          aId: meeting.aId,
          bId: meeting.bId,
        },
      };
    });

    return addCORS(NextResponse.json({ events }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}
