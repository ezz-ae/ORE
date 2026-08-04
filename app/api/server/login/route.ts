import { NextResponse } from 'next/server'
import { authenticateFromDB } from '@/lib/freehold/auth-db'
import { signSession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { tenantSubdomainFromHost } from '@/lib/tenancy/config'

export const runtime = 'nodejs'

const DAY = 60 * 60 * 24

export async function POST(req: Request) {
  let body: { email?: string; password?: string; remember?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const email = body.email ?? ''
  const password = body.password ?? ''

  // DB-only authentication — real accounts with hashed passwords. The old
  // hardcoded-credential fallback and demo-team seeding are gone: they shipped
  // plaintext passwords and resurrected deleted accounts on every login.
  const user = await authenticateFromDB(email, password)

  if (!user) {
    return NextResponse.json({ error: 'Incorrect email or password' }, { status: 401 })
  }

  const remember = !!body.remember
  const ttlMs = (remember ? 30 * DAY : 12 * 60 * 60) * 1000
  // On a tenant host the session is fenced to that tenant: authenticateFromDB
  // already read the tenant's own users table (schema-per-tenant), and the
  // claim below lets the proxy reject this cookie on any other host.
  const tenant = tenantSubdomainFromHost(req.headers.get('host'))
  const token = await signSession(tenant ? { ...user, tenant } : user, ttlMs)

  const res = NextResponse.json({ user })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    ...(remember ? { maxAge: 30 * DAY } : {}),
  })
  return res
}
