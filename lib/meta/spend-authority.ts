// lib/meta/spend-authority.ts
//
// Layer 3 — the money governor. The intent layer (Layer 2) may auto-act within
// the guardrail-safe set, but SPENDING credits autonomously is bounded by rules
// the admin sets on the credit dashboard: "the AI may spend up to X per day / Y
// per move — but ONLY if the results justify it (CPL under this, quality over
// that, enough leads for signal)." No admin rule → no autonomous spend (the safe
// default: the AI can restructure for free, but never move money until granted).
//
// This is deliberately deterministic and explainable — money authority must
// never come from a black box. Layer 2 decides WHAT to do; this decides HOW MUCH
// of it the AI is allowed to fund on its own, and hands anything beyond the
// envelope to the admin.

export interface SpendRule {
  id: string
  enabled: boolean
  /** 'all' projects, or a specific projectSlug. Project rules add to 'all'. */
  scope: 'all' | string
  /** Hard ceiling for a campaign's daily budget after an autonomous increase. */
  maxDailyBudgetAED: number
  /** Largest single autonomous increase per action. */
  maxIncreasePerActionAED: number
  /** Results gates — ALL set ones must pass for the rule to authorize a spend. */
  requireCplBelowAED?: number      // only fund what's converting cheaply
  requireQualityAtLeast?: number   // 0–100 CRM quality floor
  requireMinLeads?: number         // enough attributed leads to trust the signal
}

export interface CampaignResults {
  currentDailyBudgetAED: number
  /** null = no attributed signal yet (never auto-spend on no signal). */
  cplAED: number | null
  qualityScore: number | null
  leads: number
}

export interface SpendProposal {
  projectSlug: string
  campaignId: string
  /** The daily budget the intent layer wants to reach. */
  requestedDailyBudgetAED: number
}

export type SpendDecision = 'auto' | 'capped' | 'blocked'
export interface SpendAuthorization {
  decision: SpendDecision
  /** The daily budget the system will actually set (never above requested). */
  approvedDailyBudgetAED: number
  /** Plain-language justification for the admin log. */
  reason: string
  /** The rule that granted the authority, if any. */
  ruleId: string | null
}

const applicable = (rules: SpendRule[], projectSlug: string) =>
  rules.filter((r) => r.enabled && (r.scope === 'all' || r.scope === projectSlug))

// Does a rule's results-gate pass? A gate that references a metric we have no
// signal for (null) fails closed — we never fund on absent data.
function gatePasses(rule: SpendRule, r: CampaignResults): { ok: boolean; miss?: string } {
  if (typeof rule.requireMinLeads === 'number' && r.leads < rule.requireMinLeads) {
    return { ok: false, miss: `needs ${rule.requireMinLeads}+ leads for signal (has ${r.leads})` }
  }
  if (typeof rule.requireCplBelowAED === 'number') {
    if (r.cplAED === null) return { ok: false, miss: 'no CPL signal yet' }
    if (r.cplAED >= rule.requireCplBelowAED) return { ok: false, miss: `CPL AED ${Math.round(r.cplAED)} is not below AED ${rule.requireCplBelowAED}` }
  }
  if (typeof rule.requireQualityAtLeast === 'number') {
    if (r.qualityScore === null) return { ok: false, miss: 'no CRM quality signal yet' }
    if (r.qualityScore < rule.requireQualityAtLeast) return { ok: false, miss: `quality ${r.qualityScore} is below ${rule.requireQualityAtLeast}` }
  }
  return { ok: true }
}

/**
 * How much of a proposed budget move the AI may fund autonomously, given the
 * admin's rules and the campaign's real results. Pure and deterministic.
 */
export function evaluateSpendAuthority(
  proposal: SpendProposal,
  results: CampaignResults,
  rules: SpendRule[],
): SpendAuthorization {
  const current = Math.max(0, results.currentDailyBudgetAED)
  const requested = Math.max(0, proposal.requestedDailyBudgetAED)

  // A decrease or no-change never needs spend authority.
  if (requested <= current) {
    return { decision: 'auto', approvedDailyBudgetAED: requested, reason: 'No budget increase requested.', ruleId: null }
  }

  const rulesFor = applicable(rules, proposal.projectSlug)
  if (rulesFor.length === 0) {
    return {
      decision: 'blocked',
      approvedDailyBudgetAED: current,
      reason: 'No autonomous spend rule is set for this project. The increase is held for admin approval.',
      ruleId: null,
    }
  }

  // Never fund on absent data — regardless of which gates a rule sets. With no
  // attributed lead / no CPL signal there is nothing to justify autonomous spend.
  if (results.cplAED === null || results.leads <= 0) {
    return {
      decision: 'blocked',
      approvedDailyBudgetAED: current,
      reason: 'No attributed-result signal yet (no leads / no CPL) — the increase is held for admin approval.',
      ruleId: null,
    }
  }

  // Each satisfied rule authorizes a ceiling; the AI may use the most generous
  // envelope the admin has granted. Track the best miss reason if none pass.
  let bestCeiling = current
  let grantingRule: string | null = null
  const misses: string[] = []
  for (const rule of rulesFor) {
    const gate = gatePasses(rule, results)
    if (!gate.ok) { misses.push(`${rule.id}: ${gate.miss}`); continue }
    const ceiling = Math.min(rule.maxDailyBudgetAED, current + rule.maxIncreasePerActionAED)
    if (ceiling > bestCeiling) { bestCeiling = ceiling; grantingRule = rule.id }
  }

  if (grantingRule === null || bestCeiling <= current) {
    return {
      decision: 'blocked',
      approvedDailyBudgetAED: current,
      reason: `Results don't yet meet the autonomous-spend conditions — held for admin. (${misses.join('; ') || 'no headroom in the rule'})`,
      ruleId: null,
    }
  }

  const approved = Math.min(requested, bestCeiling)
  if (approved >= requested) {
    return {
      decision: 'auto',
      approvedDailyBudgetAED: approved,
      reason: `Within the admin's spend envelope and results justify it — funded to AED ${Math.round(approved)}/day.`,
      ruleId: grantingRule,
    }
  }
  return {
    decision: 'capped',
    approvedDailyBudgetAED: approved,
    reason: `Auto-funded to the admin ceiling (AED ${Math.round(approved)}/day); the rest of the requested increase is held for admin approval.`,
    ruleId: grantingRule,
  }
}
