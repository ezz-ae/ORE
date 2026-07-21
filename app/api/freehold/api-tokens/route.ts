// app/api/freehold/api-tokens/route.ts
//
// Manage the personal tokens that let an external model (Claude/GPT/Gemini)
// connect to the remote MCP bridge. Session-authed: a user only ever sees and
// mints tokens for themselves, and a minted token inherits their exact role.

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { createApiToken, listApiTokens, revokeApiToken } from '@/lib/freehold/api-tokens'

export const runtime = 'nodejs'

async function requireUser() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value)
}

export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ tokens: await listApiTokens(user.email) })
}

export async function POST(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { name?: string }
  const { token, raw } = await createApiToken(
    { email: user.email, name: user.name, role: user.role, brokerId: user.brokerId ?? null },
    body.name ?? '',
  )
  // `raw` is returned ONCE — the client must show it immediately; it is never recoverable.
  return NextResponse.json({ token, raw })
}

export async function DELETE(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const ok = await revokeApiToken(user.email, id)
  return NextResponse.json({ ok })
}
