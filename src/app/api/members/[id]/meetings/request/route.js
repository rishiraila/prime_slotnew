// src/app/api/members/[id]/meetings/request/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';
const ADMIN_COOKIE = 'admin_session';
const JWT_COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
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

const Schema = z.object({
  eventId: z.string().min(1).optional(),
  aId: z.string().min(1),
  scheduledAt: z.preprocess(
    (v) => (typeof v === 'string' ? Date.parse(v) : Number(v)),
    z.number().int().positive()
  ),
  durationMin: z.number().int().positive().default(30),
  place: z.string().optional().default(''),
  topic: z.string().optional().default(''),
});

export async function POST(req, context) {
  try {
    const params = await context.params;
    const user = await requireUser(req);

    // recipient from URL (bId)
    const rawBId = params?.id;
    const bId = String(rawBId ?? '').trim();

    const body = await req.json();
    const parsed = Schema.parse(body);

    // sanitise eventId: accept only a non-empty string that is NOT "undefined" / "null"
    let eventIdRaw = parsed.eventId;
    const hasEventId =
      typeof eventIdRaw === 'string' &&
      eventIdRaw.trim().length > 0 &&
      eventIdRaw.trim().toLowerCase() !== 'undefined' &&
      eventIdRaw.trim().toLowerCase() !== 'null';
    const eventId = hasEventId ? eventIdRaw.trim() : null;

    const aId = String(parsed.aId ?? '').trim();

    if (
      !aId ||
      !bId ||
      aId.toLowerCase() === 'undefined' ||
      bId.toLowerCase() === 'undefined'
    ) {
      return addCORS(
        NextResponse.json(
          { error: 'Missing valid aId or bId', debug: { aId, bId } },
          { status: 400 }
        )
      );
    }

    const now = Date.now();
    const scheduledAt = Number(parsed.scheduledAt);
    const durationMin = parsed.durationMin;
    const endTime = scheduledAt + (durationMin * 60 * 1000); // convert min->ms

    // If eventId present (valid), use existing event-based flow (unchanged)
    if (eventId) {
      // auto-add both members to event if missing
      const [aIn, bIn] = await Promise.all([
        rtdb.ref(`/eventMembers/${eventId}/${aId}`).get(),
        rtdb.ref(`/eventMembers/${eventId}/${bId}`).get(),
      ]);

      if (!aIn.exists()) {
        await rtdb.ref(`/eventMembers/${eventId}/${aId}`).set({
          status: 'Active',
          addedAt: now,
          source: 'auto-request',
        });
      }

      if (!bIn.exists()) {
        await rtdb.ref(`/eventMembers/${eventId}/${bId}`).set({
          status: 'Active',
          addedAt: now,
          source: 'auto-request',
        });
      }

      const newMeetingRef = rtdb.ref(`/meetings/${eventId}`).push();
      const meetingId = newMeetingRef.key;

      const meeting = {
        aId,
        bId,
        eventId,
        scheduledAt,
        durationMin,
        endTime,
        mode: 'inperson',
        place: parsed.place,
        topic: parsed.topic,
        notes: '',
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        createdBy: user.uid || aId,
      };

      const updates = {};
      updates[`/meetings/${eventId}/${meetingId}`] = meeting;

      updates[`/memberMeetings/${aId}/${eventId}/${meetingId}`] = {
        eventId,
        meetingId,
        scheduledAt: meeting.scheduledAt,
        durationMin: meeting.durationMin,
        endTime: meeting.endTime,
        status: meeting.status,
        otherPartyId: bId,
        topic: meeting.topic,
      };
      updates[`/memberMeetings/${bId}/${eventId}/${meetingId}`] = {
        eventId,
        meetingId,
        scheduledAt: meeting.scheduledAt,
        durationMin: meeting.durationMin,
        endTime: meeting.endTime,
        status: meeting.status,
        otherPartyId: aId,
        topic: meeting.topic,
      };

      const notifRef = rtdb.ref(`/notifications/${bId}`).push();
      updates[`/notifications/${bId}/${notifRef.key}`] = {
        type: 'meeting_request',
        meetingId,
        eventId,
        from: aId,
        to: bId,
        createdAt: now,
        read: false,
      };

      // Add contacts (non-destructive)
      updates[`/userContacts/${aId}/${bId}`] = { addedAt: now, meetingId };
      updates[`/userContacts/${bId}/${aId}`] = { addedAt: now, meetingId };

      await rtdb.ref().update(updates);
      return addCORS(NextResponse.json({ id: meetingId, ok: true }, { status: 201 }));
    }

    // --- NO valid eventId → create a standalone meeting (safe, no /meetings/undefined) ---
    const newStandRef = rtdb.ref('/meetings_standalone').push();
    const meetingId = newStandRef.key;
    const meetingPath = `/meetings_standalone/${meetingId}`;

    const meeting = {
      aId,
      bId,
      eventId: null,
      scheduledAt,
      durationMin,
      endTime,
      mode: 'inperson',
      place: parsed.place,
      topic: parsed.topic,
      notes: '',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      createdBy: user.uid || aId,
    };

    const updates = {};
    updates[meetingPath] = meeting;

    // index under memberMeetings -> standalone
    updates[`/memberMeetings/${aId}/standalone/${meetingId}`] = {
      meetingId,
      scheduledAt,
      durationMin,
      endTime,
      status: meeting.status,
      otherPartyId: bId,
      topic: meeting.topic,
    };
    updates[`/memberMeetings/${bId}/standalone/${meetingId}`] = {
      meetingId,
      scheduledAt,
      durationMin,
      endTime,
      status: meeting.status,
      otherPartyId: aId,
      topic: meeting.topic,
    };

    // notification to recipient (eventId null)
    const notifRef = rtdb.ref(`/notifications/${bId}`).push();
    updates[`/notifications/${bId}/${notifRef.key}`] = {
      type: 'meeting_request',
      meetingId,
      eventId: null,
      from: aId,
      to: bId,
      createdAt: now,
      read: false,
    };

    // contacts (non-destructive)
    updates[`/userContacts/${aId}/${bId}`] = { addedAt: now, meetingId };
    updates[`/userContacts/${bId}/${aId}`] = { addedAt: now, meetingId };

    await rtdb.ref().update(updates);
    return addCORS(NextResponse.json({ id: meetingId, ok: true }, { status: 201 }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}
