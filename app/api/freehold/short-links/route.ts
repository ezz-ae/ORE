import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { createShortLink, listShortLinks, deleteShortLink } from '@/lib/freehold/short-links'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OPERATOR_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET() {
  const auth = await requireSession(OPERATOR_ROLES)
  if ('res' in auth) return auth.res
  const links = await listShortLinks(200)
  return NextResponse.json({ links })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(OPERATOR_ROLES)
  if ('res' in auth) return auth.res
  let body: { targetUrl?: unknown; code?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const result = await createShortLink({
    targetUrl: typeof body.targetUrl === 'string' ? body.targetUrl : '',
    code: typeof body.code === 'string' && body.code.trim() ? body.code.trim() : undefined,
    createdBy: auth.user.email,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ link: result.link }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession(OPERATOR_ROLES)
  if ('res' in auth) return auth.res
  const code = req.nextUrl.searchParams.get('code') || ''
  if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 })
  const ok = await deleteShortLink(code)
  return NextResponse.json({ ok })
}
