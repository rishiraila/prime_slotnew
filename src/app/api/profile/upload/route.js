// src/app/api/profile/upload/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { bucket, rtdb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_COOKIE = 'session';
// ✅ use the same secret as /api/verify-widget-token
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';

// helper to get memberId from JWT (user token)
async function getMemberIdFromRequest(req) {
  const jar = await cookies();
  let token = jar.get(JWT_COOKIE)?.value || null;

  // also allow Authorization: Bearer <token>
  if (!token) {
    const auth =
      req.headers.get('authorization') || req.headers.get('Authorization');
    if (auth && auth.startsWith('Bearer ')) {
      token = auth.slice('Bearer '.length).trim();
    }
  }

  if (!token) {
    console.log('getMemberIdFromRequest: no token found');
    return null;
  }
  if (!JWT_SECRET) {
    console.error('getMemberIdFromRequest: JWT_SECRET is missing');
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    console.log('getMemberIdFromRequest: payload =', payload);
    return payload?.sub || null; // memberId from verify-widget-token
  } catch (err) {
    console.error('getMemberIdFromRequest: verify failed', err);
    return null;
  }
}

export async function POST(req) {
  const memberId = await getMemberIdFromRequest(req);
  if (!memberId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('photo');

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `profiles/${memberId}/profile_${Date.now()}.${fileExtension}`;

    console.log('Using bucket:', bucket.name);

    const fileUpload = bucket.file(fileName);

    await fileUpload.save(buffer, {
      metadata: {
        contentType: file.type,
        metadata: {
          uploadedBy: memberId,
          originalName: file.name,
        },
      },
    });

    await fileUpload.makePublic();

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
    const now = Date.now();

    // /profiles/{memberId}
    await rtdb.ref(`/profiles/${memberId}`).update({
      photoURL: publicUrl,
      updatedAt: now,
    });

    // /members/{memberId}/userProfile
    const memberProfileRef = rtdb.ref(`/members/${memberId}/userProfile`);
    const snapshot = await memberProfileRef.get();
    const current = snapshot.exists() ? snapshot.val() : null;

    let newProfile;
    if (typeof current === 'string') {
      newProfile = {
        type: current,
        photoURL: publicUrl,
        approved: false,
        updatedAt: now,
      };
    } else if (current && typeof current === 'object') {
      newProfile = {
        ...current,
        photoURL: publicUrl,
        approved: false,
        updatedAt: now,
      };
    } else {
      newProfile = {
        photoURL: publicUrl,
        approved: false,
        updatedAt: now,
      };
    }

    await memberProfileRef.set(newProfile);

    return NextResponse.json({
      success: true,
      memberId,
      photoURL: publicUrl,
      userProfile: newProfile,
      message: 'Profile photo uploaded and profile updated',
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload image', details: error.message },
      { status: 500 }
    );
  }
}
