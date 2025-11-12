export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import { z } from 'zod';

const COOKIE = 'admin_session';

async function requireSession() {
  const jar = await cookies();
  const session = jar.get(COOKIE)?.value;
  if (!session) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return adminAuth.verifySessionCookie(session, true);
}

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS() { return addCORS(NextResponse.json({}, { status: 204 })); }

// validate body coming from app
const CreateSchema = z.object({
  aId: z.string().min(1),                // organizerId
  bId: z.string().min(1),                // participantId
  scheduledAt: z.union([z.number().int().positive(), z.string().min(1)]), // ISO or ms
  durationMin: z.number().int().positive().default(30),
  mode: z.enum(['inperson','online']).default('inperson'),
  place: z.string().optional().default(''),
  topic: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  status: z.enum(['scheduled','completed','canceled']).default('scheduled'),
  referralsGivenByA: z.number().int().min(0).default(0),
  referralsGivenByB: z.number().int().min(0).default(0),
  businessGivenByA: z.number().int().min(0).default(0),
  businessGivenByB: z.number().int().min(0).default(0),
});

const toMs = v => (typeof v === 'number' ? v : Date.parse(v));

/* -------- GET /api/events/:id/meetings?page=&pageSize=&status=&memberId= ---------- */
export async function GET(req, ctx) {
  try {
    await requireSession();
    const { id: eventId } = ctx.params;

    const u = new URL(req.url);
    const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(u.searchParams.get('pageSize') || '20', 10)));
    const status = u.searchParams.get('status') || '';
    const memberId = u.searchParams.get('memberId') || '';

    const snap = await rtdb.ref(`/meetings/${eventId}`).get();
    const all = snap.exists()
      ? Object.entries(snap.val()).map(([id, m]) => ({ id, ...m }))
      : [];

    let recs = all;
    if (status) recs = recs.filter(r => (r.status || '').toLowerCase() === status.toLowerCase());
    if (memberId) recs = recs.filter(r => r.aId === memberId || r.bId === memberId);

    recs.sort((a,b) => (b.scheduledAt||0) - (a.scheduledAt||0));

    const total = recs.length;
    const start = (page - 1) * pageSize;
    const records = recs.slice(start, start + pageSize);

    return addCORS(NextResponse.json({ page, pageSize, total, records }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}

/* ---------------- POST /api/events/:id/meetings ---------------- */
export async function POST(req, ctx) {
  try {
    const user = await requireSession();
    const { id: eventId } = ctx.params;

    const body = await req.json();
    const input = CreateSchema.parse(body);
    const now = Date.now();
    const when = toMs(input.scheduledAt);

    // Validate both members belong to this event
    const [aIn, bIn] = await Promise.all([
      rtdb.ref(`/eventMembers/${eventId}/${input.aId}`).get(),
      rtdb.ref(`/eventMembers/${eventId}/${input.bId}`).get(),
    ]);
    if (!aIn.exists() || !bIn.exists()) {
      const who = !aIn.exists() ? input.aId : input.bId;
      return addCORS(NextResponse.json({ error: `member ${who} not in event ${eventId}` }, { status: 400 }));
    }

    // Write under /meetings/{eventId}/{meetingId}
    const ref = await rtdb.ref(`/meetings/${eventId}`).push({
      aId: input.aId,
      bId: input.bId,
      scheduledAt: when,
      durationMin: input.durationMin,
      mode: input.mode,
      place: input.place,
      topic: input.topic,
      notes: input.notes,
      status: input.status,
      referralsGivenByA: input.referralsGivenByA,
      referralsGivenByB: input.referralsGivenByB,
      businessGivenByA: input.businessGivenByA,
      businessGivenByB: input.businessGivenByB,
      eventId,
      createdAt: now,
      updatedAt: now,
      createdBy: user.uid || input.aId,
      outcome: '',
    });

    return addCORS(NextResponse.json({ id: ref.key }, { status: 201 }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}
