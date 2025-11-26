export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import jwt from 'jsonwebtoken';

const ADMIN_COOKIE = 'admin_session';
const JWT_COOKIE = 'session';
const JWT_SECRET = process.env.JWT_SECRET || 'MySuperSecretJWTSecret';

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,PATCH,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}

export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

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

export async function GET(req, { params }) {
  try {
    const paramsData = await params;
    const memberId =
      paramsData?.id ||
      paramsData?.memberId ||
      paramsData?.memberid ||
      paramsData?.member;

    if (!memberId) {
      return addCORS(
        NextResponse.json(
          { error: 'Missing route param memberId' },
          { status: 400 }
        )
      );
    }

    // Fetch member details from /members/{memberId}
    const memberSnap = await rtdb.ref(`/members/${memberId}`).once('value');
    if (!memberSnap.exists()) {
      return addCORS(
        NextResponse.json({ error: 'Member not found' }, { status: 404 })
      );
    }

    const memberData = memberSnap.val();

    // Return the full member details
    return addCORS(NextResponse.json({ member: { id: memberId, ...memberData } }, { status: 200 }));
  } catch (e) {
    return addCORS(
      NextResponse.json(
        { error: e.message || 'Server error' },
        { status: e.status || 500 }
      )
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    const paramsData = await params;
    const memberId =
      paramsData?.id ||
      paramsData?.memberId ||
      paramsData?.memberid ||
      paramsData?.member;

    if (!memberId) {
      return addCORS(
        NextResponse.json(
          { error: 'Missing route param memberId' },
          { status: 400 }
        )
      );
    }

    // Require authentication
    const user = await requireUser(req);
    // For now, allow admin or the member themselves to update
    if (user.mode !== 'admin' && user.uid !== memberId) {
      return addCORS(
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      );
    }

    // Parse the request body
    const updateData = await req.json();

    // Update the member in RTDB
    await rtdb.ref(`/members/${memberId}`).update(updateData);

    // Fetch the updated member data
    const updatedMemberSnap = await rtdb.ref(`/members/${memberId}`).once('value');
    const updatedMemberData = updatedMemberSnap.val();

    return addCORS(NextResponse.json({ member: { id: memberId, ...updatedMemberData } }, { status: 200 }));
  } catch (e) {
    return addCORS(
      NextResponse.json(
        { error: e.message || 'Server error' },
        { status: e.status || 500 }
      )
    );
  }
}
// DELETE handler — paste into src/app/api/members/[id]/route.js
export async function DELETE(req, { params }) {
  try {
    const paramsData = await params;
    const memberId =
      paramsData?.id ||
      paramsData?.memberId ||
      paramsData?.memberid ||
      paramsData?.member;

    if (!memberId) {
      return addCORS(
        NextResponse.json(
          { error: "Missing route param memberId" },
          { status: 400 }
        )
      );
    }

    // Only admin can delete members
    const user = await requireUser(req);
    if (user.mode !== "admin") {
      return addCORS(
        NextResponse.json({ error: "Forbidden" }, { status: 403 })
      );
    }

    // We'll collect paths to delete (set to null)
    const deletePaths = new Set();

    // Helper: add path
    const add = (p) => {
      if (typeof p === "string" && p.length) deletePaths.add(p);
    };

    // 1) member profile
    add(`/members/${memberId}`);

    // 2) this member's userContacts (remove whole folder under member)
    add(`/userContacts/${memberId}`);

    // 3) remove this member from other users' contacts
    const contactsSnap = await rtdb.ref("/userContacts").once("value");
    if (contactsSnap.exists()) {
      const allContacts = contactsSnap.val();
      for (const uid in allContacts) {
        if (allContacts[uid] && allContacts[uid][memberId] !== undefined) {
          add(`/userContacts/${uid}/${memberId}`);
        }
      }
    }

    // 4) notifications folder for this member
    add(`/notifications/${memberId}`);

    // 5) standalone meetings where aId or bId match -> delete meeting and memberMeetings indexes
    const standaloneSnap = await rtdb.ref("/meetings_standalone").once("value");
    if (standaloneSnap.exists()) {
      const allStand = standaloneSnap.val();
      for (const mid in allStand) {
        const m = allStand[mid];
        if (!m) continue;
        if (m.aId === memberId || m.bId === memberId) {
          add(`/meetings_standalone/${mid}`);
          // memberMeetings entries (we remove only child's path)
          add(`/memberMeetings/${m.aId}/standalone/${mid}`);
          add(`/memberMeetings/${m.bId}/standalone/${mid}`);
        }
      }
    }

    // 6) event-based meetings where aId or bId match -> delete meeting and memberMeetings entries
    const eventsSnap = await rtdb.ref("/meetings").once("value");
    if (eventsSnap.exists()) {
      const allEvents = eventsSnap.val();
      for (const eventId in allEvents) {
        const eventMeetings = allEvents[eventId] || {};
        for (const mid in eventMeetings) {
          const m = eventMeetings[mid];
          if (!m) continue;
          if (m.aId === memberId || m.bId === memberId) {
            add(`/meetings/${eventId}/${mid}`);
            add(`/memberMeetings/${m.aId}/${eventId}/${mid}`);
            add(`/memberMeetings/${m.bId}/${eventId}/${mid}`);
          }
        }
      }
    }

    // 7) remove memberMeetings folder for this member (if anything was left)
    add(`/memberMeetings/${memberId}`);

    // 8) remove this member from eventMembers
    const evSnap = await rtdb.ref("/eventMembers").once("value");
    if (evSnap.exists()) {
      const allEv = evSnap.val();
      for (const eventId in allEv) {
        if (allEv[eventId] && allEv[eventId][memberId] !== undefined) {
          add(`/eventMembers/${eventId}/${memberId}`);
        }
      }
    }

    // ------------ PRUNE ancestors to avoid RTDB ancestor/descendant conflict ------------
    // Convert set -> array and sort by path length descending (keep children)
    const paths = Array.from(deletePaths);
    // Normalize trailing slashes (no trailing slash)
    const normalized = paths.map(p => p.replace(/\/+$/, ''));
    // Sort descending by length so children come before parents
    normalized.sort((a,b) => b.length - a.length);

    // Keep only paths that are not ancestor of an already-kept path
    const finalPaths = [];
    for (const p of normalized) {
      // if any kept path starts with p + '/', then p is ancestor -> skip p
      const isAncestor = finalPaths.some(kept => kept.startsWith(p + '/'));
      if (!isAncestor) finalPaths.push(p);
    }

    // Build updates object
    const updates = {};
    for (const p of finalPaths) {
      updates[p] = null;
    }

    // If updates is empty something is wrong — still attempt to delete member
    if (Object.keys(updates).length === 0) {
      // fallback: delete the member profile alone
      await rtdb.ref(`/members/${memberId}`).set(null);
      return addCORS(NextResponse.json({ ok: true, deleted: memberId }));
    }

    // Apply update
    await rtdb.ref().update(updates);

    return addCORS(
      NextResponse.json({ ok: true, deleted: memberId, removedPathsCount: Object.keys(updates).length }, { status: 200 })
    );
  } catch (e) {
    console.error("delete-member error:", e);
    return addCORS(
      NextResponse.json(
        { error: e.message || "Server error" },
        { status: e.status || 500 }
      )
    );
  }
}
