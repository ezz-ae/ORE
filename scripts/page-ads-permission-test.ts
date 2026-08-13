/**
 * A LAUNCH IS REFUSED BEFORE IT BUILDS ANYTHING — locked.
 *
 * The error the operator kept getting, at the end of the wizard, every time:
 *
 *   "The connected Meta login can see this Page but does not have permission
 *    to run ads from it. — subcode 1487202"
 *
 * The fact was already in hand. `/me/accounts` returns a `tasks` array per
 * Page, and ADVERTISE is the exact grant 1487202 is about. Three places threw
 * it away:
 *
 *   · the launch route asked only whether the posted Page was IN the list, and
 *     never what the list said about it;
 *   · the CONFIGURED Page — the one a launch that names no Page runs from —
 *     was appended with canAdvertise hardcoded true;
 *   · a launch that posted no pageId skipped the check entirely.
 *
 * So Meta answered instead, after the campaign and its ad sets existed.
 *
 * This suite locks the rule (unknown never refuses, an empty tasks list does),
 * and scans the launch route to assert the refusal happens BEFORE
 * launchFullCampaign and gives the credits back.
 *
 * Pure — reads source, no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  pageAdsVerdict, blocksLaunch, pageAdsRefusal, ADS_TASKS, PAGE_ADS_VERDICTS,
} from '../lib/meta/page-ads'
import { readinessOf, READINESS_CHECKS, REACHABLE } from '../lib/freehold/launch-readiness'
import { SUBCODE_ADVICE } from '../lib/meta/error-advice'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const read = (p: string) => readFileSync(join(process.cwd(), p), { encoding: 'utf8' })

console.log('\n── what Meta actually said about this Page ──')
{
  check('ADVERTISE is permission to advertise',
    pageAdsVerdict(['ADVERTISE']) === 'can', pageAdsVerdict(['ADVERTISE']))
  // MANAGE is full control and CONTAINS advertise. Leaving it out would have
  // refused the owner of the Page, which is the worst possible false negative.
  check('MANAGE is full control, so it advertises too',
    pageAdsVerdict(['MANAGE']) === 'can', pageAdsVerdict(['MANAGE']))
  check('a real Page role list is read whole',
    pageAdsVerdict(['ANALYZE', 'ADVERTISE', 'MESSAGING']) === 'can')

  // THE CASE THAT SHIPPED: the login can see and analyse the Page and cannot
  // advertise from it. That is exactly what 1487202 means.
  check('see-but-not-advertise is a REFUSAL',
    pageAdsVerdict(['ANALYZE', 'MODERATE', 'CREATE_CONTENT']) === 'cannot',
    pageAdsVerdict(['ANALYZE', 'MODERATE', 'CREATE_CONTENT']))
  // An empty array is Meta answering "no tasks here" — an answer, not a gap.
  check('an empty task list is a refusal, not a gap', pageAdsVerdict([]) === 'cannot')

  // UNKNOWN IS NOT A NO. Meta omits `tasks` for some token scopes, and blocking
  // a launch on a field we never received would stop legitimate campaigns on
  // our own blind spot.
  for (const [label, input] of [
    ['field absent', undefined], ['null', null], ['a string', 'ADVERTISE'],
    ['an object', { tasks: ['ADVERTISE'] }], ['a mixed array', ['ADVERTISE', 7]],
  ] as Array<[string, unknown]>) {
    check(`${label} ⇒ unknown`, pageAdsVerdict(input) === 'unknown', pageAdsVerdict(input))
  }

  check('only a real refusal blocks a launch',
    blocksLaunch('cannot') && !blocksLaunch('unknown') && !blocksLaunch('can'))
  check('every verdict is reachable — none is dead code',
    PAGE_ADS_VERDICTS.every((v) =>
      [pageAdsVerdict(['ADVERTISE']), pageAdsVerdict([]), pageAdsVerdict(undefined)].includes(v)),
    PAGE_ADS_VERDICTS.join(','))
  check('both grants are named', ADS_TASKS.includes('ADVERTISE') && ADS_TASKS.includes('MANAGE'))
}

console.log('\n── the launcher says it before the work, not after ──')
{
  const base = {
    metaConnected: true, pageId: '123', projectSlug: null,
    hasCreative: false, hasCopy: false, dailyBudgetAed: null, hasAudience: false,
  }
  const stateOf = (d: Parameters<typeof readinessOf>[0]) =>
    readinessOf(d).find((r) => r.id === 'pageAds')?.state

  check('a Page that cannot advertise BLOCKS the launcher',
    stateOf({ ...base, pageAds: 'cannot' }) === 'blocked', String(stateOf({ ...base, pageAds: 'cannot' })))
  check('…and it names where to go and fix it',
    !!readinessOf({ ...base, pageAds: 'cannot' }).find((r) => r.id === 'pageAds')?.fix)
  check('a Page that can advertise is a tick',
    stateOf({ ...base, pageAds: 'can' }) === 'ok', String(stateOf({ ...base, pageAds: 'can' })))

  // A GREEN TICK FOR "WE COULD NOT CHECK" IS THE FALSE REASSURANCE THIS WHOLE
  // SUITE EXISTS TO PREVENT. Unknown reads as still-checking.
  check('unknown is pending, never a tick',
    stateOf({ ...base, pageAds: 'unknown' }) === 'pending', String(stateOf({ ...base, pageAds: 'unknown' })))
  check('not looked up yet is pending too',
    stateOf({ ...base, pageAds: undefined }) === 'pending')
  check('no Page chosen ⇒ pending, not a second red row about the same thing',
    stateOf({ ...base, pageId: null, pageAds: 'cannot' }) === 'pending')
  check('Meta not connected ⇒ pending',
    stateOf({ ...base, metaConnected: false, pageAds: 'cannot' }) === 'pending')

  // The strip's sentences are computed keys — a missing one prints a raw key
  // where the blocker should be.
  check('the check is registered for the i18n walk',
    READINESS_CHECKS.includes('pageAds') && REACHABLE.pageAds.includes('blocked'),
    REACHABLE.pageAds?.join(',') ?? 'absent')
}

console.log('\n── nothing is created, and no credits are held ──')
{
  const route = read('app/api/meta/launch/route.ts')

  const checkAt = route.indexOf('checkPageAds(')
  const buildAt = route.indexOf('launchFullCampaign({')
  check('the launch route asks Meta about the Page', checkAt > 0, String(checkAt))
  // THE WHOLE POINT. Asking after the build is what Meta already does for free.
  check('…and asks BEFORE it builds the campaign',
    checkAt > 0 && buildAt > checkAt, `check=${checkAt} build=${buildAt}`)

  const refusal = route.slice(checkAt, buildAt)
  check('a refusal returns the reserved credits',
    /releaseReservation\(\)/.test(refusal), refusal.slice(0, 200))
  check('…and says which fault it was, so the screen can match it',
    /1487202/.test(refusal), refusal.slice(0, 200))

  // A launch that names no Page runs from the CONFIGURED one, and that is the
  // Page that was never checked. checkPageAds() falls back to it by design.
  check('the check covers a launch that names no Page',
    /checkPageAds\(launchPageId\)/.test(route), 'checkPageAds is called with a required id')

  const client = read('lib/meta/client.ts')
  const listing = client.slice(client.indexOf('export async function listAccessiblePages'),
    client.indexOf('export async function checkPageAds'))
  check('the configured Page is no longer asserted able to advertise',
    !/canAdvertise: true, adsVerdict: 'can'/.test(listing)
    && (listing.match(/adsVerdict: 'unknown'/g) ?? []).length >= 2,
    listing.match(/adsVerdict: '[a-z]+'/g)?.join(' ') ?? 'none')

  // The refusal, the strip and Meta's own subcode text must agree on the fix,
  // or the operator gets three different instructions for one problem.
  const advice = SUBCODE_ADVICE[1487202]
  for (const [what, text] of [['the launch refusal', pageAdsRefusal('Azizi')], ['the subcode advice', advice]] as const) {
    check(`${what} sends them to Business Suite`, /Business Suite/i.test(text), text.slice(0, 80))
    check(`${what} offers the other way out — a different Page`, /different Page|another Page/i.test(text), text.slice(0, 80))
  }
  check('the refusal names the Page when Meta gave us its name',
    pageAdsRefusal('Azizi Properties').includes('Azizi Properties'))
  check('…and reads normally when it did not',
    pageAdsRefusal(null).includes('this Page') && !pageAdsRefusal(null).includes('“'))
  // A refusal that silently kept the money would be a second failure on top of
  // the first, and the operator would have no way to know.
  check('the refusal says nothing was spent',
    /no credits were spent/i.test(pageAdsRefusal(null)), pageAdsRefusal(null))
}

if (failures > 0) {
  console.error(`\n${failures} page-permission rule(s) broken.`)
  process.exit(1)
}
console.log('\nA Page that cannot run ads is refused before anything is built.\n')
