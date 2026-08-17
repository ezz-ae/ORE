/**
 * ATTACHING A WALLET TO A CAMPAIGN THAT HAS ALREADY BEEN SPENDING.
 *
 * The launch route writes meta_campaign_brokers at attribution time, so a
 * campaign built through this product is billed from its first dirham. A
 * campaign built by hand in Ads Manager has no such row, and the settlement
 * job walks past it forever: never billed, never paused, invisible in every
 * figure the finance screen shows. On the live account that is 8 campaigns and
 * AED 39,332 — which is to say all of the spend, none of it billed.
 *
 * This module attaches one after the fact.
 *
 * ── THE DECISION THAT MATTERS: WHERE BILLING STARTS ──────────────────────
 *
 * Settlement is a HIGH-WATER MARK. It asks "what should have been billed by
 * now?" and moves the difference. A freshly attributed campaign has no mark,
 * so the difference is the campaign's ENTIRE HISTORY — and the first run after
 * attaching would try to take AED 8,000 out of a broker's wallet in one
 * movement, fail for want of balance, and pause a working campaign.
 *
 * The broker never agreed to that. They were not asked when the money was
 * spent and they cannot be billed for it now on the strength of a dropdown.
 * So the default is to seed the mark AT THE CURRENT SPEND: billing starts from
 * this moment forward, and everything before it is recorded as history that
 * was never charged rather than quietly forgiven or quietly collected.
 *
 * Charging the history is available, because sometimes it is genuinely what
 * happened — a broker's campaign that everyone always intended to bill. But it
 * is an explicit choice with the amount named, never a default, and it goes on
 * the record with whoever chose it.
 *
 * Pure. The database work is in campaign-attribution-db.ts, and the rules are
 * asserted in scripts/campaign-attribution-test.ts.
 */
import type { Role } from './session-types'
import { MANAGEMENT_ROLES } from './session-types'

/** How much of a campaign's past is charged when a wallet is attached. */
export const BILLING_STARTS = [
  /** Seed the mark at today's spend. Nothing historic is taken. The default. */
  'now',
  /** Seed at zero, so the whole history bills on the next run. Explicit only. */
  'beginning',
] as const
export type BillingStart = (typeof BILLING_STARTS)[number]

export const ATTRIBUTION_REFUSALS = [
  'insufficient_role',   // assigning who pays is a management act
  'no_such_campaign',    // not on the ad account we can see
  'no_such_broker',      // nobody to bill
  'already_attributed',  // it has an owner; moving it is a different decision
  'spend_unknown',       // could not read what it has spent — never seed blind
] as const
export type AttributionRefusal = (typeof ATTRIBUTION_REFUSALS)[number]

export interface AttributionVerdict {
  allowed: boolean
  refusal?: AttributionRefusal
}

/**
 * Attaching a wallet decides who pays for delivered advertising, so it sits
 * with management. A broker cannot volunteer their own wallet for a campaign
 * and cannot be volunteered by a peer.
 */
export const mayAttribute = (role: Role): boolean =>
  (MANAGEMENT_ROLES as readonly Role[]).includes(role)

export interface AttributionFacts {
  campaignExists: boolean
  brokerExists: boolean
  currentOwnerId: string | null
  /** null when Meta could not be read — never treated as zero. */
  spendAed: number | null
}

/**
 * Can this campaign be attached to this broker?
 *
 * `spendAed === null` refuses. Seeding a mark from a spend we could not read
 * would write zero, and zero means "bill the whole history" — so a failed read
 * would silently become the most expensive possible choice. The same reasoning
 * as every other unknown in this system: absence is not a value.
 */
export function mayAttach(role: Role, f: AttributionFacts): AttributionVerdict {
  if (!mayAttribute(role)) return { allowed: false, refusal: 'insufficient_role' }
  if (!f.campaignExists) return { allowed: false, refusal: 'no_such_campaign' }
  if (!f.brokerExists) return { allowed: false, refusal: 'no_such_broker' }
  // Moving a campaign from one payer to another is a different act with a
  // different question attached — what happens to what the first one paid —
  // and it is not this one.
  if (f.currentOwnerId) return { allowed: false, refusal: 'already_attributed' }
  if (f.spendAed === null) return { allowed: false, refusal: 'spend_unknown' }
  return { allowed: true }
}

/**
 * The high-water mark to seed, in whole AED.
 *
 * `now` seeds at the spend so far, so the next settlement run finds nothing
 * owed and starts billing from the next delivered dirham. `beginning` seeds at
 * zero, so the next run bills everything the campaign has ever spent.
 *
 * Rounded DOWN on `now`, deliberately. Rounding up would seed a mark above the
 * real spend and silently forgive the difference; rounding down bills at most
 * one extra dirham, which is the harmless direction to be wrong in.
 */
export function seedMark(start: BillingStart, spendAed: number): number {
  if (start === 'beginning') return 0
  return Math.max(0, Math.floor(spendAed))
}

/**
 * What attaching will cost the broker on the next settlement run.
 *
 * Shown before the button is pressed, because "this will immediately take AED
 * 8,000 from Ahmed's wallet" is the single fact a person needs to see and the
 * one they will never work out from a dropdown labelled "from the beginning".
 */
export function immediateCharge(start: BillingStart, spendAed: number): number {
  return start === 'beginning' ? Math.max(0, Math.floor(spendAed)) : 0
}
