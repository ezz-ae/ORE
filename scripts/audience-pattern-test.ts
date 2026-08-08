/**
 * The pattern kitchen, locked.
 *
 * A pattern is a description of a PERSON — Levantine family, upgrading, cash,
 * ready — and this module turns it into real Meta targeting that the person
 * ordering never sees. Two things have to hold or the whole idea collapses:
 *
 *  1. THE TRANSLATION MUST BE REAL. If "cash buyer, ready to move" produces
 *     the same ad set as "browsing, unknown money", the vocabulary is theatre
 *     and the operator is picking words that do nothing.
 *  2. IT MUST NEVER LEAK. The describe-to-a-human sentence says WHO, and must
 *     never contain an interest id, a behaviour name or the word "narrowing".
 *
 * The language bundles are the third: nationality is not a Meta field and
 * every product that sells it is selling a proxy stack. Locales are exact.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import {
  planPattern, describePattern, emptyPattern, parsePattern, BUNDLE,
  STRICT_ALL, STRICT_DEFINING, type AudiencePattern,
} from '../lib/freehold/audience-pattern'
import { forClient } from '../lib/freehold/audiences'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const pat = (o: Partial<AudiencePattern>): AudiencePattern => ({ ...emptyPattern('P'), ...o })

console.log('\n── language, not nationality ──')
{
  const p = planPattern(pat({ speakers: ['arabic'] }))
  check('an Arabic bundle reaches Arabic AND Urdu speakers',
    p.targeting.leadLanguages?.sort().join(',') === 'ar,ur',
    String(p.targeting.leadLanguages))
  check('English reaches English and Spanish',
    planPattern(pat({ speakers: ['english'] })).targeting.leadLanguages?.sort().join(',') === 'en,es')
  check('European reaches Russian, German, French and Italian',
    planPattern(pat({ speakers: ['european'] })).targeting.leadLanguages?.sort().join(',') === 'de,fr,it,ru',
    String(planPattern(pat({ speakers: ['european'] })).targeting.leadLanguages))

  const both = planPattern(pat({ speakers: ['arabic', 'english'] }))
  check('two bundles union without duplicating',
    both.targeting.leadLanguages?.sort().join(',') === 'ar,en,es,ur',
    String(both.targeting.leadLanguages))

  // The point of choosing language: it buys LOCALES, not a guess-stack of
  // interests standing in for a nationality.
  check('a bundle adds no interests at all — it is exact, not inferred',
    both.targeting.interests.length === 0 && (both.targeting.narrowing ?? []).length === 0,
    JSON.stringify({ i: both.targeting.interests.length, n: both.targeting.narrowing?.length }))
  check('every bundle names the language its creative is written in',
    Object.values(BUNDLE).every((b) => typeof b.creative === 'string' && b.creative.length === 2))
  check('no bundle reaches a language it does not also declare',
    Object.values(BUNDLE).every((b) => !b.alsoReach.includes(b.creative)))
}

console.log('\n── the strictness dial actually moves something ──')
{
  const traits = pat({ motive: ['investment', 'first_home'], money: 'cash', lifeStage: ['young_family'] })

  const loose = planPattern({ ...traits, strictness: 0 })
  const mid = planPattern({ ...traits, strictness: 50 })
  const tight = planPattern({ ...traits, strictness: 100 })

  check('at 0 nothing binds — every trait is a hint',
    loose.boundTraits === 0 && loose.hintedTraits > 0,
    `${loose.boundTraits}/${loose.hintedTraits}`)
  check('at 50 the defining traits bind and the rest lean',
    mid.boundTraits > 0 && mid.hintedTraits > 0, `${mid.boundTraits}/${mid.hintedTraits}`)
  check('at 100 everything binds', tight.hintedTraits === 0 && tight.boundTraits > 0,
    `${tight.boundTraits}/${tight.hintedTraits}`)
  check('binding produces AND-narrowing groups, hinting produces base interests',
    (tight.targeting.narrowing ?? []).length > 0 && tight.targeting.interests.length === 0)
  check('…and the loose end is the mirror image',
    (loose.targeting.narrowing ?? []).length === 0 && loose.targeting.interests.length > 0)
  check('the dial is monotonic — more strictness never binds fewer traits',
    loose.boundTraits <= mid.boundTraits && mid.boundTraits <= tight.boundTraits,
    `${loose.boundTraits} ${mid.boundTraits} ${tight.boundTraits}`)
  check('the thresholds are the documented ones', STRICT_DEFINING === 30 && STRICT_ALL === 75)
}

console.log('\n── the vocabulary is not theatre ──')
{
  // Two genuinely different people must produce genuinely different targeting.
  const investor = planPattern(pat({ motive: ['investment'], money: 'cash', strictness: 80 }))
  const firstHome = planPattern(pat({ motive: ['first_home'], money: 'mortgage', strictness: 80 }))
  check('a cash investor and a mortgaged first-home buyer differ',
    JSON.stringify(investor.targeting) !== JSON.stringify(firstHome.targeting))
  check('…and their age bands differ',
    investor.targeting.ageMin !== firstHome.targeting.ageMin ||
    investor.targeting.ageMax !== firstHome.targeting.ageMax,
    `${investor.targeting.ageMin}-${investor.targeting.ageMax} vs ${firstHome.targeting.ageMin}-${firstHome.targeting.ageMax}`)

  // Residency is geography and geography is never a preference.
  check('overseas buyers get overseas countries',
    planPattern(pat({ residency: ['overseas'] })).targeting.countries.length > 1)
  check('GCC includes the Gulf, not just the UAE',
    planPattern(pat({ residency: ['gcc'] })).targeting.countries.includes('SA'))
  check('a pattern with no residency still targets somewhere real',
    planPattern(pat({})).targeting.countries.join(',') === 'AE')
}

console.log('\n── age intersects, never widens ──')
{
  // A young family (30-45) who is downsizing (50-65) is nobody. The band must
  // not quietly widen to 30-65 and pretend it found them.
  const contradiction = planPattern(pat({ lifeStage: ['young_family', 'downsizing'], strictness: 100 }))
  check('contradictory life stages do not produce a wide band',
    contradiction.targeting.ageMax - contradiction.targeting.ageMin <= 10,
    `${contradiction.targeting.ageMin}-${contradiction.targeting.ageMax}`)
  check('…and never an inverted one Meta would reject',
    contradiction.targeting.ageMin < contradiction.targeting.ageMax)

  const single = planPattern(pat({ lifeStage: ['single'] }))
  check('a single trait keeps its own band', single.targeting.ageMax === 34, String(single.targeting.ageMax))
  const cashSingle = planPattern(pat({ lifeStage: ['single'], money: 'cash' }))
  check('adding cash raises the floor rather than widening',
    cashSingle.targeting.ageMin >= single.targeting.ageMin,
    `${single.targeting.ageMin} -> ${cashSingle.targeting.ageMin}`)
}

console.log('\n── exclusions are behavioural, never demographic ──')
{
  const p = planPattern(pat({ exclude: ['agents_and_brokers', 'job_seekers'] }))
  check('the exclusions land in the spec',
    (p.targeting.exclusions?.interests ?? []).length === 2, JSON.stringify(p.targeting.exclusions))
  check('no exclusion is present when none was asked for',
    planPattern(pat({})).targeting.exclusions === undefined)
  // The whole point: nothing in the vocabulary can exclude by who someone is.
  check('no language or origin can be excluded — the type system forbids it',
    !JSON.stringify(planPattern(pat({ speakers: ['arabic'], exclude: ['job_seekers'] })).targeting.exclusions ?? {})
      .toLowerCase().includes('arab'))
}

console.log('\n── the kitchen never leaks ──')
{
  const p = pat({
    speakers: ['arabic'], residency: ['expat'], lifeStage: ['young_family'],
    motive: ['upgrade'], money: 'mortgage', readiness: 'ready', strictness: 60,
  })
  const sentence = describePattern(p)
  const leaks = ['interest', 'behavior', 'behaviour', 'narrowing', 'flexible', 'lookalike', 'locale', '600', 'meta']
  check('the description contains no platform vocabulary',
    !leaks.some((w) => sentence.toLowerCase().includes(w)), sentence)
  check('…and no id', !/\d{6,}/.test(sentence), sentence)
  check('…and it reads as a person', /Arabic speakers/.test(sentence) && /young family/.test(sentence), sentence)
  check('an empty pattern says so plainly rather than describing nobody',
    /no traits chosen yet/.test(describePattern(emptyPattern())), describePattern(emptyPattern()))
}

console.log('\n── the plan is always launchable ──')
{
  for (const s of [0, 25, 50, 75, 100]) {
    const p = planPattern(pat({
      speakers: ['arabic', 'european'], residency: ['gcc'], motive: ['investment', 'golden_visa'],
      lifeStage: ['established_family'], money: 'cash', exclude: ['agents_and_brokers'], strictness: s,
    }))
    const t = p.targeting
    if (t.countries.length === 0) { fail('every plan has a country', String(s)); break }
    if (t.ageMin < 18 || t.ageMax > 65 || t.ageMin >= t.ageMax) { fail('every plan has a legal age band', `${s}: ${t.ageMin}-${t.ageMax}`); break }
    if (t.publisherPlatforms.length === 0) { fail('every plan names its placements', String(s)); break }
  }
  ok('every strictness from 0 to 100 produces a launchable spec')
  check('placements are explicit, so no plan can enrol in Advantage',
    planPattern(pat({})).targeting.publisherPlatforms.join(',') === 'facebook,instagram')
}

console.log('\n── readiness is a temperature, not an interest ──')
{
  // Readiness was in the vocabulary, in the describing sentence, and changed
  // NOTHING in the targeting — the exact theatre this module's own header
  // forbids. Nothing in Meta's catalog knows who is ready to buy; what it
  // changes is which arm the pattern belongs in.
  const browsing = planPattern(pat({ readiness: 'browsing' }))
  const ready = planPattern(pat({ readiness: 'ready' }))
  check('browsing is a cold, prospecting audience',
    browsing.temperature === 'cold' && !browsing.needsRetargetingSource, browsing.temperature)
  check('ready is hot and says so', ready.temperature === 'hot', ready.temperature)
  check('a hot pattern declares it cannot launch on targeting alone',
    ready.needsRetargetingSource === true)
  check('comparing sits between them', planPattern(pat({ readiness: 'comparing' })).temperature === 'warm')
  check('readiness still adds no invented interest — it is honest about not knowing',
    ready.targeting.interests.length === browsing.targeting.interests.length &&
    (ready.targeting.narrowing ?? []).length === (browsing.targeting.narrowing ?? []).length)
}

console.log('\n── a bundle with no landing page is named, not dropped in silence ──')
{
  // An ad has to be WRITTEN in something we can publish. Dropping a bundle is
  // correct; dropping it quietly is the failure — the operator chose it and
  // would never learn it did not survive.
  const noArabicPage = planPattern(pat({ speakers: ['arabic', 'english'] }), ['en', 'ru'])
  check('a bundle we cannot write an ad for is removed',
    !(noArabicPage.targeting.leadLanguages ?? []).includes('ar'),
    String(noArabicPage.targeting.leadLanguages))
  check('…and it takes its second-half speakers with it, not leaving them stranded',
    !(noArabicPage.targeting.leadLanguages ?? []).includes('ur'),
    String(noArabicPage.targeting.leadLanguages))
  check('…and the operator is told which one went',
    noArabicPage.unreachable.join(',') === 'Arabic speakers', noArabicPage.unreachable.join(','))
  check('the bundle that does have a page survives intact',
    (noArabicPage.targeting.leadLanguages ?? []).sort().join(',') === 'en,es',
    String(noArabicPage.targeting.leadLanguages))
  check('naming no pages at all constrains nothing — the caller simply did not say',
    planPattern(pat({ speakers: ['arabic'] })).unreachable.length === 0)
  check('every bundle is writable against the languages this system actually serves',
    planPattern(pat({ speakers: ['arabic', 'english', 'european'] }), ['en', 'ar', 'ru']).unreachable.length === 0)
}

console.log('\n── an untrusted pattern cannot smuggle anything in ──')
{
  const junk = parsePattern({
    name: 'x'.repeat(500), residency: ['expat', 'martian', 42], speakers: 'arabic',
    motive: ['investment', 'investment'], money: 'bitcoin', readiness: null,
    exclude: ['agents_and_brokers', '../../etc/passwd'], strictness: 9999,
  })
  check('an unknown trait is dropped, never coerced to a neighbour',
    junk.residency.join(',') === 'expat', junk.residency.join(','))
  check('a non-array where a list belongs yields an empty list, not a character split',
    junk.speakers.length === 0, JSON.stringify(junk.speakers))
  check('an unknown single-choice falls back to the not-chosen state',
    junk.money === 'unknown' && junk.readiness === 'browsing')
  check('duplicates collapse', junk.motive.join(',') === 'investment')
  check('an out-of-range dial is clamped, not wrapped', junk.strictness === 100, String(junk.strictness))
  check('the name is bounded', junk.name.length === 120, String(junk.name.length))
  check('a garbage exclusion cannot reach the spec',
    planPattern(junk).targeting.exclusions?.interests?.length === 1,
    JSON.stringify(planPattern(junk).targeting.exclusions))
  check('nothing at all still parses to a usable pattern',
    parsePattern(null).strictness === 50 && parsePattern('nope').money === 'unknown')
}

console.log('\n── the recipe never crosses the wire ──')
{
  // The whole arrangement: they order the burger, they never see the kitchen.
  // Ship the spec to the browser once and it is in the network tab forever,
  // and anyone who reads it rebuilds the same audience in Ads Manager free.
  const ROUTES = [
    'app/api/freehold/ads/audiences/pattern/route.ts',
    'app/api/freehold/ads/audiences/route.ts',
    'app/api/freehold/ads/audiences/[id]/route.ts',
  ]
  const patternRoute = readFileSync(ROUTES[0], 'utf8')
  check('the pattern route never puts targeting in a response',
    !/NextResponse\.json\([^)]*targeting/.test(patternRoute), 'targeting appears in a JSON response')
  check('…and returns only the vetted public shape',
    /publicPlan/.test(patternRoute))
  check('a pattern audience is stripped before every route answers',
    ROUTES.every((f) => /forClient/.test(readFileSync(f, 'utf8'))),
    ROUTES.filter((f) => !/forClient/.test(readFileSync(f, 'utf8'))).join(','))

  // forClient is the single chokepoint, so it is worth proving rather than
  // trusting: a pattern loses its spec, a hand-built audience keeps its own.
  const base = {
    id: 'a', name: 'n', description: 'd', spec: { countries: ['AE'] } as never,
    metaSourceAudienceId: null, metaLookalikeId: null, uploadedCount: 0,
    pattern: null, createdBy: 'e', createdAt: '', updatedAt: '',
  }
  check('a pattern audience goes out without its spec',
    forClient({ ...base, kind: 'pattern' }).spec === undefined)
  check('an audience someone built by hand keeps the work they typed',
    forClient({ ...base, kind: 'behavioral' }).spec !== undefined)
  check('…and the pattern itself still travels, because re-opening needs it',
    'pattern' in forClient({ ...base, kind: 'pattern', pattern: { money: 'cash' } }))
}

console.log('\n── every segment carries the level it came from ──')
{
  // THE INPUT THE ARM PLANNER NEVER HAD. Levels were assigned nowhere in the
  // product, so `level-arms.ts` sat complete and unreachable. A pattern knows,
  // because the operator chose "cash" under money and "investing" under
  // why-they-are-buying — that IS the schema.
  const p = planPattern(pat({ motive: ['investment'], money: 'cash', strictness: 100 }))
  const byId = new Map(p.entityLevels.map((e) => [e.id, e.level]))
  check('a money segment lands at the money level',
    byId.get('6003193636887') === 2, String(byId.get('6003193636887')))
  check('a why-they-buy segment lands at the product level',
    byId.get('6002714398372') === 3, String(byId.get('6002714398372')))
  check('every segment in the spec has a level',
    p.entityLevels.length > 0 && p.entityLevels.every((e) => e.level >= 1 && e.level <= 5),
    JSON.stringify(p.entityLevels))
  check('a pattern with no segments assigns no levels rather than inventing one',
    planPattern(pat({ lifeStage: ['single'] })).entityLevels.length === 0)

  // "Luxury goods" stands for paying cash AND for wanting a holiday home. One
  // Meta interest doing double duty a level apart cannot make the arms either
  // side of it different, which is the one thing an arm has to do.
  const collide = planPattern(pat({ motive: ['holiday_home'], money: 'cash' }))
  check('a segment claimed by two levels takes the LOWER one — the cheaper cut first',
    collide.entityLevels.find((e) => e.id === '6003193636887')?.level === 2,
    JSON.stringify(collide.entityLevels))
  check('…and the collision is reported, never hidden',
    collide.sharedSegments.includes('Luxury goods'), JSON.stringify(collide.sharedSegments))
  check('a pattern with no collision reports none',
    planPattern(pat({ motive: ['investment'] })).sharedSegments.length === 0,
    JSON.stringify(planPattern(pat({ motive: ['investment'] })).sharedSegments))
  check('two motives sharing a segment at the SAME level is not a collision',
    planPattern(pat({ motive: ['investment', 'golden_visa'] })).sharedSegments.length === 0)
}

console.log('\n── a mass interest is a pond, not a buyer ──')
{
  // A group is an OR. "Property" in this market is close to everybody who has
  // ever looked at a listing, so putting it beside a narrow segment makes the
  // group "Property" — the narrow one is still listed, still visible in Ads
  // Manager, still discussed in the meeting, and contributing nothing. The
  // campaign looks precise, delivers to everyone, and the leads come back as
  // browsers. This is the most expensive mistake the product can make FOR
  // someone, so it is measured and said out loud.
  const browsers = planPattern(pat({ motive: ['upgrade'], strictness: 0 }))
  check('an upgrade buyer at the loose end is everyone, and says so',
    browsers.reachesEveryone === true, String(browsers.reachesEveryone))
  check('…and first-home and relocation are the same pond',
    planPattern(pat({ motive: ['first_home'], strictness: 0 })).reachesEveryone &&
    planPattern(pat({ motive: ['relocation'], strictness: 0 })).reachesEveryone)

  // Real intent segments are not mass, and neither is a bound audience.
  check('investing is a real intent segment, not a pond',
    planPattern(pat({ motive: ['investment'], strictness: 0 })).reachesEveryone === false)
  check('binding the trait stops it being everyone',
    planPattern(pat({ motive: ['upgrade'], strictness: 100 })).reachesEveryone === false)
  check('adding a real buying signal alongside stops it too',
    planPattern(pat({ motive: ['upgrade', 'investment'], strictness: 100 })).reachesEveryone === false)
  check('a pattern with no interests at all is not flagged as everyone',
    planPattern(pat({ lifeStage: ['single'] })).reachesEveryone === false)
}

console.log('\n── the pattern and the spec beside it cannot drift ──')
{
  // A stored pattern that no longer produces its stored spec shows one person
  // and launches another, and no screen can reveal the gap: the card renders
  // the pattern, the ad set uses the spec. Rederiving in the ROUTE was the
  // habit this codebase keeps repeating — an invariant applied at one call
  // site, which holds until a second caller appears. It belongs in the writer.
  const WRITER = readFileSync('lib/freehold/audiences.ts', 'utf8')
  const fn = WRITER.slice(WRITER.indexOf('export async function updateAudience'))
  check('the writer itself rederives the spec from the pattern',
    /planPattern\(/.test(fn.slice(0, 2000)), 'updateAudience does not call planPattern')
  check('…and does it for every pattern audience, not only when one was sent',
    /current\.kind === 'pattern'/.test(fn.slice(0, 2000)))
  check('a posted spec cannot override a pattern audience\'s targeting',
    /spec: planPattern\(/.test(fn.slice(0, 2000)), 'a caller-supplied spec may still win')
}

if (failures > 0) {
  console.error(`\n${failures} pattern rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll pattern rules hold.\n')
