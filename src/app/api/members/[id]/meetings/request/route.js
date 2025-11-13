export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import { z } from 'zod';

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS() { return addCORS(NextResponse.json({}, { status: 204 })); }

async function requireSession() {
  const jar = await cookies();
  const session = jar.get('admin_session')?.value;
  if (!session) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return adminAuth.verifySessionCookie(session, true);
}

const Schema = z.object({
  eventId: z.string().min(1),
  aId: z.string().min(1),           // requester
  scheduledAt: z.preprocess(v => typeof v === 'string' ? Date.parse(v) : Number(v), z.number().int().positive()),
  durationMin: z.number().int().positive().default(30),
  mode: z.enum(['inperson','online']).default('inperson'),
  place: z.string().optional().default(''),
  topic: z.string().optional().default(''),
  notes: z.string().optional().default('')
});

export async function POST(req, ctx) {
  try {
    const user = await requireSession();
    const { id: bId } = await ctx.params; // recipient
    const body = await req.json();
    const data = Schema.parse(body);
    if (!data.eventId || data.eventId === 'undefined') {
    return addCORS(NextResponse.json({ error: 'Missing valid eventId' }, { status: 400 }));
    }
    if (!data.aId || !bId || data.aId === 'undefined' || bId === 'undefined') {
      return addCORS(NextResponse.json({ error: 'Missing valid aId or bId' }, { status: 400 }));
    }

    // validation: both members must belong to event
    const [aIn, bIn] = await Promise.all([
      rtdb.ref(`/eventMembers/${data.eventId}/${data.aId}`).get(),
      rtdb.ref(`/eventMembers/${data.eventId}/${bId}`).get(),
    ]);
    if (!aIn.exists() || !bIn.exists()) {
      const who = !aIn.exists() ? data.aId : bId;
      return addCORS(NextResponse.json({ error: `member ${who} not in event ${data.eventId}` }, { status: 400 }));
    }

    const now = Date.now();
    // prepare meeting payload (key will be generated)
    const newMeetingRef = rtdb.ref(`/meetings/${data.eventId}`).push();
    const meetingId = newMeetingRef.key;
    const meeting = {
      aId: data.aId,
      bId,
      scheduledAt: Number(data.scheduledAt),
      durationMin: data.durationMin,
      mode: data.mode,
      place: data.place,
      topic: data.topic,
      notes: data.notes,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      createdBy: user.uid || data.aId,
    };

    // build multi-path update
    const updates = {};
    // write meeting
    updates[`/meetings/${data.eventId}/${meetingId}`] = meeting;
    // write member indexes (under eventId to keep grouped by event)
    updates[`/memberMeetings/${data.aId}/${data.eventId}/${meetingId}`] = {
      eventId: data.eventId, meetingId, scheduledAt: meeting.scheduledAt, durationMin: meeting.durationMin,
      status: meeting.status, otherPartyId: bId, topic: meeting.topic
    };
    updates[`/memberMeetings/${bId}/${data.eventId}/${meetingId}`] = {
      eventId: data.eventId, meetingId, scheduledAt: meeting.scheduledAt, durationMin: meeting.durationMin,
      status: meeting.status, otherPartyId: data.aId, topic: meeting.topic
    };
    // push notification to recipient
    const notifRef = rtdb.ref(`/notifications/${bId}`).push();
    updates[`/notifications/${bId}/${notifRef.key}`] = {
      type: 'meeting_request',
      meetingId,
      eventId: data.eventId,
      from: data.aId,
      to: bId,
      createdAt: now,
      read: false,
    };

    // commit atomically
    await rtdb.ref().update(updates);

    return addCORS(NextResponse.json({ id: meetingId, ok: true }, { status: 201 }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}
