/**
 * Reading Meta's targeting_spec back, locked.
 *
 * This is the parser the whole snapshot depends on. If it silently drops a
 * behaviour, that behaviour becomes invisible to the relevance engine forever
 * — the lead is recorded as having arrived through an ad set that did not
 * contain it, and no later analysis can recover the truth. A parser that loses
 * data quietly is worse than one that throws.
 *
 * The two shapes below both occur in real accounts: ad sets we launched use
 * `flexible_spec` when they have narrowing and flat fields otherwise, and an
 * ad set edited by hand in Ads Manager can come back either way.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { targetingFromMeta } from '../lib/meta/targeting-parse'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the flat shape ──')
{
  const t = targetingFromMeta({
    geo_locations: { countries: ['AE'], cities: [{ key: '2562407' }] },
    age_min: 30, age_max: 50,
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed'],
    interests: [{ id: 'i1', name: 'Property investment' }],
    behaviors: [{ id: 'b1', name: 'Expats' }],
    genders: [1],
    locales: [6, 9],
  })!
  check('countries survive', t.countries.join(',') === 'AE')
  check('city keys survive', t.cityKeys.join(',') === '2562407', t.cityKeys.join(','))
  check('the age band survives exactly', t.ageMin === 30 && t.ageMax === 50, `${t.ageMin}-${t.ageMax}`)
  check('platforms survive', t.publisherPlatforms.join(',') === 'facebook,instagram')
  check('interests survive with names', t.interests[0]?.name === 'Property investment')
  check('behaviours survive with names', t.behaviors?.[0]?.name === 'Expats')
  check('genders survive', t.genders?.join(',') === '1')
  check('locales survive as raw ids', t.locales?.join(',') === '6,9', String(t.locales))
  check('no narrowing is invented', (t.narrowing ?? []).length === 0)
}

console.log('\n── the flexible shape: first group is the base ──')
{
  const t = targetingFromMeta({
    geo_locations: { countries: ['AE'] },
    age_min: 25, age_max: 65,
    flexible_spec: [
      { interests: [{ id: 'i1', name: 'Apartments' }] },
      { behaviors: [{ id: 'b2', name: 'Investors' }] },
      { interests: [{ id: 'i3', name: 'Luxury' }], behaviors: [{ id: 'b3', name: 'Travellers' }] },
    ],
  })!
  check('the first group becomes the base interests',
    t.interests.map((i) => i.id).join(',') === 'i1', t.interests.map((i) => i.id).join(','))
  check('the remaining groups become narrowing layers',
    (t.narrowing ?? []).length === 2, String((t.narrowing ?? []).length))
  check('a narrowing behaviour is not lost',
    (t.narrowing ?? [])[0]?.behaviors?.[0]?.id === 'b2',
    JSON.stringify(t.narrowing?.[0]))
  check('a mixed narrowing group keeps both sides',
    (t.narrowing ?? [])[1]?.interests?.[0]?.id === 'i3' && (t.narrowing ?? [])[1]?.behaviors?.[0]?.id === 'b3',
    JSON.stringify(t.narrowing?.[1]))
}

console.log('\n── the mixed shape, where the base is flat AND flexible groups exist ──')
{
  // THE ONE THAT LOSES DATA IF YOU GET IT WRONG. When the base came from the
  // flat fields, EVERY flexible group is a narrowing layer — treating the
  // first as the base (as in the pure-flexible case) would silently discard
  // it, and that behaviour would never appear in any relevance table again.
  const t = targetingFromMeta({
    geo_locations: { countries: ['AE'] },
    interests: [{ id: 'flat', name: 'Flat base' }],
    flexible_spec: [
      { behaviors: [{ id: 'n1', name: 'Narrow one' }] },
      { behaviors: [{ id: 'n2', name: 'Narrow two' }] },
    ],
  })!
  check('the flat base wins', t.interests.map((i) => i.id).join(',') === 'flat')
  check('BOTH flexible groups become narrowing — none is swallowed',
    (t.narrowing ?? []).length === 2, String((t.narrowing ?? []).length))
  check('the first narrowing group is not lost',
    (t.narrowing ?? []).some((g) => g.behaviors?.some((b) => b.id === 'n1')),
    JSON.stringify(t.narrowing))
}

console.log('\n── exclusions and custom audiences ──')
{
  const t = targetingFromMeta({
    geo_locations: { countries: ['AE'] },
    exclusions: { interests: [{ id: 'x1', name: 'Agents' }] },
    custom_audiences: [{ id: 'ca1' }, { id: 'ca2' }],
  })!
  check('exclusions survive', t.exclusions?.interests?.[0]?.id === 'x1', JSON.stringify(t.exclusions))
  check('custom audience ids survive', t.customAudienceIds?.join(',') === 'ca1,ca2',
    String(t.customAudienceIds))
  const none = targetingFromMeta({ geo_locations: { countries: ['AE'] } })!
  check('absent exclusions are undefined, not an empty shape',
    none.exclusions === undefined, JSON.stringify(none.exclusions))
}

console.log('\n── nothing is guessed ──')
{
  check('no targeting at all returns null', targetingFromMeta(null) === null)
  check('undefined returns null', targetingFromMeta(undefined) === null)
  const empty = targetingFromMeta({})!
  check('an empty spec parses without throwing', empty !== null)
  check('…with no countries invented', empty.countries.length === 0)
  check('…and no age invented', empty.ageMin === 0 && empty.ageMax === 0, `${empty.ageMin}-${empty.ageMax}`)

  // Junk must be dropped, not carried into a table as a fake entity.
  const junk = targetingFromMeta({
    interests: [{ name: 'no id at all' }, { id: 'good', name: 'Good' }, null, 'string'],
  })!
  check('an entity with no id is dropped',
    junk.interests.length === 1 && junk.interests[0].id === 'good',
    JSON.stringify(junk.interests))
  check('a non-array interests field yields nothing rather than throwing',
    targetingFromMeta({ interests: 'nope' })!.interests.length === 0)
  check('a malformed city entry is dropped, not stored as an empty key',
    targetingFromMeta({ geo_locations: { cities: [{ notakey: 1 }, { key: '123' }] } })!
      .cityKeys.join(',') === '123')
  check('an invalid gender code is dropped',
    targetingFromMeta({ genders: [1, 7, 'x'] })!.genders?.join(',') === '1')
}

if (failures > 0) {
  console.error(`\n${failures} targeting-parse rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll targeting-parse rules hold.\n')
