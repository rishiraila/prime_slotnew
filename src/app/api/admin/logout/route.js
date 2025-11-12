import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const COOKIE_NAME = 'admin_session'

export async function POST() {
  const cookieStore = await cookies()
  // Remove cookie
  cookieStore.set({
    name: COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
  })
  return NextResponse.json({ ok: true })
}
