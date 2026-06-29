import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { clearSessionCookie } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  // Clear the platform session…
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  // …and the CRM session, so one logout signs out everywhere.
  try { res.cookies.set(clearSessionCookie()) } catch { /* best-effort */ }
  return res
}
