/**
 * Who counts as being in Dubai — locked.
 *
 * `geo_locations: { countries: ['AE'] }` does not mean "people in the UAE". It
 * means whatever Meta's default `location_types` says, and that default is
 * home + recent: everyone who lives there PLUS everyone Meta has recently seen
 * there. A tourist on a five-day holiday is inside that audience and can fill
 * in a property form.
 *
 * This codebase sent `location_types` from none of the three places that build
 * a targeting spec, so every campaign it ever launched bought visitors
 * alongside residents and no screen said so.
 *
 * WHAT THIS FILE GUARDS, AND THE LINE IT WILL NOT CROSS: this is a statement
 * about where somebody LIVES — the same kind of fact as the country targeting
 * it qualifies, and the standard setting for a property campaign. It is not a
 * nationality, not an origin, and no reading of it may treat it as one.
 * Everyone who lives in the UAE is inside `home`; that is what the word means.
 *
 * Pure — no network, no database. Runs in `pnpm guards`.
 */
import {
  geoLocationsSpec, normalizeLocationTypes, includesVisitors, liveLocationTypes,
  RESIDENTS_ONLY, ALL_LOCATION_TYPES,
} from '../lib/meta/geo-spec'
import { checkCampaignSetup } from '../lib/freehold/campaign-setup-check'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the field is always sent ──')
{
  const g = geoLocationsSpec({ countries: ['AE'] })
  check('a spec with no stated preference targets residents',
    JSON.stringify(g.location_types) === JSON.stringify(RESIDENTS_ONLY), JSON.stringify(g.location_types))
  check('…and the field is PRESENT, never omitted',
    Object.prototype.hasOwnProperty.call(g, 'location_types'), JSON.stringify(g))
  check('the countries still travel', JSON.stringify(g.countries) === '["AE"]')
  check('cities are attached in Meta\'s shape',
    JSON.stringify(geoLocationsSpec({ countries: ['AE'], cityKeys: ['k1'] }).cities) === '[{"key":"k1"}]')
  check('no cities means no empty cities key',
    !Object.prototype.hasOwnProperty.call(geoLocationsSpec({ countries: ['AE'], cityKeys: [] }), 'cities'))
}

console.log('\n── an omission is not a neutral choice ──')
{
  // The whole bug in one assertion: sending nothing hands the decision to
  // Meta, and Meta's answer includes travellers.
  check('an absent value normalises to residents, not to "anyone"',
    JSON.stringify(normalizeLocationTypes(undefined)) === JSON.stringify(RESIDENTS_ONLY))
  check('an empty array normalises to residents too',
    JSON.stringify(normalizeLocationTypes([])) === JSON.stringify(RESIDENTS_ONLY))
  check('junk normalises to residents rather than being passed to Meta',
    JSON.stringify(normalizeLocationTypes(['nonsense', 42, null])) === JSON.stringify(RESIDENTS_ONLY))
  check('a deliberate wider choice is respected, not overridden',
    JSON.stringify(normalizeLocationTypes(['home', 'recent'])) === '["home","recent"]',
    JSON.stringify(normalizeLocationTypes(['home', 'recent'])))
  check('duplicates collapse', JSON.stringify(normalizeLocationTypes(['home', 'home'])) === '["home"]')
  check('every type Meta accepts is known here', ALL_LOCATION_TYPES.length === 3)

  check('residents-only does not include visitors', !includesVisitors(['home']))
  check('adding "recent" does include them', includesVisitors(['home', 'recent']))
  check('"travel_in" counts as visitors', includesVisitors(['travel_in']))
}

console.log('\n── reading a LIVE ad set back ──')
{
  // What every campaign launched before this fix looks like on the account.
  check('an ad set with no location_types is home + recent, per Meta',
    JSON.stringify(liveLocationTypes({ countries: ['AE'] })) === '["home","recent"]',
    JSON.stringify(liveLocationTypes({ countries: ['AE'] })))
  check('…so it is reported as including visitors',
    includesVisitors(liveLocationTypes({ countries: ['AE'] })))
  check('an ad set that states home only is read as residents',
    !includesVisitors(liveLocationTypes({ countries: ['AE'], location_types: ['home'] })))
}

console.log('\n── the setup check says it on screen ──')
{
  const adSet = (geo: Record<string, unknown>) => ([{
    id: 'a1', name: 'Set 1', status: 'ACTIVE', daily_budget: '10000',
    optimization_goal: 'LEAD_GENERATION',
    ads: [{ id: 'ad1', effective_status: 'ACTIVE' }],
    targeting: {
      geo_locations: geo,
      age_min: 30, age_max: 60,
      publisher_platforms: ['instagram'], instagram_positions: ['stream'],
      interests: [{ id: '1', name: 'Property' }],
    },
  }])
  const camp = { id: 'c1', status: 'ACTIVE', daily_budget: '10000' }
  const keys = (fs: ReturnType<typeof checkCampaignSetup>) => fs.map((f) => `${f.level}:${f.key}`)

  const legacy = keys(checkCampaignSetup(camp, adSet({ countries: ['AE'] })))
  check('a live campaign that never sent the field is called out as WRONG',
    legacy.includes('wrong:visitors'), legacy.join(' | '))

  const fixed = keys(checkCampaignSetup(camp, adSet({ countries: ['AE'], location_types: ['home'] })))
  check('…and one that targets residents is confirmed, not left silent',
    fixed.includes('ok:residents') && !fixed.includes('wrong:visitors'), fixed.join(' | '))

  // No place at all is a different, louder problem — it must not be drowned
  // out by a finding about which people in that place are included.
  const nowhere = keys(checkCampaignSetup(camp, adSet({})))
  check('an ad set with no location says THAT, and says nothing about visitors',
    nowhere.includes('wrong:noPlace') && !nowhere.some((k) => k.endsWith(':visitors')),
    nowhere.join(' | '))
}

if (failures > 0) {
  console.error(`\n${failures} location rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe ads are pointed at people who live here.\n')
