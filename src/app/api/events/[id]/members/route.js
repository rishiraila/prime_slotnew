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

export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

const PatchMemberSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  mob: z.string().optional(),
  chaptername: z.string().optional(),
  businessman: z.string().optional(),
  categorytype: z.string().optional(),
  status: z.string().optional(),
});

/* ------------- PATCH /api/events/:id/members/:memberid ------------- */
export async function PATCH(req, { params }) {
  try {
    await requireSession();
    const { id: eventId, memberid } = params;
    const body = await req.json();
    const updates = PatchMemberSchema.parse(body);

    await rtdb.ref(`/eventMembers/${eventId}/${memberid}`).update(updates);
    return addCORS(NextResponse.json({ ok: true }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}

/* ------------- DELETE /api/events/:id/members/:memberid ------------- */
export async function DELETE(_req, { params }) {
  try {
    await requireSession();
    const { id: eventId, memberid } = params;
    await rtdb.ref(`/eventMembers/${eventId}/${memberid}`).remove();
    return addCORS(NextResponse.json({ ok: true }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}