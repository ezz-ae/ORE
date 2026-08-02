import { query } from '@/lib/db'
import { ensureLeadsTable } from '@/lib/data'
import { getFormLeads, listAccessiblePages } from '@/lib/meta/client'
import { listLeadFormsMerged } from '@/lib/meta/form-registry'
import type { MetaFormLead } from '@/lib/meta/types'

/**
 * Per-form lead intelligence — what one Meta form has actually PRODUCED, not
 * what it captured. Meta can tell you a form collected 47 leads; only the CRM
 * can tell you those 47 averaged 2.1/10 in value, that ad B fed all the junk,
 * and that the 12 rated ≥6 are a ready lookalike seed. This module joins the
 * two sides by meta_lead_id and answers with numbers the machine can learn
 * from — never estimates.
 */

// One decisive threshold everywhere: mirrors MIN_DECISIVE_VERDICTS in the Ads
// Machine — under 3 ratings a verdict is an early signal, not a judgment.
const MIN_DECISIVE_RATINGS = 3

// Meta's practical floor for a reliable lookalike seed (same as the audience
// seed route) — below this the lookalike either fails to build or is noise.
export const LOOKALIKE_SEED_FLOOR = 100

export interface FormAdBreakdownRow {
  /** Meta ad id, or 'organic' when the lead carried no ad id. */
  adId: string
  campaignId: string | null
  metaLeads: number
  inCrm: number
  rated: number
  avgValue: number | null
}

export interface FormLeadJoin {
  crmId: string
  valueRating: number | null
}

export interface FormAnalysis {
  crm: {
    total: number
    assigned: number
    unassigned: number
    /** Phone under 7 digits — uncallable. */
    wrongNumber: number
    /** Extra rows sharing a normalized phone within this form. */
    duplicates: number
    stages: Array<{ stage: string; n: number }>
  }
  value: {
    rated: number
    avg: number | null
    /** 0–2: what the machine must stop buying. */
    avoid: number
    /** 3–5: neutral zone. */
    mid: number
    /** 6–10: what it should buy more of. */
    valuable: number
    unrated: number
    /** rated >= 3 — enough human answers for a real verdict. */
    decisive: boolean
  }
  verdict: 'valuable' | 'mixed' | 'poor' | 'unrated'
  /** Grouped by the ad that produced the lead — the ad-setup view. */
  ads: FormAdBreakdownRow[]
  recency: { last: string | null; d7: number; d30: number }
  audience: {
    /** Rows with a usable phone (≥7 digits) or an email. */
    contactable: number
    /** Contactable AND value-rated ≥ 6. */
    qualified: number
    lookalikeReady: boolean
    qualifiedLookalikeReady: boolean
  }
  /** metaLeadId → CRM row, so the form's lead list can rate inline. */
  leadJoin: Record<string, FormLeadJoin>
}

interface CrmRow {
  id: string
  meta_lead_id: string | null
  phone: string | null
  email: string | null
  status: string | null
  assigned_broker_id: string | null
  value_rating: number | null
  meta_ad_id: string | null
  utm_id: string | null
  created_at: string
}

function normPhone(p: string | null): string {
  return (p || '').replace(/\D/g, '')
}

/** target: one form id, an explicit set of form ids, or null = every Meta form. */
async function crmRowsForForm(target: string | string[] | null): Promise<CrmRow[]> {
  await ensureLeadsTable()
  // Lazy columns, same pattern as the writers: analysis must not crash on a
  // tenant that has never rated a lead or synced with ad attribution.
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rating integer`)
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_ad_id text`)
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_form_id text`)
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_lead_id text`)
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_id text`)
  const clause = target === null
    ? 'meta_form_id IS NOT NULL'
    : Array.isArray(target) ? 'meta_form_id = ANY($1)' : 'meta_form_id = $1'
  return query<CrmRow>(
    `SELECT id, meta_lead_id, phone, email, status, assigned_broker_id,
            value_rating, meta_ad_id, utm_id, created_at::text AS created_at
       FROM freehold_site_leads
      WHERE archived IS NOT TRUE
        AND ${clause}`,
    target === null ? [] : [target],
  )
}

/** Contactable = the row can seed an audience: usable phone or an email. */
function isContactable(r: { phone: string | null; email: string | null }): boolean {
  return normPhone(r.phone).length >= 7 || Boolean(r.email && r.email.includes('@'))
}

export async function analyzeFormLeads(formId: string, metaLeads: MetaFormLead[]): Promise<FormAnalysis> {
  const rows = await crmRowsForForm(formId)

  const byMetaId = new Map(rows.filter((r) => r.meta_lead_id).map((r) => [r.meta_lead_id as string, r]))

  // ── CRM overview ──────────────────────────────────────────────────────────
  const assigned = rows.filter((r) => r.assigned_broker_id).length
  const wrongNumber = rows.filter((r) => {
    const d = normPhone(r.phone)
    return d.length > 0 && d.length < 7
  }).length
  const phoneCounts = new Map<string, number>()
  for (const r of rows) {
    const d = normPhone(r.phone)
    if (d.length >= 7) phoneCounts.set(d, (phoneCounts.get(d) ?? 0) + 1)
  }
  const duplicates = [...phoneCounts.values()].reduce((s, n) => s + Math.max(0, n - 1), 0)
  const stageMap = new Map<string, number>()
  for (const r of rows) {
    const s = (r.status || 'new').toLowerCase()
    stageMap.set(s, (stageMap.get(s) ?? 0) + 1)
  }
  const stages = [...stageMap.entries()].map(([stage, n]) => ({ stage, n })).sort((a, b) => b.n - a.n)

  // ── Value distribution ────────────────────────────────────────────────────
  const ratedRows = rows.filter((r) => typeof r.value_rating === 'number' && Number.isFinite(r.value_rating))
  const rated = ratedRows.length
  const avg = rated ? ratedRows.reduce((s, r) => s + (r.value_rating as number), 0) / rated : null
  const avoid = ratedRows.filter((r) => (r.value_rating as number) <= 2).length
  const valuable = ratedRows.filter((r) => (r.value_rating as number) >= 6).length
  const mid = rated - avoid - valuable
  const decisive = rated >= MIN_DECISIVE_RATINGS

  // Verdict thresholds match the value scale's own zones (≥6 buy, ≤4 avoid) —
  // an unrated form gets NO verdict, because inventing one is exactly the
  // fabrication this platform forbids.
  const verdict: FormAnalysis['verdict'] =
    rated === 0 ? 'unrated' : (avg as number) >= 6 ? 'valuable' : (avg as number) <= 3.5 ? 'poor' : 'mixed'

  // ── Ad-setup breakdown ────────────────────────────────────────────────────
  // Group Meta's own lead list by the ad that produced each lead, then join
  // value ratings via meta_lead_id. CRM rows synced with a stored meta_ad_id
  // but missing from the (capped) Meta fetch still land in their ad's bucket.
  const adGroups = new Map<string, { campaignId: string | null; metaIds: Set<string> }>()
  for (const l of metaLeads) {
    const key = l.ad_id || 'organic'
    const g = adGroups.get(key) ?? { campaignId: l.campaign_id || null, metaIds: new Set<string>() }
    g.metaIds.add(l.id)
    if (!g.campaignId && l.campaign_id) g.campaignId = l.campaign_id
    adGroups.set(key, g)
  }
  const seenInFetch = new Set(metaLeads.map((l) => l.id))
  for (const r of rows) {
    if (!r.meta_lead_id || seenInFetch.has(r.meta_lead_id)) continue
    const key = r.meta_ad_id || 'organic'
    const g = adGroups.get(key) ?? { campaignId: r.utm_id || null, metaIds: new Set<string>() }
    g.metaIds.add(r.meta_lead_id)
    adGroups.set(key, g)
  }
  const ads: FormAdBreakdownRow[] = [...adGroups.entries()]
    .map(([adId, g]) => {
      const joined = [...g.metaIds].map((id) => byMetaId.get(id)).filter((r): r is CrmRow => Boolean(r))
      const ratedJ = joined.filter((r) => typeof r.value_rating === 'number')
      return {
        adId,
        campaignId: g.campaignId,
        metaLeads: g.metaIds.size,
        inCrm: joined.length,
        rated: ratedJ.length,
        avgValue: ratedJ.length ? ratedJ.reduce((s, r) => s + (r.value_rating as number), 0) / ratedJ.length : null,
      }
    })
    .sort((a, b) => b.metaLeads - a.metaLeads)

  // ── Recency ───────────────────────────────────────────────────────────────
  const times = rows.map((r) => new Date(r.created_at).getTime()).filter((t) => Number.isFinite(t))
  const now = Date.now()
  const recency = {
    last: times.length ? new Date(Math.max(...times)).toISOString() : null,
    d7: times.filter((t) => now - t <= 7 * 86400_000).length,
    d30: times.filter((t) => now - t <= 30 * 86400_000).length,
  }

  // ── Audience readiness ────────────────────────────────────────────────────
  const contactableRows = rows.filter(isContactable)
  const qualifiedRows = contactableRows.filter((r) => typeof r.value_rating === 'number' && (r.value_rating as number) >= 6)
  const audience = {
    contactable: contactableRows.length,
    qualified: qualifiedRows.length,
    lookalikeReady: contactableRows.length >= LOOKALIKE_SEED_FLOOR,
    qualifiedLookalikeReady: qualifiedRows.length >= LOOKALIKE_SEED_FLOOR,
  }

  const leadJoin: Record<string, FormLeadJoin> = {}
  for (const [metaId, r] of byMetaId) {
    leadJoin[metaId] = { crmId: r.id, valueRating: typeof r.value_rating === 'number' ? r.value_rating : null }
  }

  return {
    crm: { total: rows.length, assigned, unassigned: rows.length - assigned, wrongNumber, duplicates, stages },
    value: { rated, avg, avoid, mid, valuable, unrated: rows.length - rated, decisive },
    verdict,
    ads,
    recency,
    audience,
    leadJoin,
  }
}

/**
 * The audience-builder's seed contacts for one form (or ALL Meta forms when
 * formId is null). scope 'qualified' keeps only value-rated ≥6 rows — the
 * sellable seed: a lookalike of the leads a human judged worth buying more of.
 */
export async function formSeedContacts(
  target: string | string[] | null,
  scope: 'qualified' | 'all',
): Promise<Array<{ email: string | null; phone: string | null }>> {
  const rows = await crmRowsForForm(target)
  return rows
    .filter(isContactable)
    .filter((r) => scope === 'all' || (typeof r.value_rating === 'number' && (r.value_rating as number) >= 6))
    .map((r) => ({ email: r.email, phone: r.phone }))
}

/**
 * Fetch a form's leads with the OWNER Page's token when the generic connected
 * token is rejected — the same per-Page rule the cron sweep applies, now
 * reachable from the interactive endpoints. Meta refuses /{form}/leads for
 * non-owner tokens far more often than for the owning Page's own token.
 */
export async function getFormLeadsSmart(formId: string): Promise<MetaFormLead[]> {
  try {
    return await getFormLeads(formId)
  } catch (primaryError) {
    try {
      const form = (await listLeadFormsMerged()).find((f) => f.id === formId)
      if (form?.page_id) {
        const token = (await listAccessiblePages()).find((p) => p.id === form.page_id)?.token
        if (token) return await getFormLeads(formId, token)
      }
    } catch {
      // fall through to the original, more meaningful error
    }
    throw primaryError
  }
}
