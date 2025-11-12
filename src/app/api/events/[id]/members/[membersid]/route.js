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
  await adminAuth.verifySessionCookie(session, true);
}
function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS(){ return addCORS(NextResponse.json({}, { status: 204 })); }

const EventMemberPatch = z.object({
  status: z.string().optional(),
  role: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  seat: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export async function GET(_req, ctx) {
  try {
    await requireSession();
    const { id: eventId, memberId } = await ctx.params;   // <-- await params

    const [pSnap, emSnap] = await Promise.all([
      rtdb.ref(`/members/${memberId}`).get(),
      rtdb.ref(`/eventMembers/${eventId}/${memberId}`).get(),
    ]);
    if (!pSnap.exists()) return addCORS(NextResponse.json({ error: 'Member not found' }, { status: 404 }));

    return addCORS(NextResponse.json({
      member: { id: memberId, ...pSnap.val() },
      eventData: emSnap.val() || null
    }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}

export async function PATCH(req, ctx) {
  try {
    await requireSession();
    const { id: eventId, memberId } = await ctx.params;   // <-- await params
    const body = await req.json();
    const input = EventMemberPatch.parse(body);

    const path = `/eventMembers/${eventId}/${memberId}`;
    const snap = await rtdb.ref(path).get();
    if (!snap.exists()) return addCORS(NextResponse.json({ error: 'Not linked to this event' }, { status: 404 }));

    const updates = { ...input };
    if (updates.tags && !Array.isArray(updates.tags)) updates.tags = [];
    await rtdb.ref(path).update(updates);

    return addCORS(NextResponse.json({ ok: true }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}

export async function DELETE(_req, ctx) {
  try {
    await requireSession();
    const { id: eventId, memberId } = await ctx.params;   // <-- await params
    await rtdb.ref(`/eventMembers/${eventId}/${memberId}`).set(null);
    await rtdb.ref(`/memberEvents/${memberId}/${eventId}`).set(null);
    return addCORS(NextResponse.json({ ok: true }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}
