/**
 * Advantage stays off. At every level. Forever.
 *
 * Every Advantage feature is opt-OUT, and several are the default when a field
 * is simply omitted. That makes the failure mode SILENCE: nobody has to enable
 * anything for a launch to end up enrolled — someone only has to add a field
 * and forget the opt-out, or let an empty list fall through.
 *
 * So these assertions check for ABSENCE as a violation, not just for a wrong
 * value. "advantage_audience is missing" fails exactly like
 * "advantage_audience is 1", because to Meta they mean the same thing.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  placementSpecFor, findAdvantageInAdSet, findAdvantageInCreative, findAdvantageInCampaign,
  describeViolations, ALLOWED_PLATFORMS, ADVANTAGE_AUDIENCE_OFF, CREATIVE_ENHANCEMENTS_OFF, CREATIVE_FEATURES,
} from '../lib/meta/no-advantage'
import { audienceFingerprintFromTargeting } from '../lib/meta/campaign-structure'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** A clean ad-set body, built the way the client builds one. */
const cleanAdSet = (over: Record<string, unknown> = {}) => ({
  name: 'trial',
  campaign_id: 'c1',
  daily_budget: 25000,
  targeting: {
    geo_locations: { countries: ['AE'] },
    age_min: 30,
    age_max: 50,
    ...placementSpecFor(['facebook', 'instagram']),
    targeting_automation: { ...ADVANTAGE_AUDIENCE_OFF },
    ...over,
  },
})

console.log('\n── placements are never left to Meta ──')
{
  const spec = placementSpecFor(['facebook', 'instagram'])
  check('both platforms are named', Array.isArray(spec.publisher_platforms) && (spec.publisher_platforms as string[]).length === 2)
  check('facebook positions are named in full', Array.isArray(spec.facebook_positions))
  check('instagram positions are named in full', Array.isArray(spec.instagram_positions))

  // THE SILENT ENROLMENT. An empty list used to fall through to `{}`, which IS
  // Advantage+ placements — Audience Network included.
  const empty = placementSpecFor([])
  check('an EMPTY platform list still produces explicit placements',
    Array.isArray(empty.publisher_platforms) && (empty.publisher_platforms as string[]).length === 2,
    JSON.stringify(empty))
  check('…and it never returns an empty spec', Object.keys(empty).length > 0)

  check('audience network cannot be requested through the platform list',
    !(placementSpecFor(['audience_network']).publisher_platforms as string[]).includes('audience_network'),
    JSON.stringify(placementSpecFor(['audience_network'])))
  check('a typo falls back to the allowed set rather than to Meta\'s discretion',
    JSON.stringify(placementSpecFor(['facebok'])) === JSON.stringify(placementSpecFor([])))
  check('a single named platform stays single',
    (placementSpecFor(['facebook']).publisher_platforms as string[]).length === 1)
  check('a platform named alone still carries its positions',
    Array.isArray(placementSpecFor(['instagram']).instagram_positions))
  check('audience network is not in the allowed set at all',
    !(ALLOWED_PLATFORMS as readonly string[]).includes('audience_network'))
}

console.log('\n── the detector catches every silent enrolment ──')
{
  check('a clean ad set has nothing to report',
    findAdvantageInAdSet(cleanAdSet()).length === 0,
    describeViolations(findAdvantageInAdSet(cleanAdSet())))

  const noPlacements = { ...cleanAdSet(), targeting: { geo_locations: { countries: ['AE'] }, targeting_automation: { advantage_audience: 0 } } }
  check('missing publisher_platforms is caught',
    findAdvantageInAdSet(noPlacements).some((v) => v.path === 'targeting.publisher_platforms'),
    describeViolations(findAdvantageInAdSet(noPlacements)))

  const emptyPlacements = { ...cleanAdSet(), targeting: { publisher_platforms: [], targeting_automation: { advantage_audience: 0 } } }
  check('an EMPTY publisher_platforms is caught — it is not "no preference"',
    findAdvantageInAdSet(emptyPlacements).some((v) => v.path === 'targeting.publisher_platforms'))

  const an = { ...cleanAdSet(), targeting: { publisher_platforms: ['facebook', 'audience_network'], facebook_positions: ['feed'], targeting_automation: { advantage_audience: 0 } } }
  check('audience network smuggled into the platform list is caught',
    findAdvantageInAdSet(an).some((v) => /audience_network/.test(v.problem)),
    describeViolations(findAdvantageInAdSet(an)))

  const noPositions = { ...cleanAdSet(), targeting: { publisher_platforms: ['facebook'], targeting_automation: { advantage_audience: 0 } } }
  check('a platform without an explicit position list is caught',
    findAdvantageInAdSet(noPositions).some((v) => v.path === 'targeting.facebook_positions'))

  // The one that matters most: absence, not a wrong value.
  const noAutomation = { ...cleanAdSet(), targeting: { ...placementSpecFor(['facebook']), geo_locations: { countries: ['AE'] } } }
  check('a MISSING targeting_automation is a violation, not a pass',
    findAdvantageInAdSet(noAutomation).some((v) => v.path.endsWith('advantage_audience')),
    describeViolations(findAdvantageInAdSet(noAutomation)))

  const expanded = cleanAdSet({ targeting_automation: { advantage_audience: 1 } })
  check('advantage_audience = 1 is caught',
    findAdvantageInAdSet(expanded).some((v) => v.path.endsWith('advantage_audience')))

  // The Advantage feature that does not exist yet.
  const future = cleanAdSet({ targeting_automation: { advantage_audience: 0, advantage_something_new: 1 } })
  check('an UNKNOWN targeting automation is refused rather than assumed harmless',
    findAdvantageInAdSet(future).some((v) => v.path.endsWith('advantage_something_new')),
    describeViolations(findAdvantageInAdSet(future)))
  const futureOff = cleanAdSet({ targeting_automation: { advantage_audience: 0, advantage_something_new: 0 } })
  check('…but an unknown automation explicitly OFF is fine',
    findAdvantageInAdSet(futureOff).length === 0,
    describeViolations(findAdvantageInAdSet(futureOff)))

  const cbo = { ...cleanAdSet(), is_adset_budget_sharing_enabled: true }
  check('campaign budget optimisation riding along is caught',
    findAdvantageInAdSet(cbo).some((v) => v.path === 'is_adset_budget_sharing_enabled'))

  check('an ad set with no targeting at all is the loudest violation',
    findAdvantageInAdSet({ name: 'x' }).length === 1)
}

console.log('\n── Advantage+ creative is opted out, not merely unmentioned ──')
{
  const clean = { name: 'creative', degrees_of_freedom_spec: { ...CREATIVE_ENHANCEMENTS_OFF } }
  check('the opt-out payload passes', findAdvantageInCreative(clean).length === 0,
    describeViolations(findAdvantageInCreative(clean)))

  // The old behaviour: omit the block and "let the account default apply".
  // Meta removed the umbrella, so omitting the block now leaves EVERY feature
  // on the account default — one violation each, not one in total.
  check('OMITTING the block is a violation — the account default usually edits the ad',
    findAdvantageInCreative({ name: 'creative' }).length === CREATIVE_FEATURES.length,
    describeViolations(findAdvantageInCreative({ name: 'creative' })))
  check('…and the reason says so plainly',
    /account default/.test(findAdvantageInCreative({ name: 'creative' })[0].problem))

  // The deprecated umbrella is now itself a defect: Meta rejects the whole
  // creative on it (subcode 3858504), so an ad carrying it cannot launch.
  const withUmbrella = { degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_OUT' } } } }
  check('the DEPRECATED umbrella is caught, even when it says OPT_OUT',
    findAdvantageInCreative(withUmbrella).some((v) => /deprecated/i.test(v.problem)),
    describeViolations(findAdvantageInCreative(withUmbrella)))
  check('…and our own payload no longer sends it',
    !JSON.stringify(CREATIVE_ENHANCEMENTS_OFF).includes('standard_enhancements'),
    JSON.stringify(CREATIVE_ENHANCEMENTS_OFF).slice(0, 120))
  check('every named feature is opted out, none merely listed',
    CREATIVE_FEATURES.every((f) =>
      (CREATIVE_ENHANCEMENTS_OFF.creative_features_spec as Record<string, { enroll_status: string }>)[f]?.enroll_status === 'OPT_OUT'))

  const optedIn = { degrees_of_freedom_spec: { creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_IN' } } } }
  check('an explicit OPT_IN is caught', findAdvantageInCreative(optedIn).length > 0)
}

console.log('\n── budget stays on the ad sets ──')
{
  check('an explicitly-false sharing flag passes',
    findAdvantageInCampaign({ name: 'c', is_adset_budget_sharing_enabled: false }).length === 0)
  check('omitting the flag is a violation',
    findAdvantageInCampaign({ name: 'c' }).length === 1,
    describeViolations(findAdvantageInCampaign({ name: 'c' })))
  check('enabling it is a violation',
    findAdvantageInCampaign({ is_adset_budget_sharing_enabled: true }).length === 1)
}

console.log('\n── the age band is now honoured exactly ──')
{
  // The clamp to 25/65 existed ONLY to satisfy Advantage audiences. Removing it
  // from the launch path means the fingerprint must stop mirroring it too —
  // otherwise an identical ad set fails to match itself and gets created twice.
  const broad = { countries: ['AE'], cityKeys: [], ageMin: 30, ageMax: 50, publisherPlatforms: ['facebook'], interests: [] }
  const fp = audienceFingerprintFromTargeting(broad)
  check('a broad 30–50 audience fingerprints as 30–50, not 25–65',
    fp.includes('30') && fp.includes('50') && !fp.includes('65'), fp)
  check('the same audience fingerprints identically twice',
    audienceFingerprintFromTargeting(broad) === audienceFingerprintFromTargeting({ ...broad }))
  const narrow = { ...broad, interests: [{ id: '1', name: 'Property' }] }
  check('a defined audience and a broad one with the same band still differ',
    audienceFingerprintFromTargeting(narrow) !== fp)
}

if (failures > 0) {
  console.error(`\n${failures} Advantage guard(s) broken.`)
  process.exit(1)
}
console.log('\nAdvantage is off at every level.\n')
