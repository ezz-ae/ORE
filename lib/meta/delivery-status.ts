/**
 * WHAT IS THIS AD ACTUALLY DOING RIGHT NOW.
 *
 * The system showed two words: Active or Paused. Between them sit every state
 * that actually explains a quiet account, and each one has a different answer:
 *
 *   · in review — Meta has not approved it yet. Nothing is wrong. Wait.
 *   · rejected — it will never run until the ad is changed.
 *   · payment — Meta is holding delivery for a billing problem, not an ad one.
 *   · has an issue — Meta flagged something specific and will say what.
 *   · learning — running, but Meta is still working out who to show it to.
 *     Worth a number: 12 of the 50 results it needs.
 *   · stuck in learning — Meta gave up learning at this volume. This is the
 *     one that quietly wastes the most money, and "Active" hid it completely.
 *   · delivering — running and being shown.
 *   · not delivering — ACTIVE, approved, and Meta is showing it to nobody.
 *     The most alarming state in the list, and the one that looked identical
 *     to a healthy ad.
 *   · paused by its ad set / campaign — the switch that stopped it is one
 *     level up, so switching THIS on changes nothing.
 *
 * "Active" was true for six of these and useful in none.
 *
 * Every state below is read from what Meta reports: effective_status (what
 * Meta will actually do, as opposed to what was asked for), learning_stage_info
 * and the delivery numbers. Nothing is inferred from a status alone.
 *
 * Pure + client-safe. Runs in `pnpm guards`.
 */

export type DeliveryState =
  | 'inReview' | 'rejected' | 'billing' | 'issue'
  | 'learning' | 'learningLimited' | 'delivering' | 'notDelivering'
  | 'pausedByAdSet' | 'pausedByCampaign' | 'paused' | 'archived' | 'unknown'

export type DeliveryTone = 'good' | 'working' | 'idle' | 'bad'

export interface Delivery {
  state: DeliveryState
  tone: DeliveryTone
  /** Learning progress, when Meta says it is learning and results are known. */
  progress?: { have: number; need: number }
}

/** Meta's own threshold for leaving the learning phase. */
export const LEARNING_TARGET = 50

const TONE: Record<DeliveryState, DeliveryTone> = {
  delivering: 'good',
  learning: 'working',
  inReview: 'working',
  learningLimited: 'bad',
  notDelivering: 'bad',
  rejected: 'bad',
  billing: 'bad',
  issue: 'bad',
  paused: 'idle',
  pausedByAdSet: 'idle',
  pausedByCampaign: 'idle',
  archived: 'idle',
  unknown: 'idle',
}

export interface DeliveryInput {
  /** Meta's effective_status — what it will actually do. */
  effectiveStatus?: string | null
  /** The status that was asked for, used only when there is no effective one. */
  status?: string | null
  /** ad set learning_stage_info.status: LEARNING | SUCCESS | FAIL. */
  learningStage?: string | null
  /** Results so far, for the learning progress number. */
  results?: number | null
  /**
   * Impressions in the recent window. Zero on an approved, ACTIVE ad is the
   * difference between "running" and "running and reaching nobody" — the
   * distinction "Active" erased.
   */
  impressions?: number | null
}

export function deliveryOf(input: DeliveryInput): Delivery {
  const raw = String(input.effectiveStatus ?? input.status ?? '').toUpperCase()
  const state = ((): DeliveryState => {
    switch (raw) {
      case 'PENDING_REVIEW':
      case 'PREAPPROVED':
      case 'IN_PROCESS':
        return 'inReview'
      case 'DISAPPROVED':          return 'rejected'
      case 'PENDING_BILLING_INFO': return 'billing'
      case 'WITH_ISSUES':          return 'issue'
      case 'ADSET_PAUSED':         return 'pausedByAdSet'
      case 'CAMPAIGN_PAUSED':      return 'pausedByCampaign'
      case 'PAUSED':               return 'paused'
      case 'ARCHIVED':
      case 'DELETED':              return 'archived'
      case 'ACTIVE':               break
      default:                     return raw ? 'unknown' : 'unknown'
    }

    // ACTIVE is where the real answer lives.
    const stage = String(input.learningStage ?? '').toUpperCase()
    if (stage === 'FAIL' || stage === 'LEARNING_LIMITED') return 'learningLimited'
    if (stage === 'LEARNING') return 'learning'

    // Approved and switched on, showing to nobody. Only claimed when Meta has
    // actually reported impressions for the window — an unknown number is not
    // evidence of zero.
    if (typeof input.impressions === 'number' && input.impressions <= 0) return 'notDelivering'
    if (typeof input.impressions === 'number' && input.impressions > 0) return 'delivering'

    // Switched on, nothing else known. "Active" is all that can honestly be
    // said, and it is said as itself rather than dressed up as delivering.
    return 'unknown'
  })()

  const out: Delivery = { state, tone: TONE[state] }
  if (state === 'learning' && typeof input.results === 'number' && input.results >= 0) {
    out.progress = { have: Math.floor(input.results), need: LEARNING_TARGET }
  }
  return out
}

/** Does this state mean money is moving? Used to sort the quiet ones up. */
export function isSpending(state: DeliveryState): boolean {
  return state === 'delivering' || state === 'learning' || state === 'learningLimited'
}
