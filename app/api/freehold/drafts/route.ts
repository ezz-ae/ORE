import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { listDrafts, getDraft, saveDraft, deleteDraft, type DraftKind } from '@/lib/freehold/drafts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KINDS = new Set<DraftKind>(['doc', 'landing', 'image', 'video', 'pdf', 'campaign', 'upload'])

// GET                       → recent drafts for the "Continue editing" shelf
// GET ?kind=&refKey=        → one draft WITH payload (to resume an editor)
// PUT { kind, refKey, ... } → upsert (autosave)
// DELETE ?id= | ?kind=&refKey= → clear (on Save/Publish or dismiss)

export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const kind = req.nextUrl.searchParams.get('kind')
  const refKey = req.nextUrl.searchParams.get('refKey')
  if (kind && refKey) {
    const draft = await getDraft(auth.user.email, kind, refKey)
    return NextResponse.json({ draft })
  }
  const drafts = await listDrafts(auth.user.email)
  return NextResponse.json({ drafts })
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  // Autosave fires often; keep it cheap and abuse-resistant.
  const rl = await checkRateLimit(`drafts:${auth.user.email}`, { limit: 60, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Slow down' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })

  const body = await req.json().catch(() => ({})) as {
    kind?: string; refKey?: string; title?: string; href?: string; payload?: Record<string, unknown>
  }
  const kind = body.kind as DraftKind
  if (!KINDS.has(kind)) return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  const refKey = String(body.refKey ?? '').trim().slice(0, 160)
  const href = String(body.href ?? '').trim()
  if (!refKey || !href.startsWith('/')) return NextResponse.json({ error: 'refKey and an in-app href are required' }, { status: 400 })

  const draft = await saveDraft(auth.user.email, {
    kind, refKey, href,
    title: typeof body.title === 'string' ? body.title : undefined,
    payload: body.payload && typeof body.payload === 'object' ? body.payload : undefined,
  })
  return draft ? NextResponse.json({ draft }, { status: 200 }) : NextResponse.json({ error: 'Could not save draft' }, { status: 500 })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const id = req.nextUrl.searchParams.get('id') || undefined
  const kind = req.nextUrl.searchParams.get('kind') || undefined
  const refKey = req.nextUrl.searchParams.get('refKey') || undefined
  const ok = await deleteDraft(auth.user.email, { id, kind, refKey })
  return NextResponse.json({ ok })
}
