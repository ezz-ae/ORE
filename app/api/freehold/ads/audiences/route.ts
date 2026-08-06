import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import type { Role } from '@/lib/freehold/session-types'
import { listAudiences, createAudience, forClient, type AudienceKind } from '@/lib/freehold/audiences'
import { isMetaConfigured, listCustomAudiences, getReachEstimate, type CustomAudienceSummary } from '@/lib/meta/client'
import { normalizeSpec } from '@/lib/freehold/audiences'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

// GET — saved audiences + the ad account's live Custom/Lookalike audiences
// (real size bands from Meta; honest `connected:false` when not wired).
export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const [saved, connected] = await Promise.all([listAudiences(), isMetaConfigured()])
  let metaAudiences: CustomAudienceSummary[] = []
  if (connected) {
    try { metaAudiences = await listCustomAudiences() } catch { /* token scope may lack ads_read — show none */ }
  }
  return NextResponse.json({
    audiences: saved.map(forClient),
    meta: { connected, customAudiences: metaAudiences },
  })
}

// POST — save an audience definition. `withReach: true` also asks Meta for the
// definition's live reach band (never invented; null when not connected).
export async function POST(req: NextRequest) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Audience name is required' }, { status: 400 })
  // 'pattern' is deliberately absent. A pattern audience's spec is produced by
  // the kitchen, never posted by the caller — accepting one here would let the
  // client dictate the targeting while the card still claimed a pattern made
  // it. Rejected outright rather than quietly downgraded to 'behavioral',
  // which would save the audience under a kind nobody asked for.
  if (String(body.kind) === 'pattern') {
    return NextResponse.json(
      { error: 'Pattern audiences are created from a pattern, not from a spec' },
      { status: 400 },
    )
  }
  const kind = (['behavioral', 'narrow', 'lookalike', 'custom_list'].includes(String(body.kind))
    ? String(body.kind)
    : 'behavioral') as AudienceKind

  const audience = await createAudience({
    name,
    description: typeof body.description === 'string' ? body.description : '',
    kind,
    spec: body.spec,
    createdBy: auth.user.email,
  })

  let reach = null
  if (body.withReach === true) {
    reach = await getReachEstimate(normalizeSpec(body.spec))
  }
  return NextResponse.json({ audience, reach }, { status: 201 })
}
