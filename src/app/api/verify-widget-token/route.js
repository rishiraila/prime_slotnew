// src/app/api/verify-widget-token/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { rtdb } from "@/lib/firebaseAdmin";

const MSG91_VERIFY_URL =
  "https://control.msg91.com/api/v5/widget/verifyAccessToken";

// ====== WARNING: Hardcoded authkey below. Do NOT commit to public repos. ======
const MSG91_AUTHKEY = "417046AkzbTCai3m68c9391bP1";
// =============================================================================

function addCORS(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  return res;
}
export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

function digitsOnly(s) {
  if (!s && s !== 0) return "";
  return String(s).replace(/\D/g, "");
}

function extractPhoneFromMsg91Response(data) {
  if (!data) return null;
  const candidates = [
    data?.data?.mobile,
    data?.data?.identifier,
    data?.identifier,
    data?.mobile,
    data?.request_id,
    data?.requestId,
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
  const snap = await rtdb.ref("/members").get();
  if (!snap.exists()) return null;
  const members = snap.val();
  for (const [id, rec] of Object.entries(members)) {
    const candidates = [];
    if (rec?.phone !== undefined) candidates.push(rec.phone);
    if (rec?.mobile !== undefined) candidates.push(rec.mobile);
    if (rec?.phoneRaw !== undefined) candidates.push(rec.phoneRaw);
    candidates.push(rec);
    for (const p of candidates) {
      if (p == null) continue;
      let candidate = null;
      if (typeof p === "string" || typeof p === "number") candidate = String(p);
      else if (typeof p === "object") {
        const keys = [
          "Value",
          "value",
          "phone",
          "Phone",
          "mobile",
          "Mobile",
          "number",
          "contact",
          "phoneRaw",
        ];
        for (const k of keys)
          if (k in p && p[k] != null) {
            candidate = String(p[k]);
            break;
          }
        if (!candidate) {
          const vals = Object.values(p).filter(
            (v) => v != null && (typeof v === "string" || typeof v === "number")
          );
          if (vals.length) candidate = String(vals[0]);
        }
      }
      if (!candidate) continue;
      const storedDigits = digitsOnly(candidate);
      if (!storedDigits) continue;
      if (
        storedDigits === phoneDigits ||
        storedDigits.endsWith(phoneDigits) ||
        phoneDigits.endsWith(storedDigits) ||
        storedDigits.slice(-10) === phoneDigits.slice(-10)
      ) {
        return { id, member: rec, storedDigits };
      }
    }
  }
  return null;
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accessToken =
      body?.accessToken ||
      body?.["access-token"] ||
      body?.token ||
      body?.message;
    if (!accessToken)
      return addCORS(
        NextResponse.json(
          { success: false, message: "Missing accessToken" },
          { status: 400 }
        )
      );

    // Using hardcoded MSG91 authkey (set above)
    if (!MSG91_AUTHKEY)
      return addCORS(
        NextResponse.json(
          { success: false, message: "MSG91_AUTHKEY missing" },
          { status: 500 }
        )
      );

    // Call MSG91 to verify the widget access token
    const resp = await fetch(MSG91_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authkey: MSG91_AUTHKEY,
        "access-token": accessToken,
      }),
    });

    const text = await resp.text();
    const contentType = resp.headers.get("content-type") || "";
    let data = null;
    if (contentType.includes("application/json")) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = text;
      }
    } else data = text;

    // --- helpful server-side logging for debugging invalid access-token issues ---
    console.log("MSG91 /verifyAccessToken reply:", {
      status: resp.status,
      contentType,
      data,
    });
    // ---------------------------------------------------------------------------

    if (!resp.ok) {
      return addCORS(
        NextResponse.json(
          {
            success: false,
            message: "MSG91 verify failed",
            status: resp.status,
            raw: data,
          },
          { status: 400 }
        )
      );
    }

    const verified =
      data?.type === "success" ||
      data?.status === "success" ||
      data?.success === true;
    if (!verified)
      return addCORS(
        NextResponse.json(
          {
            success: false,
            message: data?.message || "Invalid access token",
            raw: data,
          },
          { status: 400 }
        )
      );

    const phoneDigits =
      extractPhoneFromMsg91Response(data) || digitsOnly(body?.phone) || null;
    if (!phoneDigits)
      return addCORS(
        NextResponse.json(
          {
            success: false,
            message: "Phone not found in token response",
            raw: data,
          },
          { status: 400 }
        )
      );

    const matched = await findMemberByPhoneDigits(phoneDigits);
    if (!matched)
      return addCORS(
        NextResponse.json(
          { success: false, message: "Member not found", phoneDigits },
          { status: 404 }
        )
      );

    const JWT_SECRET = "MY_SUPER_SECRET_KEY_123";
    const maxAge = Number(process.env.JWT_MAX_AGE || 60 * 60 * 24 * 7);

    const responseBody = {
      success: true,
      message: "Verified and member found",
      data,
      member: { id: matched.id, ...(matched.member || {}) },
    };

    if (!JWT_SECRET)
      return addCORS(NextResponse.json(responseBody, { status: 200 }));

    const token = jwt.sign(
      {
        sub: matched.id, // member ID
        phone: matched.storedDigits,
        provider: "msg91",
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    const resOut = NextResponse.json(
      { ...responseBody, token },
      { status: 200 }
    );
    resOut.cookies.set("session", token, {
      httpOnly: true,
      path: "/",
      maxAge,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return addCORS(resOut);
  } catch (err) {
    console.error("verify-widget-token error:", err);
    return addCORS(
      NextResponse.json(
        { success: false, message: "Verification failed", error: String(err) },
        { status: 500 }
      )
    );
  }
}
