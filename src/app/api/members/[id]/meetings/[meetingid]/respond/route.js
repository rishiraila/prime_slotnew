export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import { z } from 'zod';

const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST,PATCH,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS() { return addCORS(NextResponse.json({}, { status: 204 })); }

async function requireSession() {
  if (DISABLE_AUTH) return { uid: 'TEST_USER' };
  const jar = await cookies();
  const session = jar.get('admin_session')?.value;
  if (!session) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  return adminAuth.verifySessionCookie(session, true);
}

const BodySchema = z.object({
  action: z.enum(['accept','decline']),
  eventId: z.string().min(1),
  message: z.string().optional().default('')
});

async function handleRespond(req, paramsPromise) {
  // IMPORTANT: params may be a Promise — await it
  const params = await paramsPromise;

  // support several bracket-name variants:
  const memberId = params?.id || params?.memberId || params?.memberid || params?.member;
  const meetingId = params?.meetingid || params?.meetingId || params?.meeting;

  if (!memberId || !meetingId) {
    return addCORS(NextResponse.json({ error: 'Missing route params memberId or meetingId' }, { status: 400 }));
  }

  // auth (or fake when DISABLE_AUTH=true)
  const user = await requireSession();

  // parse body
  const text = await req.text();
  let bodyObj = {};
  try { bodyObj = text ? JSON.parse(text) : {}; } catch (err) {
    return addCORS(NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }));
  }
  const { action, eventId, message } = BodySchema.parse(bodyObj);

  const path = `/meetings/${eventId}/${meetingId}`;
  const snap = await rtdb.ref(path).get();
  if (!snap.exists()) return addCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }));
  const meeting = snap.val();

  // ownership / user check (enforced when auth enabled)
  if (!DISABLE_AUTH) {
    if (user.uid !== memberId) return addCORS(NextResponse.json({ error: 'Not allowed: user mismatch' }, { status: 403 }));
    if (meeting.bId !== memberId && meeting.aId !== memberId) return addCORS(NextResponse.json({ error: 'Not allowed' }, { status: 403 }));
  }

  const updates = {};
  const now = Date.now();

  if (action === 'accept') {
    updates[`${path}/status`] = 'approved';
    updates[`${path}/updatedAt`] = now;
    updates[`/memberMeetings/${meeting.aId}/${eventId}/${meetingId}/status`] = 'approved';
    updates[`/memberMeetings/${meeting.bId}/${eventId}/${meetingId}/status`] = 'approved';
    const notifRef = rtdb.ref(`/notifications/${meeting.createdBy || meeting.aId}`).push();
    updates[`/notifications/${meeting.createdBy || meeting.aId}/${notifRef.key}`] = {
      type: 'meeting_accepted',
      meetingId,
      eventId,
      by: memberId,
      message,
      createdAt: now,
      read: false
    };
  } else {
    updates[`${path}/status`] = 'canceled';
    updates[`${path}/updatedAt`] = now;
    updates[`/memberMeetings/${meeting.aId}/${eventId}/${meetingId}/status`] = 'canceled';
    updates[`/memberMeetings/${meeting.bId}/${eventId}/${meetingId}/status`] = 'canceled';
    const notifRef = rtdb.ref(`/notifications/${meeting.createdBy || meeting.aId}`).push();
    updates[`/notifications/${meeting.createdBy || meeting.aId}/${notifRef.key}`] = {
      type: 'meeting_declined',
      meetingId,
      eventId,
      by: memberId,
      message,
      createdAt: now,
      read: false
    };
  }

  await rtdb.ref().update(updates);
  return addCORS(NextResponse.json({ ok: true }));
}

// Keep POST for backwards compatibility (it now awaits params)
export async function POST(req, { params }) {
  return handleRespond(req, params);
}

// Optional: also support PATCH (more semantically correct for status update)
export async function PATCH(req, { params }) {
  return handleRespond(req, params);
}
