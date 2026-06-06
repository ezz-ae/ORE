import { NextResponse } from 'next/server'
import { authenticate } from '@/lib/freehold/accounts'
import { signSession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'

const DAY = 60 * 60 * 24

export async function POST(req: Request) {
  let body: { email?: string; password?: string; remember?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const user = authenticate(body.email ?? '', body.password ?? '')
  if (!user) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 })
  }

  const remember = !!body.remember
  const ttlMs = (remember ? 30 * DAY : 12 * 60 * 60) * 1000
  const token = await signSession(user, ttlMs)

  const res = NextResponse.json({ user })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // remember → persistent cookie; otherwise a session cookie (no maxAge)
    ...(remember ? { maxAge: 30 * DAY } : {}),
  })
  return res
}
