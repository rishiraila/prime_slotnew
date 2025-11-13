export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import { z } from 'zod';

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
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

const QuerySchema = z.object({
  from: z.preprocess(v => v ? Number(v) : undefined, z.number().int().positive()).optional(),
  to: z.preprocess(v => v ? Number(v) : undefined, z.number().int().positive()).optional(),
  eventId: z.string().optional()
});

export async function GET(req, ctx) {
  try {
    await requireSession();

    const { memberId } = ctx.params;
    const q = Object.fromEntries(new URL(req.url).searchParams.entries());
    const input = QuerySchema.parse(q);
    const from = input.from ?? (Date.now() - 1000*60*60*24*7);
    const to = input.to ?? (Date.now() + 1000*60*60*24*30);

    // read member index
    const root = input.eventId ? `/memberMeetings/${memberId}/${input.eventId}` : `/memberMeetings/${memberId}`;
    const snap = await rtdb.ref(root).get();
    if (!snap.exists()) return addCORS(NextResponse.json({ memberId, from, to, busy: [], free: [{ start: from, end: to }] }));

    // gather meeting metadata from index then optionally fetch details
    const raw = snap.val();
    const meetings = [];
    // raw shape: { eventId: { meetingId: {...} } } if root is memberMeetings/{memberId}
    if (!input.eventId) {
      for (const [eventId, block] of Object.entries(raw || {})) {
        for (const [meetingId, item] of Object.entries(block || {})) {
          meetings.push({ eventId, meetingId, ...item });
        }
      }
    } else {
      for (const [meetingId, item] of Object.entries(raw || {})) {
        meetings.push({ eventId: input.eventId, meetingId, ...item });
      }
    }

    // filter by range and return busy intervals (include pending and approved as busy)
    const busy = meetings
      .filter(m => m.status === 'pending' || m.status === 'approved' || m.status === 'scheduled')
      .map(m => ({
        id: m.meetingId,
        eventId: m.eventId,
        start: Number(m.scheduledAt || 0),
        end: Number((m.scheduledAt || 0) + ((m.durationMin || 30) * 60 * 1000)),
        status: m.status,
        otherPartyId: m.otherPartyId,
        topic: m.topic || ''
      }))
      .filter(i => i.end > from && i.start < to)
      .sort((a,b) => a.start - b.start);

    // compute free intervals by finding gaps in busy periods
    const free = [];
    let cursor = from;
    for (const iv of busy) {
      if (iv.start > cursor) free.push({ start: cursor, end: iv.start });
      cursor = Math.max(cursor, iv.end);
    }
    if (to > cursor) free.push({ start: cursor, end: to });

    return addCORS(NextResponse.json({ memberId, from, to, busy, free }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}
