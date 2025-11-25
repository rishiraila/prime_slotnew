export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';

const ADMIN_COOKIE = 'admin_session';
const JWT_COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';

async function requireUser(req) {
  const jar = await cookies();

  // 1) try Bearer token (JWT from verify-widget-token)
  const auth =
    req.headers.get('authorization') ||
    req.headers.get('Authorization') ||
    '';
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { mode: 'member', uid: payload.sub, payload };
    } catch (e) {
      // ignore, try cookie
    }
  }

  // 2) try JWT cookie fallback
  const token = jar.get(JWT_COOKIE)?.value;
  if (token && JWT_SECRET) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { mode: 'member', uid: payload.sub, payload };
    } catch (e) {
      // ignore, try admin
    }
  }

  // 3) fallback: admin_session
  const session = jar.get(ADMIN_COOKIE)?.value;
  if (!session)
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const decoded = await adminAuth.verifySessionCookie(session, true);
  return { mode: 'admin', uid: decoded.uid, decoded };
}

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

export async function GET(req, { params }) {
  try {
    const paramsData = await params;
    const userId = paramsData?.id;

    if (!userId) {
      return addCORS(
        NextResponse.json({ error: 'Missing userId' }, { status: 400 })
      );
    }

    const user = await requireUser(req);

    // Allow access if admin or the user themselves
    if (user.mode !== 'admin' && user.uid !== userId) {
      return addCORS(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      );
    }

    // Fetch user's contacts
    const contactsSnap = await rtdb.ref(`/userContacts/${userId}`).get();
    if (!contactsSnap.exists()) {
      return addCORS(NextResponse.json({ contacts: [] }));
    }

    const contactData = contactsSnap.val();
    const contactIds = Object.keys(contactData);

    // Fetch member details for each contact
    const memberPromises = contactIds.map(async (contactId) => {
      const memberSnap = await rtdb.ref(`/members/${contactId}`).get();
      if (memberSnap.exists()) {
        const member = memberSnap.val();
        return {
          id: contactId,
          name: member.name || 'Unknown',
          phone: member.phone || '',
          email: member.email || '',
          profile: member.avatar || '', // assuming avatar is the profile field
          addedAt: contactData[contactId].addedAt,
          meetingId: contactData[contactId].meetingId,
        };
      }
      return null;
    });

    const contacts = (await Promise.all(memberPromises)).filter(Boolean);

    return addCORS(NextResponse.json({ contacts }));
  } catch (e) {
    return addCORS(
      NextResponse.json(
        { error: e.message || 'Server error' },
        { status: e.status || 500 }
      )
    );
  }
}
