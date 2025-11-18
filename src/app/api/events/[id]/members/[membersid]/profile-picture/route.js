// src/app/api/events/[id]/members/[memberId]/profile-picture/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import Busboy from "busboy";
import { rtdb, storage } from "@/lib/firebaseAdmin";

const JWT_SECRET = "MY_SUPER_SECRET_KEY_123";

function addCORS(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return res;
}

export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

export async function POST(req, ctx) {
  try {
    const { memberId } = await ctx.params;
    if (!memberId) {
      return addCORS(
        NextResponse.json({ ok: false, message: "memberId missing" }, { status: 400 })
      );
    }

    // ============================
    // 1) Authorize User
    // ============================
    const auth = req.headers.get("authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return addCORS(
        NextResponse.json({ ok: false, message: "Missing Bearer token" }, { status: 401 })
      );
    }

    const token = auth.split(" ")[1];
    let payload;

    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return addCORS(
        NextResponse.json({ ok: false, message: "Invalid or expired token" }, { status: 401 })
      );
    }

    const tokenMemberId = String(payload.sub);
    const isAdmin = payload.role === "admin" || payload.admin === true;

    if (tokenMemberId !== String(memberId) && !isAdmin) {
      return addCORS(
        NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 })
      );
    }

    // ============================
    // 2) Ensure Member Exists
    // ============================
    const snap = await rtdb.ref(`/members/${memberId}`).get();
    if (!snap.exists()) {
      return addCORS(
        NextResponse.json({ ok: false, message: "Member not found" }, { status: 404 })
      );
    }

    // ============================
    // 3) Validate Upload Format
    // ============================
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return addCORS(
        NextResponse.json(
          { ok: false, message: "Content-Type must be multipart/form-data" },
          { status: 400 }
        )
      );
    }

    // ============================
    // 4) Parse Upload using Busboy
    // ============================
    const bb = Busboy({ headers: Object.fromEntries(req.headers) });

    let fileBuffer = null;
    let originalName = "";
    let mimeType = "";
    let foundFile = false;

    await new Promise((resolve, reject) => {
      bb.on("file", (_field, file, info) => {
        foundFile = true;
        originalName = info.filename;
        mimeType = info.mimeType || "application/octet-stream";

        const chunks = [];
        file.on("data", (d) => chunks.push(d));
        file.on("end", () => {
          fileBuffer = Buffer.concat(chunks);
        });
        file.on("error", reject);
      });

      bb.on("finish", resolve);
      bb.on("error", reject);

      const reader = req.body.getReader();
      (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bb.write(Buffer.from(value));
        }
        bb.end();
      })();
    });

    if (!foundFile || !fileBuffer) {
      return addCORS(
        NextResponse.json(
          { ok: false, message: 'No file found. Field should be named "file"' },
          { status: 400 }
        )
      );
    }

    // ============================
    // 5) Upload to Firebase Storage
    // ============================
    const ext =
      (originalName.match(/\.(\w+)$/)?.[1] ||
        mimeType.split("/")[1] ||
        "jpg").replace(/[^a-zA-Z0-9]/g, "");

    const ts = Date.now();
    const path = `members/${memberId}/${ts}.${ext}`;

    const bucket = storage.bucket();
    const file = bucket.file(path);

    await file.save(fileBuffer, {
      metadata: {
        contentType: mimeType,
        metadata: { uploadedBy: tokenMemberId }
      },
      resumable: false
    });

    // try to make public
    try {
      await file.makePublic();
    } catch {}

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURIComponent(path)}`;

    // ============================
    // 6) Save URL in RTDB
    // ============================
    await rtdb.ref(`/members/${memberId}`).update({
      userProfile: publicUrl,
      updatedAt: Date.now()
    });

    return addCORS(
      NextResponse.json({ ok: true, userProfile: publicUrl }, { status: 200 })
    );
  } catch (err) {
    console.error("profile-picture upload error:", err);
    return addCORS(
      NextResponse.json({ ok: false, message: "Server error", error: String(err) })
    );
  }
}
