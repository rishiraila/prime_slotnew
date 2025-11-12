// src/app/api/events/summary/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';

const COOKIE = 'admin_session';

async function requireSession() {
  const jar = await cookies();
  const session = jar.get(COOKIE)?.value;
  if (!session) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  await adminAuth.verifySessionCookie(session, true);
}
function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  return res;
}

export async function GET() {
  try {
    await requireSession();
    const snap = await rtdb.ref('/events').get();
    const all = snap.exists() ? Object.values(snap.val()) : [];
    const now = Date.now();
    const total = all.length;
    const upcoming = all.filter(e => (e.date ?? 0) >= now).length;
    const past = total - upcoming;
    return addCORS(NextResponse.json({ total, upcoming, past }));
  } catch (e) {
    const status = e.status || 500;
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status }));
  }
}
