/**
 * A BROKER IS PAID FROM MONEY THAT ARRIVED — locked.
 *
 * The deal row knew what a broker had earned and nothing ever moved because of
 * it. Connecting the two is easy to do wrongly in ways that cost real money,
 * and every one of these rules exists because the obvious alternative is worse:
 *
 *   1. PRO RATA ON RECEIPTS, never on the invoice. Paying the full share on
 *      approval is the company lending money it has not been paid, out of a
 *      wallet that has to balance.
 *   2. A HIGH-WATER MARK. Instalments arrive out of order and get recorded
 *      twice; a delta pays twice on the double entry and never on the missed one.
 *   3. ROUNDED DOWN, and exact on the last instalment — so the company never
 *      covers a rounding error, and the broker is never left a dirham short.
 *   4. AN UNAPPROVED DEAL PAYS NOTHING, because there is no operation in this
 *      system for taking Cash back out of a wallet.
 *
 * Pure — no network, no clock. Runs in `pnpm guards`.
 */
import {
  PAYOUT_STATES, PAYABLE_STATUSES, earnedByNow, owedNow, payoutReference,
  type PayoutBasis,
} from '../lib/freehold/deal-payout'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** A deal worth AED 100,000 of agency commission, AED 40,000 of it the broker's. */
const deal = (o: Partial<PayoutBasis> = {}): PayoutBasis => ({
  status: 'approved',
  agencyCommissionAed: 100_000,
  commissionReceivedAed: 0,
  brokerCommissionAed: 40_000,
  paidOutAed: 0,
  ...o,
})

console.log('\n── paid from money that has actually arrived ──')
{
  // THE RULE. A developer paying AED 100,000 over five months must not mean the
  // company hands a broker AED 40,000 today out of somebody else's Cash.
  check('nothing received, nothing paid', owedNow(deal()).moveAed === 0)
  check('…and it says the money is awaited, not that there is none',
    owedNow(deal()).state === 'awaiting', owedNow(deal()).state)

  check('half received, half the share paid',
    owedNow(deal({ commissionReceivedAed: 50_000 })).moveAed === 20_000,
    String(owedNow(deal({ commissionReceivedAed: 50_000 })).moveAed))
  check('a quarter received, a quarter paid',
    owedNow(deal({ commissionReceivedAed: 25_000 })).moveAed === 10_000)
  check('all received, all paid',
    owedNow(deal({ commissionReceivedAed: 100_000 })).moveAed === 40_000)

  // …and the screen can say what is still coming.
  const half = owedNow(deal({ commissionReceivedAed: 50_000 }))
  check('what is still owed to them is reported', half.awaitingAed === 20_000, String(half.awaitingAed))
  check('…alongside their whole entitlement', half.entitledAed === 40_000)
  check('a part payment reads as partly paid',
    owedNow(deal({ commissionReceivedAed: 50_000, paidOutAed: 20_000 })).state === 'partly')
  check('a settled one reads as paid',
    owedNow(deal({ commissionReceivedAed: 100_000, paidOutAed: 40_000 })).state === 'paid')
}

console.log('\n── the mark is a total, so a repeat moves nothing ──')
{
  // Instalments get recorded twice by two people on the same afternoon.
  const first = owedNow(deal({ commissionReceivedAed: 50_000 }))
  check('the first payment moves the share', first.moveAed === 20_000)
  check('…and records the total reached', first.markAed === 20_000)

  const again = owedNow(deal({ commissionReceivedAed: 50_000, paidOutAed: 20_000 }))
  check('recording it twice pays nothing the second time', again.moveAed === 0)
  check('…and leaves the mark where it was', again.markAed === 20_000)

  // A MISSED RECORDING SELF-HEALS. Nothing has to notice it was missed.
  const caughtUp = owedNow(deal({ commissionReceivedAed: 100_000, paidOutAed: 20_000 }))
  check('a skipped instalment catches up on the next', caughtUp.moveAed === 20_000)
  check('…landing on the same total either way', caughtUp.markAed === 40_000)

  // AND THE KEY IS THE MARK, so a crash mid-payout is repaired by re-running.
  check('the reference is the deal and the total',
    payoutReference('d1', 40_000) === 'payout:deal:d1:40000')
  check('…the same every time for the same payout',
    payoutReference('d1', 40_000) === payoutReference('d1', 40_000))
  check('…and different for a later one',
    payoutReference('d1', 40_000) !== payoutReference('d1', 60_000))
}

console.log('\n── rounding never costs the company or the broker ──')
{
  // ROUNDED DOWN, so a share is never more than it should be.
  const odd = deal({ agencyCommissionAed: 3, commissionReceivedAed: 1, brokerCommissionAed: 1 })
  check('a third of one dirham pays nothing yet', earnedByNow(odd) === 0, String(earnedByNow(odd)))

  // …AND THE LAST INSTALMENT IS EXACT. Accumulating rounded steps would leave
  // the broker short of their own entitlement forever.
  const full = deal({ agencyCommissionAed: 3, commissionReceivedAed: 3, brokerCommissionAed: 1 })
  check('when it is all received they get all of it', earnedByNow(full) === 1)

  const awkward = deal({ agencyCommissionAed: 7, commissionReceivedAed: 7, brokerCommissionAed: 3 })
  check('…however awkward the ratio', earnedByNow(awkward) === 3, String(earnedByNow(awkward)))

  // Overpayment: a correction reduced what was received AFTER money went out.
  // There is no operation for taking Cash back, and inventing one to fix an
  // accounting correction would be the worst possible reason to have it.
  const corrected = owedNow(deal({ commissionReceivedAed: 10_000, paidOutAed: 40_000 }))
  check('a correction never claws money back', corrected.moveAed === 0)
  check('…and leaves the mark where the money actually went',
    corrected.markAed === 40_000, String(corrected.markAed))

  check('a deal with no broker share pays nothing',
    owedNow(deal({ brokerCommissionAed: 0, commissionReceivedAed: 100_000 })).moveAed === 0)
  check('a deal invoiced at nothing pays nothing rather than dividing by zero',
    owedNow(deal({ agencyCommissionAed: 0, commissionReceivedAed: 0 })).moveAed === 0)
  check('a negative received figure is treated as none',
    owedNow(deal({ commissionReceivedAed: -50_000 })).moveAed === 0)
}

console.log('\n── an unsettled deal pays nothing ──')
{
  // Money against a pending or rejected deal may be refunded or re-attributed.
  for (const status of ['pending_step1', 'pending_step2', 'rejected']) {
    const d = owedNow(deal({ status, commissionReceivedAed: 100_000 }))
    check(`a ${status} deal pays nothing`, d.moveAed === 0, String(d.moveAed))
    check(`…and says so rather than showing a balance`, d.state === 'notYet', d.state)
  }
  for (const status of PAYABLE_STATUSES) {
    check(`a ${status} deal does pay`,
      owedNow(deal({ status, commissionReceivedAed: 100_000 })).moveAed === 40_000)
  }
  check('approved and closed are the only two that pay',
    PAYABLE_STATUSES.length === 2, PAYABLE_STATUSES.join(','))
}

console.log('\n── the vocabulary is walkable and nothing in it is dead ──')
{
  check('the payout states are a walkable list',
    PAYOUT_STATES.length > 0 && new Set(PAYOUT_STATES).size === PAYOUT_STATES.length)

  const seen = new Set([
    owedNow(deal({ status: 'rejected' })).state,
    owedNow(deal()).state,
    owedNow(deal({ commissionReceivedAed: 50_000, paidOutAed: 20_000 })).state,
    owedNow(deal({ commissionReceivedAed: 100_000, paidOutAed: 40_000 })).state,
  ])
  const missing = PAYOUT_STATES.filter((s) => !seen.has(s))
  check('every payout state can happen', missing.length === 0, missing.join(', '))
}

if (failures > 0) {
  console.error(`\n${failures} payout rule(s) broken.`)
  process.exit(1)
}
console.log('\nWhat a broker earned and what is in their wallet are the same number.\n')
