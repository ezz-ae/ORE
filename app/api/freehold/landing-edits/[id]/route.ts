import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getRequest, submitDraft, approveRequest, rejectRequest } from '@/lib/freehold/landing-edit-requests'
import type { SessionUser } from '@/lib/freehold/session-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const actorId = (u: SessionUser) => (u.role === 'broker' ? (u.brokerId ?? u.email) : u.email)

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  const request = await getRequest(id)
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isApprover = auth.user.role !== 'broker'
  if (!isApprover && request.requestedBy !== actorId(auth.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return NextResponse.json({ request })
}

// PATCH — action switch. `submit` is owner-only (draft → pending); `approve` /
// `reject` are approver-only (the non-broker accounts: Cor / Bashar / Yamen).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const user = auth.user
  const { id } = await params
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = String(body.action || '')
  const isApprover = user.role !== 'broker'

  if (action === 'submit') {
    const r = await submitDraft(id, actorId(user))
    if (!r.ok) return NextResponse.json({ error: 'Could not submit — not your draft, or it is not in draft state.' }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'approve') {
    if (!isApprover) return NextResponse.json({ error: 'Only landing editors can publish an edit.' }, { status: 403 })
    const r = await approveRequest(id, user.name)
    if (!r.ok) return NextResponse.json({ error: `Could not publish (${r.reason || 'error'}).` }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'reject') {
    if (!isApprover) return NextResponse.json({ error: 'Only landing editors can send an edit back.' }, { status: 403 })
    const note = typeof body.note === 'string' ? body.note : ''
    const r = await rejectRequest(id, user.name, note)
    if (!r.ok) return NextResponse.json({ error: 'Could not send back.' }, { status: 400 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
