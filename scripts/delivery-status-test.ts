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
import { readdirSync, readFileSync, type Dirent } from 'node:fs'
import { join } from 'node:path'

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

console.log('\n── an ad set that reached its end date did what it was told ──')
{
  // Our ad sets carry the Trakheesi permit window as end_time. Without this
  // the permit stop — the thing we WANT to happen — lands in notDelivering,
  // which this file's own header calls the most alarming state in the list.
  const NOW = new Date('2026-09-01T08:00:00Z')
  const ended = deliveryOf({ effectiveStatus: 'ACTIVE', endTime: '2026-08-31T23:59:59+04:00', now: NOW })
  check('past its end date it reads as finished, not as a fault',
    ended.state === 'finished', JSON.stringify(ended))
  check('…and it is not painted as a problem', ended.tone === 'idle')
  check('…and it is not counted as still spending', !isSpending('finished'))

  const running = deliveryOf({ effectiveStatus: 'ACTIVE', endTime: '2026-12-31T23:59:59+04:00', impressions: 900, now: NOW })
  check('before its end date nothing changes', running.state === 'delivering', JSON.stringify(running))
  check('an ad set with no end date is unaffected',
    deliveryOf({ effectiveStatus: 'ACTIVE', impressions: 900, now: NOW }).state === 'delivering')
  check('an unparseable end date is ignored rather than treated as passed',
    deliveryOf({ effectiveStatus: 'ACTIVE', endTime: 'whenever', impressions: 900, now: NOW }).state === 'delivering')
  check('finished beats every other ACTIVE answer, including stuck-in-learning',
    deliveryOf({ effectiveStatus: 'ACTIVE', learningStage: 'FAIL', endTime: '2026-08-31T23:59:59+04:00', now: NOW }).state === 'finished')
  // A PAUSED ad set past its end is still paused — the switch a human threw
  // is the more useful fact.
  check('a paused ad set past its end still reads as paused',
    deliveryOf({ effectiveStatus: 'PAUSED', endTime: '2026-08-31T23:59:59+04:00', now: NOW }).state === 'paused')
}

console.log('\n── which of these are spending money ──')
{
  check('delivering, learning and stuck-in-learning are all spending',
    isSpending('delivering') && isSpending('learning') && isSpending('learningLimited'))
  check('…and nothing else is',
    !isSpending('paused') && !isSpending('inReview') && !isSpending('notDelivering') &&
    !isSpending('rejected') && !isSpending('archived'))
}

console.log('\n── one status vocabulary across the ads surfaces ──')
{
  // FOUR SCREENS INVENTED THEIR OWN. The campaigns list, the Meta table, the
  // attribution list and the campaign-group arms each rendered a badge from
  // `status === 'ACTIVE'` — the switch somebody flipped — so a campaign in
  // review, one whose ad was rejected, one past its schedule and one Meta was
  // refusing to deliver all read "Active", and everything else read "Paused".
  //
  // deliveryOf is the one reading. This scan is for the fifth copy: a badge
  // built from a status ternary in a file that never asks deliveryOf what is
  // actually happening.
  const ADS_TREES = [
    'app/freehold-intelligence/ads-live',
    'app/freehold-intelligence/lead-machine/campaigns',
    'components/freehold/lead-machine',
  ]
  const files: string[] = []
  const walk = (d: string) => {
    let entries: Dirent[] = []
    try { entries = readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const full = join(d, e.name)
      if (e.isDirectory()) walk(full)
      else if (/\.tsx?$/.test(e.name)) files.push(full)
    }
  }
  for (const tree of ADS_TREES) walk(join(process.cwd(), tree))
  check('the ads screens were found at all — an empty scan passes vacuously', files.length > 5, String(files.length))

  const offenders: string[] = []
  for (const f of files) {
    const src = readFileSync(f, { encoding: 'utf8' })
    // The shape: a two-branch status test feeding a rendered label. Google's
    // own pages are excluded by the trees above — Google has no
    // effective_status and must not be made to fake one.
    const invents = /\?\s*t\('lm\.[a-zA-Z.]*status\.[a-z]+'\)/.test(src)
      || /status\.active'\)\s*:\s*t\(/.test(src)
    if (invents && !/deliveryOf/.test(src)) offenders.push(f.replace(process.cwd() + '/', ''))
  }
  check('no ads screen builds its own Active/Paused badge instead of asking deliveryOf',
    offenders.length === 0, offenders.join(', '))
}

if (failures > 0) {
  console.error(`\n${failures} delivery-status rule(s) broken.`)
  process.exit(1)
}
console.log('\nAn ad says what it is doing.\n')
