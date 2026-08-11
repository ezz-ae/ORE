/**
 * One press clears the deprecated-location flag on a live ad set.
 *
 * The republish changes ONLY geo_locations.location_types to the pair Meta
 * still supports — the full spec travels back verbatim, so the narrowing,
 * locales and exclusions survive. See fixAdSetLocationTypes for the why.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { fixAdSetLocationTypes, MetaApiError } from '@/lib/meta/client'
import { explainMetaError } from '@/lib/meta/error-advice'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function POST(_req: NextRequest, { params }: { params: Promise<{ adSetId: string }> }) {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res
  const { adSetId } = await params
  if (!adSetId) return NextResponse.json({ error: 'adSetId required' }, { status: 400 })
  try {
    const result = await fixAdSetLocationTypes(adSetId)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof MetaApiError) {
      return NextResponse.json({ error: explainMetaError({ message: err.message, code: err.code }) ?? err.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Could not update the ad set.' }, { status: 500 })
  }
}
