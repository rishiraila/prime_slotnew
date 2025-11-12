export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getFirebase } from "@/lib/firebaseAdmin";

// GET /api/users/:id
export async function GET(request, { params }) {
  const { authorized } = verifyAuth(request);
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const { db } = getFirebase();
  const snap = await db.ref(`users/${id}`).get();
  if (!snap.exists()) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ id, ...snap.val() }, { status: 200 });
}

// PUT /api/users/:id  (update user)
export async function PUT(request, { params }) {
  const { authorized } = verifyAuth(request);
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const body = await request.json();
  const { db } = getFirebase();
  await db.ref(`users/${id}`).update({ ...body, updatedAt: Date.now() });

  const snap = await db.ref(`users/${id}`).get();
  return NextResponse.json({ id, ...snap.val() }, { status: 200 });
}

// DELETE /api/users/:id
export async function DELETE(request, { params }) {
  const { authorized } = verifyAuth(request);
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const { db } = getFirebase();
  await db.ref(`users/${id}`).remove();
  return NextResponse.json({ success: true }, { status: 200 });
}
