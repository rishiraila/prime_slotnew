// src/app/api/me/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { rtdb } from "@/lib/firebaseAdmin";

// ✅ use the same secret as verify-widget-token + profile/upload + approve
const JWT_SECRET = process.env.JWT_SECRET || "MySuperSecretJWTSecret";

function addCORS(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  return res;
}

export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

export async function GET(request) {
  try {
    const auth = request.headers.get("authorization") || "";
    const cookieHeader = request.headers.get("cookie") || "";
    let token = null;

    // 1) Bearer header
    if (auth && auth.startsWith("Bearer ")) {
      token = auth.split(" ")[1];
    } else {
      // 2) session cookie fallback (for browser)
      const m = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
      if (m) token = decodeURIComponent(m[1]);
    }

    if (!token) {
      return addCORS(
        NextResponse.json(
          { success: false, message: "Missing token" },
          { status: 401 }
        )
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return addCORS(
        NextResponse.json(
          { success: false, message: "Token expired or invalid" },
          { status: 401 }
        )
      );
    }

    const memberId = decoded.sub;
    if (!memberId) {
      return addCORS(
        NextResponse.json(
          { success: false, message: "Invalid token payload" },
          { status: 401 }
        )
      );
    }

    const snap = await rtdb.ref(`/members/${memberId}`).get();
    if (!snap.exists()) {
      return addCORS(
        NextResponse.json(
          { success: false, message: "Member not found" },
          { status: 404 }
        )
      );
    }

    return addCORS(
      NextResponse.json(
        {
          success: true,
          memberId,
          member: snap.val(), // includes userProfile with approved/photoURL/etc.
        },
        { status: 200 }
      )
    );
  } catch (err) {
    console.error("me route error:", err);
    return addCORS(
      NextResponse.json(
        {
          success: false,
          message: "Server error",
          error: String(err),
        },
        { status: 500 }
      )
    );
  }
}
