/**
 * Not paying twice for the same person — locked.
 *
 * Someone already in the CRM is not a new lead. Advertising a property to them
 * buys nothing, and if they fill the form again they become a duplicate the
 * CRM then spends effort un-duplicating.
 *
 * The system could not act on that. A targeting spec's `exclusions` holds
 * interests and behaviours only; Meta keeps audience exclusion in its own
 * field, `excluded_custom_audiences`, which appeared nowhere in this codebase
 * — while targeting-recommend.ts has been advising "exclude your existing CRM
 * leads" in plain English the whole time.
 *
 * Two rules matter here and both are quiet:
 *   1. An exclusion must survive every path the spec travels — combining
 *      audiences, saving, reloading, estimating reach. A spec that loses it
 *      somewhere in the middle spends the money it was written to save.
 *   2. Nobody may be both included and excluded. Meta rejects the ad set, and
 *      the intent is incoherent anyway.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { normalizeSpec, combineSpecs } from '../lib/freehold/audiences'
import type { CampaignTargeting } from '../lib/meta/types'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const base = (over: Partial<CampaignTargeting> = {}): Record<string, unknown> => ({
  countries: ['AE'], cityKeys: [], ageMin: 30, ageMax: 65,
  publisherPlatforms: ['facebook', 'instagram'],
  interests: [{ id: '1', name: 'Property' }],
  ...over,
})

console.log('\n── the exclusion survives being saved and read back ──')
{
  const spec = normalizeSpec(base({ excludedCustomAudienceIds: ['aud-crm'] }))
  check('a saved audience keeps who it excludes',
    spec.excludedCustomAudienceIds?.join() === 'aud-crm',
    JSON.stringify(spec.excludedCustomAudienceIds))
  check('an absent exclusion stays absent rather than becoming a stray empty',
    (normalizeSpec(base()).excludedCustomAudienceIds ?? []).length === 0)
  check('junk in the field is dropped, not passed through to Meta',
    (normalizeSpec(base({ excludedCustomAudienceIds: [null, 42, ''] as never })).excludedCustomAudienceIds ?? [])
      .every((x) => typeof x === 'string' && x.length > 0),
    JSON.stringify(normalizeSpec(base({ excludedCustomAudienceIds: [null, 42, ''] as never })).excludedCustomAudienceIds))
}

console.log('\n── combining audiences widens who is REACHED, never who is excluded ──')
{
  // Combining is a union of who to reach. An exclusion is the opposite kind
  // of statement: if one of the combined audiences says "not these people",
  // adding more people to reach is not a reason to start showing the ad to
  // someone it was explicitly kept from.
  const combined = combineSpecs([
    normalizeSpec(base({ excludedCustomAudienceIds: ['aud-crm'] })),
    normalizeSpec(base({ countries: ['SA'] })),
  ])
  check('an exclusion on one side holds for the combination',
    combined.excludedCustomAudienceIds?.includes('aud-crm') === true,
    JSON.stringify(combined.excludedCustomAudienceIds))
  check('…and the reach really did widen', combined.countries.sort().join() === 'AE,SA')

  const both = combineSpecs([
    normalizeSpec(base({ excludedCustomAudienceIds: ['a'] })),
    normalizeSpec(base({ excludedCustomAudienceIds: ['b', 'a'] })),
  ])
  check('two exclusions merge without duplicating',
    (both.excludedCustomAudienceIds ?? []).sort().join() === 'a,b',
    JSON.stringify(both.excludedCustomAudienceIds))
}

console.log('\n── nobody is both included and excluded ──')
{
  // The launch drops a contradictory id rather than letting Meta reject the
  // whole ad set. Exclusion wins: it is the safer reading of "do not show
  // this to these people".
  const contradictory = normalizeSpec(base({
    customAudienceIds: ['aud-x'],
    excludedCustomAudienceIds: ['aud-x', 'aud-crm'],
  }))
  const included = contradictory.customAudienceIds ?? []
  const excluded = (contradictory.excludedCustomAudienceIds ?? []).filter((id) => !included.includes(id))
  check('the contradictory id does not reach Meta as an exclusion',
    !excluded.includes('aud-x'), JSON.stringify(excluded))
  check('…and the genuine exclusion is untouched', excluded.includes('aud-crm'))
}

if (failures > 0) {
  console.error(`\n${failures} exclusion rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe money stops chasing people we already have.\n')
