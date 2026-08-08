/**
 * THE DESIGNS REPORT — every ad (design) in a campaign with its own spend,
 * leads and cost per lead, plus pause/resume per design.
 *
 * Meta already moves the budget toward the design that converts; this route
 * makes that visible and gives the operator the one control that matters:
 * stop a design that spends without converting.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { getAdResults, updateAdStatus, isMetaConfigured, MetaApiError } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  if (!(await isMetaConfigured())) return NextResponse.json({ ads: [] })
  try {
    const ads = await getAdResults(id)
    return NextResponse.json({ ads })
  } catch {
    return NextResponse.json({ ads: [] })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  await params
  let body: { adId?: string; status?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const adId = typeof body.adId === 'string' ? body.adId : ''
  const status = body.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED'
  if (!adId) return NextResponse.json({ error: 'adId required' }, { status: 400 })
  try {
    await updateAdStatus(adId, status)
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    if (error instanceof MetaApiError) return NextResponse.json({ error: error.message }, { status: 502 })
    return NextResponse.json({ error: 'Could not update the design.' }, { status: 500 })
  }
}
