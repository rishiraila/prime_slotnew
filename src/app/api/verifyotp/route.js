// src/app/api/verifyotp/route.js
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

const MSG91_VERIFY_URL = "https://control.msg91.com/api/v5/widget/verifyAccessToken";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const accessToken = body?.accessToken || body?.["access-token"] || body?.token || body?.message;
    if (!accessToken) {
      return NextResponse.json({ success: false, message: "Missing accessToken" }, { status: 400 });
    }

    const MSG91_AUTHKEY = "417046AkzbTCai3m68c9391bP1";
    if (!MSG91_AUTHKEY) {
      console.error("MSG91_AUTHKEY missing in environment");
      return NextResponse.json({ success: false, message: "Server misconfigured: MSG91_AUTHKEY missing" }, { status: 500 });
    }

    // Call MSG91 verifyAccessToken
    const resp = await fetch(MSG91_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authkey: MSG91_AUTHKEY,
        "access-token": accessToken,
      }),
    });

    // Attempt JSON parse, fallback to raw text
    let data;
    try {
      data = await resp.json();
    } catch (e) {
      const text = await resp.text();
      console.error("MSG91 returned non-JSON response:", resp.status, text);
      return NextResponse.json({ success: false, message: "Invalid response from MSG91", raw: text }, { status: 502 });
    }

    const verified = resp.ok && (data?.type === "success" || data?.status === "success" || data?.success === true);

    if (!verified) {
      console.warn("MSG91 verification failed:", resp.status, data);
      return NextResponse.json({ success: false, message: data?.message || "Invalid access token", raw: data }, { status: 400 });
    }

    // SUCCESS: optionally create session cookie (if JWT_SECRET configured)
    const JWT_SECRET = process.env.JWT_SECRET;
    const maxAge = Number(process.env.JWT_MAX_AGE || 60 * 60 * 24 * 7); // seconds

    const payload = {
      sub: data?.data?.identifier || data?.message || data?.requestId || "msg91_user",
      provider: "msg91",
      msg91: { raw: data },
    };

    const responseBody = { success: true, message: "Verified", data };

    if (!JWT_SECRET) {
      // Return success without cookie
      return NextResponse.json(responseBody, { status: 200 });
    }

    // sign token and set cookie
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: maxAge });

    const res = NextResponse.json(responseBody, { status: 200 });
    res.cookies.set("session", token, {
      httpOnly: true,
      path: "/",
      maxAge: maxAge,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    return res;
  } catch (err) {
    console.error("verify-otp error:", err);
    return NextResponse.json({ success: false, message: "Verification failed", error: String(err) }, { status: 500 });
  }
}
