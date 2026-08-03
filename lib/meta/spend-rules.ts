import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'
import { randomUUID } from 'node:crypto'
import type { SpendRule } from '@/lib/meta/spend-authority'

// Persistence for the admin's autonomous-spend rules ("the AI may spend up to X
// if results are Y"). Org-level settings, not per-user — any admin manages them
// and they govern every broker's autonomous spend. The safe default is NO rows:
// with no rule, the spend governor blocks all autonomous spend (see
// spend-authority.ts). A failed read must never crash the ads surface.

const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_spend_rules (
      id                     text PRIMARY KEY,
      enabled                boolean NOT NULL DEFAULT true,
      scope                  text NOT NULL DEFAULT 'all',
      max_daily_budget_aed   numeric NOT NULL,
      max_increase_per_action_aed numeric NOT NULL,
      require_cpl_below_aed   numeric,
      require_quality_at_least numeric,
      require_min_leads        integer,
      created_by             text,
      updated_at             timestamptz NOT NULL DEFAULT now()
    )
  `)
}
const ensureOnce = () => dbEnsureOnce('freehold_spend_rules', ensure)

type Row = {
  id: string; enabled: boolean; scope: string
  max_daily_budget_aed: string; max_increase_per_action_aed: string
  require_cpl_below_aed: string | null; require_quality_at_least: string | null; require_min_leads: number | null
}
const mapRow = (r: Row): SpendRule => ({
  id: r.id,
  enabled: r.enabled,
  scope: r.scope === 'all' ? 'all' : r.scope,
  maxDailyBudgetAED: Number(r.max_daily_budget_aed),
  maxIncreasePerActionAED: Number(r.max_increase_per_action_aed),
  ...(r.require_cpl_below_aed !== null ? { requireCplBelowAED: Number(r.require_cpl_below_aed) } : {}),
  ...(r.require_quality_at_least !== null ? { requireQualityAtLeast: Number(r.require_quality_at_least) } : {}),
  ...(r.require_min_leads !== null ? { requireMinLeads: Number(r.require_min_leads) } : {}),
})

/** All spend rules (admin dashboard). Newest-updated first. */
export async function listSpendRules(): Promise<SpendRule[]> {
  try {
    await ensureOnce()
    const rows = await query<Row>(
      `SELECT id, enabled, scope, max_daily_budget_aed, max_increase_per_action_aed,
              require_cpl_below_aed, require_quality_at_least, require_min_leads
         FROM freehold_spend_rules ORDER BY updated_at DESC`,
    )
    return rows.map(mapRow)
  } catch {
    return []
  }
}

/** Rules that apply to a project (its own + the 'all' scope). Used by the governor. */
export async function getApplicableSpendRules(projectSlug: string): Promise<SpendRule[]> {
  const all = await listSpendRules()
  return all.filter((r) => r.enabled && (r.scope === 'all' || r.scope === projectSlug))
}

/** Create or update a rule. Returns the saved rule, or null on failure. */
export async function upsertSpendRule(
  input: Partial<SpendRule> & { maxDailyBudgetAED: number; maxIncreasePerActionAED: number },
  createdBy: string,
): Promise<SpendRule | null> {
  try {
    await ensureOnce()
    const id = input.id && input.id.trim() ? input.id.trim() : `sr_${randomUUID().slice(0, 12)}`
    const clampPos = (n: number | undefined) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null)
    await query(
      `INSERT INTO freehold_spend_rules
        (id, enabled, scope, max_daily_budget_aed, max_increase_per_action_aed,
         require_cpl_below_aed, require_quality_at_least, require_min_leads, created_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       ON CONFLICT (id) DO UPDATE SET
         enabled = $2, scope = $3, max_daily_budget_aed = $4, max_increase_per_action_aed = $5,
         require_cpl_below_aed = $6, require_quality_at_least = $7, require_min_leads = $8, updated_at = now()`,
      [
        id,
        input.enabled ?? true,
        input.scope && input.scope !== 'all' ? String(input.scope).slice(0, 120) : 'all',
        Math.max(0, input.maxDailyBudgetAED),
        Math.max(0, input.maxIncreasePerActionAED),
        clampPos(input.requireCplBelowAED),
        clampPos(input.requireQualityAtLeast),
        input.requireMinLeads != null ? Math.max(0, Math.round(input.requireMinLeads)) : null,
        createdBy,
      ],
    )
    const rows = await query<Row>(
      `SELECT id, enabled, scope, max_daily_budget_aed, max_increase_per_action_aed,
              require_cpl_below_aed, require_quality_at_least, require_min_leads
         FROM freehold_spend_rules WHERE id = $1 LIMIT 1`,
      [id],
    )
    return rows[0] ? mapRow(rows[0]) : null
  } catch {
    return null
  }
}

export async function deleteSpendRule(id: string): Promise<void> {
  try {
    await ensureOnce()
    await query(`DELETE FROM freehold_spend_rules WHERE id = $1`, [id])
  } catch {
    // best-effort
  }
}
