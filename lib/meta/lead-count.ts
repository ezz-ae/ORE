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
 * fall back through a FIXED priority of known lead-flavored types — never a
 * sum across types, and never "the first one the API happened to return"
 * (Meta doesn't guarantee array order, so pick-first made the reported total
 * flip run-to-run between the instant-form rollup and the pixel event). No
 * actions → 0, never invented.
 */
// Most-canonical → least: grouped instant-form/onsite rollups before the
// pixel event, so the same campaign always resolves to the same number.
const LEAD_TYPE_PRIORITY = [
  'leadgen_grouped',
  'onsite_conversion.lead_grouped',
  'onsite_conversion.lead',
  'offsite_conversion.fb_pixel_lead',
]
export function metaLeadCount(actions: MetaInsightActions[] | undefined | null): number {
  if (!actions?.length) return 0
  const exact = actions.find((a) => a.action_type === 'lead')
  if (exact) return Number(exact.value) || 0
  for (const type of LEAD_TYPE_PRIORITY) {
    const hit = actions.find((a) => a.action_type === type)
    if (hit) return Number(hit.value) || 0
  }
  // Any other lead-flavored type: deterministic by choosing the largest total
  // (the broadest rollup) rather than array order.
  const flavored = actions.filter((a) => a.action_type.includes('lead'))
  if (!flavored.length) return 0
  return flavored.reduce((max, a) => Math.max(max, Number(a.value) || 0), 0)
}
