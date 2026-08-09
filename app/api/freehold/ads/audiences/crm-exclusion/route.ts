import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { syncCrmExclusionAudience, crmExclusionAudienceId } from '@/lib/freehold/crm-exclusion'
import { isMetaConfigured } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = [...MANAGEMENT_ROLES, 'marketing'] as const

/** Is there an "already in your CRM" audience to exclude? Read-only. */
export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  return NextResponse.json({ audienceId: await crmExclusionAudienceId() })
}

/**
 * Build or refresh it. Uploading a contact list takes real time, so it is a
 * deliberate action rather than something a launch does while somebody waits.
 */
export async function POST() {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res
  if (!(await isMetaConfigured())) {
    return NextResponse.json({ error: 'Connect Meta Ads first.', connected: false }, { status: 409 })
  }
  try {
    const result = await syncCrmExclusionAudience()
    if (!result) return NextResponse.json({ audienceId: null, uploaded: 0 })
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not build the list' },
      { status: 400 },
    )
  }
}
