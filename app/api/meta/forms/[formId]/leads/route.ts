import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import { syncLeadsToCrm } from '@/lib/freehold/meta-lead-sync'
import { getFormLeadsSmart } from '@/lib/freehold/form-analysis'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const { formId } = await params
    // Owner-Page token fallback — the same per-Page rule the cron sweep uses,
    // so a Page-owned form's leads load here too instead of erroring.
    const leads = await getFormLeadsSmart(formId)
    const { synced, skipped } = await syncLeadsToCrm(formId, leads).catch((error) => {
      console.error('[meta-leads] CRM sync failed', error)
      return { synced: 0, skipped: 0 }
    })
    // `skipped` is surfaced, not swallowed: leads Meta returned that carry
    // neither a phone nor an email can't enter the CRM, and silently dropping
    // them is what makes "Meta says N, the CRM has 0" look like a mystery.
    return NextResponse.json({ leads, total: leads.length, syncedToCrm: synced, skipped })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}
