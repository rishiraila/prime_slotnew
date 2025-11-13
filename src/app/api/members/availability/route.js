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

const BodySchema = z.object({
  aId: z.string().min(1),
  bId: z.string().min(1),
  from: z.preprocess(v => Number(v), z.number().int().positive()),
  to: z.preprocess(v => Number(v), z.number().int().positive()),
  minDurationMin: z.number().int().positive().optional().default(30),
  eventId: z.string().optional()
});

function mergeIntervals(intervals = []) {
  if (!intervals.length) return [];
  intervals.sort((a,b) => a.start - b.start);
  const out = [];
  let cur = { ...intervals[0] };
  for (let i = 1; i < intervals.length; i++) {
    const it = intervals[i];
    if (it.start <= cur.end) cur.end = Math.max(cur.end, it.end);
    else {
      out.push(cur);
      cur = { ...it };
    }
  }
  out.push(cur);
  return out;
}

export async function POST(req) {
  try {
    await requireSession();
    const body = await req.json();
    const { aId, bId, from, to, minDurationMin, eventId } = BodySchema.parse(body);

    const meetingsRoot = eventId ? `/meetings/${eventId}` : '/meetings';
    const snap = await rtdb.ref(meetingsRoot).get();
    const busy = [];

    if (snap.exists()) {
      const val = snap.val();
      if (eventId) {
        for (const [mId, m] of Object.entries(val || {})) {
          if (!m || m.status === 'canceled') continue;
          if (m.aId === aId || m.bId === aId || m.aId === bId || m.bId === bId) {
            const start = Number(m.scheduledAt || 0);
            const end = start + ((m.durationMin || minDurationMin) * 60 * 1000);
            if (end > from && start < to) busy.push({ start: Math.max(start, from), end: Math.min(end, to) });
          }
        }
      } else {
        // root: /meetings -> { eventId: { meetingId: {...} } }
        for (const [evId, block] of Object.entries(val)) {
          for (const [mId, m] of Object.entries(block || {})) {
            if (!m || m.status === 'canceled') continue;
            if (m.aId === aId || m.bId === aId || m.aId === bId || m.bId === bId) {
              const start = Number(m.scheduledAt || 0);
              const end = start + ((m.durationMin || minDurationMin) * 60 * 1000);
              if (end > from && start < to) busy.push({ start: Math.max(start, from), end: Math.min(end, to) });
            }
          }
        }
      }
    }

    const mergedBusy = mergeIntervals(busy);
    const minMs = minDurationMin * 60 * 1000;
    const free = [];
    let cursor = from;
    for (const iv of mergedBusy) {
      if (iv.start - cursor >= minMs) free.push({ start: cursor, end: iv.start });
      cursor = Math.max(cursor, iv.end);
    }
    if (to - cursor >= minMs) free.push({ start: cursor, end: to });

    return addCORS(NextResponse.json({ aId, bId, from, to, busy: mergedBusy, free }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}
