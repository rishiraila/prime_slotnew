// src/app/api/items/[id]/route.js
import { NextResponse } from 'next/server';
import { getFirebase } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

// GET /api/items/:id
export async function GET(_req, { params }) {
  const { id } = params;
  try {
    const { db } = getFirebase();
    const snap = await db.ref(`items/${id}`).get();
    if (!snap.exists()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ id, ...snap.val() }, { status: 200 });
  } catch (e) {
    console.error(`GET /api/items/${id}`, e);
    return NextResponse.json({ error: 'Failed to get item' }, { status: 500 });
  }
}

// PUT /api/items/:id
export async function PUT(request, { params }) {
  const { id } = params;
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const { db } = getFirebase();
    const ref = db.ref(`items/${id}`);
    const snap = await ref.get();
    if (!snap.exists()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await ref.update({ ...body, updatedAt: Date.now() });
    const updated = (await ref.get()).val();
    return NextResponse.json({ id, ...updated }, { status: 200 });
  } catch (e) {
    console.error(`PUT /api/items/${id}`, e);
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
  }
}

// DELETE /api/items/:id
export async function DELETE(_req, { params }) {
  const { id } = params;
  try {
    const { db } = getFirebase();
    const ref = db.ref(`items/${id}`);
    const snap = await ref.get();
    if (!snap.exists()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await ref.remove();
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    console.error(`DELETE /api/items/${id}`, e);
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
  }
}
