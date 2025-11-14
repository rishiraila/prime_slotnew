// src/app/api/verify-otp/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
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
    const otp = (body?.otp || body?.code || "").toString().trim();
    if (!phoneRaw || !otp) return addCORS(NextResponse.json({ ok: false, message: "Phone and otp required" }, { status: 400 }));

    const phoneDigits = digitsOnly(phoneRaw);
    if (!phoneDigits) return addCORS(NextResponse.json({ ok: false, message: "Invalid phone" }, { status: 400 }));

    // Verify member exists in DB
    const matched = await findMemberByPhoneDigits(phoneDigits);
    if (!matched) return addCORS(NextResponse.json({ ok: false, message: "Member not found" }, { status: 404 }));

    // Call MSG91 verify endpoint
    const MSG91_AUTHKEY = "417046AkzbTCai3m68c9391bP1";
    if (!MSG91_AUTHKEY) return addCORS(NextResponse.json({ ok: false, message: "Server misconfigured: MSG91_AUTHKEY missing" }, { status: 500 }));

    const verifyUrl = "https://api.msg91.com/api/v5/otp/verify";
    const payload = { mobile: phoneDigits, otp, authkey: MSG91_AUTHKEY };

    const resp = await fetch(verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    const contentType = resp.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) data = JSON.parse(text);

    if (!resp.ok) {
      return addCORS(NextResponse.json({ ok: false, message: "MSG91 verify failed", status: resp.status, raw: data || text }, { status: 502 }));
    }

    // MSG91 success detection - adapt depending on your MSG91 account responses
    const success = data?.type === "success" || data?.status === "success" || data?.message?.toLowerCase()?.includes("verified") || data?.success === true;
    if (!success) {
      return addCORS(NextResponse.json({ ok: false, message: data?.message || "OTP verify failed", raw: data }, { status: 400 }));
    }

    // optionally sign JWT
    const JWT_SECRET = process.env.JWT_SECRET || null;
    const maxAge = Number(process.env.JWT_MAX_AGE || 60 * 60 * 24 * 7);

    const responseBody = {
      ok: true,
      message: "OTP verified and member found",
      memberId: matched.id,
      member: matched.member,
      raw: data
    };

    if (!JWT_SECRET) {
      return addCORS(NextResponse.json(responseBody, { status: 200 }));
    }

    const payloadJwt = {
      sub: matched.id,
      provider: "msg91",
      member: { id: matched.id, fullName: matched.member?.fullName || null }
    };

    const token = jwt.sign(payloadJwt, JWT_SECRET, { expiresIn: maxAge });
    const res = NextResponse.json({ ...responseBody, token }, { status: 200 });
    res.cookies.set("session", token, {
      httpOnly: true,
      path: "/",
      maxAge,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return addCORS(res);
  } catch (err) {
    console.error("verify-otp error:", err);
    return addCORS(NextResponse.json({ ok: false, message: "Server error", error: String(err) }, { status: 500 }));
  }
}
