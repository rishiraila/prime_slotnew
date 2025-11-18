export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';
const ADMIN_COOKIE = 'admin_session';
const JWT_COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST,PATCH,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

async function requireUser(req) {
  if (DISABLE_AUTH) return { mode: 'test', uid: 'TEST_USER' };

  const jar = await cookies();

  // 1) try JWT
  let token = null;
  const auth =
    req.headers.get('authorization') ||
    req.headers.get('Authorization') ||
    '';
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice('Bearer '.length).trim();
  }
  if (!token) {
    token = jar.get(JWT_COOKIE)?.value || null;
  }

  if (token && JWT_SECRET) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      return { mode: 'member', uid: payload.sub, payload };
    } catch (e) {
      // ignore, try admin
    }
  }

  // 2) fallback: admin_session
  const session = jar.get(ADMIN_COOKIE)?.value;
  if (!session)
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  const decoded = await adminAuth.verifySessionCookie(session, true);
  return { mode: 'admin', uid: decoded.uid, decoded };
}

const BodySchema = z.object({
  action: z.enum(['accept', 'decline']),
  eventId: z.string().min(1),
  message: z.string().optional().default(''),
});

async function handleRespond(req, paramsPromise) {
  const params = await paramsPromise;
  const memberId =
    params?.id ||
    params?.memberId ||
    params?.memberid ||
    params?.member;
  const meetingId =
    params?.meetingId ||
    params?.meetingid ||
    params?.meeting;

  if (!memberId || !meetingId) {
    return addCORS(
      NextResponse.json(
        { error: 'Missing route params memberId or meetingId' },
        { status: 400 }
      )
    );
  }

  const user = await requireUser(req);

  // For member mode, responder is the authenticated user; for admin, use URL param
  const responderId = user.mode === 'member' ? user.uid : memberId;

  const text = await req.text();
  let bodyObj = {};
  try {
    bodyObj = text ? JSON.parse(text) : {};
  } catch (err) {
    return addCORS(
      NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    );
  }
  const { action, eventId, message } = BodySchema.parse(bodyObj);

  const path = `/meetings/${eventId}/${meetingId}`;
  const snap = await rtdb.ref(path).get();
  if (!snap.exists()) {
    return addCORS(
      NextResponse.json({ error: 'Not found' }, { status: 404 })
    );
  }
  const meeting = snap.val();

  // enforce ownership
  if (!DISABLE_AUTH) {
    const responderId = user.mode === 'member' ? user.uid : memberId;
    if (meeting.bId !== responderId && meeting.aId !== responderId) {
      return addCORS(
        NextResponse.json({ error: 'Not allowed' }, { status: 403 })
      );
    }
  }

  const updates = {};
  const now = Date.now();

  if (action === 'accept') {
    updates[`${path}/status`] = 'approved';
    updates[`${path}/updatedAt`] = now;
    updates[
      `/memberMeetings/${meeting.aId}/${eventId}/${meetingId}/status`
    ] = 'approved';
    updates[
      `/memberMeetings/${meeting.bId}/${eventId}/${meetingId}/status`
    ] = 'approved';
    const notifRef = rtdb
      .ref(`/notifications/${meeting.createdBy || meeting.aId}`)
      .push();
    updates[
      `/notifications/${meeting.createdBy || meeting.aId}/${notifRef.key}`
    ] = {
      type: 'meeting_accepted',
      meetingId,
      eventId,
      by: responderId,
      message,
      createdAt: now,
      read: false,
    };
  } else {
    updates[`${path}/status`] = 'canceled';
    updates[`${path}/updatedAt`] = now;
    updates[
      `/memberMeetings/${meeting.aId}/${eventId}/${meetingId}/status`
    ] = 'canceled';
    updates[
      `/memberMeetings/${meeting.bId}/${eventId}/${meetingId}/status`
    ] = 'canceled';
    const notifRef = rtdb
      .ref(`/notifications/${meeting.createdBy || meeting.aId}`)
      .push();
    updates[
      `/notifications/${meeting.createdBy || meeting.aId}/${notifRef.key}`
    ] = {
      type: 'meeting_declined',
      meetingId,
      eventId,
      by: responderId,
      message,
      createdAt: now,
      read: false,
    };
  }

  await rtdb.ref().update(updates);
  return addCORS(NextResponse.json({ ok: true }));
}

export async function POST(req, { params }) {
  return handleRespond(req, params);
}

export async function PATCH(req, { params }) {
  return handleRespond(req, params);
}
