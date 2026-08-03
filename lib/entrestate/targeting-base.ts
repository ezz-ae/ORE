import { randomUUID } from 'node:crypto'
import { ensureOnce as dbEnsureOnce, query, withTransaction } from '@/lib/db'

// ─── The network targeting base ───────────────────────────────────────────────
// The system's shared brain. Every tenant (Entrestate's own historical data,
// Freehold's CRM, every client the system is sold to) contributes to ONE
// targeting-signals table — but only as ANONYMIZED AGGREGATES:
//
//   entrestate_lead_history   — per-tenant landing zone for raw imports.
//                               May contain PII inside `payload`; NEVER read
//                               by the shared pipeline beyond dimension columns.
//   entrestate_targeting_signals — dimensions × outcomes counts per tenant.
//                               No names, phones, emails — structurally
//                               incapable of leaking a lead.
//
// Cross-tenant benchmarks aggregate the signals of ALL tenants (with a
// minimum-volume threshold), so every system user benefits from the whole
// network's learning without ever seeing another client's data.

export const TENANT_ID = process.env.ENTRESTATE_TENANT_ID || 'freehold'
export const BASE_TENANT = 'entrestate-base'

export interface HistoryRow {
  source?: string
  platform?: string
  campaign?: string
  area?: string
  projectType?: string
  priceBandAED?: string
  ageBand?: string
  city?: string
  interest?: string
  outcome?: string
  leadDate?: string
  /** Anything else — stays tenant-private, never aggregated. */
  payload?: Record<string, unknown>
}

const OUTCOMES = new Set(['lead', 'qualified', 'closed', 'lost'])

// A cell starting with =, +, -, or @ is executed as a formula by Excel/Sheets
// on export/re-open — the classic "CSV/spreadsheet formula injection" attack.
// Any import (paste OR file upload) is untrusted input, so every string field
// is defused the same way regardless of where it came from: a leading
// straight quote neutralizes it in every spreadsheet app without changing
// what a human reads. `sanitized` is an out-param (a plain object, not a
// module-level counter) so concurrent imports never share mutable state.
const FORMULA_LEAD_CHARS = /^[=+\-@]/

function norm(v: unknown, max: number, sanitized: { count: number }): string | null {
  let s = String(v ?? '').trim()
  if (FORMULA_LEAD_CHARS.test(s)) { s = `'${s}`; sanitized.count += 1 }
  s = s.toLowerCase()
  return s ? s.slice(0, max) : null
}

const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS entrestate_lead_history (
      id           text PRIMARY KEY,
      tenant_id    text NOT NULL,
      source       text,
      platform     text,
      campaign     text,
      area         text,
      project_type text,
      price_band   text,
      age_band     text,
      city         text,
      interest     text,
      outcome      text NOT NULL DEFAULT 'lead',
      lead_date    date,
      payload      jsonb,
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS entrestate_lead_history_tenant_idx ON entrestate_lead_history (tenant_id)`)
  await query(`
    CREATE TABLE IF NOT EXISTS entrestate_targeting_signals (
      tenant_id    text NOT NULL,
      platform     text NOT NULL DEFAULT '',
      area         text NOT NULL DEFAULT '',
      project_type text NOT NULL DEFAULT '',
      price_band   text NOT NULL DEFAULT '',
      age_band     text NOT NULL DEFAULT '',
      city         text NOT NULL DEFAULT '',
      interest     text NOT NULL DEFAULT '',
      leads        int  NOT NULL DEFAULT 0,
      qualified    int  NOT NULL DEFAULT 0,
      closed       int  NOT NULL DEFAULT 0,
      lost         int  NOT NULL DEFAULT 0,
      updated_at   timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, platform, area, project_type, price_band, age_band, city, interest)
    )
  `)
}
const ensureOnce = () => dbEnsureOnce('entrestate_lead_history', ensure)

/** Bulk-insert historical rows for a tenant (max ~2000 per call). Returns how
 * many rows landed and how many string cells were formula-injection-defused
 * (an upload/paste-time security scan, not just a validation formality). */
export async function importHistory(tenantId: string, rows: HistoryRow[]): Promise<{ inserted: number; sanitized: number }> {
  await ensureOnce()
  let inserted = 0
  const sanitized = { count: 0 }
  // Insert in chunks of 200 with a single multi-VALUES statement per chunk.
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const values: string[] = []
    const params: unknown[] = []
    for (const r of chunk) {
      const outcome = OUTCOMES.has(String(r.outcome ?? '').toLowerCase()) ? String(r.outcome).toLowerCase() : 'lead'
      const date = r.leadDate && !Number.isNaN(Date.parse(r.leadDate)) ? new Date(r.leadDate).toISOString().slice(0, 10) : null
      const base = params.length
      values.push(`($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10},$${base + 11},$${base + 12},$${base + 13},$${base + 14})`)
      params.push(
        `hist-${randomUUID()}`, tenantId,
        norm(r.source, 80, sanitized), norm(r.platform, 30, sanitized), norm(r.campaign, 120, sanitized), norm(r.area, 80, sanitized),
        norm(r.projectType, 40, sanitized), norm(r.priceBandAED, 40, sanitized), norm(r.ageBand, 20, sanitized),
        norm(r.city, 60, sanitized), norm(r.interest, 80, sanitized), outcome, date,
        r.payload ? JSON.stringify(r.payload).slice(0, 8000) : null,
      )
    }
    await query(
      `INSERT INTO entrestate_lead_history
         (id, tenant_id, source, platform, campaign, area, project_type, price_band, age_band, city, interest, outcome, lead_date, payload)
       VALUES ${values.join(',')}`,
      params,
    )
    inserted += chunk.length
  }
  return { inserted, sanitized: sanitized.count }
}

/**
 * Rebuild a tenant's aggregated signals from its history — dimensions and
 * outcome counts ONLY. This is the single door between tenant data and the
 * shared brain; nothing identifying passes through it.
 */
export async function rebuildSignals(tenantId: string): Promise<void> {
  await ensureOnce()
  await query(`DELETE FROM entrestate_targeting_signals WHERE tenant_id = $1`, [tenantId])
  await query(
    `INSERT INTO entrestate_targeting_signals
       (tenant_id, platform, area, project_type, price_band, age_band, city, interest, leads, qualified, closed, lost, updated_at)
     SELECT tenant_id,
            COALESCE(platform, ''), COALESCE(area, ''), COALESCE(project_type, ''),
            COALESCE(price_band, ''), COALESCE(age_band, ''), COALESCE(city, ''), COALESCE(interest, ''),
            COUNT(*),
            COUNT(*) FILTER (WHERE outcome IN ('qualified','closed')),
            COUNT(*) FILTER (WHERE outcome = 'closed'),
            COUNT(*) FILTER (WHERE outcome = 'lost'),
            now()
     FROM entrestate_lead_history
     WHERE tenant_id = $1
     GROUP BY tenant_id, COALESCE(platform, ''), COALESCE(area, ''), COALESCE(project_type, ''),
              COALESCE(price_band, ''), COALESCE(age_band, ''), COALESCE(city, ''), COALESCE(interest, '')`,
    [tenantId],
  )
}

/** Fold the CURRENT tenant's live CRM leads into its signals (auto table).
 *
 * Called from the nightly cron, the data-import route, AND every campaign plan
 * (recommendTargeting). Those overlap, so the DELETE + INSERTs run inside ONE
 * transaction under a per-tenant advisory lock: concurrent runs serialize
 * instead of interleaving into a primary-key collision and a torn, half-empty
 * signals table. The whole rebuild commits atomically or not at all — a reader
 * never sees zero live rows mid-refresh.
 */
export async function refreshLiveTenantSignals(): Promise<void> {
  await ensureOnce()
  const liveTenant = `${TENANT_ID}-live`
  // The rating column arrives lazily with the first one-click rating; ensure
  // it here so a fresh install's fold doesn't fail on a missing column.
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS value_rating int`).catch(() => undefined)

  // Does the profile-facts table exist yet? Checked OUTSIDE the transaction so
  // its absence (no enrichment has ever run) simply skips that INSERT — rather
  // than throwing inside the transaction and rolling back the live fold too.
  // This replaces a broad `/does not exist/` catch that also swallowed real
  // column errors, hiding exactly the fed-brain failure this code guards against.
  let hasFactTable = false
  try {
    const [r] = await query<{ reg: string | null }>(`SELECT to_regclass('freehold_lead_profile_facts')::text AS reg`)
    hasFactTable = Boolean(r?.reg)
  } catch { hasFactTable = false }

  try {
    await withTransaction(async (q) => {
      // Serialize refreshes for this tenant; the lock releases at COMMIT/ROLLBACK.
      await q(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`targeting-refresh:${liveTenant}`])
      await q(`DELETE FROM entrestate_targeting_signals WHERE tenant_id = $1`, [liveTenant])
      await q(
        `INSERT INTO entrestate_targeting_signals
           (tenant_id, platform, area, project_type, price_band, age_band, city, interest, leads, qualified, closed, lost, updated_at)
         SELECT $1,
                CASE WHEN source ILIKE '%google%' THEN 'google'
                     WHEN source ILIKE '%meta%' OR source ILIKE '%face%' OR source ILIKE '%insta%' THEN 'meta'
                     ELSE 'other' END,
                '', '', '', '', '',
                COALESCE(NULLIF(lower(trim(interest)), ''), ''),
                COUNT(*),
                COUNT(*) FILTER (WHERE priority IN ('hot','priority')
                                    OR status IN ('qualified','viewing','negotiation','closed','converted')
                                    OR value_rating >= 6),
                COUNT(*) FILTER (WHERE status IN ('closed','converted')),
                COUNT(*) FILTER (WHERE status = 'lost' OR value_rating <= 2),
                now()
         FROM freehold_site_leads
         GROUP BY 2, 8`,
        [liveTenant],
      )

      // SMART-PROFILE FACTS join the fold. Verified facts (industry, role, city,
      // age range) folded against outcomes become targetable knowledge —
      // "leads who work in finance rate 6+". Aggregate counts only; privacy by
      // schema holds. Deliberately EXCLUDED: nationality, family, education,
      // social links — not ad-targetable and too close to the person.
      if (hasFactTable) {
        await q(
          `INSERT INTO entrestate_targeting_signals
             (tenant_id, platform, area, project_type, price_band, age_band, city, interest, leads, qualified, closed, lost, updated_at)
           SELECT $1, '', '', '', '',
                  CASE WHEN f.fact_key = 'age_range' THEN left(lower(trim(f.fact_value)), 20) ELSE '' END,
                  CASE WHEN f.fact_key = 'location_city' THEN left(lower(trim(f.fact_value)), 60) ELSE '' END,
                  CASE f.fact_key
                    WHEN 'company_industry'   THEN left('industry: ' || lower(trim(f.fact_value)), 80)
                    WHEN 'job_title'          THEN left('role: '     || lower(trim(f.fact_value)), 80)
                    WHEN 'business_interests' THEN left('interest: ' || lower(trim(f.fact_value)), 80)
                    ELSE '' END,
                  COUNT(*),
                  COUNT(*) FILTER (WHERE l.priority IN ('hot','priority')
                                      OR l.status IN ('qualified','viewing','negotiation','closed','converted')
                                      OR l.value_rating >= 6),
                  COUNT(*) FILTER (WHERE l.status IN ('closed','converted')),
                  COUNT(*) FILTER (WHERE l.status = 'lost' OR l.value_rating <= 2),
                  now()
           FROM freehold_lead_profile_facts f
           JOIN freehold_site_leads l ON l.id = f.lead_id
           WHERE f.fact_key IN ('age_range','location_city','company_industry','job_title','business_interests')
           GROUP BY 6, 7, 8`,
          [liveTenant],
        )
      }
    })
  } catch (e) {
    // LOUD. This fold failed silently for its whole life once (a wrong column
    // name eaten by a bare catch), so the failure is now always visible. A
    // fresh white-label with no CRM table is the one tolerated case.
    console.error('[targeting-base] live signal fold failed — the shared brain is NOT being fed:', e)
  }
}

/*
 * VALUE RATINGS IN THE FOLD (the two value_rating terms above): the one-click
 * 0–10 human judgment teaches the shared signals immediately, without waiting
 * for a pipeline stage change. ≥6 counts as qualified-grade signal; ≤2 counts
 * with the negatives — the machine learns what it should stop buying from the
 * bottom of the scale, which is the entire point of rating downward from 0.
 * Ratings 3–5 stay neutral: a "maybe" teaches nothing and shouldn't pretend to.
 */

export interface NetworkBenchmark {
  platform: string
  area: string
  projectType: string
  priceBand: string
  ageBand: string
  city: string
  interest: string
  leads: number
  qualifiedRate: number
  closeRate: number
  tenants: number
}

/**
 * Cross-tenant benchmarks — the shared benefit. Aggregates EVERY tenant's
 * signals; a minimum-volume threshold (k ≥ 5) keeps any single small segment
 * from being traceable to one client's book.
 *
 * @param excludeTenantIds Tenants that opted out of CONTRIBUTING (Settings →
 *   Data Security → "network benchmarks"). They still see the benchmarks
 *   below — this only removes their own rows from the aggregation.
 */
export async function getNetworkBenchmarks(limit = 20, excludeTenantIds: string[] = []): Promise<NetworkBenchmark[]> {
  try {
    await ensureOnce()
    const exclude = excludeTenantIds.filter(Boolean)
    const rows = await query<Record<string, string>>(
      `SELECT platform, area, project_type, price_band, age_band, city, interest,
              SUM(leads)::int AS leads,
              SUM(qualified)::int AS qualified,
              SUM(closed)::int AS closed,
              COUNT(DISTINCT tenant_id)::int AS tenants
       FROM entrestate_targeting_signals
       WHERE NOT (tenant_id = ANY($2::text[]))
       GROUP BY platform, area, project_type, price_band, age_band, city, interest
       HAVING SUM(leads) >= 5
       ORDER BY (SUM(closed)::float / GREATEST(SUM(leads), 1)) DESC, SUM(leads) DESC
       LIMIT $1`,
      [limit, exclude],
    )
    return rows.map((r) => ({
      platform: r.platform, area: r.area, projectType: r.project_type,
      priceBand: r.price_band, ageBand: r.age_band, city: r.city, interest: r.interest,
      leads: Number(r.leads),
      qualifiedRate: Math.round((Number(r.qualified) / Math.max(Number(r.leads), 1)) * 100),
      closeRate: Math.round((Number(r.closed) / Math.max(Number(r.leads), 1)) * 100),
      tenants: Number(r.tenants),
    }))
  } catch {
    return []
  }
}

/** Bucket an exact count into a range so a shared benchmark never reveals
 * one tenant's precise volume — "leads" stays useful for ranking without
 * being a number anyone could reverse-engineer into a real business figure. */
export function bucketCount(n: number): string {
  if (n < 10) return `${n}`
  if (n < 25) return '10-24'
  if (n < 50) return '25-49'
  if (n < 100) return '50-99'
  if (n < 250) return '100-249'
  if (n < 500) return '250-499'
  return '500+'
}

/** Import stats for the operator view. */
export async function getBaseStats(): Promise<Array<{ tenantId: string; rows: number; lastImport: string | null }>> {
  try {
    await ensureOnce()
    const rows = await query<{ tenant_id: string; n: string; last: string | null }>(
      `SELECT tenant_id, COUNT(*)::text AS n, MAX(created_at)::text AS last
       FROM entrestate_lead_history GROUP BY tenant_id ORDER BY tenant_id`,
    )
    return rows.map((r) => ({ tenantId: r.tenant_id, rows: parseInt(r.n, 10), lastImport: r.last }))
  } catch {
    return []
  }
}

export interface BaseQuality {
  tenantId: string
  rows: number
  outcomes: { lead: number; qualified: number; closed: number; lost: number }
  /** % of rows that have each dimension filled — the "criteria" the pool was
   *  actually imported with, without exposing a single row's real values. */
  fieldCoverage: { field: string; pct: number }[]
}

const COVERAGE_FIELDS = [
  { field: 'platform', col: 'platform' },
  { field: 'area', col: 'area' },
  { field: 'projectType', col: 'project_type' },
  { field: 'priceBand', col: 'price_band' },
  { field: 'ageBand', col: 'age_band' },
  { field: 'city', col: 'city' },
  { field: 'interest', col: 'interest' },
] as const

/** Row count + outcome mix + per-field fill-rate for one tenant — the
 * quality signal shown on the Data Pool page and handed to the AI. Never
 * touches a row's actual values, only how many rows have each field set. */
export async function getBaseQuality(tenantId: string): Promise<BaseQuality | null> {
  try {
    await ensureOnce()
    const rows = await query<Record<string, string>>(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE outcome = 'lead')::int AS lead,
              COUNT(*) FILTER (WHERE outcome = 'qualified')::int AS qualified,
              COUNT(*) FILTER (WHERE outcome = 'closed')::int AS closed,
              COUNT(*) FILTER (WHERE outcome = 'lost')::int AS lost,
              COUNT(*) FILTER (WHERE platform IS NOT NULL)::int AS platform_n,
              COUNT(*) FILTER (WHERE area IS NOT NULL)::int AS area_n,
              COUNT(*) FILTER (WHERE project_type IS NOT NULL)::int AS project_type_n,
              COUNT(*) FILTER (WHERE price_band IS NOT NULL)::int AS price_band_n,
              COUNT(*) FILTER (WHERE age_band IS NOT NULL)::int AS age_band_n,
              COUNT(*) FILTER (WHERE city IS NOT NULL)::int AS city_n,
              COUNT(*) FILTER (WHERE interest IS NOT NULL)::int AS interest_n
       FROM entrestate_lead_history WHERE tenant_id = $1`,
      [tenantId],
    )
    const r = rows[0]
    const total = Number(r?.total) || 0
    if (!r || total === 0) return null
    const pct = (n: string) => Math.round((Number(n) / total) * 100)
    return {
      tenantId,
      rows: total,
      outcomes: {
        lead: Number(r.lead) || 0, qualified: Number(r.qualified) || 0,
        closed: Number(r.closed) || 0, lost: Number(r.lost) || 0,
      },
      fieldCoverage: COVERAGE_FIELDS.map(({ field, col }) => ({ field, pct: pct(r[`${col}_n`]) })),
    }
  } catch {
    return null
  }
}
