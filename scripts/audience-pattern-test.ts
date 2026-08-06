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
import {
  planPattern, describePattern, emptyPattern, BUNDLE,
  STRICT_ALL, STRICT_DEFINING, type AudiencePattern,
} from '../lib/freehold/audience-pattern'

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

if (failures > 0) {
  console.error(`\n${failures} pattern rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll pattern rules hold.\n')
