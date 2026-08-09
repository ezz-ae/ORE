import type { MetaCampaignObjective, MetaOptimizationGoal, AdDestination } from './types'

/**
 * WHAT META IS ACTUALLY OPTIMISING FOR — and therefore what the cost cap caps.
 *
 * The wizard has a field labelled "max cost per lead". It becomes Meta's
 * `bid_amount`, and `bid_amount` caps the cost of whatever `optimization_goal`
 * the ad set was given. The operator never chose that goal; it was derived.
 *
 * On a WhatsApp ad the derived goal is LINK_CLICKS. So the default launch was
 * sending COST_CAP at AED 150 PER LINK CLICK — a cap perhaps thirty times
 * above what a Dubai property click costs, which is to say no cap at all,
 * under a label promising one. The two objectives that reach for it most —
 * WhatsApp and the landing-page ad — were the two where it did nothing.
 *
 * The goal is not a detail to hide. It decides what the money buys, what the
 * cap means, and whether a "cost per lead" number on the screen is a fact or a
 * decoration. So it lives here, in one place, client-safe, and the screen
 * shows it.
 *
 * Pure — no I/O, no credentials. lib/meta/client.ts imports it rather than
 * keeping its own copy.
 */

/**
 * Meta's optimisation goal for a launch.
 *
 * Instant forms optimise on the form itself; call ads on call quality. A
 * website objective optimises on real conversion signal when a pixel exists
 * and on landing-page views when one does not — everything else is clicks.
 */
export function objectiveToOptimizationGoal(
  obj: MetaCampaignObjective,
  hasPixel: boolean,
  destination?: AdDestination,
): MetaOptimizationGoal {
  // On-ad instant form optimizes on the form itself; call ads on call quality.
  if (destination === 'form')  return 'LEAD_GENERATION'
  if (destination === 'phone') return 'QUALITY_CALL'
  switch (obj) {
    case 'LEAD_GENERATION':
    case 'CONVERSIONS':
      // With a pixel we optimize on real conversion signal; without one,
      // landing-page views is the best available quality proxy.
      return hasPixel ? 'OFFSITE_CONVERSIONS' : 'LANDING_PAGE_VIEWS'
    default:
      return 'LINK_CLICKS'
  }
}

/** What one unit of the cost cap actually buys. */
export type CapUnit = 'lead' | 'call' | 'click' | 'view'

/**
 * The thing `bid_amount` caps the cost of, for this goal.
 *
 * A goal Meta adds later resolves to 'click' — the cheapest, most plentiful
 * event — because that is the assumption under which a cap is least likely to
 * be mistaken for a promise about leads.
 */
export function capUnitFor(goal: MetaOptimizationGoal): CapUnit {
  switch (goal) {
    case 'LEAD_GENERATION':
    case 'OFFSITE_CONVERSIONS':
      return 'lead'
    case 'QUALITY_CALL':
      return 'call'
    case 'LANDING_PAGE_VIEWS':
      return 'view'
    default:
      return 'click'
  }
}

/**
 * Is a cost cap on this goal really a cost-per-LEAD cap?
 *
 * The question the wizard has to answer before it prints the words "per lead"
 * next to a number the operator is about to trust.
 */
export function capIsPerLead(goal: MetaOptimizationGoal): boolean {
  return capUnitFor(goal) === 'lead'
}
