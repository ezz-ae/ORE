/**
 * SWEEP THE JUDGMENT THAT NEVER LEFT THE BUILDING.
 *
 * reportLeadToMeta fires on UPDATE, so the moment the credentials work the
 * NEXT rating goes out and the ones already sitting there never do — nobody
 * re-rates five weeks of leads to trigger a side effect. On this account that
 * is 124 qualified leads against a pixel that has never fired once, while
 * every ad set optimises for the "Conversion leads" goal that learns from
 * exactly those events.
 *
 * Runs daily. Sends at most SWEEP_BATCH, newest first, and stops. Every send
 * goes through reportLeadToMeta — the same path, the same stage guard, the
 * same deterministic event id — so a lead swept twice is deduplicated rather
 * than double-counted, and this route cannot develop its own opinion about
 * what qualifies.
 */
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { ensureLeadsTable } from '@/lib/data'
import { reportLeadToMeta } from '@/lib/freehold/lead-writeback'
import { backlogPlan, summarise, SWEEP_BATCH, type BacklogLead } from '@/lib/freehold/capi-backlog'
import { VALUABLE_RATING, QUALIFIED_STATUSES, WON_STATUSES } from '@/lib/freehold/lead-stages'
import { capiCoverage } from '@/lib/freehold/capi-ledger-db'
import { notify } from '@/lib/freehold/notifications'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    await ensureLeadsTable()
    await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_reported_stages text[]`)
      .catch(() => undefined)

    // Every lead that could be owed an event. The planner decides which
    // actually are — this query only narrows to the candidates so the sweep
    // does not read the whole table.
    const rows = await query<{
      id: string; value_rating: number | null; status: string | null
      meta_lead_id: string | null; email: string | null; phone: string | null
      meta_reported_stages: string[] | null; created_at: string
    }>(
      `SELECT id, value_rating, status, meta_lead_id, email, phone,
              meta_reported_stages, created_at::text
         FROM freehold_site_leads
        WHERE archived IS NOT TRUE
          AND (value_rating IS NOT NULL OR status IS NOT NULL)
          AND (meta_reported_stages IS NULL
               OR array_length(meta_reported_stages, 1) IS NULL
               OR NOT ('won' = ANY(meta_reported_stages)))`,
    )

    const leads: BacklogLead[] = rows.map((r) => ({
      id: r.id,
      valueRating: r.value_rating,
      status: r.status,
      metaLeadId: r.meta_lead_id,
      email: r.email,
      phone: r.phone,
      reported: r.meta_reported_stages ?? [],
      createdAtMs: Date.parse(r.created_at) || 0,
    }))

    // Everything owed, and then only the batch. `owed` is the number worth
    // watching over days: a backlog that stops falling means the sends are
    // failing, not that the work is done.
    const owed = backlogPlan(leads, {
      valuableRating: VALUABLE_RATING,
      wonStatuses: WON_STATUSES,
      qualifiedStatuses: QUALIFIED_STATUSES,
      cap: Number.MAX_SAFE_INTEGER,
    }).length
    const batch = backlogPlan(leads, {
      valuableRating: VALUABLE_RATING,
      wonStatuses: WON_STATUSES,
      qualifiedStatuses: QUALIFIED_STATUSES,
      cap: SWEEP_BATCH,
    })

    // SEQUENTIAL, not Promise.all. Twenty simultaneous events after five
    // weeks of silence is a burst at a moment none of those people converted;
    // it also makes a credential failure hit twenty times before the first
    // answer comes back.
    const results: Array<{ ok: boolean; attributes: boolean }> = []
    for (const item of batch) {
      const stage = await reportLeadToMeta(item.leadId)
      results.push({ ok: stage !== null, attributes: item.attributes })
    }

    const summary = summarise(owed, results)
    const coverage = await capiCoverage()

    // Told once, when the sweep achieves nothing while work is outstanding —
    // which is what a missing pixel id looks like from here, and what this
    // account has looked like since the write-back was written.
    if (summary.owed > 0 && summary.sent === 0) {
      await notify('management_alert', {
        kind: 'capi_backlog_stuck',
        owed: summary.owed,
        failed: summary.failed,
        reach: coverage.reach,
      }, { href: '/freehold-intelligence/lead-machine/rating' }).catch(() => {})
    }

    return NextResponse.json({ ...summary, coverage })
  } catch {
    return NextResponse.json({ error: 'sweep failed' }, { status: 503 })
  }
}
