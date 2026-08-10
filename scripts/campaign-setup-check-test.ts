/**
 * The setup check, locked.
 *
 * This reads a LIVE campaign — what Meta holds right now, not what the
 * launcher meant to send — and says whether the money is pointed where someone
 * meant to point it. Two rules govern it, and both are easy to break later:
 *
 *   1. A "wrong" must be really wrong. A false alarm on a correct campaign is
 *      what the overlap panel already did to us in front of the client.
 *   2. Silence must be impossible where it matters. An ad set with no live ad,
 *      no property signal, or Audience Network switched on looks perfectly
 *      healthy from the campaign row above it. Those are exactly the ones the
 *      check exists to surface.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { checkCampaignSetup, setupProblemCount, surfaceLabels, type AdSetForCheck } from '../lib/freehold/campaign-setup-check'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const CAMPAIGN = { id: 'c1', name: 'Dubai · Arabic investors', status: 'ACTIVE' }

/** A correctly built ad set, exactly as this product launches one. */
const good: AdSetForCheck = {
  id: 'a1',
  name: 'Instagram Feed',
  status: 'ACTIVE',
  daily_budget: '20000',
  optimization_goal: 'LEAD_GENERATION',
  ads: [{ id: 'ad1', status: 'ACTIVE', effective_status: 'ACTIVE' }],
  targeting: {
    // `location_types` is part of what "correctly built" MEANS now. Omitting it
    // is not neutral — Meta's default is home + recent, so an ad set without it
    // is buying tourists, and this fixture would have been asserting that the
    // product's own output raises nothing while doing exactly that.
    geo_locations: { countries: ['AE'], location_types: ['home'] },
    age_min: 30, age_max: 65,
    publisher_platforms: ['instagram'],
    instagram_positions: ['stream'],
    narrowing: [{ interests: [{ id: '1', name: 'Property' }, { id: '2', name: 'Real estate investing' }] }],
  },
}
const at = (over: Partial<AdSetForCheck>, targeting?: Record<string, unknown>): AdSetForCheck => ({
  ...good, ...over, targeting: targeting ?? good.targeting,
})
const keys = (f: ReturnType<typeof checkCampaignSetup>) => f.map((x) => `${x.level}:${x.key}`)

console.log('\n── a correct campaign raises nothing ──')
{
  const f = checkCampaignSetup(CAMPAIGN, [good])
  check('no problems on a properly built ad set', setupProblemCount(f) === 0, keys(f).join(' | '))
  check('…and it still reports what IS set, so the screen is not empty',
    f.some((x) => x.key === 'place') && f.some((x) => x.key === 'property') && f.some((x) => x.key === 'placements'),
    keys(f).join(' | '))
  check('the placements read as real names, not codes',
    f.find((x) => x.key === 'placements')?.vars?.where === 'Instagram Feed',
    String(f.find((x) => x.key === 'placements')?.vars?.where))
}

console.log('\n── money going somewhere nobody chose ──')
{
  const offPlatform = at({ id: 'a2' }, { ...good.targeting, publisher_platforms: ['facebook', 'audience_network'], facebook_positions: ['feed'] })
  check('Audience Network is called out',
    keys(checkCampaignSetup(CAMPAIGN, [offPlatform])).includes('wrong:offPlatform'))

  const noPlacement = at({ id: 'a3' }, { ...good.targeting, publisher_platforms: [], instagram_positions: [] })
  check('no placement list at all is wrong — that is Meta choosing',
    keys(checkCampaignSetup(CAMPAIGN, [noPlacement])).includes('wrong:anyPlacement'))

  const loose = at({ id: 'a4' }, { geo_locations: { countries: ['AE'] }, age_min: 30, age_max: 65, publisher_platforms: ['instagram'], narrowing: good.targeting!.narrowing })
  check('a platform with no surfaces named is flagged, not silently accepted',
    keys(checkCampaignSetup(CAMPAIGN, [loose])).includes('watch:loosePlacement'))

  const expanded = at({ id: 'a5' }, { ...good.targeting, targeting_automation: { advantage_audience: 1 } })
  check('Meta expanding past the chosen audience is wrong',
    keys(checkCampaignSetup(CAMPAIGN, [expanded])).includes('wrong:expansion'))
  const notExpanded = at({ id: 'a6' }, { ...good.targeting, targeting_automation: { advantage_audience: 0 } })
  check('…and the opt-out is not mistaken for it',
    !keys(checkCampaignSetup(CAMPAIGN, [notExpanded])).includes('wrong:expansion'))
}

console.log('\n── the one rule: these people must be interested in property ──')
{
  const noProperty = at({ id: 'a7' }, {
    ...good.targeting,
    narrowing: [{ interests: [{ id: '9', name: 'Luxury goods' }] }],
  })
  check('an audience with no property signal anywhere is wrong',
    keys(checkCampaignSetup(CAMPAIGN, [noProperty])).includes('wrong:noProperty'))

  // The anchor lives in the AND-layer, not the base list — reading only
  // `interests` would call every audience this product builds broken.
  const inNarrowing = at({ id: 'a8' }, {
    ...good.targeting,
    interests: [{ id: '9', name: 'Luxury goods' }],
    narrowing: [{ interests: [{ id: '1', name: 'Property' }] }],
  })
  check('the anchor counts wherever it sits in the spec',
    !keys(checkCampaignSetup(CAMPAIGN, [inNarrowing])).includes('wrong:noProperty'))

  const behaviour = at({ id: 'a9' }, {
    ...good.targeting,
    narrowing: [{ behaviors: [{ id: '5', name: 'Likely to move into a new apartment' }] }],
  })
  check('a behaviour counts too, not only an interest',
    !keys(checkCampaignSetup(CAMPAIGN, [behaviour])).includes('wrong:noProperty'))
}

console.log('\n── the campaign that looks alive and spends nothing ──')
{
  check('an ad set with no ad in it is wrong',
    keys(checkCampaignSetup(CAMPAIGN, [at({ id: 'b1', ads: [] })])).includes('wrong:noAds'))
  check('…and one whose only ad is paused is wrong too',
    keys(checkCampaignSetup(CAMPAIGN, [at({ id: 'b2', ads: [{ id: 'x', status: 'PAUSED', effective_status: 'PAUSED' }] })])).includes('wrong:noLiveAd'))
  check('a paused ad set inside a live campaign is worth saying',
    keys(checkCampaignSetup(CAMPAIGN, [at({ id: 'b3', status: 'PAUSED' })])).includes('watch:adSetPaused'))
  check('a campaign with no ad sets at all is one clear problem, not silence',
    keys(checkCampaignSetup(CAMPAIGN, [])).join('') === 'wrong:noAdSets')
}

console.log('\n── buying the wrong thing ──')
{
  check('optimising for reach on a lead campaign is wrong',
    keys(checkCampaignSetup(CAMPAIGN, [at({ id: 'c2', optimization_goal: 'REACH' })])).includes('wrong:softGoal'))
  check('no budget anywhere is wrong',
    keys(checkCampaignSetup({ ...CAMPAIGN }, [at({ id: 'c3', daily_budget: '0' })])).includes('wrong:noBudget'))
  check('…but a campaign-level budget covers its ad sets',
    !keys(checkCampaignSetup({ ...CAMPAIGN, daily_budget: '50000' }, [at({ id: 'c4', daily_budget: '0' })])).includes('wrong:noBudget'))
  check('targeting the whole world is worth a look',
    keys(checkCampaignSetup(CAMPAIGN, [at({ id: 'c5' }, { ...good.targeting, geo_locations: { countries: ['AE','IN','PK','PH','EG','JO','LB','RU','GB','FR'] } })])).includes('watch:manyCountries'))
  check('no location at all is wrong',
    keys(checkCampaignSetup(CAMPAIGN, [at({ id: 'c6' }, { ...good.targeting, geo_locations: {} })])).includes('wrong:noPlace'))
}

console.log('\n── the worst thing is read first ──')
{
  const f = checkCampaignSetup(CAMPAIGN, [good, at({ id: 'z', ads: [] })])
  check('problems sort above everything that is fine', f[0].level === 'wrong', keys(f).join(' | '))
  check('every finding names the ad set it is about', f.every((x) => !!x.adSet))
}

console.log('\n── surface names ──')
{
  check('the four surfaces this product buys read in plain words',
    surfaceLabels({ publisher_platforms: ['facebook', 'instagram'], facebook_positions: ['feed'], instagram_positions: ['stream', 'story', 'reels'] })
      .join(', ') === 'Facebook Feed, Instagram Feed, Instagram Stories, Instagram Reels',
    surfaceLabels({ publisher_platforms: ['facebook', 'instagram'], facebook_positions: ['feed'], instagram_positions: ['stream', 'story', 'reels'] }).join(', '))
  check('a surface we have no word for still shows what it is, never blank',
    surfaceLabels({ publisher_platforms: ['facebook'], facebook_positions: ['marketplace'] })[0] === 'facebook · marketplace')
}

if (failures > 0) {
  console.error(`\n${failures} setup-check rule(s) broken.`)
  process.exit(1)
}
console.log('\nA live campaign is read for what it actually is.\n')
