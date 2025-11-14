export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { rtdb } from "@/lib/firebaseAdmin"; // ensure correct path

function addCORS(res){
  res.headers.set('Access-Control-Allow-Origin','*');
  res.headers.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers','Content-Type,Authorization');
  return res;
}
export async function OPTIONS(){ return addCORS(NextResponse.json({}, { status: 204 })); }

function digitsOnly(s){ if(!s && s!==0) return ''; return String(s).replace(/\D/g,''); }

function extractPhoneValue(input){
  if(input == null) return null;
  if(typeof input === 'string' || typeof input === 'number') return String(input);
  if(typeof input === 'object'){
    const keys = ['Value','value','phone','Phone','mobile','Mobile','number','phoneRaw','contact'];
    for(const k of keys) if(k in input && input[k] != null) return String(input[k]);
    const vals = Object.values(input).filter(v=> v!=null && (typeof v==='string' || typeof v==='number'));
    if(vals.length) return String(vals[0]);
  }
  return null;
}

async function findMemberByPhoneDigits(phoneDigits){
  if(!phoneDigits) return null;
  const snap = await rtdb.ref('/members').get();
  if(!snap.exists()) return null;
  const members = snap.val();
  for(const [id, rec] of Object.entries(members)){
    const candidates = [];
    if(rec?.phone !== undefined) candidates.push(rec.phone);
    if(rec?.mobile !== undefined) candidates.push(rec.mobile);
    if(rec?.phoneRaw !== undefined) candidates.push(rec.phoneRaw);
    candidates.push(rec);
    for(const c of candidates){
      const extracted = extractPhoneValue(c);
      if(!extracted) continue;
      const storedDigits = digitsOnly(extracted);
      if(!storedDigits) continue;
      if(
        storedDigits === phoneDigits ||
        storedDigits.endsWith(phoneDigits) ||
        phoneDigits.endsWith(storedDigits) ||
        storedDigits.slice(-10) === phoneDigits.slice(-10)
      ){
        return { id, member: rec, storedDigits };
      }
    }
  }
  return null;
}

export async function POST(request){
  try{
    const body = await request.json().catch(()=>({}));
    const phoneRaw = (body?.phone || body?.mobile || body?.identifier || "").toString().trim();
    if(!phoneRaw) return addCORS(NextResponse.json({ ok:false, message:'Phone required' }, { status:400 }));
    const inputDigits = digitsOnly(phoneRaw);
    if(!inputDigits) return addCORS(NextResponse.json({ ok:false, message:'Invalid phone' }, { status:400 }));

    if(!rtdb) return addCORS(NextResponse.json({ ok:false, message:'RTDB not available' }, { status:500 }));

    const found = await findMemberByPhoneDigits(inputDigits);
    if(!found) return addCORS(NextResponse.json({ ok:true, exists:false, member:null }));

    return addCORS(NextResponse.json({
      ok:true,
      exists:true,
      memberId: found.id,
      member: found.member
    }));
  } catch(err){
    console.error('check-user error:', err);
    return addCORS(NextResponse.json({ ok:false, message:'Server error', error:String(err) }, { status:500 }));
  }
}
