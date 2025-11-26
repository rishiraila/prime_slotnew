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
  res.headers.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers','Content-Type,Authorization');
  return res;
}
export async function OPTIONS(){ return addCORS(NextResponse.json({}, { status: 204 })); }

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

export async function POST(req, { params }) {
  try {
    const adminUser = await requireAdmin(req);
    const adminId = adminUser.uid;

    const id = params?.id;
    if (!id) return addCORS(NextResponse.json({ ok:false, message:'id required' }, { status:400 }));

    const body = await req.json().catch(()=>({}));
    const { adminComment } = body || null;

    const ref = rtdb.ref(`/profileUpdateRequests/${id}`);
    const snap = await ref.once('value');
    if (!snap.exists()) return addCORS(NextResponse.json({ ok:false, message:'not found' }, { status:404 }));

    const rec = snap.val();
    if (rec.status !== 'pending') return addCORS(NextResponse.json({ ok:false, message:'already processed' }, { status:400 }));

    const now = Date.now();
    await ref.update({
      status: 'rejected',
      adminId,
      adminComment: adminComment || null,
      modifiedAt: now
    });

    return addCORS(NextResponse.json({ ok:true, rejected:true, requestId: id }, { status:200 }));
  } catch (err) {
    console.error('reject request error', err);
    return addCORS(NextResponse.json({ ok:false, message:'Server error', error: String(err) }, { status:500 }));
  }
}
