import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listRequests, saveDraft, type EditRequestStatus } from '@/lib/freehold/landing-edit-requests'
import type { SessionUser } from '@/lib/freehold/session-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The broker is keyed by brokerId (falls back to email); everyone else by email.
const actorId = (u: SessionUser) => (u.role === 'broker' ? (u.brokerId ?? u.email) : u.email)

// GET — approvers (non-brokers) see the whole queue (optionally filtered by
// ?status=pending,draft,…); a broker sees only their own requests.
export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const user = auth.user
  const isApprover = user.role !== 'broker'
  const statusParam = new URL(req.url).searchParams.get('status')
  if (isApprover) {
    const statuses = statusParam && statusParam !== 'all'
      ? (statusParam.split(',').filter(Boolean) as EditRequestStatus[])
      : undefined
    const requests = await listRequests({ statuses })
    return NextResponse.json({ requests, canApprove: true })
  }
  const requests = await listRequests({ requestedBy: actorId(user) })
  return NextResponse.json({ requests, canApprove: false })
}

// POST — create/update the actor's open draft for a landing. `submit: true`
// sends it for approval in the same call.
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const user = auth.user
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const landingSlug = String(body.landingSlug || '').trim()
  if (!landingSlug) return NextResponse.json({ error: 'landingSlug is required' }, { status: 400 })
  const saved = await saveDraft({
    landingSlug,
    projectSlug: body.projectSlug ? String(body.projectSlug) : null,
    requestedBy: actorId(user),
    requestedByName: user.name,
    proposedFields: body.proposedFields && typeof body.proposedFields === 'object' ? (body.proposedFields as Record<string, unknown>) : {},
    proposedSections: body.proposedSections,
    note: typeof body.note === 'string' ? body.note : null,
    submit: body.submit === true,
  })
  if (!saved) return NextResponse.json({ error: 'Could not save the draft.' }, { status: 500 })
  return NextResponse.json({ request: saved }, { status: 200 })
}
