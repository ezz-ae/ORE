/**
 * What the ad is actually doing — locked.
 *
 * The system showed two words, Active and Paused. "Active" was true for an ad
 * waiting on review, an ad Meta had given up learning, an ad delivering
 * perfectly, and an ad reaching nobody at all. Two of those need action today
 * and two need none, and the screen could not tell them apart.
 *
 * The two that matter most, and that "Active" hid completely:
 *   · STUCK IN LEARNING — Meta stopped trying to learn at this volume. It
 *     keeps spending and keeps paying the beginner's price.
 *   · NOT DELIVERING — approved, switched on, shown to nobody.
 *
 * The discipline: nothing is inferred from a status alone. An unknown
 * impression count is not evidence of zero impressions, and an ad that is
 * merely ACTIVE is reported as exactly that rather than promoted to
 * "delivering" on an assumption.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { deliveryOf, isSpending, LEARNING_TARGET } from '../lib/meta/delivery-status'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the states that need someone today ──')
{
  check('waiting on Meta’s review is not "active"',
    deliveryOf({ effectiveStatus: 'PENDING_REVIEW' }).state === 'inReview')
  check('a rejected ad says so', deliveryOf({ effectiveStatus: 'DISAPPROVED' }).state === 'rejected')
  check('a billing hold is a payment problem, not an ad problem',
    deliveryOf({ effectiveStatus: 'PENDING_BILLING_INFO' }).state === 'billing')
  check('an ad Meta flagged says it has an issue',
    deliveryOf({ effectiveStatus: 'WITH_ISSUES' }).state === 'issue')
}

console.log('\n── the two "Active" hid ──')
{
  const stuck = deliveryOf({ effectiveStatus: 'ACTIVE', learningStage: 'FAIL', impressions: 9000 })
  check('an ad Meta gave up learning is called stuck, not active',
    stuck.state === 'learningLimited', JSON.stringify(stuck))
  check('…and it reads as a problem', stuck.tone === 'bad')

  const dead = deliveryOf({ effectiveStatus: 'ACTIVE', impressions: 0 })
  check('approved, switched on, and reaching nobody is NOT delivering',
    dead.state === 'notDelivering', JSON.stringify(dead))
  check('…and it reads as a problem', dead.tone === 'bad')
}

console.log('\n── learning says how far along it is ──')
{
  const learning = deliveryOf({ effectiveStatus: 'ACTIVE', learningStage: 'LEARNING', results: 12 })
  check('learning is its own state', learning.state === 'learning')
  check(`…with the count out of ${LEARNING_TARGET}`,
    learning.progress?.have === 12 && learning.progress?.need === LEARNING_TARGET,
    JSON.stringify(learning.progress))
  check('…and it reads as work in progress, not a fault', learning.tone === 'working')
  check('no result count means no invented progress number',
    deliveryOf({ effectiveStatus: 'ACTIVE', learningStage: 'LEARNING' }).progress === undefined)
  check('learning finished is simply delivering',
    deliveryOf({ effectiveStatus: 'ACTIVE', learningStage: 'SUCCESS', impressions: 500 }).state === 'delivering')
}

console.log('\n── the switch that stopped it may be one level up ──')
{
  check('paused by its ad set says so',
    deliveryOf({ effectiveStatus: 'ADSET_PAUSED' }).state === 'pausedByAdSet')
  check('paused by its campaign says so',
    deliveryOf({ effectiveStatus: 'CAMPAIGN_PAUSED' }).state === 'pausedByCampaign')
  check('paused on its own is plain paused',
    deliveryOf({ effectiveStatus: 'PAUSED' }).state === 'paused')
  check('archived is not confused with paused',
    deliveryOf({ effectiveStatus: 'ARCHIVED' }).state === 'archived')
}

console.log('\n── nothing is inferred from a status alone ──')
{
  check('ACTIVE with no numbers is not promoted to "delivering"',
    deliveryOf({ effectiveStatus: 'ACTIVE' }).state === 'unknown',
    JSON.stringify(deliveryOf({ effectiveStatus: 'ACTIVE' })))
  check('…an unknown impression count is not evidence of zero',
    deliveryOf({ effectiveStatus: 'ACTIVE', impressions: null }).state !== 'notDelivering')
  check('what Meta will DO beats what was asked for',
    deliveryOf({ status: 'ACTIVE', effectiveStatus: 'CAMPAIGN_PAUSED' }).state === 'pausedByCampaign')
  check('…and the asked-for status is used when there is no effective one',
    deliveryOf({ status: 'PAUSED' }).state === 'paused')
  check('a status Meta invents tomorrow is "unknown", never a guess',
    deliveryOf({ effectiveStatus: 'SOMETHING_NEW' }).state === 'unknown')
  check('no status at all is unknown', deliveryOf({}).state === 'unknown')
}

console.log('\n── which of these are spending money ──')
{
  check('delivering, learning and stuck-in-learning are all spending',
    isSpending('delivering') && isSpending('learning') && isSpending('learningLimited'))
  check('…and nothing else is',
    !isSpending('paused') && !isSpending('inReview') && !isSpending('notDelivering') &&
    !isSpending('rejected') && !isSpending('archived'))
}

if (failures > 0) {
  console.error(`\n${failures} delivery-status rule(s) broken.`)
  process.exit(1)
}
console.log('\nAn ad says what it is doing.\n')
