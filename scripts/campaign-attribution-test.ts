/**
 * ATTACHING A WALLET MUST NOT SILENTLY BILL SOMEBODY FOR LAST MONTH — locked.
 *
 * The settlement job bills a campaign only when meta_campaign_brokers carries
 * it, and that row is written by our launch route. On the live account 8 of 9
 * campaigns were built by hand in Ads Manager: AED 39,332 delivered, nothing
 * billed, no balance touched, and the funding brake unable to engage on any of
 * them. Retroactive attribution closes that without relaunching anything.
 *
 * ── AND IT IS ONE DECISION AWAY FROM BEING WORSE THAN THE PROBLEM ────────
 *
 * Settlement is a HIGH-WATER MARK: it asks what should have been billed by now
 * and moves the difference. A newly attributed campaign has no mark, so the
 * difference is its ENTIRE HISTORY — and the first run after attaching would
 * try to take AED 8,000 from a broker's wallet in one movement, fail for want
 * of balance, and pause a working campaign.
 *
 * The broker was never asked. They cannot be billed for spend that happened
 * before anyone decided they were paying for it, on the strength of a
 * dropdown. So the mark is seeded AT TODAY'S SPEND by default, and charging
 * the history is an explicit choice with its amount named.
 *
 * Pure — no database, no network. Runs in `pnpm guards`.
 */
import {
  BILLING_STARTS, ATTRIBUTION_REFUSALS,
  mayAttribute, mayAttach, seedMark, immediateCharge,
  type AttributionFacts,
} from '../lib/freehold/campaign-attribution'
import type { Role } from '../lib/freehold/session-types'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const clean: AttributionFacts = {
  campaignExists: true, brokerExists: true, currentOwnerId: null, spendAed: 8000,
}
const facts = (p: Partial<AttributionFacts>): AttributionFacts => ({ ...clean, ...p })

console.log('\n── nobody is billed for spend that happened before they were the payer ──')
{
  // THE RULE THIS FILE EXISTS FOR. Seeding at today's spend means the next
  // settlement finds nothing owed and starts from the next delivered dirham.
  check('the default seeds the mark at what has already been spent',
    seedMark('now', 8000) === 8000, String(seedMark('now', 8000)))
  check('…so nothing is taken from the wallet on the next run',
    immediateCharge('now', 8000) === 0, String(immediateCharge('now', 8000)))

  // The other option is real and sometimes right — but it is a choice, and the
  // amount is named so it cannot be picked by accident.
  check('charging the history seeds at zero', seedMark('beginning', 8000) === 0)
  check('…and says exactly what it will take',
    immediateCharge('beginning', 8000) === 8000, String(immediateCharge('beginning', 8000)))

  // ROUNDED DOWN on the default. Rounding UP would seed a mark above the real
  // spend and silently forgive the difference; down bills at most one extra
  // dirham, which is the harmless direction to be wrong in.
  check('the seeded mark rounds down, never up',
    seedMark('now', 8000.9) === 8000, String(seedMark('now', 8000.9)))
  check('…and never goes negative on a nonsense figure', seedMark('now', -5) === 0)
}

console.log('\n── a spend we could not read is never treated as zero ──')
{
  // Zero is not a neutral value here: zero MEANS "bill the whole history". So
  // a failed read would silently become the most expensive possible choice —
  // the same class of fault as an absent targeting_automation reading as off.
  const v = mayAttach('ceo', facts({ spendAed: null }))
  check('an unreadable spend refuses the attach',
    !v.allowed && v.refusal === 'spend_unknown', JSON.stringify(v))
  check('…and a real zero is fine, because it is an answer',
    mayAttach('ceo', facts({ spendAed: 0 })).allowed)
}

console.log('\n── deciding who pays is a management act ──')
{
  check('management may attribute', mayAttribute('ceo') && mayAttribute('director'))
  check('a broker may not volunteer their own wallet', !mayAttribute('broker'))
  check('…nor may marketing, which can spend but not assign the bill',
    !mayAttribute('marketing'))
  const v = mayAttach('broker', clean)
  check('the refusal names the role', !v.allowed && v.refusal === 'insufficient_role')
}

console.log('\n── what cannot be attached ──')
{
  check('a campaign that is not there', !mayAttach('ceo', facts({ campaignExists: false })).allowed)
  check('a broker that is not there', !mayAttach('ceo', facts({ brokerExists: false })).allowed)

  // MOVING a campaign from one payer to another is a different act with a
  // different question attached — what happens to what the first one paid —
  // so it is refused here rather than handled badly.
  const owned = mayAttach('ceo', facts({ currentOwnerId: 'someone@else.com' }))
  check('a campaign that already has a payer is refused, not silently moved',
    !owned.allowed && owned.refusal === 'already_attributed', JSON.stringify(owned))

  check('an unowned campaign with a real broker and a readable spend attaches',
    mayAttach('ceo', clean).allowed, JSON.stringify(mayAttach('ceo', clean)))
}

console.log('\n── the vocabulary is walkable ──')
{
  check('there are exactly two places billing can start',
    BILLING_STARTS.length === 2 && BILLING_STARTS[0] === 'now',
    BILLING_STARTS.join(','))
  check('…and the safe one is first, so a default that reads index 0 is safe',
    BILLING_STARTS[0] === 'now')
  check('every refusal is distinct',
    new Set(ATTRIBUTION_REFUSALS).size === ATTRIBUTION_REFUSALS.length)

  // Every role must get a defined verdict; a role falling through to undefined
  // is an accidental permission.
  const ROLES: Role[] = ['broker', 'admin', 'sales_manager', 'director', 'ceo', 'marketing', 'team_leader']
  for (const r of ROLES) {
    const v = mayAttach(r, clean)
    check(`\`${r}\` gets a verdict with a reason when refused`,
      typeof v.allowed === 'boolean' && (v.allowed || !!v.refusal), JSON.stringify(v))
  }
}

if (failures > 0) {
  console.error(`\n${failures} attribution rule(s) broken.`)
  console.error('Billing a broker for last month because somebody attached a wallet today is worse than not billing at all.')
  process.exit(1)
}
console.log('\nAttaching a wallet starts the billing, and never backdates it by accident.\n')
