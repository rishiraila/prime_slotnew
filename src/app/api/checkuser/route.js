// src/app/api/check-user/route.js
import { NextResponse } from "next/server";

// adapt to your firebase admin export
// your existing file earlier referenced `rtdb` (Realtime Database)
import { rtdb } from "@/lib/firebaseAdmin"; // <-- change path if needed

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    let phone = (body?.phone || "").toString().trim();

    if (!phone) {
      return NextResponse.json({ ok: false, message: "Phone required" }, { status: 400 });
    }

    // normalize phone digits only: keep country code + digits (remove spaces, +, -)
    const digits = phone.replace(/\D/g, "");
    if (!digits) {
      return NextResponse.json({ ok: false, message: "Invalid phone" }, { status: 400 });
    }

    if (!rtdb) {
      // If rtdb isn't configured, return error (or decide to allow)
      console.error("RTDB not available (check firebaseAdmin import)");
      return NextResponse.json({ ok: false, message: "Server misconfigured: RTDB not available" }, { status: 500 });
    }

    // check path /users/{digits} — adapt if your users stored elsewhere
    const userRef = rtdb.ref(`users/${digits}`);
    const snapshot = await userRef.get();

    const exists = snapshot.exists();
    const value = exists ? snapshot.val() : null;

    return NextResponse.json({ ok: true, exists, user: value ?? null });
  } catch (err) {
    console.error("check-user error:", err);
    return NextResponse.json({ ok: false, message: "Server error", error: String(err) }, { status: 500 });
  }
}
