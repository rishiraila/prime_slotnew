// src/app/api/items/route.js
import { NextResponse } from 'next/server';
import { getFirebase } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs'; // ensure Node (not Edge) for Admin SDK

// GET /api/items
export async function GET() {
  try {
    const { db } = getFirebase();
    const snap = await db.ref('items').get();
    const val = snap.val() || {};
    const items = Object.entries(val).map(([id, data]) => ({ id, ...data }));
    return NextResponse.json({ items }, { status: 200 });
  } catch (e) {
    console.error('GET /api/items', e);
    return NextResponse.json({ error: 'Failed to list items' }, { status: 500 });
  }
}

// POST /api/items
export async function POST(request) {
  try {
    const body = await request.json();
    if (!body?.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    const { db } = getFirebase();
    const ref = db.ref('items').push();
    const data = {
      name: body.name,
      description: body.description || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await ref.set(data);
    return NextResponse.json({ id: ref.key, ...data }, { status: 201 });
  } catch (e) {
    console.error('POST /api/items', e);
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
  }
}
