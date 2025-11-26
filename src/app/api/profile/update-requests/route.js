export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { rtdb, adminAuth } from '@/lib/firebaseAdmin';

const ADMIN_COOKIE = 'admin_session';
const JWT_COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';

function addCORS(res){
  res.headers.set('Access-Control-Allow-Origin','*');
  res.headers.set('Access-Control-Allow-Methods','GET,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers','Content-Type,Authorization');
  return res;
}
export async function OPTIONS(){ return addCORS(NextResponse.json({}, { status: 204 })); }

// requireAdmin: session cookie or admin JWT / admin custom claim
async function requireAdmin(req){
  if (DISABLE_AUTH) return { mode:'test', uid:'ADMIN_TEST' };
  const jar = await cookies();
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (JWT_SECRET) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.isAdmin) return { mode:'admin', uid: payload.sub, payload };
      } catch(e){}
    }
    if (adminAuth && typeof adminAuth.verifyIdToken === 'function') {
      try {
        const decoded = await adminAuth.verifyIdToken(token);
        if (decoded?.admin === true || decoded?.isAdmin === true) return { mode:'admin', uid: decoded.uid, decoded };
      } catch(e){}
    }
  }
  const session = jar.get(ADMIN_COOKIE)?.value;
  if (session && adminAuth && typeof adminAuth.verifySessionCookie === 'function') {
    try {
      const decoded = await adminAuth.verifySessionCookie(session, true);
      return { mode:'admin', uid: decoded.uid, decoded };
    } catch(e){}
  }
  throw Object.assign(new Error('Unauthorized'), { status: 401 });
}

export async function GET(req){
  try {
    await requireAdmin(req);

    if (!rtdb) return addCORS(NextResponse.json({ ok:false, message:'RTDB not initialized' }, { status: 500 }));

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get('status'); // optional

    const snap = await rtdb.ref('/profileUpdateRequests').once('value');
    const data = snap.exists() ? snap.val() : {};

    let arr = Object.values(data).map(x => x).sort((a,b) => (b.createdAt||0) - (a.createdAt||0));
    if (statusFilter) arr = arr.filter(r => String(r.status) === String(statusFilter));

    return addCORS(NextResponse.json({ ok:true, items: arr }, { status: 200 }));
  } catch (err) {
    console.error('list update requests error', err);
    return addCORS(NextResponse.json({ ok:false, message:'Server error', error: String(err) }, { status:500 }));
  }
}
