// src/app/api/members/availability/route.js
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

    let meetings = [];

    if (eventId) {
      // If eventId provided, fetch meetings under that event
      const snap = await rtdb.ref(`/meetings/${eventId}`).get();
      if (snap.exists()) {
        meetings = Object.entries(snap.val()).map(([id, m]) => ({ id, eventId, ...m }));
      }
    } else {
      // 1) collect meetings under /events -> /meetings/{eventId}
      const eventsSnap = await rtdb.ref('/events').get();
      const eventsIdsFromEvents = eventsSnap.exists() ? Object.keys(eventsSnap.val()) : [];

      // 2) collect eventIds under /meetings (some eventIds may not be in /events)
      const meetingsSnap = await rtdb.ref('/meetings').get();
      const eventIdsFromMeetings = meetingsSnap.exists() ? Object.keys(meetingsSnap.val()) : [];

      const allEventIds = Array.from(new Set([...eventsIdsFromEvents, ...eventIdsFromMeetings]));

      for (const eid of allEventIds) {
        const snap = await rtdb.ref(`/meetings/${eid}`).get();
        if (snap.exists()) {
          const ms = Object.entries(snap.val()).map(([id, m]) => ({ id, eventId: eid, ...m }));
          meetings.push(...ms);
        }
      }

      // 3) also include standalone meetings
      const standaloneSnap = await rtdb.ref('/meetings_standalone').get();
      if (standaloneSnap.exists()) {
        const standaloneList = Object.entries(standaloneSnap.val()).map(([id, m]) => ({ id, eventId: null, ...m }));
        meetings.push(...standaloneList);
      }
    }

    // Filter meetings involving either member
    const relevantMeetings = meetings.filter(
      (m) => m.aId === aId || m.bId === aId || m.aId === bId || m.bId === bId
    );

    // Collect unique member IDs used in meetings to fetch human names
    const memberIds = new Set([aId, bId]);
    relevantMeetings.forEach((m) => {
      if (m.aId) memberIds.add(m.aId);
      if (m.bId) memberIds.add(m.bId);
    });

    // Fetch member names (try multiple name fields)
    const memberPromises = Array.from(memberIds).map((id) =>
      rtdb.ref(`/members/${id}`).get().then((snap) => {
        const v = snap.exists() ? snap.val() : null;
        let name = 'Unknown';
        if (v) name = v.name || v.fullName || v.businessName || v.fullname || 'Unknown';
        return { id, name };
      })
    );
    const members = await Promise.all(memberPromises);
    const memberMap = {};
    members.forEach((m) => (memberMap[m.id] = m.name));

    // Format as calendar events
    const events = relevantMeetings.map((meeting) => {
      // meeting may have `scheduledAt` in ms (recommended)
      const start = Number(meeting.scheduledAt) || 0;
      const end = start + (Number(meeting.durationMin) || 30) * 60 * 1000; // minutes -> ms
      const otherId = meeting.aId === aId ? meeting.bId : meeting.aId;
      const title = `Meeting with ${memberMap[otherId] || 'Unknown'}`;

      return {
        id: meeting.id,
        title,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        extendedProps: {
          meetingId: meeting.id,
          eventId: meeting.eventId === undefined ? null : meeting.eventId,
          aId: meeting.aId,
          bId: meeting.bId,
          status: meeting.status || 'pending',
        },
      };
    });

    return addCORS(NextResponse.json({ events }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}
