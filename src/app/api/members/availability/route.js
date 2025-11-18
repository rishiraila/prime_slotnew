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

  // 1) Try member JWT (Authorization: Bearer or session cookie)
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
      // ignore and try admin_session
    }
  }

  // 2) Fallback: admin_session (admin web)
  const session = jar.get(ADMIN_COOKIE)?.value;
  if (!session)
    throw Object.assign(new Error('Unauthorized'), { status: 401 });

  const decoded = await adminAuth.verifySessionCookie(session, true);
  return { mode: 'admin', uid: decoded.uid, decoded };
}

function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS() {
  return addCORS(NextResponse.json({}, { status: 204 }));
}

const BodySchema = {
  parse(body) {
    const {
      aid,
      bid,
    } = body || {};
    if (!aid || !bid) throw Object.assign(new Error('aid & bid required'), { status: 400 });
    return {
      aid: String(aid),
      bid: String(bid),
    };
  },
};

function mergeIntervals(intervals = []) {
  if (!intervals.length) return [];
  intervals.sort((a, b) => a.start - b.start);
  const out = [];
  let cur = { ...intervals[0] };
  for (let i = 1; i < intervals.length; i++) {
    const it = intervals[i];
    if (it.start <= cur.end) {
      cur.end = Math.max(cur.end, it.end);
    } else {
      out.push(cur);
      cur = { ...it };
    }
  }
  out.push(cur);
  return out;
}

export async function POST(req) {
  try {
    await requireUser(req);
    const rawBody = await req.json();
    const { aid, bid } = BodySchema.parse(rawBody);

    const snap = await rtdb.ref('/meetings').get();
    const events = [];

    if (snap.exists()) {
      const val = snap.val();
      // Fetch member names for titles
      const memberIds = new Set([aid, bid]);
      const memberPromises = Array.from(memberIds).map(async (id) => {
        const res = await rtdb.ref(`/members/${id}`).get();
        if (res.exists()) {
          const memberData = res.val();
          return { id, name: memberData.name || memberData.displayName || `Member ${id}` };
        }
        return { id, name: `Member ${id}` };
      });
      const membersArray = await Promise.all(memberPromises);
      const membersMap = {};
      membersArray.forEach(member => {
        membersMap[member.id] = member.name;
      });

      for (const [evId, block] of Object.entries(val)) {
        for (const [mId, m] of Object.entries(block || {})) {
          if (!m || m.status === 'canceled') continue;
          if (m.aId === aid || m.bId === aid || m.aId === bid || m.bId === bid) {
            const start = Number(m.scheduledAt || 0);
            const end = start + ((m.durationMin || 30) * 60 * 1000);

            // Determine the other member for the title
            let otherMemberId = null;
            if (m.aId === aid && m.bId === bid) {
              otherMemberId = bid; // Meeting between aid and bid
            } else if (m.aId === bid && m.bId === aid) {
              otherMemberId = aid; // Meeting between bid and aid
            } else if (m.aId === aid) {
              otherMemberId = m.bId; // aid's meeting with someone else
            } else if (m.bId === aid) {
              otherMemberId = m.aId; // aid's meeting with someone else
            } else if (m.aId === bid) {
              otherMemberId = m.bId; // bid's meeting with someone else
            } else if (m.bId === bid) {
              otherMemberId = m.aId; // bid's meeting with someone else
            }

            const otherMemberName = otherMemberId ? membersMap[otherMemberId] || `Member ${otherMemberId}` : 'Unknown';

            events.push({
              id: `${evId}-${mId}`,
              title: `Meeting with ${otherMemberName}`,
              start: new Date(start).toISOString(),
              end: new Date(end).toISOString(),
              allDay: false,
              extendedProps: {
                calendar: 'Business',
                meetingId: mId,
                eventId: evId,
                status: m.status || 'scheduled',
                topic: m.topic || '',
                notes: m.notes || '',
              },
            });
          }
        }
      }
    }

    return addCORS(
      NextResponse.json({ aid, bid, events })
    );
  } catch (e) {
    return addCORS(
      NextResponse.json(
        { error: e.message || 'Server error' },
        { status: e.status || 500 }
      )
    );
  }
}
