/**
 * The overlap estimator, locked.
 *
 * This panel is read by the CLIENT. A red "100% — may be competing" row is a
 * serious claim: it says two ad sets are bidding against each other and
 * wasting the budget. It has to be true when shown.
 *
 * It was not. The estimate read geo, age, gender and interests and ignored
 * PLACEMENT — so the four ad sets this product deliberately splits across
 * Instagram Feed, Instagram Stories, Reels and Facebook Feed (same audience,
 * different inventory, on purpose) were all scored 100% and flagged red. Our
 * own panel raising an alarm about our own correct structure, in front of the
 * customer.
 *
 * Competing means being able to win the SAME impression. Different surface,
 * no contention, no warning.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { computeOverlaps, type AdSetLite } from '../lib/meta/audience-overlap'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** The identical audience every time — geo, age and interests never differ. */
const audience = {
  geo_locations: { countries: ['AE'] },
  age_min: 30,
  age_max: 65,
  interests: [{ id: '1', name: 'Property' }, { id: '2', name: 'Investment' }],
}
const at = (name: string, placement: Record<string, unknown>): AdSetLite => ({
  id: name, name, targeting: { ...audience, ...placement },
})

const IG_FEED   = at('Instagram Feed',   { publisher_platforms: ['instagram'], instagram_positions: ['stream'] })
const IG_STORY  = at('Instagram Story',  { publisher_platforms: ['instagram'], instagram_positions: ['story'] })
const REELS     = at('Reels',            { publisher_platforms: ['facebook', 'instagram'], facebook_positions: ['facebook_reels'], instagram_positions: ['reels'] })
const FB_FEED   = at('Facebook Feed',    { publisher_platforms: ['facebook'], facebook_positions: ['feed'] })

console.log('\n── a placement split is not a conflict ──')
{
  // Exactly the campaign shape this product builds. Before the fix this
  // produced six red 100% rows.
  const pairs = computeOverlaps([IG_FEED, IG_STORY, REELS, FB_FEED])
  check('the four-placement split raises no overlap warning at all',
    pairs.length === 0,
    pairs.map((p) => `${p.aName} ↔ ${p.bName} ${p.score}%`).join(' | '))

  check('two ad sets on the same surface DO still warn',
    computeOverlaps([IG_FEED, at('Instagram Feed copy', { publisher_platforms: ['instagram'], instagram_positions: ['stream'] })]).length === 1)

  // Reels runs on both platforms; Facebook Feed is facebook-only. Different
  // positions on the same platform still never contend.
  check('same platform, different position, still no warning',
    computeOverlaps([REELS, FB_FEED]).length === 0)

  check('overlapping position lists warn',
    computeOverlaps([
      at('A', { publisher_platforms: ['instagram'], instagram_positions: ['stream', 'story'] }),
      at('B', { publisher_platforms: ['instagram'], instagram_positions: ['story'] }),
    ]).length === 1)
}

console.log('\n── an unknown placement is a wildcard, never a silent all-clear ──')
{
  // An ad set with no placement fields could be running anywhere. Staying
  // quiet about it would hide a real conflict, which is the opposite failure
  // to the one this suite exists for.
  const anywhere = at('Legacy', {})
  check('an ad set with no placement info is treated as everywhere',
    computeOverlaps([anywhere, IG_FEED]).length === 1)
  check('…and so is a platform with no position list',
    computeOverlaps([
      at('All of Instagram', { publisher_platforms: ['instagram'] }),
      IG_STORY,
    ]).length === 1)
}

console.log('\n── a real conflict is still reported in full ──')
{
  const pairs = computeOverlaps([
    at('Broad A', { publisher_platforms: ['instagram'], instagram_positions: ['stream'] }),
    at('Broad B', { publisher_platforms: ['instagram'], instagram_positions: ['stream'] }),
  ])
  check('the pair is scored', pairs.length === 1 && pairs[0].score >= 40, JSON.stringify(pairs))
  check('…and names the shared countries', pairs[0]?.countries.includes('AE'))
  check('…and names the shared interests', (pairs[0]?.interests ?? []).includes('Property'))
}

if (failures > 0) {
  console.error(`\n${failures} overlap rule(s) broken.`)
  process.exit(1)
}
console.log('\nOverlap warnings only fire where a conflict can actually happen.\n')
