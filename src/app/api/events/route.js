// src/app/api/events/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import { z } from 'zod';

/* ---------- Inline schema ---------- */
const createEventSchema = z.object({
  title: z.string().min(1, 'title required'),
  // accept ms timestamp or ISO string; convert later
  date: z.union([z.number().int().positive(), z.string().min(1)]),
  location: z.string().min(1, 'location required'),
  description: z.string().optional().default(''),
  status: z.enum(['draft','published','archived']).default('draft'),
});

/* ---------- Helpers ---------- */
const COOKIE = 'admin_session';

async function requireUid() {
  const jar = await cookies();
  const session = jar.get(COOKIE)?.value;
  if (!session) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    return decoded.uid;
  } catch {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
}
function yyyymmdd(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}
function toMs(v) {
  if (typeof v === 'number') return v;
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw Object.assign(new Error('Invalid date'), { status: 400 });
  return t;
}
function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

/* ---------- OPTIONS ---------- */
export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

/* ---------- GET /api/events ----------
   Query:
     page, pageSize
     day=YYYYMMDD (optional) OR from, to (ms or ISO)
     q=keyword (title/location)
     status=draft|published|archived
--------------------------------------*/
export async function GET(req) {
  try {
    await requireUid();

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.max(1, Math.min(50, parseInt(url.searchParams.get('pageSize') || '12', 10)));
    const day = url.searchParams.get('day');
    const status = url.searchParams.get('status') || null;
    const q = (url.searchParams.get('q') || '').toLowerCase().trim();

    const fromRaw = url.searchParams.get('from');
    const toRaw = url.searchParams.get('to');
    const from = fromRaw ? toMs(fromRaw) : null;
    const to = toRaw ? toMs(toRaw) : null;

    let ids = [];
    if (day) {
      const snap = await rtdb.ref(`/eventsByDate/${day}`).get();
      ids = snap.exists() ? Object.keys(snap.val()) : [];
    } else {
      // small/medium data: fetch all ids; for very large sets, add server cursors/indexes
      const snap = await rtdb.ref('/events').get();
      ids = snap.exists() ? Object.keys(snap.val()) : [];
    }

    // Load & filter in memory (fine for admin-scale datasets)
    const snaps = await Promise.all(ids.map(id => rtdb.ref(`/events/${id}`).get()));
    let records = snaps.filter(s => s.exists()).map(s => ({ id: s.key, ...s.val() }));

    if (status) records = records.filter(r => r.status === status);
    if (from !== null) records = records.filter(r => typeof r.date === 'number' && r.date >= from);
    if (to !== null) records = records.filter(r => typeof r.date === 'number' && r.date <= to);
    if (q) {
      records = records.filter(r =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q)
      );
    }

    // newest first
    records.sort((a, b) => (b.date || b.createdAt || 0) - (a.date || a.createdAt || 0));

    const total = records.length;
    const start = (page - 1) * pageSize;
    const pageRecords = records.slice(start, start + pageSize);

    return addCORS(NextResponse.json({ page, pageSize, total, records: pageRecords }));
  } catch (e) {
    const status = e.status || 500;
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status }));
  }
}

/* ---------- POST /api/events ----------
Body:
{
  "title": "Annual Conference",
  "date": "2024-10-26",   // or timestamp (ms)
  "location": "Convention Center, New York",
  "description": "Keynotes...",
  "status": "published"   // optional, default "draft"
}
---------------------------------------*/
export async function POST(req) {
  try {
    const uid = await requireUid();
    const body = await req.json();

    const parsed = createEventSchema.parse(body);
    const dateMs = toMs(parsed.date);
    const now = Date.now();

    const ref = await rtdb.ref('/events').push({
      title: parsed.title,
      date: dateMs,
      location: parsed.location,
      description: parsed.description || '',
      status: parsed.status || 'draft',
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
    });

    const id = ref.key;
    await rtdb.ref(`/eventsByDate/${yyyymmdd(dateMs)}/${id}`).set(true);

    return addCORS(NextResponse.json({ id }, { status: 201 }));
  } catch (e) {
    const status = e.status || 500;
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status }));
  }
}
