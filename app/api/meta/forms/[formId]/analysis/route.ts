import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import type { MetaFormLead } from '@/lib/meta/types'
import { analyzeFormLeads, getFormLeadsSmart } from '@/lib/freehold/form-analysis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The forms tab is a marketing/management surface — it exposes EVERY lead's
// analysis and CRM join across the whole form. Brokers work only their own
// assigned leads in the CRM, so this must not be reachable with a bare session
// (that would hand a broker every lead's contact-derived data, bypassing the
// CRM's per-broker scoping).
const OPERATOR_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

/**
 * GET — the form's full lead analysis: value distribution, per-ad breakdown,
 * CRM overview, audience readiness. The Meta side is fail-soft: if the lead
 * fetch is rejected (token, permission), the CRM half of the analysis still
 * returns — with the Meta error stated, never hidden.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const auth = await requireSession(OPERATOR_ROLES)
  if ('res' in auth) return auth.res
  const { formId } = await params

  let metaLeads: MetaFormLead[] = []
  let metaError: string | null = null
  try {
    metaLeads = await getFormLeadsSmart(formId)
  } catch (err) {
    if (err instanceof MetaConfigError) metaError = 'Meta is not connected.'
    else if (err instanceof MetaApiError) metaError = err.message
    else metaError = 'Could not load leads from Meta.'
  }

  try {
    const analysis = await analyzeFormLeads(formId, metaLeads)
    return NextResponse.json({ analysis, metaError })
  } catch (err) {
    console.error('[form-analysis] failed', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
