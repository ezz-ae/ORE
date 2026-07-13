import { query } from '@/lib/db'
import { listCampaigns, getCampaignInsights, listAdSets, listAds } from '@/lib/meta/client'
import type { MetaCampaign, MetaAdSet, MetaInsights, CampaignTargeting } from '@/lib/meta/types'
import type { ProjectAdStructure, ExistingCampaign, ExistingAdSet, ExistingAd } from '@/lib/meta/campaign-router'

// Builds the live per-project ad structure the intent router reads. Two jobs:
//  1. Remember which campaigns belong to which project (a link table written at
//     launch — Meta itself has no project concept).
//  2. Fingerprint the live campaigns → ad sets → ads into audience / language /
//     creative keys, and infer learning state, so the router can decide where a
//     new request belongs.

let ensured: Promise<void> | null = null
const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS meta_campaign_projects (
      campaign_id  text PRIMARY KEY,
      project_slug text NOT NULL,
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_campaign_projects_slug ON meta_campaign_projects (project_slug)`)
}
const ensureOnce = async () => { if (!ensured) ensured = ensure().catch((e) => { ensured = null; throw e }); await ensured }

/** Link a launched campaign to its project (called from the launch route). */
export async function recordCampaignProject(campaignId: string, projectSlug: string): Promise<void> {
  if (!campaignId || !projectSlug) return
  try {
    await ensureOnce()
    await query(
      `INSERT INTO meta_campaign_projects (campaign_id, project_slug) VALUES ($1, $2)
       ON CONFLICT (campaign_id) DO UPDATE SET project_slug = $2`,
      [campaignId, projectSlug],
    )
  } catch { /* best-effort link */ }
}

/** Campaign ids known to belong to a project. */
export async function getCampaignIdsForProject(projectSlug: string): Promise<Set<string>> {
  const ids = new Set<string>()
  if (!projectSlug) return ids
  try {
    await ensureOnce()
    const rows = await query<{ campaign_id: string }>(
      `SELECT campaign_id FROM meta_campaign_projects WHERE project_slug = $1`,
      [projectSlug],
    )
    for (const r of rows) ids.add(r.campaign_id)
  } catch { /* fall through to empty */ }
  return ids
}

// ── Fingerprints ──────────────────────────────────────────────────────────────
// Both the live-Meta read path and the wizard's request path normalize into the
// SAME shape, then through the SAME key builder — otherwise "same audience"
// would never match across the two sources.
interface AudienceNormal {
  countries: string[]; cities: string[]; ageMin: string; ageMax: string
  genders: string[]; interests: string[]; behaviors: string[]; customAudiences: string[]
}
const sortStr = (v: Array<string | number>): string[] => v.map(String).filter(Boolean).sort()
const asStrArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' || typeof x === 'number' ? String(x) : (x && typeof x === 'object' && 'id' in (x as Record<string, unknown>) ? String((x as Record<string, unknown>).id) : ''))).filter(Boolean).sort() : []

const keyFrom = (a: AudienceNormal): string =>
  [`c:${a.countries.join(',')}`, `city:${a.cities.join(',')}`, `age:${a.ageMin}-${a.ageMax}`,
    `g:${a.genders.join(',')}`, `int:${a.interests.join(',')}`, `beh:${a.behaviors.join(',')}`,
    `ca:${a.customAudiences.join(',')}`].join('|')

// From a live ad set's untyped Graph `targeting` Record.
export function audienceFingerprint(targeting: Record<string, unknown> | undefined): string {
  const t = targeting || {}
  const geo = (t.geo_locations && typeof t.geo_locations === 'object' ? t.geo_locations : {}) as Record<string, unknown>
  const cities = Array.isArray(geo.cities) ? sortStr(geo.cities.map((c) => String((c as Record<string, unknown>)?.key ?? ''))) : []
  return keyFrom({
    countries: asStrArr(geo.countries), cities,
    ageMin: String(t.age_min ?? ''), ageMax: String(t.age_max ?? ''),
    genders: asStrArr(t.genders), interests: asStrArr(t.interests),
    behaviors: asStrArr(t.behaviors), customAudiences: asStrArr(t.custom_audiences),
  })
}

/** Language key from the ad set's locales (Meta adlocale numbers). '' = default. */
export function languageFingerprint(targeting: Record<string, unknown> | undefined): string {
  const locales = asStrArr(targeting?.locales)
  return locales.length ? `loc:${locales.join(',')}` : ''
}

// From the wizard's app-side CampaignTargeting — MUST produce the same key shape.
export function audienceFingerprintFromTargeting(t: CampaignTargeting | undefined): string {
  const g = t
  return keyFrom({
    countries: sortStr(g?.countries ?? []),
    cities: sortStr(g?.cityKeys ?? []),
    ageMin: String(g?.ageMin ?? ''), ageMax: String(g?.ageMax ?? ''),
    genders: sortStr(g?.genders ?? []),
    interests: sortStr((g?.interests ?? []).map((i) => i.id)),
    behaviors: sortStr((g?.behaviors ?? []).map((b) => b.id)),
    customAudiences: sortStr(g?.customAudienceIds ?? []),
  })
}
export function languageFingerprintFromTargeting(t: CampaignTargeting | undefined): string {
  const locales = sortStr((t?.locales ?? []) as number[])
  return locales.length ? `loc:${locales.join(',')}` : ''
}

const ageDaysFrom = (iso: string | undefined): number => {
  if (!iso) return 999
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 999
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000))
}

const metaLeads = (ins: MetaInsights | null) =>
  (ins?.actions ?? []).filter((a) => a.action_type.includes('lead')).reduce((s, a) => s + (Number(a.value) || 0), 0)

const filsToAed = (v: string | undefined | null): number => (v ? Number(v) / 100 : 0)

// ~50 objective events/week is Meta's learning-exit rule of thumb; treat a young
// campaign, or one with few conversions, as still learning.
const LEARNING_LEADS = 30
const LEARNING_DAYS = 7

async function buildAdSet(adSet: MetaAdSet): Promise<ExistingAdSet> {
  let ads: ExistingAd[] = []
  try {
    const raw = await listAds(adSet.id)
    ads = raw.map((a) => ({ id: a.id, creativeKey: a.creative?.id || a.id }))
  } catch { ads = [] }
  return {
    id: adSet.id,
    language: languageFingerprint(adSet.targeting),
    audienceKey: audienceFingerprint(adSet.targeting),
    ads,
  }
}

async function buildCampaign(c: MetaCampaign): Promise<ExistingCampaign> {
  const [insights, adSetsRaw] = await Promise.all([
    getCampaignInsights(c.id).catch(() => null),
    listAdSets(c.id).catch(() => [] as MetaAdSet[]),
  ])
  const adSets = await Promise.all(adSetsRaw.map(buildAdSet))
  const leads = metaLeads(insights)
  const ageDays = ageDaysFrom(c.created_time || c.start_time)
  // Campaign daily budget, or the sum of ad-set budgets (ABO campaigns).
  const campBudget = filsToAed(c.daily_budget)
  const adsetBudget = adSetsRaw.reduce((s, a) => s + filsToAed(a.daily_budget), 0)
  return {
    id: c.id,
    objectiveKey: c.objective || '',
    status: c.status,
    ageDays,
    leads,
    learning: ageDays < LEARNING_DAYS || leads < LEARNING_LEADS,
    dailyBudgetAED: campBudget > 0 ? campBudget : adsetBudget,
    adSets,
  }
}

/**
 * The live ad structure for a project — every campaign we've linked to it,
 * fingerprinted down to ad set (audience/language) and ad (creative). Returns an
 * empty structure (not an error) when Meta is unconfigured or the project is new.
 */
export async function buildProjectAdStructure(projectSlug: string): Promise<ProjectAdStructure> {
  try {
    const ids = await getCampaignIdsForProject(projectSlug)
    if (ids.size === 0) return { projectSlug, campaigns: [] }
    const all = await listCampaigns()
    const mine = all.filter((c) => ids.has(c.id) && c.status !== 'DELETED' && c.status !== 'ARCHIVED')
    const campaigns = await Promise.all(mine.map(buildCampaign))
    return { projectSlug, campaigns }
  } catch {
    // Meta unconfigured or an API hiccup → treat as "nothing running" so the
    // router safely recommends a fresh campaign rather than crashing a launch.
    return { projectSlug, campaigns: [] }
  }
}
