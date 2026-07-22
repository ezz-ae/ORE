// lib/freehold/spend-governor.ts
//
// The Spend Governor — a DETERMINISTIC rule engine that gates every autonomous,
// spend-INCREASING action the Ads Machine can take. It is intentionally NOT a
// model: given the rule and the live numbers, the same inputs always produce the
// same verdict, in plain language.
//
// The governing law (from the architecture spec):
//   "AI may spend up to X, but only if CPL is below Y.
//    If no rule exists, no autonomous spend is permitted."
//
// So: rules are OFF by default → the Machine may pause/optimise but may never
// raise a budget until management sets an explicit, bounded rule.

import { query } from '@/lib/db'

export interface SpendRules {
  enabled: boolean
  /** Hard ceiling on any single campaign's new daily budget (AED). */
  maxDailyAed: number
  /** The Machine may only raise spend on a campaign whose CPL is below this (AED). 0 = no CPL gate. */
  cplCeilingAed: number
  updatedBy: string | null
  updatedAt: string | null
}

export interface SpendVerdict {
  allowed: boolean
  /** Plain-language reason, always logged with the decision. */
  reason: string
}

const DEFAULT: SpendRules = { enabled: false, maxDailyAed: 0, cplCeilingAed: 0, updatedBy: null, updatedAt: null }

let ensured = false
async function ensure() {
  if (ensured) return
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_spend_rules (
      id            integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      enabled       boolean NOT NULL DEFAULT false,
      max_daily_aed numeric NOT NULL DEFAULT 0,
      cpl_ceiling_aed numeric NOT NULL DEFAULT 0,
      updated_by    text,
      updated_at    timestamptz DEFAULT now()
    )
  `)
  ensured = true
}

export async function getSpendRules(): Promise<SpendRules> {
  try {
    await ensure()
    const [row] = await query<{ enabled: boolean; max_daily_aed: string; cpl_ceiling_aed: string; updated_by: string | null; updated_at: string | null }>(
      `SELECT enabled, max_daily_aed, cpl_ceiling_aed, updated_by, updated_at FROM freehold_spend_rules WHERE id = 1`,
    )
    if (!row) return DEFAULT
    return {
      enabled: !!row.enabled,
      maxDailyAed: Number(row.max_daily_aed) || 0,
      cplCeilingAed: Number(row.cpl_ceiling_aed) || 0,
      updatedBy: row.updated_by,
      updatedAt: row.updated_at,
    }
  } catch {
    return DEFAULT // fail closed — no rule means no autonomous spend
  }
}

export async function setSpendRules(
  r: { enabled: boolean; maxDailyAed: number; cplCeilingAed: number },
  updatedBy: string,
): Promise<void> {
  await ensure()
  const maxDaily = Math.max(0, Math.round(Number(r.maxDailyAed) || 0))
  const cpl = Math.max(0, Math.round(Number(r.cplCeilingAed) || 0))
  await query(
    `INSERT INTO freehold_spend_rules (id, enabled, max_daily_aed, cpl_ceiling_aed, updated_by, updated_at)
     VALUES (1, $1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET enabled = $1, max_daily_aed = $2, cpl_ceiling_aed = $3, updated_by = $4, updated_at = now()`,
    [!!r.enabled, maxDaily, cpl, updatedBy],
  )
}

/**
 * Deterministic gate for a proposed spend increase. Same inputs → same verdict.
 * `newDailyAed` is the daily budget the Machine wants to set; `currentCpl` is the
 * campaign's live cost per lead (0 = unknown).
 */
export function evaluateSpend(rules: SpendRules, proposed: { newDailyAed: number; currentCpl: number }): SpendVerdict {
  if (!rules.enabled) {
    return { allowed: false, reason: 'No spend rule is set — autonomous spend is not permitted.' }
  }
  if (rules.maxDailyAed <= 0) {
    return { allowed: false, reason: 'The daily-budget ceiling is 0 — no autonomous spend is permitted.' }
  }
  if (proposed.newDailyAed > rules.maxDailyAed) {
    return { allowed: false, reason: `Blocked: AED ${Math.round(proposed.newDailyAed)}/day exceeds the AED ${rules.maxDailyAed}/day ceiling.` }
  }
  if (rules.cplCeilingAed > 0) {
    if (proposed.currentCpl <= 0) {
      return { allowed: false, reason: 'Blocked: no cost-per-lead yet, so the CPL rule cannot be satisfied.' }
    }
    if (proposed.currentCpl >= rules.cplCeilingAed) {
      return { allowed: false, reason: `Blocked: cost per lead (AED ${Math.round(proposed.currentCpl)}) is at or above the AED ${rules.cplCeilingAed} ceiling.` }
    }
  }
  return {
    allowed: true,
    reason: `Allowed: AED ${Math.round(proposed.newDailyAed)}/day is within the AED ${rules.maxDailyAed} ceiling${rules.cplCeilingAed > 0 ? ` and CPL (AED ${Math.round(proposed.currentCpl)}) is below AED ${rules.cplCeilingAed}` : ''}.`,
  }
}
