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
import { allCatalogEntities, standardExclusions } from '@/lib/freehold/audience-pattern'
import { newStops, clearedStops, shouldNotify, type GuardStop } from '@/lib/freehold/guard-runs'
import { diffTargeting, type LiveAdSet } from '@/lib/freehold/targeting-diff'
import { autoApplyPlan, needsAPerson, type AppliedFix } from '@/lib/freehold/auto-apply'
import { VALUABLE_RATING } from '@/lib/freehold/lead-stages'
import { adRatings } from '@/lib/freehold/ad-ratings'
import { patchAdSetTargeting, listAds } from '@/lib/meta/client'
import { notify } from '@/lib/freehold/notifications'
import { query, ensureOnce } from '@/lib/db'

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

  // ── AND THE ONE FIX IT MAY MAKE WITHOUT ASKING ─────────────────────────
  //
  // A deliberate change to the policy stated in this file's header. Pausing
  // and budget still wait for a person. ONE targeting fix no longer does,
  // because it carries no second question: an ad set running with Advantage
  // on is running an audience nobody chose, and the fix is to turn it off.
  //
  // Everything else worth fixing is REPORTED and not applied — narrowing an
  // audience needs somebody who knows the event is in Al Ain. See
  // lib/freehold/auto-apply.ts for why the list is one item long, and why a
  // fix is attempted exactly once even when it fails.
  const applied: Array<{ adSetId: string; gap: string; ok: boolean; detail?: string }> = []
  let pending: ReturnType<typeof needsAPerson> = []
  try {
    await ensureOnce('freehold_targeting_applied', async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS freehold_targeting_applied (
          ad_set_id  text NOT NULL,
          gap        text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now(),
          ok         boolean NOT NULL,
          detail     text,
          PRIMARY KEY (ad_set_id, gap)
        )`)
    })
    const history = await query<{ ad_set_id: string; gap: string }>(
      `SELECT ad_set_id, gap FROM freehold_targeting_applied`,
    )
    const ratings = await adRatings()
    const exclusionNames = standardExclusions().map((e) => e.name)
    const names = (v: unknown, into: Set<string>) => {
      if (!Array.isArray(v)) return
      for (const e of v) {
        const n = String((e as { name?: unknown })?.name ?? '').trim()
        if (n) into.add(n)
      }
    }

    const diffed: Array<{ adSetId: string; findings: ReturnType<typeof diffTargeting> }> = []
    for (const c of campaigns) {
      let sets: Awaited<ReturnType<typeof listAdSets>> = []
      try { sets = await listAdSets(String(c.id)) } catch { continue }
      for (const a of sets) {
        const t = (a.targeting ?? {}) as Record<string, unknown>
        const signals = new Set<string>()
        names(t.interests, signals)
        names(t.behaviors, signals)
        for (const g of (Array.isArray(t.flexible_spec) ? t.flexible_spec : [])) {
          const grp = (g ?? {}) as Record<string, unknown>
          names(grp.interests, signals)
          names(grp.behaviors, signals)
        }
        const ex = (t.exclusions ?? {}) as Record<string, unknown>
        const excluded = new Set<string>()
        names(ex.interests, excluded)
        names(ex.behaviors, excluded)
        const geo = (t.geo_locations ?? {}) as Record<string, unknown>
        const auto = (t.targeting_automation ?? {}) as Record<string, unknown>

        // What this ad set's leads were worth — the evidence `worthApplying`
        // reads. Through adRatings so the guard and every screen cannot
        // disagree about the same ad on the same day.
        let rated = 0
        let ratingSum = 0
        try {
          for (const ad of await listAds(String(a.id))) {
            const r = ratings.get(String(ad.id))
            if (r?.rated) { rated += r.rated; ratingSum += r.meanRating * r.rated }
          }
        } catch {
          // Unreadable ads means no evidence, which reads as "nothing to
          // lose" — and the only auto-applicable fix is one that is right
          // regardless of performance, so this cannot make it act wrongly.
        }

        const live: LiveAdSet = {
          id: String(a.id),
          name: String(a.name ?? a.id),
          signals: [...signals],
          excluded: [...excluded],
          // ABSENT IS NOT OFF — Meta reads a missing advantage_audience as
          // opt-in, so anything but an explicit 0 is expansion running.
          expanding: Number(auto.advantage_audience) !== 0,
          subCountry: (Array.isArray(geo.custom_locations) && geo.custom_locations.length > 0)
            || (Array.isArray(geo.cities) && geo.cities.length > 0),
          leads: 0,
          rated,
          meanRating: rated > 0 ? ratingSum / rated : 0,
        }
        diffed.push({
          adSetId: live.id,
          findings: diffTargeting(live, {
            valuableRating: VALUABLE_RATING,
            standardExclusions: exclusionNames,
          }),
        })
      }
    }

    pending = needsAPerson(diffed)
    const plan = autoApplyPlan(
      diffed,
      history.map((h) => ({ adSetId: h.ad_set_id, gap: h.gap as AppliedFix['gap'] })),
    )
    for (const item of plan) {
      const outcome = await patchAdSetTargeting(item.adSetId, { kind: 'advantage_off' })
      applied.push({
        adSetId: item.adSetId,
        gap: item.gap,
        ok: outcome.ok,
        detail: outcome.ok ? undefined : outcome.detail,
      })
      // RECORDED WHETHER IT WORKED OR NOT. A failed attempt is still an
      // attempt: retrying a targeting edit every morning would hold the ad
      // set in the learning phase permanently, which is the one outcome
      // worse than leaving it broken.
      await query(
        `INSERT INTO freehold_targeting_applied (ad_set_id, gap, ok, detail)
         VALUES ($1, $2, $3, $4) ON CONFLICT (ad_set_id, gap) DO NOTHING`,
        [item.adSetId, item.gap, outcome.ok, outcome.ok ? null : outcome.detail],
      ).catch(() => undefined)
    }
  } catch {
    // The guard's reporting must survive its acting: a failure here leaves
    // `applied` empty and the run still answers.
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
  // AN UNATTENDED EDIT TO LIVE DELIVERY IS ALWAYS WORTH SAYING, whether or
  // not anything else changed today. This is the one notification that is not
  // gated on news: the news IS that the machine touched somebody's campaign.
  if (applied.length > 0) {
    try {
      await notify('management_alert', {
        kind: 'targeting_auto_applied',
        applied,
        stillNeedsAPerson: pending.length,
      }, { href: '/freehold-intelligence/ads-live' })
    } catch {
      // An alert that cannot be filed does not undo the edit.
    }
  }

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
    // What the guard changed on its own, and what it deliberately did not.
    applied,
    needsAPerson: pending,
    actions: ranked,
  })
}
