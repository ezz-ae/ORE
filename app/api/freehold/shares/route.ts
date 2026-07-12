import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { createShare, listShares, revokeShare } from '@/lib/freehold/shares'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET                                → my active share links
// POST { name, url, kind?, source?, refId? } → { token, path }  (create/reuse)
// DELETE ?token=                     → revoke

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const shares = await listShares(auth.user.email)
  return NextResponse.json({ shares })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const rl = await checkRateLimit(`share:${auth.user.email}`, { limit: 30, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Slow down' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })

  const b = await req.json().catch(() => ({})) as { name?: string; url?: string; kind?: string; source?: string; refId?: string }
  if (!b.name || !b.url) return NextResponse.json({ error: 'name and url are required' }, { status: 400 })
  // Only shareable if the file is fetchable by a browser (public URL or inline).
  if (!/^(https?:|data:)/.test(b.url)) return NextResponse.json({ error: 'This file can’t be shared — it has no public link.' }, { status: 400 })

  const token = await createShare(auth.user.email, { name: b.name, url: b.url, kind: b.kind, source: b.source, refId: b.refId })
  if (!token) return NextResponse.json({ error: 'Could not create the link' }, { status: 500 })
  return NextResponse.json({ token, path: `/share/${token}` }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 })
  const ok = await revokeShare(auth.user.email, token)
  return NextResponse.json({ ok })
}
