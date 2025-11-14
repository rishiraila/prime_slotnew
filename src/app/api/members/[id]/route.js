// src/app/api/members/[id]/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import { z } from 'zod';

const COOKIE = 'admin_session';
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';

// require session (unless DISABLE_AUTH)
async function requireSession() {
  if (DISABLE_AUTH) return { uid: 'TEST_USER' };
  const jar = await cookies();
  const session = jar.get(COOKIE)?.value;
  if (!session) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return adminAuth.verifySessionCookie(session, true);
}

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS() { return addCORS(NextResponse.json({}, { status: 204 })); }

// Helpers for phone extraction/normalization
function extractPhoneValue(input) {
  if (input == null) return null;
  if (typeof input === 'string' || typeof input === 'number') return String(input);
  if (typeof input === 'object') {
    const keys = ['Value', 'value', 'phone', 'Phone', 'mobile', 'Mobile', 'number'];
    for (const k of keys) {
      if (k in input && input[k] != null) return String(input[k]);
    }
    // fallback: first primitive child
    const vals = Object.values(input).filter(v => v != null && (typeof v === 'string' || typeof v === 'number'));
    if (vals.length) return String(vals[0]);
  }
  return null;
}
function digitsOnly(s) {
  if (!s) return '';
  return String(s).replace(/\D/g, '');
}

// Zod schema for patch payload (partial)
const MemberPatch = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.any().optional(), // accept string|number|object
  businessCategory: z.string().optional(),
  chapterName: z.string().optional(),
  memberStatus: z.string().optional(),
  notes: z.string().nullable().optional(),
  updatedAt: z.number().optional(),
}).partial();

export async function GET(_req, ctx) {
  try {
    // optional auth — comment out if publicly allowed
    await requireSession();

    const { id: memberId } = await ctx.params;
    if (!memberId) return addCORS(NextResponse.json({ error: 'Missing member id' }, { status: 400 }));

    const snap = await rtdb.ref(`/members/${memberId}`).get();
    if (!snap.exists()) return addCORS(NextResponse.json({ error: 'Member not found' }, { status: 404 }));

    return addCORS(NextResponse.json({ member: { id: memberId, ...(snap.val() || {}) } }, { status: 200 }));
  } catch (err) {
    console.error('members/:id GET error', err);
    return addCORS(NextResponse.json({ error: err.message || String(err) }, { status: err.status || 500 }));
  }
}

export async function PATCH(req, ctx) {
  try {
    await requireSession();

    const { id: memberId } = await ctx.params;
    if (!memberId) return addCORS(NextResponse.json({ error: 'Missing member id' }, { status: 400 }));

    // read body & validate
    const body = await req.json().catch(() => ({}));
    const parsed = MemberPatch.parse(body);

    // ensure member exists
    const memberRef = rtdb.ref(`/members/${memberId}`);
    const snap = await memberRef.get();
    if (!snap.exists()) return addCORS(NextResponse.json({ error: 'Member not found' }, { status: 404 }));

    const updates = {};

    // handle phone specially: normalize digits and also store original raw if object provided
    if ('phone' in parsed) {
      const rawPhone = parsed.phone;
      const extracted = extractPhoneValue(rawPhone);
      const digits = digitsOnly(extracted);
      // If you want to always store digits-only string in .phone, uncomment next line:
      // updates.phone = digits ? digits : extracted;
      // We'll store both: phone (normalized digits) and phoneRaw (original shape) to preserve input.
      if (digits) updates.phone = digits;
      else if (extracted) updates.phone = extracted;
      else updates.phone = rawPhone; // fallback
      updates.phoneRaw = rawPhone;
    }

    // apply other allowed fields
    const allowed = ['fullName','email','businessCategory','chapterName','memberStatus','notes','updatedAt'];
    for (const k of allowed) {
      if (k in parsed) updates[k] = parsed[k];
    }

    // ensure updatedAt present
    if (!('updatedAt' in updates)) updates.updatedAt = Date.now();

    // write update
    await memberRef.update(updates);

    // return updated member
    const updated = await memberRef.get();
    return addCORS(NextResponse.json({ ok: true, member: { id: memberId, ...(updated.val() || {}) } }, { status: 200 }));
  } catch (err) {
    console.error('members/:id PATCH error', err);
    // zod validation errors have `issues`
    if (err?.issues) return addCORS(NextResponse.json({ error: 'Invalid input', details: err.issues }, { status: 400 }));
    return addCORS(NextResponse.json({ error: err.message || String(err) }, { status: err.status || 500 }));
  }
}

export async function DELETE(_req, ctx) {
  try {
    await requireSession();

    const { id: memberId } = await ctx.params;
    if (!memberId) return addCORS(NextResponse.json({ error: 'Missing member id' }, { status: 400 }));

    // remove member and any event-member links & memberMeetings if you want (optional)
    await Promise.all([
      rtdb.ref(`/members/${memberId}`).set(null),
      rtdb.ref(`/memberEvents/${memberId}`).set(null),
      rtdb.ref(`/memberMeetings/${memberId}`).set(null),
    ]);

    return addCORS(NextResponse.json({ ok: true }, { status: 200 }));
  } catch (err) {
    console.error('members/:id DELETE error', err);
    return addCORS(NextResponse.json({ error: err.message || String(err) }, { status: err.status || 500 }));
  }
}
