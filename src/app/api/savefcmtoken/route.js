export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import admin, { rtdb, adminAuth } from '@/lib/firebaseAdmin'; // adjust path if required

const ADMIN_COOKIE = 'admin_session';
const JWT_COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  return res;
}

export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

// Resolve and verify the caller; returns { mode, uid, payload/decoded } or throws
async function requireUser(req) {
  if (DISABLE_AUTH) return { mode: 'test', uid: 'TEST_USER' };

  const jar = await cookies();

  // 1) try Bearer token (your app JWT)
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    // Try verify with app JWT first (jwt.verify)
    if (JWT_SECRET) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        return { mode: 'member', uid: payload.sub, payload };
      } catch (e) {
        // ignore and try Firebase ID token below
      }
    }
    // Next try Firebase ID token verification (if adminAuth available)
    if (adminAuth && typeof adminAuth.verifyIdToken === 'function') {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        return { mode: 'member', uid: decoded.uid, decoded };
      } catch (e) {
        // ignore and continue to cookie checks
      }
    }
  }

  // 2) try JWT cookie fallback (your app JWT stored in cookie)
  const tokenCookie = jar.get(JWT_COOKIE)?.value;
  if (tokenCookie && JWT_SECRET) {
    try {
      const payload = jwt.verify(tokenCookie, JWT_SECRET);
      return { mode: 'member', uid: payload.sub, payload };
    } catch (e) {
      // ignore and continue
    }
  }

  // 3) fallback: admin_session (Firebase session cookie)
  const session = jar.get(ADMIN_COOKIE)?.value;
  if (session && adminAuth && typeof adminAuth.verifySessionCookie === 'function') {
    try {
      const decoded = await adminAuth.verifySessionCookie(session, true);
      return { mode: 'admin', uid: decoded.uid, decoded };
    } catch (e) {
      // continue to unauthorized
    }
  }

  // If we get here, not authorized
  throw Object.assign(new Error('Unauthorized'), { status: 401 });
}

export async function POST(req) {
  try {
    // parse body
    const body = await req.json().catch(() => ({}));
    const { token, platform } = body || {};

    if (!token) {
      return addCORS(
        NextResponse.json({ ok: false, message: 'token required in body' }, { status: 400 })
      );
    }

    // Resolve calling user (will throw 401 if not authorized)
    let user;
    try {
      user = await requireUser(req);
    } catch (e) {
      console.error('auth failed', e);
      return addCORS(NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 }));
    }

    const userId = user?.uid;
    if (!userId) {
      return addCORS(NextResponse.json({ ok: false, message: 'Could not resolve user id' }, { status: 500 }));
    }

    if (!rtdb) {
      return addCORS(NextResponse.json({ ok: false, message: 'RTDB not initialized' }, { status: 500 }));
    }

    // Store token under the resolved user id (use push auto-id)
    const ref = rtdb.ref(`/fcmTokens/${userId}`);
    await ref.push({
      token,
      platform: platform || 'unknown',
      createdAt: Date.now(),
      lastSeen: Date.now(),
    });

    return addCORS(NextResponse.json({ ok: true, saved: true, userId }));
  } catch (err) {
    console.error('save-fcm-token error', err);
    return addCORS(
      NextResponse.json(
        { ok: false, message: 'Server error', error: String(err) },
        { status: 500 }
      )
    );
  }
}
