export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { getFirebase } from '@/lib/firebaseAdmin';

// Verify Firebase ID Token from Authorization Header
async function verifyToken(request) {
  const header = request.headers.get('authorization');
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.split('Bearer ')[1];
  try {
    const { auth } = getFirebase();
    return await auth.verifyIdToken(token);
  } catch {
    return null;
  }
}

// Check if requester is admin
async function isAdmin(uid) {
  try {
    const { db } = getFirebase();
    const snap = await db.ref(`users/${uid}`).get();
    if (!snap.exists()) return false;
    const user = snap.val();
    return user.userType === 'admin';
  } catch {
    return false;
  }
}

// GET: List all users (must be logged in)
export async function GET(request) {
  const decodedUser = await verifyToken(request);
  if (!decodedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { db } = getFirebase();
  const snap = await db.ref('users').get();
  const val = snap.val() || {};
  const users = Object.entries(val).map(([id, data]) => ({ id, ...data }));
  return NextResponse.json({ users }, { status: 200 });
}

// POST: Create user (admin only) with optional image upload via multipart/form-data
export async function POST(request) {
  const decodedUser = await verifyToken(request);
  if (!decodedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = await isAdmin(decodedUser.uid);
  if (!admin) return NextResponse.json({ error: 'Forbidden: Admin Only' }, { status: 403 });

  const contentType = request.headers.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');

  try {
    let name, email, userType, business, profileImageUrl = '';

    if (isMultipart) {
      // ---- multipart path (file + fields) ----
      const form = await request.formData();
      name = (form.get('name') || '').toString();
      email = (form.get('email') || '').toString();
      userType = (form.get('userType') || '').toString();
      business = (form.get('business') || '').toString();
      const file = form.get('profileImage'); // a Blob or null

      if (!name || !email || !userType) {
        return NextResponse.json({ error: 'name, email, userType required' }, { status: 400 });
      }

      const { auth, bucket, db } = getFirebase();

      // Create Firebase Auth user first to get uid
      const userRecord = await auth.createUser({ email, displayName: name });

      // Optional: upload file if provided
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const bytes = Buffer.from(await file.arrayBuffer());
        const originalName = (file.name || 'profile').replace(/\s+/g, '-');
        const ext = (originalName.includes('.') ? originalName.split('.').pop() : 'bin');
        const objectName = `profiles/${userRecord.uid}/${Date.now()}-${originalName}`;
        const gcsFile = bucket.file(objectName);

        // Generate a download token for public access via tokened URL
        const token = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));

        await gcsFile.save(bytes, {
          contentType: file.type || 'application/octet-stream',
          metadata: {
            metadata: { firebaseStorageDownloadTokens: token },
          },
          resumable: false,
        });

        // Firebase Storage download URL format
        const bucketName = bucket.name;
        const encodedPath = encodeURIComponent(objectName);
        profileImageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;
      }

      // Save profile in RTDB
      const data = {
        name,
        email,
        userType,
        business: business || '',
        profileImage: profileImageUrl, // '' if none
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await db.ref(`users/${userRecord.uid}`).set(data);

      return NextResponse.json({ id: userRecord.uid, ...data }, { status: 201 });

    } else {
      // ---- JSON path (URL provided instead of file) ----
      const body = await request.json();
      name = body.name;
      email = body.email;
      userType = body.userType;
      business = body.business || '';
      profileImageUrl = body.profileImage || ''; // expecting a URL

      if (!name || !email || !userType) {
        return NextResponse.json({ error: 'name, email, userType required' }, { status: 400 });
      }

      const { auth, db } = getFirebase();
      const userRecord = await auth.createUser({ email, displayName: name });

      const data = {
        name,
        email,
        userType,
        business,
        profileImage: profileImageUrl,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await db.ref(`users/${userRecord.uid}`).set(data);

      return NextResponse.json({ id: userRecord.uid, ...data }, { status: 201 });
    }
  } catch (e) {
    console.error('POST /api/users', e);
    if (e?.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
