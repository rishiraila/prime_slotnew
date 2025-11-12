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

/* ------------- GET /api/members ------------- */
/**
 * Query params:
 * - page:     number (default 1)
 * - pageSize: number (default 50, max 200)
 * - q:        text search on name/email/phone/company/title
 *
 * Example:
 *   /api/members?page=1&pageSize=50&q=atul
 */
export async function GET(req) {
  try {
    // If you want this secured, just uncomment:
    // await requireSession();

    const u = new URL(req.url);
    const page = Math.max(1, parseInt(u.searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, Math.min(200, parseInt(u.searchParams.get('pageSize') || '50', 10)));
    const q = (u.searchParams.get('q') || '').trim().toLowerCase();

    const snap = await rtdb.ref('/members').get();
    if (!snap.exists()) {
      return addCORS(NextResponse.json({ page, pageSize, total: 0, records: [] }));
    }

    // Flatten members
    let records = Object.entries(snap.val()).map(([id, m]) => ({ id, ...(m || {}) }));

    // Optional search
    if (q) {
      const like = (v) => (typeof v === 'string' ? v.toLowerCase().includes(q) : false);
      records = records.filter(r =>
        like(r.name) || like(r.email) || like(r.phone) || like(r.company) || like(r.title)
      );
    }

    // Stable sort: by name (case-insensitive), then id
    records.sort((a, b) => {
      const an = (a.name || '').toLowerCase();
      const bn = (b.name || '').toLowerCase();
      if (an && bn && an !== bn) return an < bn ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    });

    // Pagination
    const total = records.length;
    const start = (page - 1) * pageSize;
    const pageRecords = records.slice(start, start + pageSize);

    return addCORS(NextResponse.json({ page, pageSize, total, records: pageRecords }));
  } catch (e) {
    return addCORS(
      NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 })
    );
  }
}
