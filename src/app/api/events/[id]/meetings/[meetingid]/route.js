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
  res.headers.set('Access-Control-Allow-Methods', 'GET,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS() { return addCORS(NextResponse.json({}, { status: 204 })); }

const PatchSchema = z.object({
  status: z.enum(['scheduled','completed','canceled']).optional(),
  notes: z.string().optional(),
  outcome: z.string().optional(),
  referralsGivenByA: z.number().int().min(0).optional(),
  referralsGivenByB: z.number().int().min(0).optional(),
  businessGivenByA: z.number().int().min(0).optional(),
  businessGivenByB: z.number().int().min(0).optional(),
  scheduledAt: z.union([z.number().int().positive(), z.string().min(1)]).optional(),
  durationMin: z.number().int().positive().optional(),
  place: z.string().optional(),
  topic: z.string().optional(),
  mode: z.enum(['inperson','online']).optional(),
});

const toMs = v => (typeof v === 'number' ? v : Date.parse(v));

/* ------------- GET /api/events/:id/meetings/:meetingId ------------- */
export async function GET(_req, ctx) {
  try {
    await requireSession();
    const { id: eventId, meetingId } = ctx.params;
    const snap = await rtdb.ref(`/meetings/${eventId}/${meetingId}`).get();
    if (!snap.exists()) return addCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }));
    return addCORS(NextResponse.json({ id: meetingId, ...snap.val() }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}

/* ------------- PATCH /api/events/:id/meetings/:meetingId ------------- */
export async function PATCH(req, ctx) {
  try {
    await requireSession();
    const { id: eventId, meetingId } = ctx.params;
    const body = await req.json();
    const input = PatchSchema.parse(body);

    const path = `/meetings/${eventId}/${meetingId}`;
    const exist = await rtdb.ref(path).get();
    if (!exist.exists()) return addCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }));

    const updates = { ...input, updatedAt: Date.now() };
    if (updates.scheduledAt !== undefined) updates.scheduledAt = toMs(updates.scheduledAt);
    await rtdb.ref(path).update(updates);

    return addCORS(NextResponse.json({ ok: true }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}

/* ------------- DELETE /api/events/:id/meetings/:meetingId ------------- */
export async function DELETE(_req, ctx) {
  try {
    await requireSession();
    const { id: eventId, meetingId } = ctx.params;
    await rtdb.ref(`/meetings/${eventId}/${meetingId}`).set(null);
    return addCORS(NextResponse.json({ ok: true }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}
