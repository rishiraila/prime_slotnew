export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';

const COOKIE = 'admin_session';
async function requireSession(){
  const jar = await cookies(); const s = jar.get(COOKIE)?.value;
  if (!s) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  await adminAuth.verifySessionCookie(s, true);
}
function addCORS(res){
  res.headers.set('Access-Control-Allow-Origin','*');
  res.headers.set('Access-Control-Allow-Methods','GET,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');
  return res;
}
export async function OPTIONS(){ return addCORS(NextResponse.json({}, { status: 204 })); }

/* GET /api/events/:id/meetings/summary
   -> { total, byStatus, referralsTotal, businessTotal }
*/
export async function GET(_req, context){
  try{
    await requireSession();
    const { id: eventId } = await context.params;

    const idx = await rtdb.ref(`/eventMeetings/${eventId}`).get();
    if (!idx.exists()) return addCORS(NextResponse.json({
      total: 0, byStatus: {}, referralsTotal: 0, businessTotal: 0
    }));

    const ids = Object.keys(idx.val());
    const snaps = await Promise.all(ids.map(i => rtdb.ref(`/meetings/${i}`).get()));
    const list = snaps.filter(s=>s.exists()).map(s=>s.val());

    const byStatus = {};
    let referralsTotal = 0;
    let businessTotal = 0;

    for (const m of list){
      byStatus[m.status] = (byStatus[m.status]||0)+1;
      referralsTotal += (m.referralsGivenByA||0) + (m.referralsGivenByB||0);
      businessTotal += (m.businessGivenByA||0) + (m.businessGivenByB||0);
    }

    return addCORS(NextResponse.json({
      total: list.length,
      byStatus,
      referralsTotal,
      businessTotal
    }));
  }catch(e){
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}
