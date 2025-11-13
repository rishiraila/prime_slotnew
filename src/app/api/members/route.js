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
export async function OPTIONS() { return addCORS(NextResponse.json({}, { status: 204 })); }

/* -------- GET /api/members ---------- */
export async function GET(_req) {
  try {
    await requireSession();
    const snap = await rtdb.ref('/members').get();
    const records = snap.exists()
      ? Object.entries(snap.val()).map(([id, data]) => ({ id, ...data }))
      : [];
    return addCORS(NextResponse.json({ records }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}
