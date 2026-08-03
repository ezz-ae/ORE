/**
 * Opportunity Engine (Layer 3) — "which project deserves the next advertising
 * dirham first", computed ONLY from data the platform actually holds.
 *
 * Six components, each 0–100 or null, each carrying a one-line evidence string
 * citing the real numbers used:
 *   priceCompetitiveness — starting price vs the median of same-area catalog
 *                          peers (≥3 peers with prices required, else null)
 *   paymentPlanStrength  — from the parsed payment plan (lib/payment-plan)
 *   adReadiness          — delegates to the EXISTING inventory ad-readiness
 *                          composite (lib/inventory-data), never reimplemented
 *   areaMomentum         — leads + landing page_view events for the project's
 *                          area, last 30 days vs the 30 before
 *   provenPerformance    — attributed leads (project_slug = project) last 90d;
 *                          lead-volume basis (spend/CPL is not tracked here)
 *   developerDepth       — how many OTHER catalog projects this developer has
 *
 * NOTHING-FAKE rules:
 *  - a component with no underlying data is null with an evidence line saying
 *    why — never defaulted, never invented;
 *  - the overall score is the weighted mean of the NON-NULL components only
 *    (weights below, renormalized to sum 1 across present components);
 *  - fewer than 2 computable components ⇒ overall score null, reason
 *    "insufficient data";
 *  - coverage = fraction of the 6 components present, shown honestly in the UI.
 *
 * Persistence: freehold_site_opportunity_scores (one row per project), written
 * whole on every recompute; reads serve from the table with computed_at shown
 * as-is. DB idiom mirrors lib/freehold/ads-machine.ts (query() + lazy
 * CREATE TABLE IF NOT EXISTS, fail-soft reads).
 */
import { ensureOnce, query } from '@/lib/db'
import { getInventoryPropertiesFromDB } from '@/lib/inventory-data'
import { normalizePaymentPlan } from '@/lib/payment-plan'
import type { InventoryProperty } from '@/src/features/freehold-intelligence/inventory'

// ─── Types ───────────────────────────────────────────────────────────────────

export type OpportunityComponentKey =
  | 'priceCompetitiveness'
  | 'paymentPlanStrength'
  | 'adReadiness'
  | 'areaMomentum'
  | 'provenPerformance'
  | 'developerDepth'
  | 'scarcity'
  | 'areaDemand'

export interface OpportunityComponent {
  key: OpportunityComponentKey
  /** 0–100, or null when the underlying data is genuinely absent. */
  score: number | null
  /** One line citing the real numbers used — or why the component is absent. */
  evidence: string
}

export interface OpportunityScore {
  projectSlug: string
  /** Weighted mean of the non-null components; null when fewer than 2 exist. */
  score: number | null
  /** Fraction of the 6 components that were computable (0–1). */
  coverage: number
  components: OpportunityComponent[]
  computedAt: string
  /** Present only when score is null. */
  reason?: string
}

/**
 * Component weights — the documented opinion of the engine. They sum to 1 over
 * the full set; for a project missing components, the weights of the PRESENT
 * components are renormalized to sum 1 (a missing component never drags the
 * score, it just lowers coverage).
 *
 *   priceCompetitiveness 0.15  price vs same-area peers is the buyer's first filter
 *   adReadiness          0.15  spend on an unready listing is wasted
 *   areaMomentum         0.15  demand is MOVING somewhere — follow the change
 *   paymentPlanStrength  0.15  the plan is the off-plan ad's strongest hook
 *   provenPerformance    0.15  attributed leads = the machine already works here
 *   developerDepth       0.10  track-record proxy only, so a light weight
 *   scarcity             0.08  few competing projects in the area = less ad
 *                              auction pressure and a cleaner story to sell
 *   areaDemand           0.07  demand LEVEL, distinct from momentum: momentum
 *                              is the derivative (30d vs prior 30d), this is
 *                              the absolute funnel volume the area commands
 */
export const OPPORTUNITY_WEIGHTS: Record<OpportunityComponentKey, number> = {
  priceCompetitiveness: 0.15,
  adReadiness: 0.15,
  areaMomentum: 0.15,
  paymentPlanStrength: 0.15,
  provenPerformance: 0.15,
  developerDepth: 0.1,
  scarcity: 0.08,
  areaDemand: 0.07,
}

const COMPONENT_KEYS: OpportunityComponentKey[] = [
  'priceCompetitiveness',
  'paymentPlanStrength',
  'adReadiness',
  'areaMomentum',
  'provenPerformance',
  'developerDepth',
  'scarcity',
  'areaDemand',
]

export const INSUFFICIENT_DATA_REASON = 'insufficient data'

// ─── Persistence ─────────────────────────────────────────────────────────────

async function ensure(): Promise<void> {
  await ensureOnce('freehold_site_opportunity_scores', async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS freehold_site_opportunity_scores (
        project_slug text PRIMARY KEY,
        score        int,
        coverage     real,
        components   jsonb,
        computed_at  timestamptz NOT NULL DEFAULT now()
      )`)
  })
}

// ─── Real-data context (one batch of queries for the whole catalog) ──────────

type Windows = { recent30: number; prior30: number; last90: number }

interface OpportunityContext {
  props: InventoryProperty[]
  /** Raw project payloads — the payment-plan source of truth. */
  payloadBySlug: Map<string, Record<string, unknown> | null>
  /** Per-project lead counts (30d / prior 30d / 90d), project_slug attributed. */
  leadsBySlug: Map<string, Windows>
  /** Per-project landing page_view counts (30d / prior 30d). */
  viewsBySlug: Map<string, { recent30: number; prior30: number }>
  /** Per-project count of ads-machine campaigns ever launched (spend history). */
  campaignsBySlug: Map<string, number>
}

async function buildContext(): Promise<OpportunityContext> {
  const props = await getInventoryPropertiesFromDB()

  let payloadBySlug = new Map<string, Record<string, unknown> | null>()
  try {
    const rows = await query<{ slug: string; payload: Record<string, unknown> | null }>(
      `SELECT slug, payload FROM freehold_site_projects LIMIT 2000`,
    )
    payloadBySlug = new Map(rows.map((r) => [r.slug, r.payload]))
  } catch { /* payment-plan component degrades to null */ }

  let leadsBySlug = new Map<string, Windows>()
  try {
    const rows = await query<{ project_slug: string; recent30: number; prior30: number; last90: number }>(
      `SELECT project_slug,
              COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS recent30,
              COUNT(*) FILTER (WHERE created_at <= now() - interval '30 days'
                                 AND created_at > now() - interval '60 days')::int AS prior30,
              COUNT(*)::int AS last90
       FROM freehold_site_leads
       WHERE project_slug IS NOT NULL
         AND created_at > now() - interval '90 days'
       GROUP BY project_slug`,
    )
    leadsBySlug = new Map(rows.map((r) => [r.project_slug, {
      recent30: Number(r.recent30) || 0,
      prior30: Number(r.prior30) || 0,
      last90: Number(r.last90) || 0,
    }]))
  } catch { /* momentum/performance components degrade to null */ }

  let viewsBySlug = new Map<string, { recent30: number; prior30: number }>()
  try {
    const rows = await query<{ project_slug: string; recent30: number; prior30: number }>(
      `SELECT project_slug,
              COUNT(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS recent30,
              COUNT(*) FILTER (WHERE created_at <= now() - interval '30 days'
                                 AND created_at > now() - interval '60 days')::int AS prior30
       FROM freehold_site_lp_analytics
       WHERE project_slug IS NOT NULL
         AND event_name = 'page_view'
         AND created_at > now() - interval '60 days'
       GROUP BY project_slug`,
    )
    viewsBySlug = new Map(rows.map((r) => [r.project_slug, {
      recent30: Number(r.recent30) || 0,
      prior30: Number(r.prior30) || 0,
    }]))
  } catch { /* analytics table may not exist — momentum falls back to leads only */ }

  let campaignsBySlug = new Map<string, number>()
  try {
    const rows = await query<{ project_slug: string; n: number }>(
      `SELECT project_slug, COUNT(*)::int AS n
       FROM freehold_site_ads_machine_campaigns
       GROUP BY project_slug`,
    )
    campaignsBySlug = new Map(rows.map((r) => [r.project_slug, Number(r.n) || 0]))
  } catch { /* no machine history — provenPerformance needs leads to exist */ }

  return { props, payloadBySlug, leadsBySlug, viewsBySlug, campaignsBySlug }
}

// ─── Component scorers (pure — real numbers in, score + evidence out) ────────

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

function fmtAed(n: number): string {
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
  if (n >= 1_000) return `AED ${Math.round(n / 1_000)}K`
  return `AED ${Math.round(n).toLocaleString()}`
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Starting price vs the median of same-area catalog peers. Cheaper ⇒ higher:
 * 50% of median → 100, at median → 50, 150% of median → 0. Needs the project's
 * own price AND ≥3 same-area peers with prices — else null. */
function scorePriceCompetitiveness(prop: InventoryProperty, ctx: OpportunityContext): OpportunityComponent {
  const key = 'priceCompetitiveness' as const
  const price = prop.startingPriceAED
  if (!price || price <= 0) {
    return { key, score: null, evidence: 'No starting price on record for this project.' }
  }
  const peers = ctx.props.filter(
    (p) => p.slug !== prop.slug && p.area === prop.area && p.startingPriceAED != null && p.startingPriceAED > 0,
  )
  if (peers.length < 3) {
    return {
      key,
      score: null,
      evidence: `Only ${peers.length} same-area peer(s) with prices in ${prop.area} — need 3 for a meaningful median.`,
    }
  }
  const med = median(peers.map((p) => p.startingPriceAED as number))
  const ratio = price / med
  const score = clamp(Math.round(150 - 100 * ratio))
  return {
    key,
    score,
    evidence: `From ${fmtAed(price)} vs ${fmtAed(med)} median across ${peers.length} ${prop.area} peers (${Math.round(ratio * 100)}% of median).`,
  }
}

/** Refreshed projects keep PF fields under payload.propertyFinderDetail —
 * mirror lib/inventory-data.ts's snapshot read. */
const pfDetail = (payload: Record<string, unknown> | null): Record<string, unknown> =>
  payload && typeof payload.propertyFinderDetail === 'object' && payload.propertyFinderDetail
    ? (payload.propertyFinderDetail as Record<string, unknown>)
    : {}

/** From the parsed payment plan (lib/payment-plan normalizer — the same one the
 * landing PaymentPlanSection uses). Lower down-payment and a meaningful
 * post-handover portion score higher: 0.7 × (100 − 2.5·down%) + 0.3 × the
 * post-handover share capped at 30%. Null when nothing real is parseable. */
function scorePaymentPlanStrength(prop: InventoryProperty, ctx: OpportunityContext): OpportunityComponent {
  const key = 'paymentPlanStrength' as const
  const payload = ctx.payloadBySlug.get(prop.slug) ?? null
  const pfd = pfDetail(payload)
  const stages = normalizePaymentPlan(
    (payload?.paymentPlan ?? pfd.paymentPlan) as unknown,
    (payload?.paymentPlans ?? pfd.paymentPlans) as unknown,
  )
  if (!stages) {
    return { key, score: null, evidence: 'No parseable payment plan on record.' }
  }
  const downScore = clamp(100 - 2.5 * stages.downPayment)
  const postScore = (Math.min(stages.postHandover, 30) / 30) * 100
  const score = clamp(Math.round(0.7 * downScore + 0.3 * postScore))
  return {
    key,
    score,
    evidence: `Parsed plan: ${stages.downPayment}% down / ${stages.duringConstruction}% construction / ${stages.onHandover}% handover / ${stages.postHandover}% post-handover.`,
  }
}

/** Delegates to the EXISTING inventory ad-readiness composite — computed by
 * lib/inventory-data.ts from real fields (data quality, landing state, images).
 * Never reimplemented here. */
function scoreAdReadiness(prop: InventoryProperty): OpportunityComponent {
  return {
    key: 'adReadiness',
    score: clamp(Math.round(prop.adReadiness)),
    evidence: `Inventory ad-readiness ${prop.adReadiness}/100 (data quality ${prop.dataQuality}, landing ${prop.landingStatus}, images: ${prop.hasImages ? 'yes' : 'no'}).`,
  }
}

/** Real demand signal for the project's AREA: attributed leads + landing
 * page_view events, last 30 days vs the 30 before, summed over every catalog
 * project in the area. Score = share of the 60-day activity that happened in
 * the LAST 30 days (all recent → 100, flat → 50, fading → <50). Null when both
 * windows are empty. */
function scoreAreaMomentum(prop: InventoryProperty, ctx: OpportunityContext): OpportunityComponent {
  const key = 'areaMomentum' as const
  let leadsRecent = 0, leadsPrior = 0, viewsRecent = 0, viewsPrior = 0
  for (const p of ctx.props) {
    if (p.area !== prop.area) continue
    const l = ctx.leadsBySlug.get(p.slug)
    if (l) { leadsRecent += l.recent30; leadsPrior += l.prior30 }
    const v = ctx.viewsBySlug.get(p.slug)
    if (v) { viewsRecent += v.recent30; viewsPrior += v.prior30 }
  }
  const recent = leadsRecent + viewsRecent
  const prior = leadsPrior + viewsPrior
  if (recent + prior === 0) {
    return {
      key,
      score: null,
      evidence: `No leads or landing page views recorded for ${prop.area} in the last 60 days.`,
    }
  }
  const score = Math.round((100 * recent) / (recent + prior))
  return {
    key,
    score,
    evidence: `${prop.area}: ${leadsRecent} leads + ${viewsRecent} LP views last 30d vs ${leadsPrior} + ${viewsPrior} the 30 days before.`,
  }
}

/** Attributed leads for THIS project (freehold_site_leads.project_slug) in the
 * last 90 days — lead-volume basis, stated honestly: delivered spend/CPL is
 * not tracked here. 25 attributed leads/90d ⇒ 100. Null only when there is
 * zero attributed history AND no campaign (spend) history at all. */
function scoreProvenPerformance(prop: InventoryProperty, ctx: OpportunityContext): OpportunityComponent {
  const key = 'provenPerformance' as const
  const leads90 = ctx.leadsBySlug.get(prop.slug)?.last90 ?? 0
  const campaigns = ctx.campaignsBySlug.get(prop.slug) ?? 0
  if (leads90 === 0 && campaigns === 0) {
    return {
      key,
      score: null,
      evidence: 'No attributed leads in the last 90 days and no campaign history for this project.',
    }
  }
  const score = clamp(Math.round(leads90 * 4))
  if (leads90 === 0) {
    return {
      key,
      score,
      evidence: `${campaigns} machine campaign(s) launched for this project but 0 attributed leads in the last 90 days.`,
    }
  }
  return {
    key,
    score,
    evidence: `${leads90} attributed lead(s) for this project in the last 90 days (lead volume — delivered spend/CPL is not tracked here).`,
  }
}

/** Track-record proxy: how many OTHER catalog projects this developer has.
 * 5+ others ⇒ 100; a sole project scores 0 (a real count, not missing data).
 * Null only when the developer is unknown. */
function scoreDeveloperDepth(prop: InventoryProperty, ctx: OpportunityContext): OpportunityComponent {
  const key = 'developerDepth' as const
  const dev = (prop.developer || '').trim()
  if (!dev) {
    return { key, score: null, evidence: 'Developer unknown for this project.' }
  }
  const others = ctx.props.filter(
    (p) => p.slug !== prop.slug && (p.developer || '').trim().toLowerCase() === dev.toLowerCase(),
  ).length
  return {
    key,
    score: clamp(others * 20),
    evidence: others > 0
      ? `${dev} has ${others} other project(s) in the catalog.`
      : `${dev} has no other project in the catalog — sole listing.`,
  }
}


/** How crowded is this project's shelf? Same-area competing projects from the
 * live catalog — fewer peers means less ad-auction pressure on the same buyer
 * and a cleaner "why this one" story. 0 peers ⇒ 100, 6 ⇒ ~50, 18 (the
 * catalog's per-area average) ⇒ ~25. Null only when the area is unknown —
 * absence of data is never scored as scarce. */
function scoreScarcity(prop: InventoryProperty, ctx: OpportunityContext): OpportunityComponent {
  const key = 'scarcity' as const
  const area = (prop.area || '').trim()
  if (!area) {
    return { key, score: null, evidence: 'No area recorded for this project — competing supply cannot be counted.' }
  }
  const peers = ctx.props.filter((p) => p.slug !== prop.slug && (p.area || '').trim() === area).length
  const score = Math.round(100 * (6 / (6 + peers)))
  return {
    key,
    score,
    evidence: peers > 0
      ? `${peers} competing project(s) in ${area} in the catalog.`
      : `Sole project in ${area} in the catalog.`,
  }
}

/** Demand LEVEL of the project's area — the absolute funnel volume (attributed
 * leads 90d + landing views 30d) this area commands, relative to the busiest
 * area in the catalog. Distinct from areaMomentum, which scores the CHANGE in
 * demand; a large stable area and a small surging one are different facts and
 * the engine should see both. Null before any funnel traffic exists anywhere —
 * an empty catalog is not evidence that every area is dead. */
// Area funnel volumes are identical for every project in a run — computed once
// per context. Without this the nightly sweep re-scans the whole catalog per
// project (~1.2B comparisons at 2,840 projects × 155 areas): a hung cron.
const areaVolumeCache = new WeakMap<OpportunityContext, { byArea: Map<string, number>; max: number }>()
function areaVolumes(ctx: OpportunityContext): { byArea: Map<string, number>; max: number } {
  const hit = areaVolumeCache.get(ctx)
  if (hit) return hit
  const byArea = new Map<string, number>()
  for (const p of ctx.props) {
    const a = (p.area || '').trim()
    if (!a) continue
    const v = (ctx.leadsBySlug.get(p.slug)?.last90 ?? 0) + (ctx.viewsBySlug.get(p.slug)?.recent30 ?? 0)
    byArea.set(a, (byArea.get(a) ?? 0) + v)
  }
  let max = 0
  for (const v of byArea.values()) max = Math.max(max, v)
  const out = { byArea, max }
  areaVolumeCache.set(ctx, out)
  return out
}

function scoreAreaDemand(prop: InventoryProperty, ctx: OpportunityContext): OpportunityComponent {
  const key = 'areaDemand' as const
  const area = (prop.area || '').trim()
  if (!area) {
    return { key, score: null, evidence: 'No area recorded for this project — area demand cannot be attributed.' }
  }
  const { byArea, max } = areaVolumes(ctx)
  if (max === 0) {
    return { key, score: null, evidence: 'No leads or landing views recorded anywhere yet — area demand has no basis.' }
  }
  const vol = byArea.get(area) ?? 0
  return {
    key,
    score: Math.round((100 * vol) / max),
    evidence: `${area}: ${vol} funnel events (attributed leads 90d + LP views 30d); busiest area has ${max}.`,
  }
}

// ─── Assembly ────────────────────────────────────────────────────────────────

function scoreProject(prop: InventoryProperty, ctx: OpportunityContext): OpportunityScore {
  const components: OpportunityComponent[] = [
    scorePriceCompetitiveness(prop, ctx),
    scorePaymentPlanStrength(prop, ctx),
    scoreAdReadiness(prop),
    scoreAreaMomentum(prop, ctx),
    scoreProvenPerformance(prop, ctx),
    scoreDeveloperDepth(prop, ctx),
    scoreScarcity(prop, ctx),
    scoreAreaDemand(prop, ctx),
  ]
  const present = components.filter((c) => c.score !== null)
  const coverage = present.length / COMPONENT_KEYS.length
  const computedAt = new Date().toISOString()

  if (present.length < 2) {
    return {
      projectSlug: prop.slug,
      score: null,
      coverage,
      components,
      computedAt,
      reason: INSUFFICIENT_DATA_REASON,
    }
  }

  // Weighted mean over the present components, weights renormalized to sum 1.
  const weightSum = present.reduce((n, c) => n + OPPORTUNITY_WEIGHTS[c.key], 0)
  const score = Math.round(
    present.reduce((n, c) => n + (c.score as number) * (OPPORTUNITY_WEIGHTS[c.key] / weightSum), 0),
  )
  return { projectSlug: prop.slug, score: clamp(score), coverage, components, computedAt }
}

/** Compute the opportunity score for every catalog project. Pure computation —
 * persists nothing (see recomputeOpportunityScores). */
export async function computeAllOpportunityScores(): Promise<OpportunityScore[]> {
  const ctx = await buildContext()
  return ctx.props.map((prop) => scoreProject(prop, ctx))
}

/** Compute the opportunity score for one project (by slug or a loaded
 * inventory property). Peer-relative components need the full catalog, so this
 * builds the same context as computeAllOpportunityScores. Null when the
 * project is not in the catalog. */
export async function computeOpportunityScore(
  project: string | InventoryProperty,
): Promise<OpportunityScore | null> {
  const slug = typeof project === 'string' ? project : project.slug
  const ctx = await buildContext()
  const prop = ctx.props.find((p) => p.slug.toLowerCase() === slug.toLowerCase())
  return prop ? scoreProject(prop, ctx) : null
}

/** Recompute ALL scores and persist them (full-table refresh: every current
 * project upserted, rows for projects no longer in the catalog removed).
 * Returns what was written. */
export async function recomputeOpportunityScores(): Promise<OpportunityScore[]> {
  const scores = await computeAllOpportunityScores()
  await ensure()
  for (const s of scores) {
    await query(
      `INSERT INTO freehold_site_opportunity_scores (project_slug, score, coverage, components, computed_at)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (project_slug) DO UPDATE SET
         score = EXCLUDED.score,
         coverage = EXCLUDED.coverage,
         components = EXCLUDED.components,
         computed_at = EXCLUDED.computed_at`,
      [s.projectSlug, s.score, s.coverage, JSON.stringify(s.components), s.computedAt],
    )
  }
  if (scores.length > 0) {
    await query(
      `DELETE FROM freehold_site_opportunity_scores
       WHERE NOT (project_slug = ANY($1::text[]))`,
      [scores.map((s) => s.projectSlug)],
    )
  }
  return scores
}

type ScoreRow = {
  project_slug: string
  score: number | null
  coverage: number | null
  components: OpportunityComponent[] | null
  computed_at: string
}

function mapRow(r: ScoreRow): OpportunityScore {
  const score = r.score === null || r.score === undefined ? null : Number(r.score)
  return {
    projectSlug: r.project_slug,
    score,
    coverage: Number(r.coverage) || 0,
    components: Array.isArray(r.components) ? r.components : [],
    computedAt: r.computed_at,
    ...(score === null ? { reason: INSUFFICIENT_DATA_REASON } : {}),
  }
}

/** Read stored scores (all projects, or a slug subset). Fail-soft: an absent
 * table or unreachable DB yields [] — the UI then says "not computed yet"
 * rather than showing invented numbers. */
export async function readOpportunityScores(slugs?: string[]): Promise<OpportunityScore[]> {
  try {
    await ensure()
    const rows = slugs && slugs.length > 0
      ? await query<ScoreRow>(
          `SELECT project_slug, score, coverage, components, computed_at
           FROM freehold_site_opportunity_scores
           WHERE project_slug = ANY($1::text[])`,
          [slugs],
        )
      : await query<ScoreRow>(
          `SELECT project_slug, score, coverage, components, computed_at
           FROM freehold_site_opportunity_scores`,
        )
    return rows.map(mapRow)
  } catch {
    return []
  }
}

/** Read one stored score by project slug, or null when never computed. */
export async function readOpportunityScore(slug: string): Promise<OpportunityScore | null> {
  try {
    await ensure()
    const rows = await query<ScoreRow>(
      `SELECT project_slug, score, coverage, components, computed_at
       FROM freehold_site_opportunity_scores
       WHERE lower(project_slug) = lower($1)
       LIMIT 1`,
      [slug],
    )
    return rows[0] ? mapRow(rows[0]) : null
  } catch {
    return null
  }
}
