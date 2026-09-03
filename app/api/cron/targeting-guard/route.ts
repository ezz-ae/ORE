/**
 * THE GUARD THAT RUNS ITSELF.
 *
 * Every check this product has for a broken campaign is on-demand: somebody
 * has to open a screen and press a button. That is the wrong shape for the
 * fault it catches, because the fault is invisible from the outside — a
 * campaign whose audience Meta is quietly overriding looks healthy in every
 * number. Impressions are fine, CTR is fine, cost per lead is fine. Only the
 * leads are wrong, and by the time a person notices that, it is a week later
 * and the money is gone. That is exactly how this account lost a week.
 *
 * So the check stops waiting to be asked.
 *
 * It reads live Meta, decides ONE action per campaign in campaign-action.ts
 * (pure), stores the run, and raises an alarm only when something needs
 * stopping. Nothing is paused automatically: pausing somebody's campaign
 * without them is a bigger mistake than the one being fixed, and the whole
 * point of the sentence is that a person reads it and decides.
 *
 * ── AND IT NEVER SHOUTS ABOUT WHAT IT COULD NOT READ ─────────────────────
 *
 * A read failure produces `watch`, never `stop_now`. A guard that pages
 * somebody because our own request timed out is a guard that gets muted, and
 * a muted guard is worse than none — it is the shape of the panel that called
 * eight live interests retired and was then, correctly, ignored by everyone.
 */
import { NextRequest, NextResponse } from 'next/server'
import { listCampaigns, getAccountCampaignInsights, listAdSets, verifyEntityIds } from '@/lib/meta/client'
import { checkCampaignSetup } from '@/lib/freehold/campaign-setup-check'
import {
  decideAction, rankActions, stopCount, shouldAlert, type CampaignFacts,
} from '@/lib/freehold/campaign-action'
import { allCatalogEntities } from '@/lib/freehold/audience-pattern'
import { newStops, clearedStops, shouldNotify, type GuardStop } from '@/lib/freehold/guard-runs'
import { notify } from '@/lib/freehold/notifications'
import { query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let campaigns: Awaited<ReturnType<typeof listCampaigns>> = []
  let insights: Awaited<ReturnType<typeof getAccountCampaignInsights>> = new Map()
  try {
    ;[campaigns, insights] = await Promise.all([listCampaigns(), getAccountCampaignInsights()])
  } catch {
    // Bill nothing, alarm nobody. Our own failed read is not their emergency.
    return NextResponse.json({ error: 'Could not read Meta', checked: 0, stops: 0 }, { status: 502 })
  }

  // WHICH TARGETING IDS ARE ACTUALLY DEAD, asked once for the whole catalog
  // rather than per campaign. `unknown` is deliberately not counted as dead —
  // that conflation is the original sin of this whole area.
  let deadIds = new Set<string>()
  try {
    const checks = await verifyEntityIds(allCatalogEntities())
    deadIds = new Set(checks.filter((c) => c.verdict === 'dead').map((c) => c.id))
  } catch {
    // Leave it empty. A campaign is never stopped over a check that failed.
  }

  const actions = []
  for (const c of campaigns) {
    let adSets: Awaited<ReturnType<typeof listAdSets>> = []
    try { adSets = await listAdSets(c.id) } catch { /* unreadable → watch, below */ }

    const findings = checkCampaignSetup({ id: c.id, status: c.status, daily_budget: c.daily_budget }, adSets)
    const has = (key: string) => findings.some((f) => f.key === key && f.level === 'wrong')

    // Every id this campaign targets, checked against the dead set.
    const targeted = new Set<string>()
    for (const a of adSets) {
      const t = (a.targeting ?? {}) as Record<string, unknown>
      for (const group of [t.interests, t.behaviors, ...(Array.isArray(t.flexible_spec) ? t.flexible_spec : [])]) {
        const g = group as { interests?: unknown; behaviors?: unknown } | unknown
        const lists = Array.isArray(g) ? [g] : [(g as { interests?: unknown })?.interests, (g as { behaviors?: unknown })?.behaviors]
        for (const list of lists) {
          if (!Array.isArray(list)) continue
          for (const e of list) {
            const id = (e as { id?: unknown })?.id
            if (id) targeted.add(String(id))
          }
        }
      }
    }

    const facts: CampaignFacts = {
      campaignId: c.id,
      name: c.name ?? c.id,
      live: String(c.status ?? '').toUpperCase() === 'ACTIVE',
      spendAed: Number(insights.get(c.id)?.spend ?? 0),
      expanding: has('expansion'),
      // An ad set we could not read at all is unverified, not fine.
      expansionUnknown: adSets.length === 0
        || findings.some((f) => f.key === 'expansionUnknown'),
      noProperty: has('noProperty') || has('moneyNotProperty'),
      deadSignals: [...targeted].filter((id) => deadIds.has(id)),
      offPlatform: has('offPlatform') || has('anyPlacement'),
      softGoal: has('softGoal'),
      deprecatedLocation: has('visitors'),
    }
    actions.push(decideAction(facts))
  }

  const ranked = rankActions(actions, (a) => Number(insights.get(a.campaignId)?.spend ?? 0))
  const stops = stopCount(actions)

  // ── THE HALF THAT WAS ONLY EVER PROSE ──────────────────────────────────
  //
  // The header above has always said this route "stores the run, and raises an
  // alarm only when something needs stopping". It did neither: it returned the
  // actions as a response body, and a Vercel cron throws that away. Every
  // morning the machine read the account correctly and told nobody.
  //
  // Both halves are best-effort. A guard that fails on its own bookkeeping
  // stops guarding, which is the one outcome worse than not writing it down.
  const nowStops: GuardStop[] = actions
    .filter((a) => a.severity === 'stop_now')
    .map((a) => ({ campaignId: a.campaignId, name: a.name, key: a.key }))

  let previous: GuardStop[] = []
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS freehold_targeting_guard_runs (
        id bigserial PRIMARY KEY,
        created_at timestamptz NOT NULL DEFAULT now(),
        checked integer NOT NULL,
        stops integer NOT NULL,
        alarm boolean NOT NULL,
        actions jsonb NOT NULL
      )`)
    const prev = await query<{ actions: unknown }>(
      `SELECT actions FROM freehold_targeting_guard_runs ORDER BY id DESC LIMIT 1`,
    )
    const raw = prev[0]?.actions
    if (Array.isArray(raw)) {
      previous = (raw as Array<Record<string, unknown>>)
        .filter((a) => a?.severity === 'stop_now')
        .map((a) => ({ campaignId: String(a.campaignId), name: String(a.name), key: String(a.key) }))
    }
    await query(
      `INSERT INTO freehold_targeting_guard_runs (checked, stops, alarm, actions)
       VALUES ($1, $2, $3, $4)`,
      [campaigns.length, stops, shouldAlert(actions), JSON.stringify(ranked)],
    )
  } catch {
    // Unreadable or unwritable history means no comparison is possible; the
    // run still answers, and `previous` stays empty so genuinely new stops
    // are announced rather than swallowed.
  }

  // ONLY NEWS INTERRUPTS. A campaign broad today is broad tomorrow, so
  // alerting on state sends the same alarm every morning — which is exactly
  // how the header's "muted guard" happens. See lib/freehold/guard-runs.ts.
  const fresh = newStops(nowStops, previous)
  const cleared = clearedStops(nowStops, previous)
  if (shouldNotify(nowStops, previous)) {
    try {
      await notify('management_alert', {
        kind: 'targeting_guard',
        newStops: fresh.map((s) => ({ campaignId: s.campaignId, name: s.name, reason: s.key })),
        totalStops: stops,
        checked: campaigns.length,
      }, { href: '/freehold-intelligence/ads-live' })
    } catch {
      // An alert that cannot be filed does not undo the run or the record.
    }
  }

  return NextResponse.json({
    checked: campaigns.length,
    stops,
    // The alarm is a property of the run, decided by the same pure function
    // the screen uses — so what pages somebody and what they then read cannot
    // disagree about how bad it is.
    alarm: shouldAlert(actions),
    // What changed since yesterday — the only part a person needed to be
    // interrupted for, and now the only part that interrupts them.
    newStops: fresh.length,
    clearedStops: cleared.length,
    actions: ranked,
  })
}
