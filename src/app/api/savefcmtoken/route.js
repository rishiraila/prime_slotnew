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

    const now = Date.now();
    const userRef = rtdb.ref(`/fcmTokens/${userId}`);

    // 1) Read current record for this user
    const snap = await userRef.once('value');
    const exists = snap.exists();
    if (exists) {
      const current = snap.val();
      // If token unchanged, just update modifiedAt/lastSeen
      if (current && current.token === token) {
        await userRef.update({ modifiedAt: now, lastSeen: now });
        return addCORS(NextResponse.json({ ok: true, saved: true, created: false, userId }));
      }
      // Token changed for this user: replace token, preserve createdAt if present
      const createdAt = current?.createdAt || now;
      await userRef.set({
        token,
        platform: platform || current?.platform || 'unknown',
        createdAt,
        modifiedAt: now,
        lastSeen: now,
      });
      // Also remove this token from any other user entries (cleanup)
      await removeTokenFromOtherUsers(token, userId);
      return addCORS(NextResponse.json({ ok: true, saved: true, created: false, userId }));
    }

    // 2) No existing record for this user -> create one
    await userRef.set({
      token,
      platform: platform || 'unknown',
      createdAt: now,
      modifiedAt: now,
      lastSeen: now,
    });

    // 3) Cleanup same token stored under other users (if any)
    await removeTokenFromOtherUsers(token, userId);

    return addCORS(NextResponse.json({ ok: true, saved: true, created: true, userId }));
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

// Helper: remove any other /fcmTokens/{otherUser} entries where token matches
async function removeTokenFromOtherUsers(tokenToRemove, keepUserId) {
  try {
    const rootSnap = await rtdb.ref('/fcmTokens').once('value');
    if (!rootSnap.exists()) return;
    const all = rootSnap.val();
    const updates = {};
    Object.entries(all).forEach(([uid, rec]) => {
      if (uid === keepUserId) return;
      if (rec && rec.token && rec.token === tokenToRemove) {
        updates[`/fcmTokens/${uid}`] = null; // remove whole node for that uid
      }
    });
    if (Object.keys(updates).length) {
      await rtdb.ref().update(updates);
    }
  } catch (e) {
    console.error('cleanup other users tokens error', e);
  }
}
