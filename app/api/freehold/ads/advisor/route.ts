import { NextRequest, NextResponse } from 'next/server'
import { geminiApiKey } from "@/lib/gemini-rest"
import { metaLeadCount } from '@/lib/meta/lead-count'
import { requireSession } from '@/lib/freehold/api-auth'
import { getCampaign, getCampaignInsights, listAdSets, MetaConfigError } from '@/lib/meta/client'
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
 * A suggestion may carry a machine-applicable `action` — but ONLY one of three
 * safe shapes (set_budget / pause_campaign / resume_campaign), only when the
 * model grounded it in the data, and always re-validated server-side against
 * the REAL fetched state (budget clamped to ±30% of the ad set's current
 * budget, unknown ad-set ids rejected). Anything else is discussed through the
 * Expert's confirm-gated tools, not applied here.
 */

export type AdvisorArea = 'reach' | 'targeting' | 'placements' | 'budget' | 'creative' | 'quality'

export type AdvisorAction =
  | { type: 'set_budget'; adSetId: string; dailyBudgetAED: number }
  | { type: 'pause_campaign' }
  | { type: 'resume_campaign' }

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
Below is the campaign's REAL data: Meta delivery insights for this month, derived metrics computed from them in code, each live ad set's actual targeting, and the downstream CRM lead-quality funnel (reached / qualified / won / junk — which Meta itself cannot see).
Base every suggestion ONLY on this data. Never invent numbers, and never present industry benchmarks as this campaign's data.

DATA:
${JSON.stringify(context)}

Return ONLY strict JSON, no markdown:
{"suggestions":[{"area":"...","title":"...","detail":"...","evidence":"...","action":null}]}

Rules:
- 3 to 6 suggestions, most impactful first. If the data genuinely supports fewer, return fewer — never pad.
- "area" must be exactly one of: reach, targeting, placements, budget, creative, quality.
- "title": short imperative headline, max 60 characters.
- "detail": 1-3 sentences of concrete, doable advice for THIS campaign (what to change and why).
- "evidence": cite the specific real numbers from DATA the suggestion rests on (e.g. "CTR 0.42% on 12,340 impressions; 9 leads at CPL AED 210"). Never reference a value that is null or missing from DATA.
- "action": null for most suggestions. Attach one ONLY when the numbers in DATA clearly justify an immediate, safe change, and ONLY one of these exact shapes:
  {"type":"set_budget","adSetId":"<an id from DATA.adSets>","dailyBudgetAED":<integer>} — a new daily budget for that ad set, within ±30% of its current dailyBudgetAED and at least 50.
  {"type":"pause_campaign"} — only when the campaign is ACTIVE and DATA shows meaningful spend with clearly poor results.
  {"type":"resume_campaign"} — only when the campaign is PAUSED and DATA justifies resuming it.
- DATA.recentDecisions lists what was ALREADY done to this campaign recently (by the operator or the machine). Never suggest an action equivalent to one just taken — build on the record, don't repeat it.
  Never attach an action you cannot justify from DATA, and never invent an adSetId.`
}

/**
 * Server-side validation of a model-proposed action against the REAL fetched
 * state — unknown ad-set ids are rejected, budgets are clamped to ±30% of the
 * ad set's current budget (floor AED 50), and status actions must match the
 * campaign's actual status. A suggestion whose action fails validation keeps
 * its advice but loses the one-click action.
 */
function validateAction(raw: unknown, campaign: MetaCampaign | null, adSets: MetaAdSet[]): AdvisorAction | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  if (a.type === 'pause_campaign') return campaign?.status === 'ACTIVE' ? { type: 'pause_campaign' } : null
  if (a.type === 'resume_campaign') return campaign?.status === 'PAUSED' ? { type: 'resume_campaign' } : null
  if (a.type === 'set_budget') {
    const adSet = adSets.find((s) => s.id === String(a.adSetId ?? ''))
    if (!adSet) return null
    const current = Math.round(Number(adSet.daily_budget) / 100) || 0
    if (current <= 0) return null
    const proposed = Math.round(Number(a.dailyBudgetAED))
    if (!Number.isFinite(proposed) || proposed <= 0) return null
    const clamped = Math.max(50, Math.min(Math.round(current * 1.3), Math.max(Math.round(current * 0.7), proposed)))
    if (clamped === current) return null
    return { type: 'set_budget', adSetId: adSet.id, dailyBudgetAED: clamped }
  }
  return null
}

type RawSuggestion = { area?: unknown; title?: unknown; detail?: unknown; evidence?: unknown; action?: unknown }

function parseSuggestions(raw: string, campaign: MetaCampaign | null, adSets: MetaAdSet[]): AdvisorSuggestion[] | null {
  try {
    const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
    const parsed = JSON.parse(cleaned) as { suggestions?: unknown }
    if (!Array.isArray(parsed.suggestions)) return null
    return (parsed.suggestions as RawSuggestion[])
      .slice(0, 6)
      .map((s) => ({
        area: (AREAS.has(String(s.area)) ? String(s.area) : 'quality') as AdvisorArea,
        title: String(s.title ?? '').trim().slice(0, 120),
        detail: String(s.detail ?? '').trim(),
        evidence: String(s.evidence ?? '').trim(),
        action: validateAction(s.action, campaign, adSets),
      }))
      .filter((s) => s.title && s.detail)
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
  const [campaignR, insightsR, adSetsR, qualityR] = await Promise.allSettled([
    getCampaign(campaignId),
    getCampaignInsights(campaignId),
    listAdSets(campaignId),
    getCampaignQuality(campaignId, campaignName),
  ])
  const campaign: MetaCampaign | null = campaignR.status === 'fulfilled' ? campaignR.value : null
  const insights: MetaInsights | null = insightsR.status === 'fulfilled' ? insightsR.value : null
  const adSets: MetaAdSet[] = adSetsR.status === 'fulfilled' ? adSetsR.value : []
  const quality: CampaignQuality | null = qualityR.status === 'fulfilled' ? qualityR.value : null

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
    adSets: adSets.map(targetingSummary),
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

  const suggestions = parseSuggestions(raw, campaign, adSets)
  if (suggestions === null) return NextResponse.json({ available: false, reason: 'ai_error', metrics })

  return NextResponse.json({ available: true, suggestions, metrics, generatedAt: new Date().toISOString() })
}
