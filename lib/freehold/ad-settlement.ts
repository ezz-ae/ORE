/**
 * ADS ARE PAID FOR WITH WHAT THEY ACTUALLY SPENT.
 *
 * The old rule charged the DAILY BUDGET at launch. A budget is a ceiling, not a
 * price: a campaign set to AED 300 a day that delivers AED 40 charged the broker
 * AED 300, and one that ran for three weeks charged them once. Neither number
 * had anything to do with money leaving the company.
 *
 * So the platform's own reported spend is the bill. Every AED 10 that Meta or
 * Google actually delivers moves AED 10 from the launcher's wallet to the bank,
 * and that Cash then leaves the system as a withdrawal against the platform's
 * invoice. A dirham in this system is now always a real dirham: it was either
 * deposited, or it was spent, and both have a receipt.
 *
 * ── THE HIGH-WATER MARK IS WHAT MAKES IT SAFE ────────────────────────────
 *
 * The sync runs on a timer over a number that only grows. So the settlement
 * never asks "what changed since last time" — it asks "what should be settled
 * IN TOTAL by now", and moves the difference. A missed tick self-heals on the
 * next one. A duplicated tick moves zero. A crash between the transfer and the
 * bookkeeping is repaired by running again, because the reference is derived
 * from the new total rather than from the attempt.
 *
 * A delta-based design would have been simpler to write and impossible to
 * operate: every retry is a double charge, and every missed tick is money the
 * company paid Meta and never billed.
 *
 * ── WHY TEN DIRHAMS AND NOT EVERY FILS ───────────────────────────────────
 *
 * The ledger is INTEGER Cash, and platform spend arrives as a float that
 * wobbles — Meta restates the last few hours all day long. Settling on every
 * reported change would write hundreds of one-dirham postings per campaign per
 * day and make the wallet log unreadable, which is the same as making it
 * unused. Ten dirhams is small enough that nobody's balance is meaningfully
 * ahead of their spend and large enough that a campaign produces a handful of
 * legible rows a day.
 *
 * ── AND SPEND CAN GO BACKWARDS ───────────────────────────────────────────
 *
 * Platforms restate. A campaign that reported AED 400 this morning can report
 * AED 380 tonight, and the honest answer is NOT to quietly refund: the money
 * may reappear at the next refresh, and a wallet that oscillates is a wallet
 * nobody trusts. A restatement is reported and settled at the mark already
 * reached, so the books never move backwards on their own. If a platform
 * genuinely credits money back, that is a refund somebody makes deliberately.
 *
 * ── NOTHING RESERVES ANY MORE, SO SOMETHING HAS TO STOP ──────────────────
 *
 * With no reservation, an empty wallet does not prevent a campaign from
 * spending — the auction has no idea what a wallet is. The sync IS the brake:
 * when a launcher can no longer cover what their campaigns are delivering, the
 * campaign is paused. That makes `walletVerdict` the most consequential
 * function in this file, and the reason it errs toward pausing early.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */
import { CREDIT_VALUE_AED } from '@/lib/freehold/credits-shared'

/**
 * The size of one settlement step, in dirhams.
 *
 * See the header. Ten is a legibility decision, not an accounting one — the
 * amount owed is exact, this only controls how often it is moved.
 */
export const SETTLE_STEP_AED = 10

/**
 * How far behind their real spend a launcher may be, in dirhams.
 *
 * One step. Anything under SETTLE_STEP_AED is unbilled at any moment, which is
 * the price of not writing a posting per fils, and it is stated here so nobody
 * has to derive it from the step to know the exposure.
 */
export const MAX_UNBILLED_AED = SETTLE_STEP_AED

/**
 * Days of budget a launcher must hold before a campaign may start.
 *
 * Two. Not a reservation — nothing is debited and nothing is held — but a
 * campaign whose owner cannot cover its first day will be paused by the sync
 * within hours, and launching into that is worse than refusing: the ad enters
 * the auction, Meta charges the company for the impressions it bought, and the
 * broker gets a campaign that dies overnight for reasons they did not see.
 *
 * Two rather than one because the sync is not instantaneous and a campaign
 * frequently overspends its first day while the platform is still pacing.
 */
export const LAUNCH_FLOOR_DAYS = 2

/** Walkable — what the sync decided about a campaign this tick. */
export const SETTLE_VERDICTS = ['settled', 'nothingDue', 'restated', 'walletDry'] as const
export type SettleVerdict = (typeof SETTLE_VERDICTS)[number]

/** Walkable — what should happen to the campaign itself. */
export const WALLET_VERDICTS = ['keepRunning', 'pause'] as const
export type WalletVerdict = (typeof WALLET_VERDICTS)[number]

/**
 * The total that should have been settled by now, given this much reported
 * spend.
 *
 * Floored to the step, so the mark only ever moves in whole steps and two
 * callers reading the same spend figure always agree on it.
 */
export function settleTarget(spendAed: number): number {
  if (!Number.isFinite(spendAed) || spendAed <= 0) return 0
  return Math.floor(spendAed / SETTLE_STEP_AED) * SETTLE_STEP_AED
}

export interface SettleRead {
  /** What the platform says this campaign has spent, in dirhams, all-time. */
  spendAed: number
  /** What has already been moved out of the wallet for it. */
  settledAed: number
  /** What the launcher can actually pay right now. */
  walletBalance: number
}

export interface Settlement {
  verdict: SettleVerdict
  /** Dirhams to move from the wallet to the bank on this tick. */
  moveAed: number
  /** The mark AFTER this movement — the idempotency key and the new stored value. */
  markAed: number
  /** Reported spend that could not be paid for. Drives the pause. */
  shortfallAed: number
}

/**
 * What this tick owes.
 *
 * The three interesting cases and why each answers the way it does:
 *
 *   · the mark has not moved a whole step         → `nothingDue`, move nothing.
 *   · the platform restated downwards             → `restated`, move nothing,
 *     and leave the mark where it is. See the header: a wallet that oscillates
 *     with Meta's hourly corrections is a wallet nobody trusts.
 *   · the wallet cannot cover the whole step      → settle what it CAN, in whole
 *     steps, and report the rest as a shortfall. Taking a partial step would
 *     put the mark somewhere no other reader could reproduce; refusing to
 *     settle anything would let a big balance sit unbilled behind one expensive
 *     campaign.
 */
export function settle(read: SettleRead): Settlement {
  const already = Math.max(0, Math.floor(read.settledAed))
  const target = settleTarget(read.spendAed)

  if (target < already) {
    return { verdict: 'restated', moveAed: 0, markAed: already, shortfallAed: 0 }
  }

  const owed = target - already
  if (owed <= 0) return { verdict: 'nothingDue', moveAed: 0, markAed: already, shortfallAed: 0 }

  const affordable = settleTarget(Math.max(0, read.walletBalance))
  const move = Math.min(owed, affordable)
  if (move <= 0) {
    // Nothing can be paid. The whole outstanding amount is a shortfall, and
    // this is the state that stops the campaign.
    return { verdict: 'walletDry', moveAed: 0, markAed: already, shortfallAed: owed }
  }

  return {
    verdict: move < owed ? 'walletDry' : 'settled',
    moveAed: move,
    markAed: already + move,
    shortfallAed: owed - move,
  }
}

/**
 * Should this campaign keep running?
 *
 * Pause on ANY shortfall, not on an empty wallet. By the time a balance reads
 * zero the company has already bought impressions it cannot bill for; a
 * shortfall is the first moment that is knowable, and it is one step of
 * exposure rather than a day of it.
 */
export function walletVerdict(s: Pick<Settlement, 'shortfallAed'>): WalletVerdict {
  return s.shortfallAed > 0 ? 'pause' : 'keepRunning'
}

/**
 * May this campaign start?
 *
 * Nothing is reserved and nothing is held — this is a gate, not a charge. It
 * exists because a campaign launched by somebody who cannot cover its first day
 * will be paused by the sync within hours, after the company has already been
 * charged for the impressions.
 */
export function canLaunch(
  walletBalance: number,
  dailyBudgetAed: number,
): { ok: true } | { ok: false; needAed: number; haveAed: number } {
  const have = Number.isFinite(walletBalance) ? Math.max(0, Math.floor(walletBalance)) : 0
  // A BUDGET THAT IS NOT A NUMBER REFUSES, and refuses with figures somebody
  // can read. Letting NaN through would make `need` NaN, every comparison
  // false, and the refusal message a pair of blanks — so the broker would be
  // told they cannot afford something the screen could not name.
  if (!Number.isFinite(dailyBudgetAed) || dailyBudgetAed <= 0) {
    return { ok: false, needAed: SETTLE_STEP_AED, haveAed: have }
  }
  const need = Math.max(SETTLE_STEP_AED, Math.ceil(dailyBudgetAed * LAUNCH_FLOOR_DAYS))
  return have >= need ? { ok: true } : { ok: false, needAed: need, haveAed: have }
}

/**
 * The reference one settlement is filed under, forever.
 *
 * Derived from the campaign and the MARK REACHED, never from the attempt or the
 * clock. That is what makes a retry after a crash a no-op instead of a second
 * charge: the same campaign settling to the same total produces the same key,
 * and the ledger's unique index refuses the duplicate.
 */
export const settlementReference = (campaignId: string, markAed: number): string =>
  `spend:ads:${campaignId}:${markAed}`

/**
 * Cash for a number of dirhams of platform spend.
 *
 * One line, because it is the assumption everything above rests on: at
 * CREDIT_VALUE_AED = 1 the platform's dirhams ARE the units, and if that rate
 * ever changes this is the single place the settlement has to change with it.
 */
export const cashForSpend = (aed: number): number => Math.round(aed / CREDIT_VALUE_AED)
