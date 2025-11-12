// src/app/api/items/[id]/route.js
import { NextResponse } from 'next/server';
import { getAdminApp } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

// GET /api/items/:id
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { rtdb: db } = getAdminApp();
    const snap = await db.ref(`items/${id}`).get();
    if (!snap.exists()) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    return NextResponse.json({ id, ...snap.val() }, { status: 200 });
  } catch (e) {
    console.error(`GET /api/items/${params.id}`, e);
    return NextResponse.json({ error: 'Failed to get item' }, { status: 500 });
  }
}

// PUT /api/items/:id
export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const { rtdb: db } = getAdminApp();
    const ref = db.ref(`items/${id}`);
    const snap = await ref.get();
    if (!snap.exists()) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    const data = { ...snap.val(), ...body, updatedAt: Date.now() };
    await ref.set(data);
    return NextResponse.json({ id, ...data }, { status: 200 });
  } catch (e) {
    console.error(`PUT /api/items/${params.id}`, e);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

// DELETE /api/items/:id
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const { rtdb: db } = getAdminApp();
    await db.ref(`items/${id}`).remove();
    return NextResponse.json({ message: 'Item deleted' }, { status: 200 });
  } catch (e) {
    console.error(`DELETE /api/items/${params.id}`, e);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}