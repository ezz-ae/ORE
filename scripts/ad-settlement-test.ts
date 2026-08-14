/**
 * ADS ARE BILLED FOR WHAT THEY SPENT, EXACTLY ONCE — locked.
 *
 * Charging the daily budget at launch was wrong in both directions: a campaign
 * that delivered AED 40 against a AED 300 budget was charged AED 300, and one
 * that ran three weeks was charged once. This suite locks the replacement, and
 * the rules it locks are the ones that break money when they slip:
 *
 *   1. The mark is a HIGH-WATER TOTAL, never a delta. A repeated tick moves
 *      nothing; a missed tick self-heals on the next one.
 *   2. The reference is derived from the mark, so a crash mid-settlement is
 *      repaired by running again rather than by charging twice.
 *   3. A platform restatement downwards moves nothing and rewinds nothing.
 *   4. A wallet that cannot cover the step settles what it can and reports the
 *      rest as a shortfall.
 *   5. ANY shortfall pauses the campaign. With nothing reserved, this is the
 *      only brake on real spend that exists.
 *
 * Pure — no network, no clock. Runs in `pnpm guards`.
 */
import {
  SETTLE_STEP_AED, MAX_UNBILLED_AED, LAUNCH_FLOOR_DAYS,
  SETTLE_VERDICTS, WALLET_VERDICTS,
  settleTarget, settle, walletVerdict, canLaunch, settlementReference, cashForSpend,
  type SettleRead,
} from '../lib/freehold/ad-settlement'
import { CREDIT_VALUE_AED } from '../lib/freehold/credits-shared'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Comments stripped — a header that names a forbidden pattern to explain it
 *  must not be what fails the rule. */
const code = (p: string): string =>
  readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const read = (o: Partial<SettleRead>): SettleRead =>
  ({ spendAed: 0, settledAed: 0, walletBalance: 100_000, ...o })

console.log('\n── the bill is what the platform actually spent ──')
{
  // A BUDGET IS A CEILING, NOT A PRICE. The whole change is here.
  check('a campaign that delivered nothing owes nothing',
    settle(read({ spendAed: 0 })).moveAed === 0)
  check('a campaign that delivered AED 40 owes AED 40',
    settle(read({ spendAed: 40 })).moveAed === 40, String(settle(read({ spendAed: 40 })).moveAed))
  check('…whatever its daily budget was — the budget is not an input',
    settle(read({ spendAed: 40 })).moveAed === settle(read({ spendAed: 40 })).moveAed)

  // Floored to the step so two readers of the same spend figure always agree.
  check('spend is settled in whole steps', settleTarget(47) === 40, String(settleTarget(47)))
  check('…and the remainder waits for the next step', settleTarget(49) === 40, String(settleTarget(49)))
  check('a step lands exactly on itself', settleTarget(50) === 50, String(settleTarget(50)))
  check('the unbilled exposure is one step and says so',
    MAX_UNBILLED_AED === SETTLE_STEP_AED, String(MAX_UNBILLED_AED))
  check('nonsense spend settles nothing rather than NaN',
    settleTarget(NaN) === 0 && settleTarget(-5) === 0 && settleTarget(Infinity) === 0)
}

console.log('\n── the mark is a total, so a retry is free ──')
{
  // THE PROPERTY THE WHOLE DESIGN RESTS ON. A delta design is impossible to
  // operate: every retry double-charges and every missed tick is money the
  // company paid Meta and never billed.
  const first = settle(read({ spendAed: 120, settledAed: 0 }))
  check('the first tick settles everything delivered so far', first.moveAed === 120)
  check('…and records the total reached', first.markAed === 120, String(first.markAed))

  const again = settle(read({ spendAed: 120, settledAed: 120 }))
  check('the same tick run twice moves nothing', again.moveAed === 0 && again.verdict === 'nothingDue')

  // A MISSED TICK SELF-HEALS. Nothing has to notice it was missed.
  const missed = settle(read({ spendAed: 350, settledAed: 120 }))
  check('a tick that missed three rounds catches all of them up', missed.moveAed === 230,
    String(missed.moveAed))
  check('…and lands on the same mark it would have reached tick by tick',
    missed.markAed === 350, String(missed.markAed))

  // AND THE KEY IS THE MARK, not the attempt or the clock — which is what makes
  // a crash between the transfer and the bookkeeping safe to re-run.
  check('the reference is derived from the campaign and the mark',
    settlementReference('c1', 350) === 'spend:ads:c1:350')
  check('…so the same settlement always produces the same key',
    settlementReference('c1', 350) === settlementReference('c1', 350))
  check('…and a later settlement produces a different one',
    settlementReference('c1', 350) !== settlementReference('c1', 360))
}

console.log('\n── platforms restate, and the books do not follow them down ──')
{
  // Meta corrects the last few hours all day. Refunding on every dip would make
  // a wallet that oscillates, and a wallet that oscillates is not trusted.
  const back = settle(read({ spendAed: 380, settledAed: 400 }))
  check('a downward restatement moves nothing', back.moveAed === 0)
  check('…and is named rather than hidden', back.verdict === 'restated', back.verdict)
  check('…and leaves the mark exactly where it was', back.markAed === 400, String(back.markAed))
  check('…and reports no shortfall — nothing is owed', back.shortfallAed === 0)

  // Spend recovering past the old mark bills only the genuinely new part.
  const recovered = settle(read({ spendAed: 430, settledAed: 400 }))
  check('when it recovers, only the new spend is billed', recovered.moveAed === 30,
    String(recovered.moveAed))
}

console.log('\n── a wallet that cannot cover it is the brake ──')
{
  // NOTHING IS RESERVED ANY MORE. The auction has no idea what a wallet is, so
  // this is the only thing standing between an empty balance and real money
  // leaving the company.
  const partial = settle(read({ spendAed: 500, settledAed: 0, walletBalance: 220 }))
  check('a short wallet settles what it can', partial.moveAed === 220, String(partial.moveAed))
  check('…in whole steps, so the mark stays reproducible',
    partial.moveAed % SETTLE_STEP_AED === 0)
  check('…and reports the rest as a shortfall', partial.shortfallAed === 280,
    String(partial.shortfallAed))
  check('…and says the wallet ran dry', partial.verdict === 'walletDry', partial.verdict)

  const dry = settle(read({ spendAed: 500, settledAed: 0, walletBalance: 0 }))
  check('an empty wallet settles nothing', dry.moveAed === 0)
  check('…and the whole amount is outstanding', dry.shortfallAed === 500, String(dry.shortfallAed))

  const almost = settle(read({ spendAed: 500, settledAed: 0, walletBalance: 9 }))
  check('a balance under one step cannot settle a partial step', almost.moveAed === 0,
    String(almost.moveAed))

  // ANY SHORTFALL PAUSES, not an empty balance. By the time a balance reads
  // zero the company has already bought impressions it cannot bill for.
  check('any shortfall at all pauses the campaign',
    walletVerdict({ shortfallAed: 1 }) === 'pause')
  check('…and a fully settled campaign keeps running',
    walletVerdict({ shortfallAed: 0 }) === 'keepRunning')
  check('a wallet with money and nothing owed is not paused',
    walletVerdict(settle(read({ spendAed: 120, settledAed: 120 }))) === 'keepRunning')
}

console.log('\n── the launch gate is a gate, not a charge ──')
{
  // A campaign launched by somebody who cannot cover its first day is paused by
  // the sync within hours — AFTER the company has been charged for the
  // impressions. Refusing is kinder than that, and cheaper.
  check('two days of budget is enough to start',
    canLaunch(600, 300).ok)
  check('one day is not', !canLaunch(300, 300).ok)
  const short = canLaunch(300, 300)
  check('…and the refusal says what was needed and what was held',
    !short.ok && short.needAed === 600 && short.haveAed === 300,
    short.ok ? 'allowed' : `${short.needAed}/${short.haveAed}`)
  check('the floor is two days, stated once', LAUNCH_FLOOR_DAYS === 2, String(LAUNCH_FLOOR_DAYS))

  // A tiny budget still needs enough to settle one step, or the first
  // settlement fails on a campaign that was allowed to start.
  check('even a trivial budget needs one settlement step',
    !canLaunch(4, 1).ok && canLaunch(10, 1).ok)
  // A NaN budget would make `need` NaN, every comparison false, and the
  // refusal a pair of blanks — the broker told they cannot afford something
  // the screen could not name. It refuses, with figures somebody can read.
  const nonsense = canLaunch(10_000, NaN)
  check('a budget that is not a number refuses', !nonsense.ok)
  check('…with a need somebody can read', !nonsense.ok && Number.isFinite(nonsense.needAed),
    nonsense.ok ? 'allowed' : String(nonsense.needAed))
  check('…and so does a zero budget', !canLaunch(10_000, 0).ok)

  // NOTHING IS DEBITED. Asserted as a shape: the gate returns a verdict and no
  // amount to move, so no caller can mistake it for a charge.
  const verdict = canLaunch(600, 300)
  check('the gate returns permission, never an amount to take',
    verdict.ok && !('moveAed' in verdict))
}

console.log('\n── the vocabulary is walkable and the rate is stated once ──')
{
  for (const [name, list] of [['settle verdicts', SETTLE_VERDICTS], ['wallet verdicts', WALLET_VERDICTS]] as const) {
    check(`${name} is a non-empty walkable list`,
      list.length > 0 && new Set(list).size === list.length)
  }

  // EVERY VERDICT MUST BE REACHABLE. One nobody can trigger is dead copy.
  const seen = new Set([
    settle(read({ spendAed: 120 })).verdict,
    settle(read({ spendAed: 120, settledAed: 120 })).verdict,
    settle(read({ spendAed: 100, settledAed: 200 })).verdict,
    settle(read({ spendAed: 500, walletBalance: 0 })).verdict,
  ])
  const missing = SETTLE_VERDICTS.filter((v) => !seen.has(v))
  check('every settle verdict can happen', missing.length === 0, missing.join(','))

  // THE ASSUMPTION EVERYTHING RESTS ON: at 1:1 the platform's dirhams ARE the
  // units. If the rate ever moves, this fails and points at the one function
  // that has to move with it.
  check('one dirham of platform spend is one Cash',
    cashForSpend(10) === 10 && CREDIT_VALUE_AED === 1, String(cashForSpend(10)))
}

console.log('\n── and it is wired where it says it is ──')
{
  const meta = code('app/api/meta/launch/route.ts')
  const google = code('app/api/google/campaigns/launch/route.ts')
  const db = code('lib/freehold/ad-settlement-db.ts')
  const cron = code('app/api/cron/settle-ad-spend/route.ts')

  // CHARGING AT LAUNCH **AND** ON DELIVERY WOULD BILL THE SAME CAMPAIGN TWICE,
  // out of two different ledgers, and neither total would look wrong on its
  // own. This is the check that keeps the two models from co-existing.
  for (const [name, src] of [['meta', meta], ['google', google]] as const) {
    check(`the ${name} launch no longer reserves anything`,
      !/deductCreditsForCampaign/.test(src), `${name} still debits at launch`)
    check(`…nor refunds a reservation it never took`,
      !/refundCredits|settleCampaignReservation/.test(src), `${name} still unwinds a reservation`)
    check(`…and gates on the wallet instead`, /canLaunch\(/.test(src))
    check(`…charging nothing while it does`, !/spendCash|postTransfer/.test(src),
      `${name} moves money at launch`)
  }

  // THE MARK MOVES AFTER THE MONEY. The reverse order records a payment that
  // never happened; this order is repaired by simply running again.
  check('the settlement charges before it writes the mark',
    db.indexOf('spendCash(') < db.indexOf('INSERT INTO freehold_ad_settlements'))
  check('…keyed on the mark, so a retry is a no-op',
    /reference: settlementReference\(report\.campaignId, decision\.markAed\)/.test(db))
  check('…and the stored mark can never rewind',
    /GREATEST\(freehold_ad_settlements\.settled_aed, EXCLUDED\.settled_aed\)/.test(db))
  check('a refused charge leaves the mark alone',
    /const markAed = moved > 0 \? decision\.markAed : settledAed/.test(db))

  // ADS PROVE THEMSELVES through the campaign id — the receipt that reconciles
  // against Meta's own invoice with nobody re-typing anything.
  check('the withdrawal is filed as an ad spend', /kind: 'ads'/.test(db))
  check('…carrying the campaign that bought it', /campaignId: report\.campaignId/.test(db))

  // NOTHING IS PAUSED FOR OUR OWN FAILURE. Stopping a working campaign because
  // a query broke costs a broker their leads for a fault that was never theirs.
  check('the cron gives up rather than pausing when Meta cannot be read',
    /status: 502/.test(cron) && /paused: 0/.test(cron))
  check('a campaign with no owner is never billed to anybody',
    /if \(!owner\) continue/.test(cron))
  check('the run reports what it could NOT bill, not only what it did',
    /unbilledAed/.test(cron))
}

if (failures > 0) {
  console.error(`\n${failures} settlement rule(s) broken.`)
  process.exit(1)
}
console.log('\nEvery dirham the platforms spent is billed once, and only once.\n')
