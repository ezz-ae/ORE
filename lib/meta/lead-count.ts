import type { MetaInsightActions } from './types'

/**
 * The ONE canonical lead count from a Meta insights `actions` array.
 *
 * Meta reports the same lead under several overlapping action types
 * ('lead', 'leadgen_grouped', 'onsite_conversion.lead_grouped',
 * 'offsite_conversion.fb_pixel_lead', …). Summing every type containing
 * "lead" therefore multiplies the truth — the exact bug that showed a
 * campaign with 24 real leads as 120 (5 overlapping rollups × 24).
 *
 * Rule: prefer the exact 'lead' action (Meta's own total rollup); if absent,
 * take the FIRST lead-flavored action — never a sum across types. No
 * actions → 0, never invented.
 */
export function metaLeadCount(actions: MetaInsightActions[] | undefined | null): number {
  if (!actions?.length) return 0
  const exact = actions.find((a) => a.action_type === 'lead')
  if (exact) return Number(exact.value) || 0
  const flavored = actions.find((a) => a.action_type.includes('lead'))
  return flavored ? Number(flavored.value) || 0 : 0
}
