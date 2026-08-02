import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import type { MetaFormLead } from '@/lib/meta/types'
import { analyzeFormLeads, getFormLeadsSmart } from '@/lib/freehold/form-analysis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET — the form's full lead analysis: value distribution, per-ad breakdown,
 * CRM overview, audience readiness. The Meta side is fail-soft: if the lead
 * fetch is rejected (token, permission), the CRM half of the analysis still
 * returns — with the Meta error stated, never hidden.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ formId: string }> }) {
  const auth = await requireSession()
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
