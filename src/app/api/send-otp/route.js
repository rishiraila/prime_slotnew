// src/app/api/send-otp/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { rtdb } from "@/lib/firebaseAdmin";

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS() { return addCORS(NextResponse.json({}, { status: 204 })); }

function digitsOnly(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/\D/g, '');
}

function extractPhoneValue(input) {
  if (input == null) return null;
  if (typeof input === 'string' || typeof input === 'number') return String(input);
  if (typeof input === 'object') {
    const keys = ['Value','value','phone','Phone','mobile','Mobile','number','phoneRaw'];
    for (const k of keys) {
      if (k in input && input[k] != null) return String(input[k]);
    }
    const vals = Object.values(input).filter(v => v != null && (typeof v === 'string' || typeof v === 'number'));
    if (vals.length) return String(vals[0]);
  }
  return null;
}

async function findMemberByPhoneDigits(phoneDigits) {
  if (!phoneDigits) return null;
  const snap = await rtdb.ref('/members').get();
  if (!snap.exists()) return null;
  const members = snap.val();
  for (const [id, rec] of Object.entries(members)) {
    const candidates = [];
    if (rec?.phone !== undefined) candidates.push(rec.phone);
    if (rec?.phoneRaw !== undefined) candidates.push(rec.phoneRaw);
    candidates.push(rec);

    for (const p of candidates) {
      let candidate = null;
      if (p == null) continue;
      if (typeof p === 'string' || typeof p === 'number') candidate = String(p);
      else if (typeof p === 'object') {
        const keys = ['Value','value','phone','Phone','mobile','Mobile','number'];
        for (const k of keys) {
          if (k in p && p[k] != null) { candidate = String(p[k]); break; }
        }
        if (!candidate) {
          const vals = Object.values(p).filter(v => v != null && (typeof v === 'string' || typeof v === 'number'));
          if (vals.length) candidate = String(vals[0]);
        }
      }
      if (!candidate) continue;
      const storedDigits = digitsOnly(candidate);
      if (!storedDigits) continue;
      if (storedDigits === phoneDigits || storedDigits.endsWith(phoneDigits) || phoneDigits.endsWith(storedDigits)) {
        return { id, member: rec, storedDigits };
      }
    }
  }
  return null;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const phoneRaw = (body?.phone || body?.mobile || body?.identifier || "").toString().trim();
    if (!phoneRaw) return addCORS(NextResponse.json({ ok: false, message: "Phone required" }, { status: 400 }));
    const phoneDigits = digitsOnly(phoneRaw);
    if (!phoneDigits) return addCORS(NextResponse.json({ ok: false, message: "Invalid phone" }, { status: 400 }));

    // Check in RTDB whether member exists
    const matched = await findMemberByPhoneDigits(phoneDigits);
    if (!matched) return addCORS(NextResponse.json({ ok: true, exists: false, message: "Phone not registered" }, { status: 200 }));

    // Build MSG91 request
    const MSG91_AUTHKEY = "417046AkzbTCai3m68c9391bP1";
    if (!MSG91_AUTHKEY) return addCORS(NextResponse.json({ ok: false, message: "Server misconfigured: MSG91_AUTHKEY missing" }, { status: 500 }));

    const phoneWithCC = phoneDigits; // expect frontend supplies country code (e.g. 9199...)
    const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || body?.template_id;

    // Using MSG91 OTP API v5 — send OTP
    const sendUrl = "https://api.msg91.com/api/v5/otp";
    const payload = { mobile: phoneWithCC, authkey: MSG91_AUTHKEY };
    if (MSG91_TEMPLATE_ID) payload.template_id = MSG91_TEMPLATE_ID;

    const resp = await fetch(sendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    const contentType = resp.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) data = JSON.parse(text);

    if (!resp.ok) {
      return addCORS(NextResponse.json({ ok: false, message: "MSG91 send failed", status: resp.status, raw: data || text }, { status: 502 }));
    }

    // MSG91 may return request_id, txnId or similar
    const requestId = data?.request_id || data?.txnId || data?.requestId || null;
    return addCORS(NextResponse.json({
      ok: true,
      message: "OTP sent (if MSG91 returns success)",
      request_id: requestId,
      memberId: matched.id,
      member: matched.member,
      raw: data
    }, { status: 200 }));
  } catch (err) {
    console.error("send-otp error:", err);
    return addCORS(NextResponse.json({ ok: false, message: "Server error", error: String(err) }, { status: 500 }));
  }
}
