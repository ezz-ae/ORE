import { NextRequest, NextResponse } from 'next/server'
import { safeBudgetStep } from '@/lib/freehold/learning-phase'
import { geminiApiKey } from "@/lib/gemini-rest"
import { metaLeadCount } from '@/lib/meta/lead-count'
import { requireSession } from '@/lib/freehold/api-auth'
import {
  getCampaign, getCampaignInsights, listAdSets, getAdResults,
  getCampaignInsightsByPlacement, MetaConfigError,
} from '@/lib/meta/client'
import { placementKeys } from '@/lib/meta/placement-write'
import { auditPlacements } from '@/lib/freehold/placement-audit'
import {
  validateAdvisorAction, actionShapeLines, adIsProvenWorse, MIN_AD_SPEND_TO_JUDGE,
  type AdvisorAction, type AdvisorState, type AdvisorAdSet, type AdvisorAd,
} from '@/lib/freehold/advisor-actions'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'
import { geminiGenerate, geminiText } from '@/lib/gemini-rest'
import type { MetaAdSet, MetaCampaign, MetaInsights } from '@/lib/meta/types'
import type { CampaignQuality } from '@/lib/freehold/campaign-quality'
import { listDecisions } from '@/lib/freehold/decision-ledger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * AI Campaign Advisor — the ADVISORY layer over a RUNNING Meta campaign.
 *
 * On demand it pulls the campaign's REAL state (Meta object, this-month
 * insights, ad-set targeting, and our CRM lead-quality funnel), computes the
 * derived metrics in code (never by the model), and asks Gemini ONCE for a
 * short list of grounded suggestions, each citing the specific numbers it is
 * based on. NOTHING-FAKE rule: no key / no data / unparseable output →
 * { available: false, reason } — never a heuristic fallback dressed as AI.
 *
 * A suggestion may carry a machine-applicable `action`, from the vocabulary in
 * lib/freehold/advisor-actions.ts — every one of them a move the operator
 * already had by hand on this page, every one reversible, every one
 * re-validated server-side against the REAL fetched state. Anything else is
 * discussed through the Expert's confirm-gated tools, not applied here.
 *
 * ── WHY THIS ROUTE FETCHES THE ADS AND THE PLACEMENT BREAKDOWN ───────────
 *
 * It used to read the campaign, its month insights, the ad sets' targeting and
 * the CRM funnel — and nothing below the ad set. So it could not see that one
 * of four creatives had taken half the budget and returned nothing, which is
 * the single most common thing wrong with a running campaign and the one an
 * operator most wants pointed at. It could only ever say "your CTR is low",
 * which is true of the average of four ads and actionable on none of them.
 *
 * The two extra reads close that. `getAdResults` gives every ad its own spend
 * and leads; the placement breakdown feeds the deterministic audit, whose
 * condemned list is the ONLY source a drop_placement action may name. Both
 * fail soft: a missing read narrows what the advisor can propose, it never
 * fails the request.
 */

export type AdvisorArea = 'reach' | 'targeting' | 'placements' | 'budget' | 'creative' | 'quality'

export type { AdvisorAction }

/**
 * WHAT IS WORKING AND WHAT IS BLOCKING — from the SAME call as the suggestions.
 *
 * This used to be a second endpoint (/api/freehold/ads/refine) with its own
 * model call, its own system prompt, its own vocabulary and — the part that
 * mattered — its own data. It read its metrics from the BROWSER: the page
 * posted numbers up and the server analysed whatever it was sent, while this
 * route fetches from Meta itself.
 *
 * Two models, two datasets, two voices, one panel. The operator's words were
 * "the refiner is in another word". The page had already half-conceded it, by
 * hiding the refiner's actions column whenever the advisor had suggestions —
 * a workaround for a duplication rather than a fix for it.
 *
 * Worse than untidy: the two could disagree. This codebase already carries a
 * note about a screen "contradicting itself in two boxes an inch apart", and
 * two independent analyses of two different copies of the numbers is the
 * machinery for producing exactly that.
 *
 * So the summary is produced HERE, in the same call, over the same fetched
 * data as the suggestions — which is also the only way it can be held to the
 * same evidence rules.
 */
export interface AdvisorSummary {
  /** Short, specific, each grounded in DATA. */
  working: string[]
  blocking: string[]
}

export interface AdvisorSuggestion {
  area: AdvisorArea
  title: string
  detail: string
  /** The specific real numbers this suggestion is based on. */
  evidence: string
  /** Present only when the suggestion maps to a safe one-click change. */
  action?: AdvisorAction | null
}

/** Derived metrics — computed in code from fetched fields only. */
export interface AdvisorMetrics {
  impressions: number
  clicks: number
  /** AED, this month. */
  spend: number
  leads: number
  linkClicks: number | null
  /** % — clicks / impressions. */
  ctrPct: number | null
  /** AED per lead-type action. */
  cplAED: number | null
  cpcAED: number | null
  cpmAED: number | null
  /** Campaign-level daily budget, or the sum of ad-set budgets (ABO). AED. */
  dailyBudgetAED: number | null
  avgDailySpendAED: number | null
  /** Average daily spend as % of daily budget. */
  spendPacePct: number | null
  daysElapsed: number | null
  dateStart: string | null
  dateStop: string | null
}

const round1 = (n: number) => Math.round(n * 10) / 10

function actionSum(insights: MetaInsights, match: (type: string) => boolean): number {
  return (insights.actions ?? [])
    .filter((a) => match(a.action_type))
    .reduce((s, a) => s + (Number(a.value) || 0), 0)
}

function computeMetrics(campaign: MetaCampaign | null, insights: MetaInsights, adSets: MetaAdSet[]): AdvisorMetrics {
  const impressions = Number(insights.impressions) || 0
  const clicks = Number(insights.clicks) || 0
  const spend = Number(insights.spend) || 0
  const leads = metaLeadCount(insights.actions)
  const linkClicksRaw = actionSum(insights, (t) => t === 'link_click')
  const linkClicks = linkClicksRaw > 0 ? linkClicksRaw : null

  // Daily budget: campaign-level (CBO) first, else the sum of ad-set budgets
  // (ABO). Meta returns fils — /100 to AED.
  const campaignBudget = campaign?.daily_budget ? Math.round(Number(campaign.daily_budget) / 100) : 0
  const adSetBudget = adSets.reduce((s, a) => s + (Math.round(Number(a.daily_budget) / 100) || 0), 0)
  const dailyBudgetAED = campaignBudget || adSetBudget || null

  // Spend pace over the insights window (date_preset=this_month): average
  // daily spend vs the daily budget. Only computed when the range is present.
  let daysElapsed: number | null = null
  let avgDailySpendAED: number | null = null
  let spendPacePct: number | null = null
  if (insights.date_start) {
    const start = Date.parse(`${insights.date_start}T00:00:00Z`)
    const stop = insights.date_stop ? Date.parse(`${insights.date_stop}T00:00:00Z`) : NaN
    const end = Math.min(Number.isFinite(stop) ? stop : Date.now(), Date.now())
    if (Number.isFinite(start) && end >= start) {
      daysElapsed = Math.floor((end - start) / 86_400_000) + 1
      if (spend > 0) avgDailySpendAED = round1(spend / daysElapsed)
      if (avgDailySpendAED !== null && dailyBudgetAED) spendPacePct = Math.round((avgDailySpendAED / dailyBudgetAED) * 100)
    }
  }

  return {
    impressions,
    clicks,
    spend,
    leads,
    linkClicks,
    ctrPct: impressions > 0 ? Math.round((clicks / impressions) * 10_000) / 100 : null,
    cplAED: leads > 0 && spend > 0 ? round1(spend / leads) : null,
    cpcAED: Number(insights.cpc) > 0 ? round1(Number(insights.cpc)) : null,
    cpmAED: Number(insights.cpm) > 0 ? round1(Number(insights.cpm)) : null,
    dailyBudgetAED,
    avgDailySpendAED,
    spendPacePct,
    daysElapsed,
    dateStart: insights.date_start ?? null,
    dateStop: insights.date_stop ?? null,
  }
}

// ── Targeting summary (the ad set's ACTUAL targeting, compacted) ─────────────

const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const asNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const names = (v: unknown): string[] =>
  asArr(v)
    .map((x) => (x && typeof x === 'object' ? String((x as { name?: unknown }).name ?? '') : String(x ?? '')))
    .filter(Boolean)

function targetingSummary(a: MetaAdSet) {
  const tg = (a.targeting ?? {}) as Record<string, unknown>
  const geo = (tg.geo_locations ?? {}) as Record<string, unknown>
  const flexible = asArr(tg.flexible_spec) as Record<string, unknown>[]
  const interests = [
    ...names(tg.interests),
    ...flexible.flatMap((g) => names(g.interests)),
  ]
  return {
    id: a.id,
    adSet: a.name,
    status: a.status,
    dailyBudgetAED: Math.round(Number(a.daily_budget) / 100) || null,
    optimizationGoal: a.optimization_goal ?? null,
    ageMin: asNum(tg.age_min),
    ageMax: asNum(tg.age_max),
    countries: asArr(geo.countries).map(String),
    genders: asArr(tg.genders).map(Number).filter(Number.isFinite),
    publisherPlatforms: asArr(tg.publisher_platforms).map(String),
    facebookPositions: asArr(tg.facebook_positions).map(String),
    instagramPositions: asArr(tg.instagram_positions).map(String),
    locales: asArr(tg.locales).map(Number).filter(Number.isFinite),
    customAudiencesCount: asArr(tg.custom_audiences).length,
    interests: interests.slice(0, 12),
  }
}

// ── Gemini ───────────────────────────────────────────────────────────────────

const AREAS: ReadonlySet<string> = new Set(['reach', 'targeting', 'placements', 'budget', 'creative', 'quality'])

function buildPrompt(context: unknown): string {
  return `You are a senior Meta Ads advisor for Dubai freehold real estate, reviewing a RUNNING campaign.
Below is the campaign's REAL data: Meta delivery insights for this month, derived metrics computed from them in code, each live ad set's actual targeting AND its individual ads with their own spend and leads, the placements a statistical audit has already condemned, and the downstream CRM lead-quality funnel (reached / qualified / won / junk — which Meta itself cannot see).
Base every suggestion ONLY on this data. Never invent numbers, and never present industry benchmarks as this campaign's data.

DATA:
${JSON.stringify(context)}

Return ONLY strict JSON, no markdown:
{"working":["..."],"blocking":["..."],"suggestions":[{"area":"...","title":"...","detail":"...","evidence":"...","action":null}]}

Rules:
- "working" and "blocking": up to 3 each, one short specific sentence per item, every one grounded in a number from DATA. What is genuinely driving results, and what is genuinely holding them back. Empty arrays if the data does not support any — never pad, and never put an item in "working" that the numbers do not support just to balance the two lists.
- The suggestions below must FOLLOW from working/blocking. They are one analysis, not two: never let a suggestion contradict the summary above it.
- 3 to 6 suggestions, most impactful first. If the data genuinely supports fewer, return fewer — never pad.
- "area" must be exactly one of: reach, targeting, placements, budget, creative, quality.
- "title": short imperative headline, max 60 characters.
- "detail": 1-3 sentences of concrete, doable advice for THIS campaign (what to change and why).
- "evidence": cite the specific real numbers from DATA the suggestion rests on (e.g. "CTR 0.42% on 12,340 impressions; 9 leads at CPL AED 210"). Never reference a value that is null or missing from DATA.
- "action": ATTACH ONE WHENEVER A SHAPE BELOW FITS THE FINDING. A finding the operator cannot act on from this page is worth far less than one they can, so do not withhold an action out of caution — every action here is reversible, and each is re-checked against the real data before it is offered. Use null only when nothing below expresses the change.
${actionShapeLines()}
- Never invent an id. Every adSetId, adId and placement must appear in DATA.
- DATA.adSets[].ads carries each creative's OWN spend and leads. When one ad has taken real money and returned far less than its siblings, say so by name and attach pause_ad — that is the most useful single thing this panel can do.
- DATA.recentDecisions lists what was ALREADY done to this campaign recently (by the operator or the machine). Never suggest an action equivalent to one just taken — build on the record, don't repeat it.`
}

/**
 * The fetched state every proposed action is re-checked against.
 *
 * Assembled from what Meta returned and from the placement audit's own verdict
 * — never from the model's reply. See lib/freehold/advisor-actions.ts for the
 * rules each action is then held to.
 */
function buildState(
  campaign: MetaCampaign | null,
  adSets: MetaAdSet[],
  ads: AdvisorAd[],
  adSetIdOf: Map<string, string>,
  condemned: readonly string[],
): AdvisorState {
  const byAdSet = new Map<string, AdvisorAd[]>()
  for (const ad of ads) {
    const parent = adSetIdOf.get(ad.id) ?? ''
    if (!parent) continue
    const list = byAdSet.get(parent) ?? []
    list.push(ad)
    byAdSet.set(parent, list)
  }
  return {
    campaignStatus: campaign?.status ?? null,
    adSets: adSets.map((a): AdvisorAdSet => {
      const placements = placementKeys((a.targeting ?? {}) as Record<string, unknown>)
      return {
        id: a.id,
        status: a.status ?? null,
        dailyBudgetAED: Math.round(Number(a.daily_budget) / 100) || 0,
        placements,
        // The audit is campaign-wide; an ad set is only offered the condemned
        // surfaces it actually runs. A placement it never had is not its
        // problem and dropping it would be a write that changes nothing.
        condemnedPlacements: placements.filter((p) => condemned.includes(p)),
        ads: byAdSet.get(a.id) ?? [],
      }
    }),
  }
}

type RawSuggestion = { area?: unknown; title?: unknown; detail?: unknown; evidence?: unknown; action?: unknown }

/** Short, specific, deduped strings — the two summary lists. */
const summaryList = (v: unknown): string[] =>
  (Array.isArray(v) ? v : [])
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .slice(0, 3)

function parseAdvisor(raw: string, state: AdvisorState):
  { suggestions: AdvisorSuggestion[]; summary: AdvisorSummary } | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(cleaned) as { suggestions?: unknown; working?: unknown; blocking?: unknown }
    if (!Array.isArray(parsed.suggestions)) return null
    const summary: AdvisorSummary = {
      working: summaryList(parsed.working),
      blocking: summaryList(parsed.blocking),
    }
    const suggestions = (parsed.suggestions as RawSuggestion[])
      .slice(0, 6)
      .map((s) => ({
        area: (AREAS.has(String(s.area)) ? String(s.area) : 'quality') as AdvisorArea,
        title: String(s.title ?? '').trim().slice(0, 120),
        detail: String(s.detail ?? '').trim(),
        evidence: String(s.evidence ?? '').trim(),
        action: validateAdvisorAction(s.action, state, safeBudgetStep),
      }))
      .filter((s) => s.title && s.detail)
    return { suggestions, summary }
  } catch {
    return null
  }
}

// ── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const body = (await req.json().catch(() => ({}))) as { campaignId?: string; campaignName?: string }
  const campaignId = String(body.campaignId ?? '').trim()
  const campaignName = String(body.campaignName ?? '').trim()
  if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })

  // Fetch everything in parallel; each source fails soft to null (a missing
  // piece narrows the analysis, it never 500s the advisor).
  const [campaignR, insightsR, adSetsR, qualityR, adsR, placementR] = await Promise.allSettled([
    getCampaign(campaignId),
    getCampaignInsights(campaignId),
    listAdSets(campaignId),
    getCampaignQuality(campaignId, campaignName),
    // Per-AD spend and leads. Without this the advisor can only ever describe
    // the average of every creative in the campaign, which is a number that
    // belongs to none of them.
    getAdResults(campaignId),
    // The placement breakdown. Fed to the deterministic audit below, whose
    // condemned list is the only thing a drop_placement may name.
    getCampaignInsightsByPlacement(campaignId),
  ])
  const campaign: MetaCampaign | null = campaignR.status === 'fulfilled' ? campaignR.value : null
  const insights: MetaInsights | null = insightsR.status === 'fulfilled' ? insightsR.value : null
  const adSets: MetaAdSet[] = adSetsR.status === 'fulfilled' ? adSetsR.value : []
  const quality: CampaignQuality | null = qualityR.status === 'fulfilled' ? qualityR.value : null
  const adResults = adsR.status === 'fulfilled' ? adsR.value : []

  // Meta not connected at all → honest state, not advice from nothing.
  const metaResults = [campaignR, insightsR, adSetsR]
  if (metaResults.every((r) => r.status === 'rejected') && metaResults.some((r) => r.status === 'rejected' && r.reason instanceof MetaConfigError)) {
    return NextResponse.json({ available: false, reason: 'not_connected' })
  }

  // No delivery yet → nothing real to analyse.
  if (!insights || ((Number(insights.impressions) || 0) === 0 && (Number(insights.spend) || 0) === 0)) {
    return NextResponse.json({ available: false, reason: 'no_delivery' })
  }

  const metrics = computeMetrics(campaign, insights, adSets)

  // ── The state every action is validated against ────────────────────────────
  // Built from fetched numbers and the audit's own verdict, BEFORE the model is
  // called, so nothing the model says can widen what it is allowed to do.
  const ads: AdvisorAd[] = adResults.map((a) => ({
    id: a.id, name: a.name, status: a.status || null, spend: a.spend, leads: a.leads,
  }))
  const adSetIdOf = new Map(adResults.map((a) => [a.id, a.adSetId]))
  const condemned = placementR.status === 'fulfilled'
    ? auditPlacements(placementR.value).cut.map((r) => `${r.platform}:${r.position}`)
    : []
  const state = buildState(campaign, adSets, ads, adSetIdOf, condemned)

  const apiKey = geminiApiKey()
  if (!apiKey) return NextResponse.json({ available: false, reason: 'no_ai_key', metrics })

  // The decision ledger — what was already done to this campaign, so the
  // advisor builds on the record instead of amnesically re-suggesting it.
  const decisions = await listDecisions({ campaignId, limit: 8 }).catch(() => [])

  // Compact JSON context of ONLY real fetched/computed values.
  const context = {
    campaign: campaign
      ? { name: campaign.name, status: campaign.status, objective: campaign.objective ?? null, startTime: campaign.start_time ?? null }
      : { name: campaignName || null },
    metrics,
    adSets: adSets.map((a) => {
      const seen = state.adSets.find((x) => x.id === a.id)
      return {
        ...targetingSummary(a),
        // The surfaces this ad set really runs, in the vocabulary a
        // drop_placement action has to use — not the three raw position lists
        // the targeting summary carries for describing the audience.
        placements: seen?.placements ?? [],
        condemnedPlacements: seen?.condemnedPlacements ?? [],
        ads: (seen?.ads ?? []).map((ad) => ({
          id: ad.id,
          name: ad.name,
          status: ad.status,
          spend: Math.round(ad.spend),
          leads: ad.leads,
          // Stated as a range, never a point estimate — an ad with one lead on
          // AED 400 does not have "a cost per lead of 400", it has a spread
          // wide enough that the model must not read it as a verdict. Same
          // bound the server then re-checks pause_ad against.
          cplRange: (() => {
            const r = adIsProvenWorse(ad, ads)
            return { atLeastAED: Math.round(r.adCplLo), provenWorseThanSiblings: r.proven }
          })(),
        })),
      }
    }),
    // Named so the model can say WHY an ad it can see is not yet judgeable,
    // rather than inventing a reason or condemning it anyway.
    minAdSpendToJudgeAED: MIN_AD_SPEND_TO_JUDGE,
    crmQuality: quality
      ? { attributed: quality.attributed, reached: quality.reached, qualified: quality.qualified, won: quality.won, junk: quality.junk, score: quality.score }
      : null,
    recentDecisions: decisions.map((d) => `${d.createdAt.slice(0, 10)} [${d.source}] ${d.action}: ${d.detail}`.slice(0, 220)),
  }

  let raw = ''
  try {
    const resp = await geminiGenerate(
      apiKey,
      [{ role: 'user', parts: [{ text: buildPrompt(context) }] }],
      { temperature: 0.4, maxOutputTokens: 2048, responseMimeType: 'application/json' },
    )
    raw = geminiText(resp)
  } catch {
    return NextResponse.json({ available: false, reason: 'ai_error', metrics })
  }

  const parsed = parseAdvisor(raw, state)
  if (parsed === null) return NextResponse.json({ available: false, reason: 'ai_error', metrics })

  return NextResponse.json({
    available: true,
    suggestions: parsed.suggestions,
    // One analysis, one voice — see AdvisorSummary.
    summary: parsed.summary,
    metrics,
    generatedAt: new Date().toISOString(),
  })
}
