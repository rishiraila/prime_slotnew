export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';

const COOKIE = 'admin_session';

async function requireSession() {
  const jar = await cookies();
  const session = jar.get(COOKIE)?.value;
  if (!session) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return adminAuth.verifySessionCookie(session, true);
}

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

/* -------- GET /api/events/:id/members ---------- */
export async function GET(_req, ctx) {
  try {
    await requireSession();
    const { id: eventId } = await ctx.params;

    const memberIdsSnap = await rtdb.ref(`/eventMembers/${eventId}`).get();
    if (!memberIdsSnap.exists()) return addCORS(NextResponse.json({ records: [] }));

    const memberPromises = Object.keys(memberIdsSnap.val()).map(memberId => rtdb.ref(`/members/${memberId}`).get().then(snap => ({ id: memberId, ...snap.val() })));
    const records = await Promise.all(memberPromises);

    return addCORS(NextResponse.json({ records }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}