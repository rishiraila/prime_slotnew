// src/app/api/profile/route.js
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';

const COOKIE_NAME = 'admin_session';

// verify session cookie → return uid or null
async function getUidFromRequest() {
  const jar = await cookies();
  const session = jar.get(COOKIE_NAME)?.value;
  if (!session) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(session, true);
    return decoded.uid;
  } catch {
    return null;
  }
}

const ALLOWED = new Set([
  'fullName',
  'email',
  'phone',
  'businessName',
  'businessCategory',
  'chapterName',
  'region',
  'city',
  'memberStatus',
  'photoURL',
]);

function sanitize(body) {
  const obj = {};
  for (const k of Object.keys(body || {})) {
    if (ALLOWED.has(k)) obj[k] = body[k];
  }
  return obj;
}

export async function GET() {
  const uid = await getUidFromRequest();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const snap = await rtdb.ref(`/profiles/${uid}`).get();
  return NextResponse.json(snap.val() || {});
}

export async function PUT(req) {
  const uid = await getUidFromRequest();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const data = sanitize(body);

  // minimal required fields (customize if you want)
  if (!data.fullName || !data.email || !data.phone) {
    return NextResponse.json(
      { error: 'fullName, email and phone are required' },
      { status: 400 }
    );
  }

  data.updatedAt = Date.now();
  await rtdb.ref(`/profiles/${uid}`).set(data); // upsert/replace
  return NextResponse.json({ ok: true });
}

export async function PATCH(req) {
  const uid = await getUidFromRequest();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const data = sanitize(body);
  data.updatedAt = Date.now();

  await rtdb.ref(`/profiles/${uid}`).update(data); // partial update
  return NextResponse.json({ ok: true });
}

export async function POST(req) {
  const uid = await getUidFromRequest();
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check if profile already exists
  const existingSnap = await rtdb.ref(`/profiles/${uid}`).get();
  if (existingSnap.exists()) {
    return NextResponse.json({ error: 'Profile already exists' }, { status: 409 });
  }

  const body = await req.json();
  const data = sanitize(body);

  // Validate required fields
  if (!data.fullName || !data.email || !data.phone) {
    return NextResponse.json(
      { error: 'fullName, email and phone are required' },
      { status: 400 }
    );
  }

  data.createdAt = Date.now();
  data.updatedAt = Date.now();

  await rtdb.ref(`/profiles/${uid}`).set(data);
  return NextResponse.json(data, { status: 201 });
}
