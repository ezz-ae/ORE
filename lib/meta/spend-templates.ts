import type { SpendRule } from './spend-authority'

/**
 * Logical starting-point presets for the AI Spend Governor — so an admin never
 * faces a blank rules dashboard. These are HUMAN rules of thumb, NOT values
 * computed from the account's data: each encodes a sensible posture (protect /
 * balance / scale) for Dubai off-plan, where a qualified property lead typically
 * costs roughly AED 100–400. Apply one, then fine-tune to your own numbers.
 *
 * Pure data + one logical picker — safe to import from client and server.
 */

export type SpendTemplateKey = 'conservative' | 'standard' | 'aggressive'

/** The rule fields a template pre-fills (id/enabled/scope are set on save). */
export type SpendTemplateValues = Pick<
  SpendRule,
  | 'maxDailyBudgetAED'
  | 'maxIncreasePerActionAED'
  | 'requireCplBelowAED'
  | 'requireQualityAtLeast'
  | 'requireMinLeads'
>

export interface SpendTemplate {
  key: SpendTemplateKey
  values: SpendTemplateValues
}

export const SPEND_TEMPLATES: SpendTemplate[] = [
  // Protect the budget: only fund cheap, high-quality, well-proven campaigns, in small steps.
  { key: 'conservative', values: { maxDailyBudgetAED: 300, maxIncreasePerActionAED: 50, requireCplBelowAED: 120, requireQualityAtLeast: 70, requireMinLeads: 10 } },
  // Balanced growth: fund market-normal performers in sensible steps.
  { key: 'standard', values: { maxDailyBudgetAED: 750, maxIncreasePerActionAED: 150, requireCplBelowAED: 200, requireQualityAtLeast: 55, requireMinLeads: 5 } },
  // Scale winners fast: higher ceilings for a launch push — still gated on real results.
  { key: 'aggressive', values: { maxDailyBudgetAED: 1500, maxIncreasePerActionAED: 400, requireCplBelowAED: 350, requireQualityAtLeast: 40, requireMinLeads: 3 } },
]

export const getSpendTemplate = (key: SpendTemplateKey): SpendTemplate =>
  SPEND_TEMPLATES.find((t) => t.key === key) ?? SPEND_TEMPLATES[1]

/**
 * Which preset to suggest — logical, not statistical. A first-time setup (no
 * rules yet) eases in with the protected Conservative preset, matching the
 * governor's fail-closed ethos; once the admin has rules, the balanced Standard
 * is the sensible next step. No account math involved.
 */
export function recommendSpendTemplate(ctx: { hasExistingRules: boolean }): SpendTemplateKey {
  return ctx.hasExistingRules ? 'standard' : 'conservative'
}
