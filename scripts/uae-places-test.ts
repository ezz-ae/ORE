/**
 * "AL AIN" MUST NOT MEAN "THE UAE" — locked.
 *
 * "the only way is you fix a real targeting on the api for alain/abudhabi for
 *  this event ad, and fix the other all uae target."
 *
 * The Al Ain event ad sets spent AED 2,541 and produced 6 leads. The reason
 * is structural and was invisible from every screen:
 *
 * Meta REFUSES city-level targeting in the UAE — error subcode 1487479, "City
 * Targeting Not Supported" — and lib/meta/client.ts has always carried the
 * self-heal for it: on that error it deletes `geo_locations.cities` and
 * retries at country level. The retry succeeds. The ad set goes live. It is
 * named for a city and buys a country, and nothing anywhere says so.
 *
 * So sub-country targeting here is coordinates and a radius, which Meta
 * accepts — and which, unlike a city key, needs no id from Meta's vocabulary
 * at all. A coordinate is public geography. Nothing to look up, nothing to
 * invent, nothing that can rot on Meta's schedule.
 *
 * ── AND THE TRAP INSIDE THE FIX ──────────────────────────────────────────
 *
 * `geo_locations` ORs its entries. Sending countries: ['AE'] alongside a
 * 35 km circle around Al Ain means "the UAE, or Al Ain" — which is the UAE,
 * with a radius drawn on it for decoration. That would reproduce the exact
 * bug in a form that looks fixed, which is worse than the bug.
 *
 * Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  UAE_PLACES, AL_AIN_CATCHMENT, customLocationsFor, placeByKey,
  isWholeCountry, MIN_RADIUS_KM, MAX_RADIUS_KM,
} from '../lib/freehold/uae-places'
import { geoLocationsSpec } from '../lib/meta/geo-spec'
import { targetingFromMeta } from '../lib/meta/targeting-parse'
import { checkCampaignSetup } from '../lib/freehold/campaign-setup-check'
import { normalizeSpec, combineSpecs } from '../lib/freehold/audiences'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── a radius replaces the country, never joins it ──')
{
  const spec = geoLocationsSpec({
    countries: ['AE'],
    customLocations: customLocationsFor(AL_AIN_CATCHMENT),
  })
  // THE ASSERTION THAT MATTERS MOST. geo_locations ORs its entries, so a
  // country left alongside a radius is the whole country wearing a circle.
  check('an Al Ain audience does not also carry the whole UAE',
    !('countries' in spec), JSON.stringify(spec))
  check('…and does carry the two circles it asked for',
    (spec.custom_locations as unknown[]).length === 2)

  const plain = geoLocationsSpec({ countries: ['AE'] })
  check('with no radius, the country is still the audience',
    (plain.countries as string[]).join(',') === 'AE' && !('custom_locations' in plain),
    JSON.stringify(plain))

  // The one field this module was originally written to pin.
  check('every spec still states its location types explicitly',
    Array.isArray(spec.location_types) && Array.isArray(plain.location_types))
}

console.log('\n── the places themselves ──')
{
  check('Al Ain and Abu Dhabi are both real places here',
    !!placeByKey('al_ain') && !!placeByKey('abu_dhabi'))
  check('…and the event catchment is those two',
    AL_AIN_CATCHMENT.join(',') === 'al_ain,abu_dhabi')

  // A typo must not quietly widen the audience. This is the same failure as
  // the city path — a geo that silently became "everywhere".
  check('an unknown place is dropped, never guessed at',
    customLocationsFor(['al_ain', 'nowhere']).length === 1)
  check('…and a spec built only from unknown places has no circles at all',
    customLocationsFor(['nowhere']).length === 0)

  // Out-of-range radius is rejected by Meta at create — a launch failure
  // rather than a bad audience, so it is clamped rather than sent.
  for (const p of UAE_PLACES) {
    check(`${p.key} has a radius Meta will accept`,
      p.radiusKm >= MIN_RADIUS_KM && p.radiusKm <= MAX_RADIUS_KM, String(p.radiusKm))
  }
  const clamped = customLocationsFor(UAE_PLACES.map((p) => p.key))
  check('every emitted radius is inside the accepted range',
    clamped.every((c) => c.radius >= MIN_RADIUS_KM && c.radius <= MAX_RADIUS_KM))
  check('…and every one is in kilometres, stated',
    clamped.every((c) => c.distance_unit === 'kilometer'))

  // Coordinates must be in the UAE, or the circle is somewhere else entirely
  // and every check above passes while the money goes to another country.
  check('every place is actually inside the UAE',
    UAE_PLACES.every((p) => p.latitude > 22 && p.latitude < 27 && p.longitude > 51 && p.longitude < 57),
    UAE_PLACES.map((p) => `${p.key}:${p.latitude},${p.longitude}`).join(' '))

  // Eight radii covering every emirate is the country with a worse reach
  // estimate; a caller that cannot tell would ship the expensive version.
  check('asking for every emirate is recognised as the whole country',
    isWholeCountry(UAE_PLACES.map((p) => p.key)) && !isWholeCountry(AL_AIN_CATCHMENT))
}

console.log('\n── and a radius survives the round trip ──')
{
  // BUILT AND UNWIRED IS THE FAILURE THIS PRODUCT KEEPS REPEATING — the
  // targeting guard computed the right answer daily and returned it into a
  // discarded response body. A geo the launcher can send but no reader can
  // see is the same shape of mistake.
  const spec = geoLocationsSpec({
    countries: ['AE'],
    customLocations: customLocationsFor(AL_AIN_CATCHMENT),
  })
  const readBack = targetingFromMeta({ geo_locations: spec })!
  check('a live ad set targeted by radius reads back as targeted',
    (readBack.customLocations ?? []).length === 2,
    JSON.stringify(readBack.customLocations))

  // checkCampaignSetup reads LIVE Meta. Without the radius reader it reports
  // `noPlace` on the one correctly targeted ad set in the account — a guard
  // calling good work broken is a guard people stop reading.
  const findings = checkCampaignSetup(
    { id: 'c1', status: 'ACTIVE', daily_budget: '30000' },
    [{ id: 'a1', name: 'Al Ain event', status: 'ACTIVE', targeting: { geo_locations: spec }, ads: [] } as never],
  )
  check('…and the setup check does not call it placeless',
    !findings.some((f) => f.key === 'noPlace'),
    findings.map((f) => f.key).join(','))

  // A saved audience must keep the KEY, not the resolved circle: a radius we
  // later revise has to apply to every audience that named the place.
  const saved = normalizeSpec({ countries: ['AE'], placeKeys: [...AL_AIN_CATCHMENT] })
  check('a saved audience keeps the place it named',
    (saved.placeKeys ?? []).join(',') === 'al_ain,abu_dhabi', String(saved.placeKeys))
  // Combining two audiences widens WHERE; dropping the places here would turn
  // a combined Al Ain + Abu Dhabi audience back into the whole country.
  const combined = combineSpecs([saved, normalizeSpec({ countries: ['AE'], placeKeys: ['dubai'] })])
  check('…and combining audiences keeps every place',
    (combined.placeKeys ?? []).sort().join(',') === 'abu_dhabi,al_ain,dubai',
    String(combined.placeKeys))
}

console.log('\n── and all three senders build geo the same way ──')
{
  const client = readFileSync(join(process.cwd(), 'lib/meta/client.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  // Ad-set create, ad-set update and the reach estimate. If the estimate does
  // not pass the places, the number on screen describes the country while the
  // ad buys a city — the failure this file already carries for `locales`.
  const calls = (client.match(/customLocations: customLocationsFor\(/g) ?? []).length
  const geoCalls = (client.match(/geoLocationsSpec\(\{/g) ?? []).length
  check('every geo builder call passes the places through',
    calls === geoCalls && geoCalls === 3, `${calls} of ${geoCalls}`)
}

console.log(failures === 0
  ? '\n✅ a city-sized audience is a city-sized audience.'
  : `\n❌ ${failures} UAE-place guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
