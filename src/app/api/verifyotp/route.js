// src/app/api/verifyotp/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { rtdb } from '@/lib/firebaseAdmin'; // ensure this path matches your project

const MSG91_VERIFY_URL = "https://control.msg91.com/api/v5/widget/verifyAccessToken";

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS() { return addCORS(NextResponse.json({}, { status: 204 })); }

// safe fetch+parse helper that returns { ok, status, data, raw, parseError, contentType }
async function fetchJsonSafe(url, opts = {}) {
  const resp = await fetch(url, opts);
  const text = await resp.text();
  const contentType = resp.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return { ok: resp.ok, status: resp.status, data: JSON.parse(text), contentType };
    } catch (e) {
      return { ok: resp.ok, status: resp.status, parseError: String(e), raw: text, contentType };
    }
  }
  // not JSON
  return { ok: resp.ok, status: resp.status, raw: text, contentType };
}

function digitsOnly(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/\D/g, '');
}

// Try to extract a phone/mobile from multiple possible fields in MSG91 response
function extractPhoneFromMsg91Response(data) {
  // data could be: data.data.mobile, data.data.identifier, data.identifier, data.request_id etc.
  if (!data) return null;
  const candidates = [
    data?.data?.mobile,
    data?.data?.identifier,
    data?.identifier,
    data?.request_id,
    data?.requestId,
    data?.mobile,
    data?.message,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    const d = digitsOnly(c);
    if (d) return d;
  }
  return null;
}

async function findMemberByPhoneDigits(phoneDigits) {
  if (!phoneDigits) return null;
  const snap = await rtdb.ref('/members').get();
  if (!snap.exists()) return null;
  const members = snap.val();
  for (const [id, rec] of Object.entries(members)) {
    // check common shapes: rec.phone (string/number), rec.phoneRaw, nested object { Value: ... }
    const possibles = [];
    if (rec?.phone !== undefined) possibles.push(rec.phone);
    if (rec?.phoneRaw !== undefined) possibles.push(rec.phoneRaw);
    // also push whole record so extractPhoneValue can handle nested shapes
    possibles.push(rec);

    for (const p of possibles) {
      // attempt extract
      let candidate = null;
      if (p == null) continue;
      if (typeof p === 'string' || typeof p === 'number') candidate = String(p);
      else if (typeof p === 'object') {
        // common keys
        const keys = ['Value','value','phone','Phone','mobile','Mobile','number'];
        for (const k of keys) {
          if (k in p && p[k] != null) {
            candidate = String(p[k]);
            break;
          }
        }
        if (!candidate) {
          // fallback to first primitive
          const vals = Object.values(p).filter(v => v != null && (typeof v === 'string' || typeof v === 'number'));
          if (vals.length) candidate = String(vals[0]);
        }
      }
      if (!candidate) continue;
      const storedDigits = digitsOnly(candidate);
      if (!storedDigits) continue;
      // match exact or endsWith - covers +91 vs 10-digit variations
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
    const accessToken = body?.accessToken || body?.["access-token"] || body?.token || body?.message;
    if (!accessToken) {
      return addCORS(NextResponse.json({ success: false, message: "Missing accessToken" }, { status: 400 }));
    }

    const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY || body?.MSG91_AUTHKEY || "417046AkzbTCai3m68c9391bP1";
    if (!MSG91_AUTHKEY) {
      console.error("MSG91_AUTHKEY missing in environment");
      return addCORS(NextResponse.json({ success: false, message: "Server misconfigured: MSG91_AUTHKEY missing" }, { status: 500 }));
    }

    // call MSG91 verifyAccessToken safely
    const safe = await fetchJsonSafe(MSG91_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authkey: MSG91_AUTHKEY, "access-token": accessToken }),
    });

    if (!safe.ok) {
      // upstream returned non-200 or non-json — return details for debugging
      console.warn("MSG91 verify returned non-ok:", safe.status, safe);
      return addCORS(NextResponse.json({
        success: false,
        message: "MSG91 verification failed",
        status: safe.status,
        raw: safe.raw || safe.data || safe.parseError
      }, { status: 400 }));
    }

    const data = safe.data ?? null;
    if (!data) {
      // parse error or non-json response
      return addCORS(NextResponse.json({
        success: false,
        message: "Invalid response from MSG91",
        raw: safe.raw || safe.parseError
      }, { status: 502 }));
    }

    const verified = (data?.type === "success" || data?.status === "success" || data?.success === true);
    if (!verified) {
      console.warn("MSG91 verification failed:", data);
      return addCORS(NextResponse.json({ success: false, message: data?.message || "Invalid access token", raw: data }, { status: 400 }));
    }

    // extract phone (digits-only) from MSG91 response (best-effort)
    const phoneDigits = extractPhoneFromMsg91Response(data) || digitsOnly(body?.phone) || null;
    if (!phoneDigits) {
      // cannot determine phone from MSG91 response or request — return success but warn
      // (you can change this behavior to require a phone)
      console.warn("Could not extract phone from MSG91 response or request body", { data });
      // continue but try to return data to client
    }

    // If phoneDigits found, lookup member in RTDB members node
    let matched = null;
    if (phoneDigits) {
      matched = await findMemberByPhoneDigits(phoneDigits);
      if (!matched) {
        // member not found — return 404 to indicate this phone isn't registered
        return addCORS(NextResponse.json({ success: false, message: "Member not found", phoneDigits }, { status: 404 }));
      }
    } else {
      // no phone info — treat as failure for your flow (you asked to check number)
      return addCORS(NextResponse.json({ success: false, message: "Phone number not found in verification response; cannot map to member" }, { status: 400 }));
    }

    // SUCCESS: we have verified with MSG91 and found the member in RTDB
    // Build response and optionally sign JWT
    const JWT_SECRET = process.env.JWT_SECRET;
    const maxAge = Number(process.env.JWT_MAX_AGE || 60 * 60 * 24 * 7); // seconds

    const responseBody = {
      success: true,
      message: "Verified and member found",
      data,
      member: { id: matched.id, ...(matched.member || {}) }
    };

    if (!JWT_SECRET) {
      return addCORS(NextResponse.json(responseBody, { status: 200 }));
    }

    // Sign JWT using member id as sub
    const payload = {
      sub: matched.id,
      provider: "msg91",
      member: { id: matched.id, fullName: matched.member?.fullName || null }
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: maxAge });
    const res = NextResponse.json(responseBody, { status: 200 });
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
    return addCORS(NextResponse.json({ success: false, message: "Verification failed", error: String(err) }, { status: 500 }));
  }
}
