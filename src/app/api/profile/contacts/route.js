// src/app/api/profile/contacts/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth, rtdb } from "@/lib/firebaseAdmin";
import jwt from "jsonwebtoken";

const ADMIN_COOKIE = "admin_session";
const JWT_COOKIE = "session";
const JWT_SECRET = process.env.JWT_SECRET || "MySuperSecretJWTSecret";

/* ---------------- AUTH FUNCTION ---------------- */
async function requireUser(req) {
  const jar = await cookies();

  // 1) Try Bearer token
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { mode: "member", uid: payload.sub };
    } catch {}
  }

  // 2) Try JWT cookie
  const cookieToken = jar.get(JWT_COOKIE)?.value;
  if (cookieToken) {
    try {
      const payload = jwt.verify(cookieToken, JWT_SECRET);
      return { mode: "member", uid: payload.sub };
    } catch {}
  }

  // 3) Try admin session
  const session = jar.get(ADMIN_COOKIE)?.value;
  if (!session)
    throw Object.assign(new Error("Unauthorized"), { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true);
  return { mode: "admin", uid: decoded.uid };
}

/* ---------------- CORS ---------------- */
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

/* ---------------- MAIN GET HANDLER ---------------- */
export async function GET(req) {
  try {
    const user = await requireUser(req);

    // 🔥 USE TOKEN USER ALWAYS
    const userId = user.uid;

    // contact list from RTDB
    const snap = await rtdb.ref(`/userContacts/${userId}`).get();
    if (!snap.exists()) {
      return addCORS(NextResponse.json({ contacts: [] }));
    }

    const contactData = snap.val();
    const contactIds = Object.keys(contactData);

    const contacts = [];

    // fetch full member details
    for (const cid of contactIds) {
      const memberSnap = await rtdb.ref(`/members/${cid}`).get();
      if (memberSnap.exists()) {
        const m = memberSnap.val();
        contacts.push({
          id: cid,
          name: m.fullName || "Unknown",
          phone: m.phone || "",
          email: m.email || "",
          profile: m.userProfile || "",
          addedAt: contactData[cid].addedAt,
          meetingId: contactData[cid].meetingId,
        });
      }
    }

    return addCORS(NextResponse.json({ contacts }));
  } catch (err) {
    return addCORS(
      NextResponse.json(
        { error: err.message || "Server error" },
        { status: err.status || 500 }
      )
    );
  }
}
