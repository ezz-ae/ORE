/**
 * The placement audit, locked.
 *
 * Two failures it must never produce, in either direction:
 *
 *  · Condemning a placement that is merely young. Forty impressions on a new
 *    surface is not evidence, and "cut Audience Network" said confidently on
 *    no data is the same class of mistake as every other premature verdict in
 *    this system.
 *  · Blessing overflow inventory because the blended cost per lead looks fine.
 *    That is the entire reason the breakdown call exists.
 *
 * The numbers below are shaped like the operator's own account: a campaign
 * where most impressions land off-platform at a fraction of the price and
 * convert at a fraction of the rate, which nets out to an unremarkable cost
 * per lead.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { auditPlacements, shapeOf, fits, type PlacementRow } from '../lib/freehold/placement-audit'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const find = (a: ReturnType<typeof auditPlacements>, id: string) => a.readings.find((r) => r.id === id)

console.log('\n── reading the surface ──')
{
  check('a story is a vertical surface', shapeOf('instagram', 'story') === 'vertical')
  check('reels is a vertical surface', shapeOf('facebook', 'facebook_reels') === 'vertical')
  check('a feed is a feed', shapeOf('facebook', 'feed') === 'feed')
  check('instagram stream is a feed', shapeOf('instagram', 'stream') === 'feed')
  check('audience network is treated as off-platform video inventory',
    shapeOf('audience_network', 'an_classic') === 'video')
  check('an unknown position on a known platform is not guessed into a shape',
    shapeOf('instagram', 'something_new') === 'other')
}

console.log('\n── does the creative survive the surface ──')
{
  check('a 9:16 asset fits a vertical surface', fits('vertical', '9:16') === true)
  check('a square asset is cropped by a vertical surface', fits('vertical', '1:1') === false)
  check('a 4:5 asset is cropped by a vertical surface', fits('vertical', '4:5') === false)
  check('a 9:16 asset is letterboxed in feed', fits('feed', '9:16') === false)
  check('a 4:5 asset is fine in feed', fits('feed', '4:5') === true)
  check('an unknown creative claims nothing', fits('vertical', null) === null)
  check('in-stream is not an aspect-ratio question', fits('video', '1:1') === null)
}

console.log('\n── overflow inventory hiding inside a normal cost per lead ──')
{
  // Feed: expensive, converts. Audience Network: cheap, does not. Blended CPL
  // lands at an unremarkable number and the campaign looks healthy.
  const rows: PlacementRow[] = [
    { platform: 'facebook',         position: 'feed',      impressions: 20_000,  clicks: 220, spend: 1400, leads: 14 },
    { platform: 'audience_network', position: 'an_classic', impressions: 180_000, clicks: 300, spend: 700,  leads: 2 },
  ]
  const a = auditPlacements(rows)
  const blended = (1400 + 700) / (14 + 2)
  check('the blended cost per lead looks perfectly ordinary', Math.round(blended) === 131, String(blended))

  const an = find(a, 'audience_network:an_classic')!
  const feed = find(a, 'facebook:feed')!
  check('audience network is called a drain', an.verdict === 'drain', an.verdict)
  check('feed is called strong', feed.verdict === 'strong', feed.verdict)
  check('the drain is flagged as off-platform', an.offPlatform)
  check('the audit reports the off-platform impression share',
    Math.round(a.offPlatformImpressionShare * 100) === 90, String(a.offPlatformImpressionShare))
  check('…and that it cost far less than its share of impressions',
    a.offPlatformSpendShare < a.offPlatformImpressionShare * 0.5, String(a.offPlatformSpendShare))
  check('the headline leads with the off-platform share', /90% of impressions went off-platform/.test(a.headline), a.headline)
  check('the recommendation names the placement to exclude',
    /Exclude audience network/.test(a.recommendation), a.recommendation)
  check('feed is never in the cut list', !a.cut.some((r) => r.platform === 'facebook'))
}

console.log('\n── a young placement is not a bad placement ──')
{
  const rows: PlacementRow[] = [
    { platform: 'facebook',         position: 'feed',       impressions: 20_000, clicks: 220, spend: 1400, leads: 14 },
    { platform: 'audience_network', position: 'an_classic', impressions: 40,     clicks: 0,   spend: 2,    leads: 0 },
  ]
  const a = auditPlacements(rows)
  check('40 impressions cannot condemn a placement',
    find(a, 'audience_network:an_classic')!.verdict === 'undecided',
    find(a, 'audience_network:an_classic')!.verdict)
  check('nothing is cut', a.cut.length === 0, a.cut.map((r) => r.id).join(','))
  check('the recommendation says to leave it alone', /Leave the split alone/.test(a.recommendation), a.recommendation)
}

console.log('\n── the creative being killed by the surface ──')
{
  // Stories taking real spend while the creative is square: cropped ad.
  const rows: PlacementRow[] = [
    { platform: 'facebook',  position: 'feed',  impressions: 30_000, clicks: 300, spend: 1200, leads: 12 },
    { platform: 'instagram', position: 'story', impressions: 25_000, clicks: 200, spend: 800,  leads: 8 },
  ]
  const withAspect = auditPlacements(rows, '1:1')
  const story = find(withAspect, 'instagram:story')!
  check('a square creative in Stories is called a mismatch', story.verdict === 'mismatch', story.verdict)
  check('the sentence says the ad is cropped', /cropped to run here/.test(story.sentence), story.sentence)
  check('it reaches the cut list because it takes real spend',
    withAspect.cut.some((r) => r.id === 'instagram:story'))
  check('the recommendation offers the 9:16 alternative to cutting',
    /9:16 version/.test(withAspect.recommendation), withAspect.recommendation)

  // Same delivery, a vertical creative: nothing is wrong.
  const vertical = auditPlacements(rows, '9:16')
  check('a 9:16 creative in Stories is not a mismatch',
    find(vertical, 'instagram:story')!.verdict !== 'mismatch')

  // Same delivery, unknown creative: claim nothing about the aspect ratio.
  const unknown = auditPlacements(rows, null)
  check('an unknown creative produces no mismatch claim',
    !unknown.readings.some((r) => r.verdict === 'mismatch'))
  check('…and every creativeFits is null', unknown.readings.every((r) => r.creativeFits === null))
}

console.log('\n── a mismatch on trivial spend is a note, not an action ──')
{
  const rows: PlacementRow[] = [
    { platform: 'facebook',  position: 'feed',  impressions: 100_000, clicks: 900, spend: 5000, leads: 40 },
    { platform: 'instagram', position: 'story', impressions: 900,     clicks: 6,   spend: 30,   leads: 0 },
  ]
  const a = auditPlacements(rows, '1:1')
  check('the mismatch is still reported', find(a, 'instagram:story')!.verdict === 'mismatch')
  check('but it is not worth cutting at 0.6% of spend', a.cut.length === 0,
    a.cut.map((r) => `${r.id}@${r.spendShare}`).join(','))
}

console.log('\n── shares and degenerate input ──')
{
  const rows: PlacementRow[] = [
    { platform: 'facebook',  position: 'feed',  impressions: 60_000, clicks: 500, spend: 900, leads: 9 },
    { platform: 'instagram', position: 'stream', impressions: 40_000, clicks: 350, spend: 600, leads: 6 },
  ]
  const a = auditPlacements(rows)
  const total = a.readings.reduce((n, r) => n + r.impressionShare, 0)
  check('impression shares sum to 1', Math.abs(total - 1) < 1e-9, String(total))
  check('spend shares sum to 1',
    Math.abs(a.readings.reduce((n, r) => n + r.spendShare, 0) - 1) < 1e-9)
  check('two evenly-performing placements produce no verdict',
    a.readings.every((r) => r.verdict === 'undecided'), a.readings.map((r) => r.verdict).join(','))

  const empty = auditPlacements([])
  check('no delivery does not throw', empty.readings.length === 0 && empty.cut.length === 0)
  check('…and says so rather than implying health',
    /has not delivered/.test(empty.recommendation), empty.recommendation)
  const zero = auditPlacements([{ platform: 'facebook', position: 'feed', impressions: 0, clicks: 0, spend: 0, leads: 0 }])
  check('a zero-impression campaign does not divide by zero', zero.readings.length === 0)
}

if (failures > 0) {
  console.error(`\n${failures} placement-audit rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll placement-audit rules hold.\n')
