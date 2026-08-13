/**
 * BUILDING A SMART VIEW'S SHEET — the only place the platform words survive.
 *
 * Everything above this file speaks the trade's language: enquiries, viewings,
 * sold, money in, times each person saw it. Everything below it speaks Meta's:
 * insights, frequency, effective_status. This module is the seam, and keeping
 * the seam in ONE file is what stops a platform word leaking onto a screen —
 * which is the entire feature.
 *
 * The judgement is pure and lives in lib/freehold/smart-view.ts. This only
 * fetches and translates.
 *
 * BOTH CHANNELS, because a total that quietly omits one is a WRONG number
 * rather than a missing one. A sheet headed "which projects are actually
 * selling" that leaves Google's spend out does not under-report — it sends
 * somebody to the wrong conclusion with a number that looks complete. Google
 * rows leave blank the cells Google does not report (there is no reach or
 * frequency in a search auction) instead of borrowing Meta's shape for them.
 *
 * Fail-soft throughout: a build that cannot reach one source produces a sheet
 * with that column blank rather than no sheet at all. A saved view that
 * disappears because Meta was rate-limited for a minute is worse than a sheet
 * with a gap in it, and the gap is visible where the failure is not.
 */
import { query } from '@/lib/db'
import {
  listCampaigns, listAdSets, getAccountCampaignInsights, getAdDailyInsights,
  getAdResults, isMetaConfigured,
} from '@/lib/meta/client'
import { readDecay } from '@/lib/freehold/creative-decay'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'
import { assessTier } from '@/lib/freehold/lookalike-ladder'
import { deliveryOf, isSpending } from '@/lib/meta/delivery-status'
import { getCampaignIdsForProject } from '@/lib/meta/campaign-structure'
import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { dailyBudgetToLearn } from '@/lib/freehold/learning-phase'
import { QUALIFIED_STATUSES } from '@/lib/freehold/lead-stages'
import {
  buildSheet, TEMPLATE_SPEC, type SmartView, type ViewRow, type RiskKind,
} from '@/lib/freehold/smart-view'
import {
  listCampaigns as listGoogleCampaigns, googleConfiguredAsync,
} from '@/lib/google/client'
import { googleDeliveryOf, isServing as googleIsServing } from '@/lib/google/delivery'

/** Most campaigns a single sheet reads. One CRM read and one ad-set read each. */
const MAX_CAMPAIGNS = 40

/**
 * How close a permit may be to lapsing before it is a risk.
 *
 * Seven days — the same window the landing pre-flight uses for a page that
 * stops publishing, because they are the same question: will this still be
 * legal to run by the time anybody looks at this sheet again.
 */
export const PERMIT_RISK_DAYS = 7

/** Median minutes to a first reply, per campaign, over the attributed leads. */
async function answerTimes(): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>()
  try {
    const rows = await query<{ key: string; mins: string | null }>(
      `SELECT COALESCE(NULLIF(l.utm_id, ''), lower(l.utm_campaign)) AS key,
              percentile_cont(0.5) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (r.first_response_at - l.created_at)) / 60
              ) AS mins
         FROM freehold_site_leads l
         LEFT JOIN LATERAL (
           SELECT MIN(a.created_at) AS first_response_at
             FROM freehold_site_lead_activity a
            WHERE a.lead_id = l.id
              AND a.created_by IS NOT NULL
              AND a.activity_type <> ALL($1)
              AND a.created_at >= l.created_at
         ) r ON TRUE
        WHERE l.archived IS NOT TRUE
          AND COALESCE(NULLIF(l.utm_id, ''), l.utm_campaign) IS NOT NULL
        GROUP BY 1`,
      [['assignment', 'created', 'repeat_inquiry', 'whatsapp_received']],
    )
    for (const r of rows) {
      if (!r.key) continue
      // A campaign where NOBODY was ever answered has a null median, and null
      // is the honest answer — not zero, which would read as instant.
      out.set(r.key, r.mins === null ? null : Number(r.mins))
    }
  } catch { /* the column renders blank, which is true */ }
  return out
}

/** One campaign, translated. */
interface Built {
  row: ViewRow
  campaignId: string
  projectSlug: string
  serving: boolean
}

export async function buildRows(view: SmartView): Promise<ViewRow[]> {
  if (!(await isMetaConfigured())) return []
  const spec = TEMPLATE_SPEC[view.template]

  const [all, insightsById, answers, listings] = await Promise.all([
    listCampaigns().catch(() => []),
    getAccountCampaignInsights().catch(() => new Map()),
    answerTimes(),
    getInventoryPropertiesFromDB().catch(() => []),
  ])
  // NOT `if (all.length === 0) return []`. An account running Google and
  // nothing on Meta would have got an empty sheet, and an empty sheet reads as
  // "you spent nothing" rather than "this only looked at Meta".

  // Which project each campaign belongs to. Read from our own link table, not
  // guessed from the campaign name — a name is a label somebody typed.
  const slugByCampaign = new Map<string, string>()
  const permitBySlug = new Map<string, string | null>()
  for (const l of listings) {
    permitBySlug.set(l.slug, l.permitExpiry ?? null)
    const ids = await getCampaignIdsForProject(l.slug).catch(() => new Set<string>())
    for (const id of ids) slugByCampaign.set(id, l.slug)
  }

  const chosen = view.channel === 'google' ? [] : all.slice(0, MAX_CAMPAIGNS)
  const now = Date.now()

  const built = await Promise.all(chosen.map(async (c): Promise<Built | null> => {
    const projectSlug = slugByCampaign.get(c.id) ?? ''
    // The view's own narrowing, applied before the expensive reads.
    if (view.projectSlug && projectSlug !== view.projectSlug) return null

    const [quality, adSets] = await Promise.all([
      getCampaignQuality(c.id, c.name ?? '').catch(() => null),
      listAdSets(c.id).catch(() => []),
    ])
    const ins = insightsById.get(c.id)
    const created = c.created_time ? Date.parse(c.created_time) : NaN
    const daysLive = Number.isFinite(created) ? Math.max(0, Math.floor((now - created) / 86_400_000)) : 0
    const spend = Number(ins?.spend ?? 0) || 0
    const impressions = Number(ins?.impressions ?? 0) || 0
    const dailyBudgetAed = adSets.reduce((n, s) => n + (Number(s.daily_budget) || 0) / 100, 0)

    const delivery = deliveryOf({ effectiveStatus: c.effective_status, status: c.status })
    const serving = isSpending(delivery.state)

    const tier = assessTier({
      ratio: 0, impressions, reach: Number(ins?.reach ?? 0) || 0,
      leads: quality?.attributed ?? 0, spend, previousReach: null,
    })

    // ── What will stop or waste this ────────────────────────────────────
    const risks: RiskKind[] = []
    const expiry = projectSlug ? permitBySlug.get(projectSlug) ?? null : null
    if (expiry) {
      // Valid THROUGH its expiry date in Dubai time — the same reading the
      // permit gate takes, so a sheet and a launch cannot disagree by a day.
      const end = Date.parse(`${expiry}T23:59:59+04:00`)
      if (Number.isFinite(end) && end - now < PERMIT_RISK_DAYS * 86_400_000) risks.push('permitLapsing')
    }
    // Switched on and serving nothing is money committed and no ad running.
    if (!serving && (c.status ?? '').toUpperCase() === 'ACTIVE') risks.push('notServing')
    // A budget too thin to buy fifty results a week never leaves learning, so
    // every number it produces is noise. Only claimed with a lead price to
    // measure against — an unknown price is not evidence of a thin budget.
    const cpl = (quality?.attributed ?? 0) > 0 && spend > 0 ? spend / (quality?.attributed ?? 1) : null
    if (serving && cpl !== null && dailyBudgetAed > 0 && dailyBudgetAed < dailyBudgetToLearn(cpl)) {
      risks.push('budgetTooThin')
    }

    const key = c.id
    return {
      campaignId: c.id,
      projectSlug,
      serving,
      row: {
        id: c.id,
        label: c.name ?? c.id,
        spend,
        enquiries: quality?.attributed ?? 0,
        worthCalling: quality?.qualified ?? 0,
        viewings: quality?.viewings ?? 0,
        sold: quality?.won ?? 0,
        moneyIn: quality?.revenueAed ?? 0,
        seenBy: Number(ins?.reach ?? 0) || 0,
        timesSeen: Number(ins?.frequency ?? 0) || 0,
        answeredIn: answers.has(key) ? answers.get(key) ?? null : null,
        daysLive,
        saturated: tier.action === 'widen' || tier.action === 'stop',
        risks,
      },
    }
  }))

  const rows = built.filter((b): b is Built => b !== null)

  // ── GOOGLE, on the same sheet ───────────────────────────────────────────
  //
  // Everything above reads Meta. A "Spent" total with Google missing from it
  // is not an incomplete number, it is a wrong one — and it looks complete,
  // which is what makes it dangerous on a sheet somebody plans a week from.
  //
  // Google reports different things, and the difference is kept rather than
  // papered over: there is no reach or frequency in a search auction, so those
  // cells stay blank, and there is no daily creative read yet, so a Google row
  // carries no decay verdict and falls back to the frequency rule.
  if (view.channel !== 'meta' && (await googleConfiguredAsync().catch(() => false))) {
    const gRows = await listGoogleCampaigns('LAST_30_DAYS').catch(() => [])
    for (const g of gRows) {
      const quality = await getCampaignQuality(g.id, g.name).catch(() => null)
      const spend = (g.metrics?.costMicros ?? 0) / 1_000_000
      const created = g.startDate ? Date.parse(g.startDate) : NaN
      // THE SWITCH IS NOT THE STATE, on Google too — primary_status and its
      // reasons are what say whether anything is being served.
      const serving = googleIsServing(googleDeliveryOf({
        primaryStatus: g.primaryStatus ?? null,
        reasons: g.primaryStatusReasons ?? [],
      }).state)
      const dailyBudgetAed = (g.dailyBudgetMicros ?? 0) / 1_000_000

      const risks: RiskKind[] = []
      if (!serving && (g.status ?? '').toUpperCase() === 'ENABLED') risks.push('notServing')
      const cpl = (quality?.attributed ?? 0) > 0 && spend > 0 ? spend / (quality?.attributed ?? 1) : null
      if (cpl !== null && dailyBudgetAed > 0 && dailyBudgetAed < dailyBudgetToLearn(cpl)) {
        risks.push('budgetTooThin')
      }

      rows.push({
        campaignId: g.id,
        // Google campaigns are not linked to a project in this product, so a
        // project sheet cannot claim them. Left blank rather than guessed from
        // the name — see the project grouping below, which drops blanks.
        projectSlug: '',
        serving,
        row: {
          id: `g:${g.id}`,
          // The channel is on the row because two campaigns can be named the
          // same thing on two platforms and a sheet that cannot tell them
          // apart is a sheet nobody can act on.
          label: `${g.name} · Google`,
          spend,
          enquiries: quality?.attributed ?? 0,
          worthCalling: quality?.qualified ?? 0,
          viewings: quality?.viewings ?? 0,
          sold: quality?.won ?? 0,
          moneyIn: quality?.revenueAed ?? 0,
          // A search auction has no reach and no frequency. Blank, not zero,
          // and never Meta's numbers wearing a Google row.
          seenBy: 0,
          timesSeen: 0,
          answeredIn: answers.has(g.id) ? answers.get(g.id) ?? null : null,
          daysLive: Number.isFinite(created)
            ? Math.max(0, Math.floor((now - created) / 86_400_000)) : 0,
          saturated: false,
          risks,
        },
      })
    }
  }

  if (spec.groupBy === 'campaign') {
    return buildSheet(rows.map((b) => b.row), view.template)
  }

  // ── By picture ──────────────────────────────────────────────────────────
  // "Make a new creative" is the fix this sheet asks for, and you cannot make
  // a new creative for a campaign. The slope per picture is what decides —
  // see creative-decay.ts — and a picture with too little history carries no
  // verdict rather than a guessed one.
  if (spec.groupBy === 'ad') {
    const daily = await getAdDailyInsights().catch(() => new Map())
    const perCampaign = await Promise.all(rows.map(async (b) => {
      const ads = await getAdResults(b.campaignId).catch(() => [])
      return ads.map((a) => {
        const days = daily.get(a.id) ?? []
        const d = readDecay(days)
        return {
          id: a.id,
          // The campaign's name beside the picture's: an ad called
          // "Story 3 - AR" means nothing on its own in a list of forty.
          label: `${a.name} · ${b.row.label}`,
          spend: a.spend,
          enquiries: a.leads,
          // The CRM rungs are attributed to a CAMPAIGN, never to an ad, so
          // they are not invented here. The columns this template shows do
          // not include them.
          worthCalling: 0, viewings: 0, sold: 0, moneyIn: 0,
          // People reached is not reported per ad on the account edge, so the
          // cell stays blank rather than borrowing the campaign's number — a
          // campaign's reach printed on a picture's row is a wrong number, not
          // a missing one.
          seenBy: 0,
          // The RECENT half, not the lifetime average. The whole point of this
          // sheet is that the average hides the death.
          timesSeen: d.recent.frequency,
          answeredIn: null,
          daysLive: days.length,
          saturated: d.verdict === 'fatigued',
          decay: d.verdict,
          risks: [] as RiskKind[],
        } satisfies ViewRow
      })
    }))
    return buildSheet(perCampaign.flat(), view.template)
  }

  // ── By project ──────────────────────────────────────────────────────────
  // Counts add. Times-seen and answer-time do NOT: a project's frequency is
  // not the sum of its campaigns' and its median answer is not their sum, so
  // both are weighted where that is meaningful and withheld where it is not.
  const byProject = new Map<string, Built[]>()
  for (const b of rows) {
    // A campaign linked to no project is not evidence about any project —
    // dropped rather than piled into an "unknown" row nobody can act on.
    if (!b.projectSlug) continue
    byProject.set(b.projectSlug, [...(byProject.get(b.projectSlug) ?? []), b])
  }
  const nameBySlug = new Map(listings.map((l) => [l.slug, l.name || l.slug]))

  const projectRows: ViewRow[] = [...byProject.entries()].map(([slug, group]) => {
    const sum = (f: (b: Built) => number) => group.reduce((n, b) => n + f(b), 0)
    const spend = sum((b) => b.row.spend)
    const seenBy = sum((b) => b.row.seenBy)
    // Impressions-weighted, so a campaign that barely ran cannot pull the
    // project's number. With no reach reported anywhere it stays 0 and renders
    // as an empty cell.
    const timesSeen = seenBy > 0
      ? group.reduce((n, b) => n + b.row.timesSeen * b.row.seenBy, 0) / seenBy
      : 0
    const answered = group.map((b) => b.row.answeredIn).filter((n): n is number => n !== null)
    return {
      id: slug,
      label: nameBySlug.get(slug) ?? slug,
      spend,
      enquiries: sum((b) => b.row.enquiries),
      worthCalling: sum((b) => b.row.worthCalling),
      viewings: sum((b) => b.row.viewings),
      sold: sum((b) => b.row.sold),
      moneyIn: sum((b) => b.row.moneyIn),
      seenBy,
      timesSeen,
      answeredIn: answered.length > 0
        ? answered.sort((a, b) => a - b)[Math.floor(answered.length / 2)]
        : null,
      daysLive: Math.max(...group.map((b) => b.row.daysLive), 0),
      saturated: group.every((b) => b.row.saturated),
      risks: [...new Set(group.flatMap((b) => b.row.risks))],
    }
  })

  return buildSheet(projectRows, view.template)
}

/** Exported so the guard can assert the CRM rung this file reads is the one
 *  lead-stages defines, rather than a second opinion about "qualified". */
export const QUALIFIED_FOR_VIEWS = QUALIFIED_STATUSES
