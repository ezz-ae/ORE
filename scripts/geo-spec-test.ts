/**
 * Who counts as being in Dubai — second edition, locked.
 *
 * The history this suite now guards, because both halves cost real money:
 *
 * First: no `location_types` was ever sent, Meta's default bought tourists
 * alongside residents, and nothing on any screen said so. The first edition
 * pinned `['home']` — residents only — and locked it here.
 *
 * Then Meta answered: `['home']` alone is a DEPRECATED option. A live ad set
 * created with it kept delivering but was flagged with a draft validation
 * error that silently BLOCKED EVERY EDIT — budget, audience, all refused —
 * until the location type was republished by hand. The residents-only knob
 * no longer exists on Meta's side; the only supported value is
 * `['home','recent']`, together.
 *
 * So this suite asserts the corrected doctrine: the wire always carries the
 * one supported value, legacy stored values normalise FORWARD instead of
 * poisoning new ad sets, and the deprecated state is detectable on live ad
 * sets so the setup check can name the edit-blocker.
 *
 * Pure — no network, no database. Runs in `pnpm guards`.
 */
import {
  geoLocationsSpec, normalizeLocationTypes, liveLocationTypes,
  usesDeprecatedLocationTypes, STANDARD_LOCATION_TYPES,
} from '../lib/meta/geo-spec'
import { checkCampaignSetup } from '../lib/freehold/campaign-setup-check'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the wire carries the one value Meta still accepts ──')
{
  const g = geoLocationsSpec({ countries: ['AE'] })
  check('a fresh spec sends home+recent — the only supported pair',
    JSON.stringify(g.location_types) === JSON.stringify(['home', 'recent']), JSON.stringify(g.location_types))
  check('…and the field is PRESENT, never omitted: "Meta\'s default" changed under us once already',
    Object.prototype.hasOwnProperty.call(g, 'location_types'))
  check('the countries still travel', JSON.stringify(g.countries) === '["AE"]')
  check('cities are attached in Meta\'s shape',
    JSON.stringify(geoLocationsSpec({ countries: ['AE'], cityKeys: ['k1'] }).cities) === '[{"key":"k1"}]')
}

console.log('\n── legacy values normalise FORWARD, never onto the wire ──')
{
  // A saved audience from the residents-only era must not poison a new ad
  // set with the deprecated option that blocks all future edits.
  check('the stored residents-only era value becomes the supported pair',
    JSON.stringify(normalizeLocationTypes(['home'])) === JSON.stringify(STANDARD_LOCATION_TYPES))
  check('travel_in — deprecated even earlier — becomes the supported pair',
    JSON.stringify(normalizeLocationTypes(['travel_in'])) === JSON.stringify(STANDARD_LOCATION_TYPES))
  check('absent, junk and empty all become the supported pair',
    [undefined, [], ['nonsense', 42]].every((v) =>
      JSON.stringify(normalizeLocationTypes(v)) === JSON.stringify(STANDARD_LOCATION_TYPES)))
  check('the supported pair is exactly home+recent', STANDARD_LOCATION_TYPES.join(',') === 'home,recent')
}

console.log('\n── the deprecated state is detectable on LIVE ad sets ──')
{
  // Delivery continues under the flag — the damage is silent edit refusal.
  // Detection is what lets the setup check say so in words.
  check('a home-only live ad set is flagged deprecated',
    usesDeprecatedLocationTypes({ countries: ['AE'], location_types: ['home'] }))
  check('the supported pair is not flagged',
    !usesDeprecatedLocationTypes({ countries: ['AE'], location_types: ['home', 'recent'] }))
  check('order does not matter',
    !usesDeprecatedLocationTypes({ countries: ['AE'], location_types: ['recent', 'home'] }))
  check('an absent field is Meta\'s own default — not flagged',
    !usesDeprecatedLocationTypes({ countries: ['AE'] }))
  check('a legacy reader reports what is actually there, never modernised history',
    liveLocationTypes({ countries: ['AE'], location_types: ['home'] }).join(',') === 'home')
}

console.log('\n── the setup check names the edit-blocker ──')
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

  const legacy = keys(checkCampaignSetup(camp, adSet({ countries: ['AE'], location_types: ['home'] })))
  check('the residents-only era ad set is called out as WRONG — its edits are hostage',
    legacy.includes('wrong:visitors'), legacy.join(' | '))

  const modern = keys(checkCampaignSetup(camp, adSet({ countries: ['AE'], location_types: ['home', 'recent'] })))
  check('the supported pair is confirmed, not left silent',
    modern.includes('ok:residents') && !modern.includes('wrong:visitors'), modern.join(' | '))

  const absent = keys(checkCampaignSetup(camp, adSet({ countries: ['AE'] })))
  check('an absent field — Meta\'s default — is also fine',
    absent.includes('ok:residents'), absent.join(' | '))
}

if (failures > 0) {
  console.error(`\n${failures} location rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe location setting is the one Meta still sells, and the flag has a name.\n')
