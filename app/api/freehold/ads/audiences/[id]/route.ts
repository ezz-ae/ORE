import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import type { Role } from '@/lib/freehold/session-types'
import { getAudience, updateAudience, deleteAudience } from '@/lib/freehold/audiences'
import { getReachEstimate } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

// GET — one audience + its live Meta reach band (null when not connected).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  const audience = await getAudience(id)
  if (!audience) return NextResponse.json({ error: 'Audience not found' }, { status: 404 })
  const reach = await getReachEstimate(audience.spec)
  return NextResponse.json({ audience, reach })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  const { id } = await params
  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const audience = await updateAudience(id, {
    name: typeof body.name === 'string' ? body.name : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    spec: body.spec,
  })
  if (!audience) return NextResponse.json({ error: 'Audience not found' }, { status: 404 })
  return NextResponse.json({ audience })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  const { id } = await params
  const removed = await deleteAudience(id)
  if (!removed) return NextResponse.json({ error: 'Audience not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
