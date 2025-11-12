export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { adminAuth, rtdb } from '@/lib/firebaseAdmin';
import { z } from 'zod';
import * as XLSX from 'xlsx';

const COOKIE = 'admin_session';

/* ---------- auth ---------- */
async function requireSession() {
  const jar = await cookies();
  const session = jar.get(COOKIE)?.value;
  if (!session) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  await adminAuth.verifySessionCookie(session, true);
}

/* ---------- helpers ---------- */
function addCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
export async function OPTIONS() { return addCORS(NextResponse.json({}, { status: 204 })); }

/* ---- validators & mapping ---- */
const RowSchema = z.object({
  fullName: z.string().min(1, 'fullName required'),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  chapterName: z.string().optional().nullable(),
  memberStatus: z.string().optional().nullable(),
  businessCategory: z.string().optional().nullable(),
});

const HEADER_MAP = {
  'name':'fullName','full name':'fullName','user':'fullName',
  'email':'email','e-mail':'email',
  'mobile':'phone','phone':'phone','phone number':'phone',
  'chapter':'chapterName','chapter name':'chapterName',
  'status':'memberStatus','membership status':'memberStatus',
  'category':'businessCategory','business category':'businessCategory',
};
const normHeaders = (arr)=>arr.map(h=>HEADER_MAP[String(h||'').trim().toLowerCase()]||String(h||'').trim());
const rowToObj = (headers,row)=>headers.reduce((o,k,i)=>(k?(o[k]=row[i]??row[k],o):o),{});

/* ---- safe index keys (RTDB cannot contain . # $ [ ]) ---- */
const emailIndexKey = e => e ? String(e).trim().toLowerCase().replace(/\./g, ',') : null;
const phoneIndexKey = p => p ? String(p).replace(/[^\d]/g,'') : null;

/* ---- lookup / upsert ---- */
async function findExistingMemberId({ email, phone }) {
  const ek = emailIndexKey(email);
  if (ek) {
    const snap = await rtdb.ref(`/memberIndex/byEmail/${ek}`).get();
    if (snap.exists()) return Object.keys(snap.val())[0];
  }
  const pk = phoneIndexKey(phone);
  if (pk) {
    const snap = await rtdb.ref(`/memberIndex/byPhone/${pk}`).get();
    if (snap.exists()) return Object.keys(snap.val())[0];
  }
  return null;
}
async function indexMemberIds(memberId, profile) {
  const ops = {};
  const ek = emailIndexKey(profile.email);
  if (ek) ops[`/memberIndex/byEmail/${ek}/${memberId}`] = true;
  const pk = phoneIndexKey(profile.phone);
  if (pk) ops[`/memberIndex/byPhone/${pk}/${memberId}`] = true;
  if (Object.keys(ops).length) await rtdb.ref().update(ops);
}
async function createMember(profile) {
  const now = Date.now();
  const ref = await rtdb.ref('/members').push({ ...profile, createdAt: now, updatedAt: now });
  const memberId = ref.key;
  await indexMemberIds(memberId, profile);
  return memberId;
}
async function updateMember(memberId, profile) {
  const now = Date.now();
  await rtdb.ref(`/members/${memberId}`).update({ ...profile, updatedAt: now });
  await indexMemberIds(memberId, profile);
}

/* ---------- POST: import members (dedupe; link to event) ---------- */
export async function POST(req, ctx) {
  try {
    await requireSession();
    const { id: eventId } = await ctx.params;   // <-- IMPORTANT: await params

    const form = await req.formData();
    const file = form.get('file');
    const dryRun = String(form.get('dryRun') ?? 'false').toLowerCase() === 'true';
    if (!file || typeof file.arrayBuffer !== 'function') {
      return addCORS(NextResponse.json({ error: 'file is required (xlsx/csv)' }, { status: 400 }));
    }

    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return addCORS(NextResponse.json({ error: 'No sheet found' }, { status: 400 }));

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    if (!rows.length) return addCORS(NextResponse.json({ error: 'Empty sheet' }, { status: 400 }));

    const headers = normHeaders(rows[0]);

    const summary = {
      totalRows: Math.max(0, rows.length - 1),
      createdMembers: 0,
      updatedMembers: 0,
      linkedToEvent: 0,
      alreadyLinked: 0,
      errors: [],
      rowResults: []
    };

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every(c => (c ?? '').toString().trim() === '')) continue;

      try {
        const rawObj = rowToObj(headers, row);
        const profile = RowSchema.parse({
          fullName: (rawObj.fullName ?? rawObj.name ?? rawObj.user ?? '').trim(),
          email: rawObj.email || null,
          phone: rawObj.phone || null,
          chapterName: rawObj.chapterName || rawObj.chapter || null,
          memberStatus: rawObj.memberStatus || rawObj.status || null,
          businessCategory: rawObj.businessCategory || rawObj.category || null,
        });

        let memberId = await findExistingMemberId(profile);
        if (!memberId) {
          if (dryRun) summary.createdMembers += 1;
          else {
            memberId = await createMember(profile);
            summary.createdMembers += 1;
          }
        } else {
          if (dryRun) summary.updatedMembers += 1;
          else {
            await updateMember(memberId, profile);
            summary.updatedMembers += 1;
          }
        }

        if (!dryRun && memberId) {
          const linkRef = rtdb.ref(`/eventMembers/${eventId}/${memberId}`);
          const linkSnap = await linkRef.get();
          if (linkSnap.exists()) {
            summary.alreadyLinked += 1;
          } else {
            await linkRef.set({
              addedAt: Date.now(),
              source: 'import',
              status: profile.memberStatus || 'Pending',
              role: null,
              notes: '',
              seat: null,
              tags: [],
            });
            await rtdb.ref(`/memberEvents/${memberId}/${eventId}`).set(true);
            summary.linkedToEvent += 1;
          }
        }

        summary.rowResults.push({ index: i + 1, ok: true });
      } catch (e) {
        summary.errors.push({ index: i + 1, message: e.message || 'Invalid row' });
        summary.rowResults.push({ index: i + 1, ok: false, error: e.message || 'Invalid row' });
      }
    }

    return addCORS(NextResponse.json({ eventId, dryRun, summary }, { status: 200 }));
  } catch (e) {
    return addCORS(NextResponse.json({ error: e.message || 'Server error' }, { status: e.status || 500 }));
  }
}
