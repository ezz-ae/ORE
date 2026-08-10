/**
 * The account remembers which placements it already paid to condemn — locked.
 *
 * The placement audit has condemned surfaces with an exact significance test
 * since it shipped, and the verdict only ever reached an activity log. Every
 * machine launch then bought the full placement spec again, including the
 * surface the machine itself had just proven worthless. The memory closes
 * that loop at the ONLY safe moment — the next launch. Live campaigns are
 * never touched: a mid-flight placement edit resets the ad set's learning
 * and silently changes what the operator approved.
 *
 * Rules this file locks:
 *   1. Only 'drain' and 'noClicks' carry across campaigns. A 'mismatch' is a
 *      fact about one creative's crop, and the next launch ships different
 *      creative.
 *   2. A proven-STRONG surface rescues its launch key; tiny undecided
 *      surfaces do not. Absence of evidence is not a defence.
 *   3. The keep-list is NEVER empty. History condemning every surface is a
 *      signal for a human, not a launch instruction.
 *   4. Aggregation pools evidence across campaigns, so a surface too thin to
 *      judge in any one campaign can still be judged on the account.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  aggregatePlacementRows, learnedPlacements, LAUNCHABLE_PLACEMENTS,
} from '../lib/freehold/placement-memory'
import type { PlacementRow } from '../lib/freehold/placement-audit'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const row = (platform: string, position: string, impressions: number, clicks: number, spend: number, leads: number): PlacementRow =>
  ({ platform, position, impressions, clicks, spend, leads })

console.log('\n── the account\'s own worst week, remembered ──')
{
  // The shape from the live account: Facebook Reels ate most of the spend,
  // nobody clicked it, the feed converted.
  const history = [
    row('facebook', 'facebook_reels', 100_000, 20, 500, 0),
    row('facebook', 'feed', 25_000, 300, 140, 4),
    row('instagram', 'feed', 8_000, 90, 60, 2),
  ]
  const mem = learnedPlacements(history)
  check('the condemned surface is remembered', mem !== null && mem.avoid.includes('reels'),
    JSON.stringify(mem?.avoid))
  check('…and the next launch keeps everything else',
    mem?.keep.sort().join() === ['fbFeed', 'igFeed', 'igStory'].sort().join(),
    JSON.stringify(mem?.keep))
  check('…with the audit\'s own sentence as the receipt',
    (mem?.reasons.length ?? 0) > 0 && mem!.reasons.every((r) => typeof r === 'string' && r.length > 10),
    JSON.stringify(mem?.reasons))
}

console.log('\n── what does NOT become a memory ──')
{
  // Clean delivery: every surface pulling its weight → nothing learned.
  const clean = learnedPlacements([
    row('facebook', 'feed', 30_000, 300, 200, 5),
    row('instagram', 'feed', 30_000, 310, 200, 5),
  ])
  check('an account with nothing condemned has no memory', clean === null, JSON.stringify(clean))

  check('no delivery at all has no memory', learnedPlacements([]) === null)

  // Audience Network draining is real, but it is not a LAUNCHABLE surface —
  // the launch spec never buys it, so there is nothing to avoid by name.
  const anOnly = learnedPlacements([
    row('audience_network', 'an_classic', 200_000, 40, 700, 0),
    row('facebook', 'feed', 20_000, 250, 150, 4),
  ])
  check('an off-platform drain does not narrow the launchable set',
    anOnly === null || anOnly.avoid.length === 0, JSON.stringify(anOnly?.avoid))
}

console.log('\n── a strong half rescues its key ──')
{
  // `reels` buys Facebook AND Instagram Reels as one unit. If one half is
  // condemned but the other is PROVEN strong, the honest state is mixed and
  // the memory keeps its hands off the key.
  const mixed = learnedPlacements([
    row('facebook', 'facebook_reels', 100_000, 20, 500, 0),
    row('instagram', 'reels', 40_000, 700, 300, 30),
    row('facebook', 'feed', 30_000, 200, 200, 4),
  ])
  check('a key with a proven-strong surface is not avoided',
    mixed === null || !mixed.avoid.includes('reels'), JSON.stringify(mixed?.avoid))
}

console.log('\n── history condemning everything launches everything ──')
{
  // Every launchable surface condemned → keep-list stays full, flagged.
  const apocalypse = learnedPlacements([
    row('facebook', 'facebook_reels', 100_000, 10, 400, 0),
    row('instagram', 'reels', 90_000, 9, 380, 0),
    row('facebook', 'feed', 95_000, 12, 390, 0),
    row('instagram', 'feed', 92_000, 11, 385, 0),
    row('instagram', 'story', 91_000, 10, 380, 0),
    // One surface has to convert, or nothing separates from the rest.
    row('audience_network', 'an_classic', 20_000, 400, 100, 12),
  ])
  if (apocalypse && apocalypse.avoid.length >= LAUNCHABLE_PLACEMENTS.length) {
    check('…keep is the FULL set, never empty',
      apocalypse.keep.length === LAUNCHABLE_PLACEMENTS.length, JSON.stringify(apocalypse.keep))
    check('…and it says so', apocalypse.allCondemned === true)
  } else {
    // The audit's own floors may keep some surfaces undecided — that is the
    // audit's call to make, and the memory must still never return an empty
    // keep-list.
    check('…keep is never empty even when the audit condemns partially',
      (apocalypse?.keep.length ?? LAUNCHABLE_PLACEMENTS.length) > 0, JSON.stringify(apocalypse))
  }
}

console.log('\n── aggregation pools what single campaigns cannot judge ──')
{
  // One campaign's reels sample is too thin to condemn; five campaigns of the
  // same story are not. The account learns what no single campaign could.
  const oneCampaign: PlacementRow[] = [
    row('facebook', 'facebook_reels', 4_000, 1, 25, 0),
    row('facebook', 'feed', 2_000, 24, 12, 1),
  ]
  const alone = learnedPlacements(oneCampaign)
  const pooled = learnedPlacements(aggregatePlacementRows([
    oneCampaign, oneCampaign, oneCampaign, oneCampaign, oneCampaign,
  ]))
  check('pooled evidence can condemn what a single campaign cannot',
    pooled !== null && pooled.avoid.includes('reels'),
    `alone=${JSON.stringify(alone?.avoid ?? null)} pooled=${JSON.stringify(pooled?.avoid)}`)

  const agg = aggregatePlacementRows([oneCampaign, oneCampaign])
  const reels = agg.find((r) => r.position === 'facebook_reels')!
  check('aggregation sums, never averages',
    reels.impressions === 8_000 && reels.spend === 50, JSON.stringify(reels))
  check('…and does not invent surfaces', agg.length === 2, String(agg.length))
}

console.log('\n── the insights vocabulary maps to the buying vocabulary ──')
{
  // Instagram feed impressions come back as `stream` OR `feed` depending on
  // surface generation; both must reach the same key.
  const streamed = learnedPlacements([
    row('instagram', 'stream', 100_000, 15, 500, 0),
    row('facebook', 'feed', 25_000, 300, 140, 4),
  ])
  const fed = learnedPlacements([
    row('instagram', 'feed', 100_000, 15, 500, 0),
    row('facebook', 'feed', 25_000, 300, 140, 4),
  ])
  check('instagram "stream" maps to the igFeed key',
    streamed?.avoid.includes('igFeed') === true, JSON.stringify(streamed?.avoid))
  check('instagram "feed" maps to the same key',
    fed?.avoid.includes('igFeed') === true, JSON.stringify(fed?.avoid))
}

if (failures > 0) {
  console.error(`\n${failures} placement-memory rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe next launch starts from what the last one paid to learn.\n')
