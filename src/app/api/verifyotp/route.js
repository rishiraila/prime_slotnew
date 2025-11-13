// src/app/api/verifyotp/route.js
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

    // Call MSG91 verifyAccessToken
    const resp = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authkey: MSG91_AUTHKEY,
        "access-token": accessToken,
      }),
    });

    const data = await resp.json();

    // Treat success when MSG91 returns type/status success or HTTP 200
    const verified = resp.ok && (data?.type === "success" || data?.status === "success" || data?.success === true);

    if (verified) {
      // data may include user details, requestId, companyId, etc.
      return NextResponse.json({ success: true, message: "Verified", data: data.data ?? data });
    } else {
      return NextResponse.json({ success: false, message: data?.message || "Invalid access token", raw: data }, { status: 400 });
    }
  } catch (err) {
    console.error("verify-otp error:", err);
    return NextResponse.json({ success: false, message: "Verification failed", error: String(err) }, { status: 500 });
  }
}
