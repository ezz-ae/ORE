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

/**
 * Every state, ENUMERABLE. The screens render these through a computed key
 * — t(`lm.machine.delivery.${state}`) — which `pnpm i18n` cannot see, so the
 * list has to be walkable for dynamic-keys-test. The type is derived FROM
 * the array: a new state cannot exist without appearing here.
 */
export const DELIVERY_STATES = [
  'inReview', 'rejected', 'billing', 'issue',
  'learning', 'learningLimited', 'delivering', 'notDelivering',
  'pausedByAdSet', 'pausedByCampaign', 'paused', 'archived',
  'finished', 'on', 'unknown',
] as const

export type DeliveryState = (typeof DELIVERY_STATES)[number]

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
  // SWITCHED ON COUNTS AS RUNNING, AND IS COLOURED LIKE IT.
  //
  // This state used to be folded into `unknown`, which is `idle` — the same
  // amber as Paused. So a campaign that had just been turned on and was
  // spending money sat in the list wearing the colour of a campaign that was
  // doing nothing, and there was no way to tell at a glance what was live.
  //
  // It is `good` rather than `delivering` in name only: the label still says
  // "On" and never "Delivering", because we have not been told it is reaching
  // anybody. Meta reporting zero impressions still overrides this to
  // `notDelivering` — the amber here was never protecting against that, it was
  // just failing to distinguish on from off.
  on: 'good',
  // An ad set that reached its end date did what it was told. Reading it as a
  // fault would put the Trakheesi permit stop — the thing we WANT to happen —
  // in the same red as an ad reaching nobody.
  finished: 'idle',
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
  /**
   * The ad set's own end_time, when it has one. Ours carry the Trakheesi
   * permit window, so an ad set past its end stopped ON PURPOSE — without
   * this it lands in `notDelivering`, which this file's own header calls the
   * most alarming state in the list.
   */
  endTime?: string | null
  /** Injected for tests; the clock is never read implicitly. */
  now?: Date
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
      // A STATUS WORD WE DO NOT RECOGNISE, or none at all. Genuinely unknown —
      // kept apart from `on` because "Meta said something we cannot read" and
      // "it is switched on" are different facts, and the first must never be
      // painted as the second.
      default:                     return 'unknown'
    }

    // ACTIVE is where the real answer lives — but an ad set past its end date
    // is finished, whatever Meta still calls it. Checked first, because every
    // other ACTIVE answer below would be a wrong one.
    if (input.endTime) {
      const end = Date.parse(input.endTime)
      if (Number.isFinite(end) && end <= (input.now ?? new Date()).getTime()) return 'finished'
    }

    const stage = String(input.learningStage ?? '').toUpperCase()
    if (stage === 'FAIL' || stage === 'LEARNING_LIMITED') return 'learningLimited'
    if (stage === 'LEARNING') return 'learning'

    // Approved and switched on, showing to nobody. Only claimed when Meta has
    // actually reported impressions for the window — an unknown number is not
    // evidence of zero.
    if (typeof input.impressions === 'number' && input.impressions <= 0) return 'notDelivering'
    if (typeof input.impressions === 'number' && input.impressions > 0) return 'delivering'

    // Switched on, nothing else known. "On" is all that can honestly be said,
    // and it is said as itself rather than dressed up as delivering.
    return 'on'
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
