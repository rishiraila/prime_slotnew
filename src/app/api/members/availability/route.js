export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';

const ADMIN_COOKIE = 'admin_session';
const JWT_COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';

async function requireUser(req) {
  const jar = await cookies();

  // 1) Try member JWT (Authorization: Bearer or session cookie)
  let token = null;
  const auth =
    req.headers.get('authorization') ||
    req.headers.get('Authorization') ||
    '';

  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice('Bearer '.length).trim();
  }
  if (!token) {
    token = jar.get(JWT_COOKIE)?.value || null;
  }

  if (token && JWT_SECRET) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { mode: 'member', uid: payload.sub, payload };
    } catch (e) {
      // ignore and try admin_session
    }
  }

  // 2) Fallback: admin_session (admin web)
  const session = jar.get(ADMIN_COOKIE)?.value;
  if (!session)
    throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true);
  return { mode: 'admin', uid: decoded.uid, decoded };
}

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

const BodySchema = {
  parse(body) {
    const {
      aId,
      bId,
      from,
      to,
      minDurationMin = 30,
      eventId,
    } = body || {};
    if (!aId || !bId) throw Object.assign(new Error('aId & bId required'), { status: 400 });
    const fromNum = Number(from);
    const toNum = Number(to);
    if (!fromNum || !toNum || fromNum <= 0 || toNum <= 0) {
      throw Object.assign(new Error('Invalid from/to'), { status: 400 });
    }
    return {
      aId: String(aId),
      bId: String(bId),
      from: fromNum,
      to: toNum,
      minDurationMin: Number(minDurationMin) || 30,
      eventId: eventId ? String(eventId) : undefined,
    };
  },
};

function mergeIntervals(intervals = []) {
  if (!intervals.length) return [];
  intervals.sort((a, b) => a.start - b.start);
  const out = [];
  let cur = { ...intervals[0] };
  for (let i = 1; i < intervals.length; i++) {
    const it = intervals[i];
    if (it.start <= cur.end) {
      cur.end = Math.max(cur.end, it.end);
    } else {
      out.push(cur);
      cur = { ...it };
    }
  }
  out.push(cur);
  return out;
}

export async function POST(req) {
  try {
    await requireUser(req);
    const rawBody = await req.json();
    const { aId, bId, from, to, minDurationMin, eventId } =
      BodySchema.parse(rawBody);

    const meetingsRoot = eventId ? `/meetings/${eventId}` : '/meetings';
    const snap = await rtdb.ref(meetingsRoot).get();
    const busy = [];

    if (snap.exists()) {
      const val = snap.val();
      if (eventId) {
        for (const [mId, m] of Object.entries(val || {})) {
          if (!m || m.status === 'canceled') continue;
          if (m.aId === aId || m.bId === aId || m.aId === bId || m.bId === bId) {
            const start = Number(m.scheduledAt || 0);
            const end = start + ((m.durationMin || minDurationMin) * 60 * 1000);
            if (end > from && start < to) {
              busy.push({
                start: Math.max(start, from),
                end: Math.min(end, to),
              });
            }
          }
        }
      } else {
        for (const [evId, block] of Object.entries(val)) {
          for (const [mId, m] of Object.entries(block || {})) {
            if (!m || m.status === 'canceled') continue;
            if (m.aId === aId || m.bId === aId || m.aId === bId || m.bId === bId) {
              const start = Number(m.scheduledAt || 0);
              const end = start + ((m.durationMin || minDurationMin) * 60 * 1000);
              if (end > from && start < to) {
                busy.push({
                  start: Math.max(start, from),
                  end: Math.min(end, to),
                });
              }
            }
          }
        }
      }
    }

    const mergedBusy = mergeIntervals(busy);
    const minMs = minDurationMin * 60 * 1000;
    const free = [];
    let cursor = from;
    for (const iv of mergedBusy) {
      if (iv.start - cursor >= minMs) free.push({ start: cursor, end: iv.start });
      cursor = Math.max(cursor, iv.end);
    }
    if (to - cursor >= minMs) free.push({ start: cursor, end: to });

    return addCORS(
      NextResponse.json({ aId, bId, from, to, busy: mergedBusy, free })
    );
  } catch (e) {
    return addCORS(
      NextResponse.json(
        { error: e.message || 'Server error' },
        { status: e.status || 500 }
      )
    );
  }
}
