// src/app/api/users/[id]/route.js
import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getAdminApp } from "@/lib/firebaseAdmin";

export const runtime = 'nodejs';

// GET /api/users/:id
export async function GET(request, { params }) {
  const decodedUser = await verifyAuth(request);
  if (!decodedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = params;
    const { rtdb: db } = getAdminApp();
    const snap = await db.ref(`users/${id}`).get();
    if (!snap.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({ id, ...snap.val() }, { status: 200 });
  } catch (e) {
    console.error(`GET /api/users/${params.id}`, e);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}

// PUT /api/users/:id
export async function PUT(request, { params }) {
  const decodedUser = await verifyAuth(request);
  if (!decodedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = params;
    const body = await request.json();
    const { rtdb: db } = getAdminApp();
    const ref = db.ref(`users/${id}`);
    const snap = await ref.get();
    if (!snap.exists()) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const data = { ...snap.val(), ...body, updatedAt: Date.now() };
    await ref.set(data);
    return NextResponse.json({ id, ...data }, { status: 200 });
  } catch (e) {
    console.error(`PUT /api/users/${params.id}`, e);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}