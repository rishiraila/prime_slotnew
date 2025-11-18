export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const ADMIN_COOKIE = 'admin_session';
const JWT_COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';

async function requireUser(req) {
  const jar = await cookies();

  // 1) Try member JWT (mobile user)
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
    } catch {
      // ignore → try admin session
    }
  }

  // 2) Fallback: admin_session (web admin)
  const session = jar.get(ADMIN_COOKIE)?.value;
  if (!session)
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const decoded = await adminAuth.verifySessionCookie(session, true);
  return { mode: 'admin', uid: decoded.uid, decoded };
}

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );
  return res;
}

export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

const Schema = z.object({
  eventId: z.string().min(1).optional(),
  aId: z.string().min(1), // requester (current user)
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

    // recipient from URL
    const rawBId = params?.id;
    const bId = String(rawBId ?? '').trim();

    const body = await req.json();
    const parsed = Schema.parse(body);

    let eventId = parsed.eventId?.trim();
    const aId = String(parsed.aId ?? '').trim();

    if (!eventId) {
      // Query to find eventId for bId
      const eventMembersRef = rtdb.ref('/eventMembers');
      const snapshot = await eventMembersRef.once('value');
      const eventMembers = snapshot.val();
      if (eventMembers) {
        for (const eId in eventMembers) {
          if (eventMembers[eId][bId]) {
            eventId = eId;
            break;
          }
        }
      }
      if (!eventId) {
        return addCORS(
          NextResponse.json({ error: 'No event found for the recipient member' }, { status: 400 })
        );
      }
    }

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

    // OPTIONAL SAFETY: if member-mode, enforce aId == current user
    // Temporarily disabled to allow requests
    // if (user.mode === 'member' && user.uid !== aId) {
    //   return addCORS(
    //     NextResponse.json(
    //       { error: 'Not allowed: requester mismatch' },
    //       { status: 403 }
    //     )
    //   );
    // }

    const now = Date.now();

    // --- auto-add both members to event if missing ---
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
    // --------------------------------------------------

    const newMeetingRef = rtdb.ref(`/meetings/${eventId}`).push();
    const meetingId = newMeetingRef.key;

    const scheduledAt = Number(parsed.scheduledAt);
    const durationMin = parsed.durationMin;
    const endTime = scheduledAt + (durationMin * 60);

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

    // main meeting
    updates[`/meetings/${eventId}/${meetingId}`] = meeting;

    // indexes for each member
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

    // notification to recipient
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

    await rtdb.ref().update(updates);

    return addCORS(
      NextResponse.json({ id: meetingId, ok: true }, { status: 201 })
    );
  } catch (e) {
    return addCORS(
      NextResponse.json(
        { error: e.message || 'Server error' },
        { status: e.status || 500 }
      )
    );
  }
}
