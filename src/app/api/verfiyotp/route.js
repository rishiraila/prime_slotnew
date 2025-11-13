// src/app/api/verfiyotp/route.js
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const accessToken = body?.accessToken || body?.["access-token"];
    if (!accessToken) {
      return NextResponse.json({ success: false, message: "Missing accessToken" }, { status: 400 });
    }

    const MSG91_AUTHKEY = process.env.MSG91_AUTHKEY;
    if (!MSG91_AUTHKEY) {
      return NextResponse.json({ success: false, message: "Server misconfigured: MSG91_AUTHKEY missing" }, { status: 500 });
    }

    const resp = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authkey: MSG91_AUTHKEY,
        "access-token": accessToken,
      }),
    });

    const data = await resp.json();

    // MSG91 returns type/status. Accept both shapes.
    const verified = resp.ok && (data.type === "success" || data.status === "success");

    if (verified) {
      // data may contain user info — adapt to your needs
      return NextResponse.json({ success: true, message: "Verified", data: data.data ?? data });
    } else {
      return NextResponse.json({ success: false, message: data.message || "Invalid access token", raw: data }, { status: 400 });
    }
  } catch (err) {
    console.error("verify-otp error:", err);
    return NextResponse.json({ success: false, message: "Verification failed", error: String(err) }, { status: 500 });
  }
}
