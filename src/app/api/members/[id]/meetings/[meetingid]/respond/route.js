// src/app/api/members/[id]/meetings/[meetingid]/respond/route.js
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
  message: z.string().optional().default(''),
});

// Helper: find where the meeting lives for the given member
async function locateMeetingForMember(memberId, meetingId) {
  const mmSnap = await rtdb.ref(`/memberMeetings/${memberId}`).once('value');
  const mm = mmSnap.val();
  if (!mm) return null;

  // Check legacy event grouped shape first
  for (const eId of Object.keys(mm)) {
    if (eId === 'standalone') continue;
    if (mm[eId] && mm[eId][meetingId]) {
      return { path: `/meetings/${eId}/${meetingId}`, eventId: eId, standalone: false };
    }
  }

  // check standalone bucket
  if (mm.standalone && mm.standalone[meetingId]) {
    return { path: `/meetings_standalone/${meetingId}`, eventId: null, standalone: true };
  }

  // edge: direct meetingId under memberMeetings (rare) -> treat as standalone
  if (mm[meetingId]) {
    return { path: `/meetings_standalone/${meetingId}`, eventId: null, standalone: true };
  }

  return null;
}

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
    return addCORS(NextResponse.json({ error: 'Missing route params memberId or meetingId' }, { status: 400 }));
  }

  const user = await requireUser(req);

  // Responder: for member mode, it must be the authenticated user; for admin, param is allowed
  const responderId = user.mode === 'member' ? user.uid : memberId;

  const text = await req.text();
  let bodyObj = {};
  try {
    bodyObj = text ? JSON.parse(text) : {};
  } catch (err) {
    return addCORS(NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }));
  }
  const { action, message } = BodySchema.parse(bodyObj);

  // locate meeting path and whether it's standalone
  const found = await locateMeetingForMember(responderId, meetingId);
  if (!found) {
    return addCORS(NextResponse.json({ error: 'Meeting not found for this member' }, { status: 404 }));
  }

  const { path, eventId, standalone } = found;
  const snap = await rtdb.ref(path).get();
  if (!snap.exists()) {
    return addCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }));
  }
  const meeting = snap.val();

  // enforce ownership (unless auth disabled)
  if (!DISABLE_AUTH) {
    const who = user.mode === 'member' ? user.uid : memberId;
    if (meeting.bId !== who && meeting.aId !== who) {
      return addCORS(NextResponse.json({ error: 'Not allowed' }, { status: 403 }));
    }
  }

  const updates = {};
  const now = Date.now();

  if (action === 'accept') {
    updates[`${path}/status`] = 'approved';
    updates[`${path}/updatedAt`] = now;

    if (standalone) {
      updates[`/memberMeetings/${meeting.aId}/standalone/${meetingId}/status`] = 'approved';
      updates[`/memberMeetings/${meeting.bId}/standalone/${meetingId}/status`] = 'approved';
    } else {
      updates[`/memberMeetings/${meeting.aId}/${eventId}/${meetingId}/status`] = 'approved';
      updates[`/memberMeetings/${meeting.bId}/${eventId}/${meetingId}/status`] = 'approved';
    }

    const notifRef = rtdb.ref(`/notifications/${meeting.createdBy || meeting.aId}`).push();
    updates[`/notifications/${meeting.createdBy || meeting.aId}/${notifRef.key}`] = {
      type: 'meeting_accepted',
      meetingId,
      eventId: standalone ? null : eventId,
      by: responderId,
      message,
      createdAt: now,
      read: false,
    };
  } else {
    // decline / cancel
    updates[`${path}/status`] = 'canceled';
    updates[`${path}/updatedAt`] = now;

    if (standalone) {
      updates[`/memberMeetings/${meeting.aId}/standalone/${meetingId}/status`] = 'canceled';
      updates[`/memberMeetings/${meeting.bId}/standalone/${meetingId}/status`] = 'canceled';
    } else {
      updates[`/memberMeetings/${meeting.aId}/${eventId}/${meetingId}/status`] = 'canceled';
      updates[`/memberMeetings/${meeting.bId}/${eventId}/${meetingId}/status`] = 'canceled';
    }

    const notifRef = rtdb.ref(`/notifications/${meeting.createdBy || meeting.aId}`).push();
    updates[`/notifications/${meeting.createdBy || meeting.aId}/${notifRef.key}`] = {
      type: 'meeting_declined',
      meetingId,
      eventId: standalone ? null : eventId,
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
