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

  return NextResponse.json({
    checked: campaigns.length,
    stops,
    // The alarm is a property of the run, decided by the same pure function
    // the screen uses — so what pages somebody and what they then read cannot
    // disagree about how bad it is.
    alarm: shouldAlert(actions),
    actions: ranked,
  })
}
