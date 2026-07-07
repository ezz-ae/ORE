import { randomUUID } from 'node:crypto'
import { query } from '@/lib/db'

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

const norm = (v: unknown, max = 80): string | null => {
  const s = String(v ?? '').trim().toLowerCase()
  return s ? s.slice(0, max) : null
}

let ensured: Promise<void> | null = null
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
const ensureOnce = async () => { if (!ensured) ensured = ensure().catch((e) => { ensured = null; throw e }); await ensured }

/** Bulk-insert historical rows for a tenant (max ~2000 per call). */
export async function importHistory(tenantId: string, rows: HistoryRow[]): Promise<number> {
  await ensureOnce()
  let inserted = 0
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
        norm(r.source), norm(r.platform, 30), norm(r.campaign, 120), norm(r.area),
        norm(r.projectType, 40), norm(r.priceBandAED, 40), norm(r.ageBand, 20),
        norm(r.city, 60), norm(r.interest, 80), outcome, date,
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
  return inserted
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

/** Fold the CURRENT tenant's live CRM leads into its signals (auto table). */
export async function refreshLiveTenantSignals(): Promise<void> {
  await ensureOnce()
  const liveTenant = `${TENANT_ID}-live`
  await query(`DELETE FROM entrestate_targeting_signals WHERE tenant_id = $1`, [liveTenant])
  await query(
    `INSERT INTO entrestate_targeting_signals
       (tenant_id, platform, area, project_type, price_band, age_band, city, interest, leads, qualified, closed, lost, updated_at)
     SELECT $1,
            CASE WHEN source ILIKE '%google%' THEN 'google'
                 WHEN source ILIKE '%meta%' OR source ILIKE '%face%' OR source ILIKE '%insta%' THEN 'meta'
                 ELSE 'other' END,
            '', '', '', '', '',
            COALESCE(NULLIF(lower(trim(project_interest)), ''), ''),
            COUNT(*),
            COUNT(*) FILTER (WHERE priority IN ('hot','priority') OR status IN ('qualified','viewing','negotiation','closed','converted')),
            COUNT(*) FILTER (WHERE status IN ('closed','converted')),
            COUNT(*) FILTER (WHERE status = 'lost'),
            now()
     FROM freehold_site_leads
     GROUP BY 2, 8`,
    [liveTenant],
  ).catch(() => { /* live CRM table may not exist in a fresh white-label */ })
}

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
 */
export async function getNetworkBenchmarks(limit = 20): Promise<NetworkBenchmark[]> {
  try {
    await ensureOnce()
    const rows = await query<Record<string, string>>(
      `SELECT platform, area, project_type, price_band, age_band, city, interest,
              SUM(leads)::int AS leads,
              SUM(qualified)::int AS qualified,
              SUM(closed)::int AS closed,
              COUNT(DISTINCT tenant_id)::int AS tenants
       FROM entrestate_targeting_signals
       GROUP BY platform, area, project_type, price_band, age_band, city, interest
       HAVING SUM(leads) >= 5
       ORDER BY (SUM(closed)::float / GREATEST(SUM(leads), 1)) DESC, SUM(leads) DESC
       LIMIT $1`,
      [limit],
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
