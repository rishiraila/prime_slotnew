// src/app/api/profile/approve/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { rtdb } from '@/lib/firebaseAdmin';

const JWT_COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';

// same logic as in /api/profile/upload
async function getMemberIdFromRequest(req) {
  const jar = await cookies();
  let token = jar.get(JWT_COOKIE)?.value || null;

  if (!token) {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    if (auth && auth.startsWith('Bearer ')) {
      token = auth.slice('Bearer '.length).trim();
    }
  }

  if (!token || !JWT_SECRET) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload?.sub || null; // memberId
  } catch {
    return null;
  }
}

export async function POST(req) {
  const memberId = await getMemberIdFromRequest(req);
  if (!memberId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const memberProfileRef = rtdb.ref(`/members/${memberId}/userProfile`);
    const snap = await memberProfileRef.get();
    const current = snap.exists() ? snap.val() : null;
    const now = Date.now();

    let newProfile;
    if (typeof current === 'string') {
      // e.g. "Standard" → convert to object
      newProfile = {
        type: current,
        approved: true,
        approvedAt: now,
        updatedAt: now,
      };
    } else if (current && typeof current === 'object') {
      newProfile = {
        ...current,
        approved: true,
        approvedAt: now,
        updatedAt: now,
      };
    } else {
      // no previous data, just mark approved
      newProfile = {
        approved: true,
        approvedAt: now,
        updatedAt: now,
      };
    }

    await memberProfileRef.set(newProfile);

    return NextResponse.json({
      success: true,
      memberId,
      userProfile: newProfile,
      message: 'Profile approved',
    });
  } catch (err) {
    console.error('approve-profile error:', err);
    return NextResponse.json(
      { error: 'Failed to approve profile', details: String(err) },
      { status: 500 }
    );
  }
}
