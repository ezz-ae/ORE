/**
 * A CLOSED DEAL PAYS THE PERSON WHO CLOSED IT.
 *
 * The deal record already knew what a broker had earned — brokerCommissionAed
 * sat on the row and nothing ever moved because of it. Somebody worked out the
 * payroll from a spreadsheet, and the number the broker could see on the deal
 * screen had no relationship to the number in their wallet.
 *
 * This is the rule that connects them.
 *
 * ── A BROKER IS PAID FROM MONEY THAT HAS ACTUALLY ARRIVED ────────────────
 *
 * PRO RATA ON RECEIPTS, never on the invoice. A deal is approved with an agency
 * commission of AED 100,000 and the developer pays it in three instalments over
 * five months; paying the broker their full share on approval would be the
 * company lending them money it has not been paid, and doing it from a wallet
 * that has to balance means the shortfall lands on somebody else's Cash.
 *
 * So: the broker's share of what has come in. Half the commission received,
 * half the broker's entitlement paid. It tracks the real cash position at every
 * moment, and it needs no judgement call from anybody.
 *
 * ── AND IT IS A HIGH-WATER MARK, FOR THE SAME REASON THE ADS ARE ─────────
 *
 * `owedNow` is asked what the TOTAL payout should be by now, not what changed.
 * Instalments arrive out of order, get corrected, get recorded twice by two
 * people on the same afternoon. A delta design pays twice on the double entry
 * and never pays at all on the missed one; a total is self-healing and a repeat
 * moves nothing.
 *
 * ── A DEAL THAT IS NOT APPROVED PAYS NOTHING ─────────────────────────────
 *
 * Money received against a pending or rejected deal is money whose ownership is
 * not settled — it may be refunded, re-attributed, or the deal may never
 * complete. Paying it out early is a debt to chase across somebody's balance,
 * and this system has no operation for taking money back out of a wallet.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */

/** Walkable — where a broker's money stands on one deal. */
export const PAYOUT_STATES = ['notYet', 'awaiting', 'partly', 'paid'] as const
export type PayoutState = (typeof PAYOUT_STATES)[number]

/** The deal statuses that may pay. Anything else is unsettled — see the header. */
export const PAYABLE_STATUSES: readonly string[] = ['approved', 'closed']

/**
 * What the payout needs to know about a deal.
 *
 * Deliberately not the whole Deal: this module decides one thing, and a
 * function that could see the client's phone number is a function somebody will
 * one day use to decide something else.
 */
export interface PayoutBasis {
  status: string
  /** What the agency invoiced. The denominator, never the payout. */
  agencyCommissionAed: number
  /** What has actually been received against it. */
  commissionReceivedAed: number
  /** The broker's full entitlement if every dirham arrives. */
  brokerCommissionAed: number
  /** Already moved into their wallet for this deal. */
  paidOutAed: number
}

export interface Payout {
  state: PayoutState
  /** To move now. Zero unless something is genuinely owed. */
  moveAed: number
  /** The total paid out after this movement — the idempotency key. */
  markAed: number
  /** Their full entitlement, for a screen that wants to show progress. */
  entitledAed: number
  /** Entitlement not yet earned because the money has not arrived. */
  awaitingAed: number
}

/**
 * How much of the broker's share has been earned by receipts so far.
 *
 * Rounded DOWN. The ledger is whole Cash and rounding a share up would, across
 * enough instalments, pay out more than the entitlement — the company covering
 * a rounding error it never agreed to. The remainder is not lost: the final
 * instalment settles the whole entitlement exactly, because the last
 * calculation is against the full received amount rather than an accumulation
 * of rounded steps.
 */
export function earnedByNow(b: PayoutBasis): number {
  const invoiced = Math.max(0, b.agencyCommissionAed)
  const received = Math.max(0, b.commissionReceivedAed)
  const entitled = Math.max(0, Math.floor(b.brokerCommissionAed))
  if (entitled <= 0) return 0
  if (invoiced <= 0) return 0
  // Fully received — pay the whole entitlement rather than a share that
  // rounding could leave a dirham short of it.
  if (received >= invoiced) return entitled
  return Math.floor((entitled * received) / invoiced)
}

/**
 * What to pay right now.
 *
 * Never negative. An over-payment — a correction that reduced the received
 * figure after money had already gone out — is reported by leaving the mark
 * where it is, because there is no operation in this system for reaching into
 * a broker's wallet and taking Cash back, and inventing one to fix an
 * accounting correction would be the worst possible reason to have it.
 */
export function owedNow(b: PayoutBasis): Payout {
  const entitled = Math.max(0, Math.floor(b.brokerCommissionAed))
  const paid = Math.max(0, Math.floor(b.paidOutAed))

  if (!PAYABLE_STATUSES.includes(b.status)) {
    return { state: 'notYet', moveAed: 0, markAed: paid, entitledAed: entitled, awaitingAed: entitled - paid }
  }

  const earned = earnedByNow(b)
  const move = Math.max(0, earned - paid)
  const mark = paid + move
  const awaiting = Math.max(0, entitled - mark)

  const state: PayoutState =
    entitled <= 0 ? 'notYet'
    : mark >= entitled ? 'paid'
    : mark > 0 ? 'partly'
    : 'awaiting'

  return { state, moveAed: move, markAed: mark, entitledAed: entitled, awaitingAed: awaiting }
}

/**
 * The reference one payout is filed under, forever.
 *
 * Derived from the deal and the MARK REACHED — never from the attempt or the
 * clock — so a retry after a crash produces the same key and the ledger's
 * unique index refuses the duplicate. The same shape as the ad settlement,
 * because it is the same problem.
 */
export const payoutReference = (dealId: string, markAed: number): string =>
  `payout:deal:${dealId}:${markAed}`

/**
 * One commission payment, as the wallet reads it.
 *
 * `receivedAt` is what the wallet was missing: a broker could see that AED
 * 40,000 was outstanding and not when any of it was due, which is the only part
 * of it they can plan around.
 */
export interface CommissionPayment {
  dealId: string
  dealName: string
  amountAed: number
  /** When the agency actually received it. */
  receivedAt: string
  /** What went to this broker's wallet as a result. */
  payoutAed: number
  reference: string
}
