/**
 * WHAT AN AD SET ACTUALLY BUYS — locked.
 *
 * The operator's finding, and the reason this module exists: "we can reinvent
 * the way Meta uses things or displays it, but we can't bypass the settings
 * and rules — show always what satisfies the situation, not generic."
 *
 * A picker that offers Instagram Story on a Facebook-Feed-only ad set is not a
 * picker; it is a form that collects a value Meta rejects at publish time,
 * after the work is done. So every assertion here is about reading the parent
 * object correctly — including the two "absent means EVERYTHING" traps that
 * make a wrong reading look like a conservative one.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import {
  placementsOfAdSet, formatsFor, croppedBy, bestFormatFor, FORMAT_ASPECT,
  AD_FORMATS, type AdFormat,
} from '../lib/meta/adset-placements'
import { LAUNCHABLE_PLACEMENTS } from '../lib/freehold/placement-memory'
import type { FormatKey } from '../lib/freehold/ad-compose'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the ad set is read, never assumed ──')
{
  const fbOnly = placementsOfAdSet({
    publisher_platforms: ['facebook'], facebook_positions: ['feed'],
  })
  check('a Facebook-Feed-only ad set has exactly one surface',
    fbOnly.keys.join(',') === 'fbFeed', fbOnly.keys.join(','))
  check('…and is NOT reported as automatic', !fbOnly.automatic)

  const both = placementsOfAdSet({
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed'],
    instagram_positions: ['stream', 'story'],
  })
  check('every named surface comes back', both.keys.length === 3, both.keys.join(','))
  check('…in the product\'s own order, so two ad sets read the same way',
    both.keys.join(',') === 'igFeed,igStory,fbFeed', both.keys.join(','))

  check('a position spelled the insights way still resolves',
    placementsOfAdSet({ publisher_platforms: ['instagram'], instagram_positions: ['feed'] })
      .keys.join(',') === 'igFeed')
}

console.log('\n── absent means EVERYTHING, twice ──')
{
  // TRAP 1. An empty publisher_platforms is how a request enrols in Advantage+
  // placements. Reading it as "no placements" would report an ad set that runs
  // everywhere as one that runs nowhere.
  const auto = placementsOfAdSet({ age_min: 25 })
  check('an ad set with no platforms is AUTOMATIC, not empty', auto.automatic, JSON.stringify(auto))
  check('…and offers every surface we can design for',
    auto.keys.length === LAUNCHABLE_PLACEMENTS.length, auto.keys.join(','))
  check('an explicitly empty list is the same trap',
    placementsOfAdSet({ publisher_platforms: [] }).automatic)
  check('unreadable targeting is automatic too — we cannot claim a narrowing we cannot see',
    placementsOfAdSet(null).automatic && placementsOfAdSet('nonsense').automatic)

  // TRAP 2, one level down: a platform named without its positions means ALL
  // of that platform's positions.
  const igAll = placementsOfAdSet({ publisher_platforms: ['instagram'] })
  check('Instagram with no positions named means EVERY Instagram position',
    igAll.keys.join(',') === 'igFeed,igStory,reels', igAll.keys.join(','))
  check('…and it is still not "automatic" — the platform WAS chosen',
    !igAll.automatic)
}

console.log('\n── a surface we do not design for is named, not hidden ──')
{
  const an = placementsOfAdSet({
    publisher_platforms: ['audience_network', 'instagram'], instagram_positions: ['stream'],
  })
  check('the unsupported platform is reported by name',
    an.unsupported.join(',') === 'audience_network', an.unsupported.join(','))
  check('…and does not contaminate the surfaces we can use',
    an.keys.join(',') === 'igFeed', an.keys.join(','))

  const nothing = placementsOfAdSet({ publisher_platforms: ['audience_network'] })
  check('an ad set that buys nothing we design for has no surfaces',
    nothing.keys.length === 0, nothing.keys.join(','))
  check('…and no shapes are offered for it, rather than a default that fits nothing',
    formatsFor(nothing.keys).length === 0)
  check('…and there is no best shape to fall back to', bestFormatFor(nothing.keys) === null)
}

console.log('\n── only shapes these surfaces can actually use ──')
{
  // The whole point of the module.
  const feedOnly = formatsFor(['fbFeed', 'igFeed'])
  check('a feed-only ad set is NEVER offered a 9:16 design',
    !feedOnly.includes('story'), feedOnly.join(','))
  check('…and is offered both feed shapes, which both survive intact',
    feedOnly.includes('feed') && feedOnly.includes('square'), feedOnly.join(','))

  const vertOnly = formatsFor(['igStory', 'reels'])
  check('a story/reels-only ad set is offered the vertical shape',
    vertOnly.join(',') === 'story', vertOnly.join(','))
  check('…and never a feed shape that would be letterboxed everywhere it runs',
    !vertOnly.includes('square') && !vertOnly.includes('feed'))

  const mixed = formatsFor(['igFeed', 'igStory'])
  check('a mixed ad set is offered both', mixed.length === 3, mixed.join(','))
  check('…always in a stable order', mixed.join(',') === 'feed,square,story', mixed.join(','))
}

console.log('\n── the crop is stated before the press, not read off a report later ──')
{
  check('a square design is cropped by a story surface',
    croppedBy(['igFeed', 'igStory'], 'square').join(',') === 'igStory',
    croppedBy(['igFeed', 'igStory'], 'square').join(','))
  check('a 9:16 design is letterboxed in feed',
    croppedBy(['igFeed', 'igStory'], 'story').join(',') === 'igFeed',
    croppedBy(['igFeed', 'igStory'], 'story').join(','))
  check('a design that fits every surface crops nothing',
    croppedBy(['igFeed', 'fbFeed'], 'square').length === 0)

  // The default must be the shape that survives the most surfaces intact — a
  // mixed ad set defaulting to story would crop its feed placements, which are
  // where the money is.
  check('a feed-heavy ad set defaults to a feed shape',
    bestFormatFor(['igFeed', 'fbFeed', 'igStory']) !== 'story',
    String(bestFormatFor(['igFeed', 'fbFeed', 'igStory'])))
  check('a vertical-only ad set defaults to vertical',
    bestFormatFor(['igStory', 'reels']) === 'story')
  check('a feed-only ad set defaults to a feed shape',
    bestFormatFor(['fbFeed']) !== 'story')
}

console.log('\n── one vocabulary, not two ──')
{
  // AdFormat is declared in lib/meta/adset-placements so that module stays
  // free of the canvas layer. If the two ever drift, a shape offered here
  // renders nothing in the studio.
  const studio: FormatKey[] = ['feed', 'square', 'story']
  check('every shape this module offers is one the studio can render',
    AD_FORMATS.every((f) => (studio as string[]).includes(f)), AD_FORMATS.join(','))
  check('…and every shape the studio renders is offerable here',
    studio.every((f) => (AD_FORMATS as string[]).includes(f)), studio.join(','))
  check('every shape has an aspect, or the crop check is silently vacuous',
    AD_FORMATS.every((f: AdFormat) => !!FORMAT_ASPECT[f]))
}

if (failures > 0) {
  console.error(`\n${failures} ad-set placement rule(s) broken.`)
  process.exit(1)
}
console.log('\nNothing is offered that the ad set cannot run.\n')
