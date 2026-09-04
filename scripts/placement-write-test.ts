/**
 * ACCEPT MUST NOT COST MORE THAN IT SAVES — locked.
 *
 * Proposals gave the product an Accept button. The obvious way to honour one —
 * call `updateAdSet` with new targeting — would have been catastrophic, and it
 * took reading that function to see why.
 *
 * It builds the targeting object from a CampaignTargeting shape: geo, ages,
 * publisher_platforms, interests. Meta REPLACES the whole targeting object on
 * write, so everything not in that shape is deleted — flexible_spec (the
 * property qualifier), exclusions (the do-not-target audience), locales (the
 * Arabic narrowing that is doing most of the real work), the position lists,
 * and targeting_automation, whose ABSENCE Meta reads as opting IN to Advantage.
 *
 * So one press of Accept, meant to stop a placement wasting AED 200, would
 * have turned a bounded property audience into everybody with Advantage back
 * on: precisely the failure this system has spent weeks chasing, triggered by
 * the button built to fix things.
 *
 * These are the rules that stop it. Pure — no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  withoutPlacement, placementKeys, readInvariants, PLACEMENT_WRITE_REFUSALS,
  withAdvantageOff, withCustomLocations, customLocationCount, targetsWholeCountry,
} from '../lib/meta/placement-write'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** A real bounded audience: qualifier, exclusion, Arabic, Advantage off. */
const spec = (): Record<string, unknown> => ({
  geo_locations: { countries: ['AE'], location_types: ['home', 'recent'] },
  age_min: 30, age_max: 65,
  locales: [5],
  publisher_platforms: ['facebook', 'instagram'],
  facebook_positions: ['feed', 'story'],
  instagram_positions: ['stream', 'story'],
  flexible_spec: [
    { interests: [{ id: '1', name: 'Investor' }] },
    { interests: [{ id: '2', name: 'Real estate investing' }] },
  ],
  exclusions: { interests: [{ id: '9', name: 'Job seeking' }] },
  excluded_custom_audiences: [{ id: '77' }],
  targeting_automation: { advantage_audience: 0 },
})

console.log('\n── the change touches the placements and nothing else ──')
{
  const next = withoutPlacement(spec(), 'facebook:story')
  check('the dropped position is gone', !placementKeys(next!).includes('facebook:story'),
    placementKeys(next!).join(', '))
  check('…and the other positions stay', placementKeys(next!).includes('facebook:feed')
    && placementKeys(next!).includes('instagram:stream'))

  // THE WHOLE POINT. Each of these is a separate way for a placement tidy-up
  // to silently broaden the audience it was supposed to be improving.
  const before = readInvariants(spec())
  const after = readInvariants(next!)
  check('the narrowing groups survive', after.flexibleGroups === before.flexibleGroups
    && after.flexibleGroups === 2, String(after.flexibleGroups))
  check('the exclusions survive', after.hasExclusions)
  check('the language targeting survives', after.locales === 1, String(after.locales))
  check('the Advantage opt-out survives', after.advantageAudienceOff)

  // Absent is not off: a spec that loses the field entirely has opted IN.
  const stripped = { ...spec() }
  delete stripped.targeting_automation
  check('…and a spec missing the opt-out reads as NOT off',
    !readInvariants(stripped).advantageAudienceOff)
}

console.log('\n── dropping a platform\'s last position drops the platform ──')
{
  // A platform listed with no positions is the other door into Advantage+
  // placements — Meta treats "facebook, but nowhere in particular" as
  // permission to choose.
  const one = { ...spec(), facebook_positions: ['feed'] }
  const next = withoutPlacement(one, 'facebook:feed')
  check('the platform goes when its last position goes',
    !(next!.publisher_platforms as string[]).includes('facebook'),
    JSON.stringify(next!.publisher_platforms))
  check('…and no orphan position list is left behind',
    !('facebook_positions' in next!), JSON.stringify(Object.keys(next!)))
  check('…while instagram is untouched',
    placementKeys(next!).includes('instagram:stream'))
}

console.log('\n── an ad set is never left with no placements ──')
{
  // AN EMPTY PLACEMENT LIST IS NOT "NO PLACEMENTS". It is Meta's own signal to
  // pick for you, which means Audience Network — inventory this product never
  // buys. Removing the last one is refused rather than obeyed.
  const only = {
    publisher_platforms: ['instagram'], instagram_positions: ['stream'],
    targeting_automation: { advantage_audience: 0 },
  }
  check('removing the last placement is refused',
    withoutPlacement(only, 'instagram:stream') === null,
    'the ad set would be handed to Meta to place freely')
  check('…and so is removing the last platform outright',
    withoutPlacement(only, 'instagram') === null)

  // The safe version of the same request still works.
  check('removing one of two is allowed',
    withoutPlacement(spec(), 'instagram:story') !== null)
}

console.log('\n── the writer never reconstructs a targeting object ──')
{
  // The rule that makes all of the above hold in production: the spec that
  // goes back to Meta must be the spec that came from Meta, modified — not one
  // built from our own narrower type, which is what updateAdSet does.
  const client = readFileSync(join(process.cwd(), 'lib/meta/client.ts'), { encoding: 'utf8' })
  const fn = client.slice(client.indexOf('export async function dropPlacement'))
  const body = fn.slice(0, fn.indexOf('export async function getAdSet'))

  check('it reads the live targeting first',
    /fields: 'targeting'/.test(body), 'it is writing blind')
  check('…and refuses to write when the read failed',
    /reason: 'unreadable'/.test(body), 'a failed read would become a blind write')
  check('…and posts the modified live spec, not a rebuilt one',
    /apiPost\(`\/\$\{adSetId\}`, \{ targeting: next \}\)/.test(body)
      && !/updateAdSet\(/.test(body),
    'it is going through the lossy CampaignTargeting path')

  // A 200 IS NOT A CHANGE. location_types already taught this product that
  // Meta accepts requests it does not apply.
  check('it reads the ad set back afterwards',
    (body.match(/fields: 'targeting'/g) ?? []).length >= 2,
    'success is being assumed from the response code')
  check('…and reports not_applied when the placement is still there',
    /now\.includes\(drop\)/.test(body) && /reason: 'not_applied'/.test(body))
  check('…and collateral damage when something else moved',
    /reason: 'collateral_damage'/.test(body))
  check('…checking every invariant by name',
    /the narrowing groups/.test(body) && /the exclusions/.test(body)
      && /the language targeting/.test(body) && /the Advantage opt-out/.test(body))
}

console.log('\n── Accept answers with what Meta holds, not what we asked ──')
{
  const route = readFileSync(
    join(process.cwd(), 'app/api/freehold/proposals/accept/route.ts'), { encoding: 'utf8' })

  // A BUTTON THAT FILES AN INTENTION is worse than the sentence it replaced:
  // the sentence left the reader knowing there was work to do.
  check('the route performs the change', /await dropPlacement\(/.test(route),
    'Accept is recording an intention rather than doing anything')
  check('a failed write is reported as failed, never as done',
    /state: 'failed'/.test(route) && /state: 'done'/.test(route))
  check('…with the platform\'s own reason attached', /reason: outcome\.reason/.test(route))
  check('…and a 502, because the request was fine and the platform was not',
    /status: 502/.test(route))
  check('the placements returned are the ones read back from Meta',
    /placements: outcome\.placements/.test(route))

  // The evidence gate has to hold at the door too. A client that sends an
  // Accept for a `notYet` must not be obeyed just because it asked.
  check('a proposal with no Accept cannot be accepted by asking anyway',
    /kind === 'notYet'/.test(route) && /status: 409/.test(route),
    'the evidence gate is only enforced in the UI')

  // Every attempt is on the record — the failures especially.
  check('every outcome is written to the authority log',
    /await logAuthority\(/.test(route) && /FAILED to drop/.test(route))
}

console.log('\n── the refusals are walkable ──')
{
  check('every refusal reason is distinct',
    new Set(PLACEMENT_WRITE_REFUSALS).size === PLACEMENT_WRITE_REFUSALS.length)
  check('there is a reason for "we could not read it"',
    (PLACEMENT_WRITE_REFUSALS as readonly string[]).includes('unreadable'))
  check('…and for "Meta said yes and did nothing"',
    (PLACEMENT_WRITE_REFUSALS as readonly string[]).includes('not_applied'))
}


console.log('\n── the two other in-place edits ──')
{
  const live: Record<string, unknown> = {
    publisher_platforms: ['facebook', 'instagram'],
    facebook_positions: ['feed'],
    instagram_positions: ['stream'],
    flexible_spec: [{ interests: [{ id: '1', name: 'Residential real estate' }] }],
    exclusions: { interests: [{ id: '2', name: 'Real estate broker' }] },
    locales: [6],
    geo_locations: { countries: ['AE'], location_types: ['home', 'recent'] },
    targeting_automation: { advantage_audience: 1 },
  }

  // ADVANTAGE OFF IS AN EXPLICIT 0, NEVER A DELETED FIELD. Meta reads a
  // missing advantage_audience as opt-IN, so removing it is the exact
  // opposite of the change being asked for.
  const off = withAdvantageOff(live)
  check('advantage off is written as an explicit zero',
    (off.targeting_automation as Record<string, unknown>).advantage_audience === 0)
  check('…and the qualifier, exclusions and languages survive it',
    readInvariants(off).flexibleGroups === 1 && readInvariants(off).hasExclusions
    && readInvariants(off).locales === 1 && readInvariants(off).advantageAudienceOff)
  check('…and the placements are untouched',
    placementKeys(off).join(',') === placementKeys(live).join(','))

  // THE EDIT THAT WOULD LOOK FIXED AND BUY NATIONALLY. geo_locations ORs its
  // entries, so a country left beside a circle is the whole country with a
  // circle drawn on it.
  const geo = withCustomLocations(
    live,
    [{ latitude: 24.2075, longitude: 55.7447, radius: 35, distance_unit: 'kilometer' }],
    ['home', 'recent'],
  )!
  check('a radius REPLACES the country rather than joining it',
    !targetsWholeCountry(geo) && customLocationCount(geo) === 1,
    JSON.stringify(geo.geo_locations))
  check('…and the qualifier, exclusions and languages survive that too',
    readInvariants(geo).flexibleGroups === 1 && readInvariants(geo).hasExclusions
    && readInvariants(geo).locales === 1)
  check('…and so do the placements',
    placementKeys(geo).join(',') === placementKeys(live).join(','))

  // An empty geo_locations is a spec Meta rejects; refusing here gives a
  // better message than Meta's.
  check('no known places is refused rather than written',
    withCustomLocations(live, [], ['home']) === null)
}

if (failures > 0) {
  console.error(`\n${failures} placement-write rule(s) broken.`)
  console.error('An Accept that quietly rebuilds targeting undoes every audience decision on the ad set.')
  process.exit(1)
}
console.log('\nAccept changes the placement, proves it, and breaks nothing else.\n')
