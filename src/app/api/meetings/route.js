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
  res.headers.set('Access-Control-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS() { return addCORS(NextResponse.json({}, { status: 204 })); }

/* -------- GET /api/meetings?page=&pageSize=&status=&memberId= ---------- */
export async function GET(req) {
  try {
    await requireSession();
    const u = new URL(req.url);
    const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(u.searchParams.get('pageSize') || '20', 10)));
    const status = u.searchParams.get('status') || '';
    const memberId = u.searchParams.get('memberId') || '';

    const snap = await rtdb.ref('/meetings').get();
    let all = [];
    if (snap.exists()) {
      const val = snap.val();
      for (const eventId in val) {
        for (const meetingId in val[eventId]) {
          all.push({ id: meetingId, eventId, ...val[eventId][meetingId] });
        }
      }
    }

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
