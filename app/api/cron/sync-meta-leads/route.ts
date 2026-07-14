import { NextRequest, NextResponse } from 'next/server'
import { syncAllMetaLeads } from '@/lib/freehold/meta-lead-sync'
import { subscribePageToLeadgenWebhook, MetaApiError, MetaConfigError } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Daily Meta lead-form sync (Vercel Cron) — the safety net behind the
 * app/api/meta/webhook real-time push. Before either existed, a Meta form's
 * leads only ever reached the CRM as a side effect of a staff member opening
 * that exact form's page in Lead Machine — a live, converting form nobody
 * happened to click into left its leads sitting in Meta with zero record in
 * freehold_site_leads. This sweeps every form on the connected account once a
 * day (Vercel Hobby's cron ceiling) so ingestion never depends on a human
 * noticing OR on the webhook subscription staying intact — it also
 * re-asserts the Page's leadgen webhook subscription every run, since that's
 * the one piece Meta can silently drop without any local signal.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get('authorization') || ''
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const [result] = await Promise.all([
      syncAllMetaLeads(),
      subscribePageToLeadgenWebhook().catch((error) => {
        console.error('[sync-meta-leads] leadgen webhook re-subscribe failed', error)
      }),
    ])
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof MetaConfigError) {
      // Not connected — nothing to sync, not a failure.
      return NextResponse.json({ ok: true, formsChecked: 0, totalSynced: 0, perForm: [] })
    }
    if (err instanceof MetaApiError) {
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    }
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}
