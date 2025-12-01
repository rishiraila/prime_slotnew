export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { rtdb, messaging } from '../../../lib/firebaseAdmin';  // <-- named import (messaging added above)

function addCORS(res){
  res.headers.set('Access-Control-Allow-Origin','*');
  res.headers.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers','Content-Type,Authorization');
  return res;
}
export async function OPTIONS(){ return addCORS(NextResponse.json({}, { status: 204 })); }

export async function POST(req){
  try{
    const body = await req.json().catch(()=>({}));
    const { userId, title, body: notifBody, data } = body || {};

    if(!userId || !title || !notifBody){
      return addCORS(NextResponse.json({ ok:false, message:'userId,title,body required' }, { status:400 }));
    }

    if(!rtdb) return addCORS(NextResponse.json({ ok:false, message:'RTDB not initialized' }, { status:500 }));

    const snap = await rtdb.ref(`/fcmTokens/${userId}`).once('value');
    const tokensObj = snap.val();
    if(!tokensObj) return addCORS(NextResponse.json({ ok:false, message:'no tokens' }, { status:404 }));

    // tokenEntries keeps the RTDB child key and token value
    const tokenEntries = Object.entries(tokensObj).map(([key, val]) => ({ key, token: val?.token || (typeof val === 'string' ? val : null), raw: val }));
    const tokens = tokenEntries.map(e => e.token).filter(Boolean);
    if(!tokens.length) return addCORS(NextResponse.json({ ok:false, message:'no tokens' }, { status:404 }));

    const message = {
      notification: { title, body: notifBody },
      data: typeof data === 'object' ? Object.fromEntries(Object.entries(data).map(([k,v])=>[k,String(v)])) : {},
      tokens
    };

    // use messaging (from admin SDK v9 modular)
    const response = await messaging.sendMulticast(message);

    // Collect invalid tokens to remove
    const toRemoveKeys = [];
    response.responses.forEach((r, i) => {
      if(!r.success){
        const err = r.error;
        const badToken = tokens[i];
        console.error('FCM error for token', badToken, err && err.code ? err.code : err);
        if(err && (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-registration-token')){
          const found = tokenEntries.find(te => te.token === badToken);
          if(found) toRemoveKeys.push(found.key);
        }
      }
    });

    // Remove them from RTDB
    if(toRemoveKeys.length){
      await Promise.all(toRemoveKeys.map(k => rtdb.ref(`/fcmTokens/${userId}/${k}`).remove()));
    }

    return addCORS(NextResponse.json({
      ok:true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      cleaned: toRemoveKeys.length
    }));
  } catch(err){
    console.error('send-notification error', err);
    return addCORS(NextResponse.json({ ok:false, message:'Server error', error:String(err) }, { status:500 }));
  }
}
