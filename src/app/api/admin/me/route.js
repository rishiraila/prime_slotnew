// src/app/api/admin/me/route.js
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebaseAdmin'

const COOKIE_NAME = 'admin_session'

export async function GET() {
  const cookie = (await cookies()).get(COOKIE_NAME)?.value
  if (!cookie) return NextResponse.json({ authenticated: false }, { status: 401 })

  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true)
    return NextResponse.json({ authenticated: true, uid: decoded.uid, email: decoded.email || null })
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
