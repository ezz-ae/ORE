/**
 * WHAT AN EVENT ACTUALLY COSTS ON THIS ACCOUNT.
 *
 * `learning-phase.ts` decides how many ad sets a budget can carry, and the
 * whole calculation turns on one input: the observed cost per optimisation
 * event. That input had NO PRODUCER. `EventCosts` was declared, tested, and
 * imported by the planner — and every production call reached the planner with
 * it undefined, which switched the entire learning ceiling off. The planner has
 * been returning four arms to accounts that cannot fund one.
 *
 * This is the producer. It reads a spend total and its action counts and
 * divides. Nothing more clever than that, and three rules about what it will
 * NOT do:
 *
 *  1. NO EVENTS OF A KIND MEANS UNKNOWN, NOT FREE AND NOT INFINITE. An account
 *     with zero landing-page views has no cost per landing-page view. Returning
 *     0 would tell the planner one arm needs AED 0/day to learn, and it would
 *     approve any number of arms. `null` is the only honest answer, and the
 *     planner already handles it by stepping down the ladder.
 *
 *  2. LINK CLICKS, NOT CLICKS. Meta's `clicks` counts every click on the ad —
 *     a like, a profile tap, an expand. Meta optimises on `link_click`. Using
 *     the bigger number would divide the same spend by more events, understate
 *     the cost, and overstate how many arms the budget supports. The error
 *     points the wrong way, which is why it has to be the exact action type.
 *
 *  3. ONE LEAD IS ONE LEAD. Meta reports the same lead under several
 *     overlapping action types, so the count comes from `metaLeadCount` — the
 *     one place in this codebase allowed to answer "how many leads".
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */
import type { EventCosts } from '@/lib/freehold/learning-phase'
import { metaLeadCount } from './lead-count'
import type { MetaInsightActions } from './types'

/** Meta's action type for a click that actually went somewhere. */
export const LINK_CLICK_ACTION = 'link_click'
/** …and for the page having loaded once it got there. */
export const LANDING_VIEW_ACTION = 'landing_page_view'

const countOf = (actions: MetaInsightActions[] | undefined | null, type: string): number => {
  const hit = actions?.find((a) => a.action_type === type)
  return hit ? Number(hit.value) || 0 : 0
}

/** Spend divided by events, or null when either side cannot support a number. */
const costPer = (spend: number, events: number): number | null =>
  spend > 0 && events > 0 ? spend / events : null

/**
 * Cost per optimisation event, from one insights row.
 *
 * The row is whatever window the caller asked for — account-level over the last
 * 30 days is what the planner uses, because a learning-phase budget is a
 * question about how this account behaves NOW, not how it behaved in its first
 * month a year ago.
 */
export function eventCostsFromInsights(insights: {
  spend?: string | number | null
  actions?: MetaInsightActions[] | null
} | null | undefined): EventCosts {
  const spend = Number(insights?.spend ?? 0) || 0
  const actions = insights?.actions ?? []
  return {
    link_click: costPer(spend, countOf(actions, LINK_CLICK_ACTION)),
    landing_view: costPer(spend, countOf(actions, LANDING_VIEW_ACTION)),
    lead: costPer(spend, metaLeadCount(actions)),
  }
}

/** True when nothing at all could be measured — the state where the planner
 *  must fall back to a single arm rather than guess a split. */
export const noCostsKnown = (costs: EventCosts): boolean =>
  !((costs.lead ?? 0) > 0 || (costs.landing_view ?? 0) > 0 || (costs.link_click ?? 0) > 0)
