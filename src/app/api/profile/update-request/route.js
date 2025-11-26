export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { rtdb, adminAuth } from '@/lib/firebaseAdmin';

const JWT_COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';

function addCORS(res){
  res.headers.set('Access-Control-Allow-Origin','*');
  res.headers.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers','Content-Type,Authorization');
  return res;
}
export async function OPTIONS(){ return addCORS(NextResponse.json({}, { status: 204 })); }

// Ensure the caller is a member (returns { mode:'member', uid })
async function requireMember(req){
  if (DISABLE_AUTH) return { mode:'test', uid:'TEST_USER' };
  const jar = await cookies();

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    // Try app JWT
    if (JWT_SECRET) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        return { mode:'member', uid: payload.sub, payload };
      } catch(e){ /* ignore */ }
    }
    // Try Firebase ID token
    if (adminAuth && typeof adminAuth.verifyIdToken === 'function') {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        return { mode:'member', uid: decoded.uid, decoded };
      } catch(e){ /* ignore */ }
    }
  }

  // Try cookie
  const cookieToken = jar.get(JWT_COOKIE)?.value;
  if (cookieToken && JWT_SECRET) {
    try {
      const payload = jwt.verify(cookieToken, JWT_SECRET);
      return { mode:'member', uid: payload.sub, payload };
    } catch(e){}
  }

  throw Object.assign(new Error('Unauthorized'), { status: 401 });
}

export async function POST(req){
  try {
    const user = await requireMember(req);
    const body = await req.json().catch(()=>({}));
    const { text } = body || {};

    if (!text || String(text).trim().length === 0) {
      return addCORS(NextResponse.json({ ok:false, message: 'text required' }, { status: 400 }));
    }

    const now = Date.now();
    const newRef = rtdb.ref('/profileUpdateRequests').push();
    const item = {
      id: newRef.key,
      userId: user.uid,
      text: String(text).trim(),
      status: 'pending',
      createdAt: now,
      modifiedAt: now,
      adminId: null,
      adminComment: null,
      approvedAt: null
    };

    await newRef.set(item);

    return addCORS(NextResponse.json({ ok:true, request: item }, { status: 201 }));
  } catch (err) {
    console.error('create update request error', err);
    return addCORS(NextResponse.json({ ok:false, message: 'Server error', error: String(err) }, { status: 500 }));
  }
}
