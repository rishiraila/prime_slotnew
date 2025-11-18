// src/app/api/admin/login/route.js
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebaseAdmin'

const EXPIRES_IN_MS = 1000 * 60 * 60 * 24 * 5 // 5 days
const COOKIE_NAME = 'admin_session'

export async function POST(req) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    // 🔴 OLD: const API_KEY = "AIzaSyDqR1GfS9Wshql-msxrsDAb0ljAaRgMMt4"
    // 🟢 NEW (matches prime-slot-35cd9 project):
    const API_KEY = 'AIzaSyAbyuKHYzZpA2YAQrPoVy8JfW3yMtTJs3Y'

    if (!API_KEY) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 500 })
    }

    const SIGN_IN_URL =
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`

    const res = await fetch(SIGN_IN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    })

    const data = await res.json()

    if (!res.ok) {
      const code = data?.error?.message || 'AUTH_ERROR'
      const map = {
        INVALID_EMAIL: 'Invalid email',
        EMAIL_NOT_FOUND: 'No user with this email',
        INVALID_PASSWORD: 'Incorrect password',
        USER_DISABLED: 'User is disabled',
      }
      return NextResponse.json({ error: map[code] || code }, { status: 401 })
    }

    const { idToken, localId, email: returnedEmail } = data

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: EXPIRES_IN_MS,
    })

    const cookieStore = await cookies()
    cookieStore.set({
      name: COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: EXPIRES_IN_MS / 1000,
    })

    return NextResponse.json({ uid: localId, email: returnedEmail })
  } catch (err) {
    console.error('Login error:', err) // 👈 add this so you see real error in console
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
