/**
 * A saved audience's language survives being reused.
 *
 * The bug this exists to prevent has a specific shape, and it is the shape
 * this codebase keeps producing: the audience card reads "Arabic", the
 * operator attaches it, the ad set delivers to everyone, and no screen
 * anywhere says otherwise. Language is the one part of an audience definition
 * that changes WHO sees the ad without appearing in any interest list, so
 * losing it is silent by construction.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { mergeLeadLanguages, SUPPORTED_LEAD_LANGUAGES, REACHABLE_LEAD_LANGUAGES } from '../lib/meta/lead-language'
import { normalizeSpec } from '../lib/freehold/audiences'
import { BUNDLE } from '../lib/freehold/audience-pattern'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

console.log('\n── merging the two language sources ──')
{
  // THE REGRESSION. Wizard picked nothing; the attached audience is Arabic.
  check('an attached audience\'s language is not dropped when the wizard is silent',
    eq(mergeLeadLanguages(undefined, ['ar']), ['ar']), JSON.stringify(mergeLeadLanguages(undefined, ['ar'])))
  check('the wizard\'s own choice still works with no audience attached',
    eq(mergeLeadLanguages(['ar'], undefined), ['ar']))
  check('both sources union rather than intersect',
    eq(mergeLeadLanguages(['en'], ['ar']), ['en', 'ar']), JSON.stringify(mergeLeadLanguages(['en'], ['ar'])))
  check('the same language from both sides appears once',
    eq(mergeLeadLanguages(['ar'], ['ar']), ['ar']))
  check('nothing anywhere means narrow nothing', eq(mergeLeadLanguages(undefined, undefined), []))
  check('an empty array is not a narrowing', eq(mergeLeadLanguages([], []), []))
}

console.log('\n── reach is wider than the language the ad is written in ──')
{
  // TWO DIFFERENT QUESTIONS, and answering them with one list threw away most
  // of the reach. What the ad is WRITTEN in needs a landing page: en, ar, ru.
  // Who can be SHOWN it does not — an Urdu speaker in Dubai reads the Arabic
  // ad and lands on the Arabic page. Validating reach against the three page
  // languages deleted ur/es/de/fr/it on the way to Meta, so a bundle sold as
  // "Arabic and Urdu speakers" delivered Arabic-only and every screen lied.
  check('a language a bundle reaches survives the merge',
    eq(mergeLeadLanguages(['ar', 'ur']), ['ar', 'ur']), JSON.stringify(mergeLeadLanguages(['ar', 'ur'])))
  check('…including the European bundle\'s second half',
    eq(mergeLeadLanguages(['ru', 'de', 'fr', 'it']), ['ru', 'de', 'fr', 'it']),
    JSON.stringify(mergeLeadLanguages(['ru', 'de', 'fr', 'it'])))
  check('a language nothing reaches is still dropped, not passed to Meta',
    eq(mergeLeadLanguages(['zh', 'ar', 'ja']), ['ar']), JSON.stringify(mergeLeadLanguages(['zh', 'ar', 'ja'])))
  check('junk types cannot become a locale',
    eq(mergeLeadLanguages([null, 42, {}, 'ar'] as unknown[]), ['ar']))
  check('a non-array source is ignored rather than throwing',
    eq(mergeLeadLanguages('ar' as unknown as string[]), []))
  check('every creative language is reachable — an ad we can write must be deliverable',
    SUPPORTED_LEAD_LANGUAGES.every((c) => (REACHABLE_LEAD_LANGUAGES as readonly string[]).includes(c)),
    SUPPORTED_LEAD_LANGUAGES.join(','))

  // Every bundle's promise, end to end. This is the assertion that would have
  // caught the original bug: the pattern module said "ar,ur", the merge said
  // "ar", and nothing compared the two.
  for (const [name, b] of Object.entries(BUNDLE)) {
    const promised = [b.creative, ...b.alsoReach]
    check(`the ${name} bundle delivers every language it promises`,
      promised.every((c) => mergeLeadLanguages(promised).includes(c as never)),
      `${promised.join(',')} -> ${mergeLeadLanguages(promised).join(',')}`)
  }
}

console.log('\n── a reachable language resolves to a real Meta locale ──')
{
  // A code the resolver has no search term for silently narrows NOTHING for
  // that language — the exact failure again, one layer lower. The table and
  // the reach list have to stay in step, so the suite compares them.
  const CLIENT = readFileSync('lib/meta/client.ts', 'utf8')
  const table = /const LEAD_LANGUAGE_SEARCH_TERMS[^=]*=\s*\{([^}]*)\}/.exec(CLIENT)?.[1] ?? ''
  const missing = REACHABLE_LEAD_LANGUAGES.filter((c) => !new RegExp(`\\b${c}:`).test(table))
  check('every reachable language has a locale search term', missing.length === 0, missing.join(','))
}

console.log('\n── the order is stable ──')
{
  // Two launches with the same intent must produce byte-identical targeting;
  // an ad set diff should reflect a real change, never Set iteration order.
  check('order does not depend on which source supplied which language',
    eq(mergeLeadLanguages(['ru', 'ar']), mergeLeadLanguages(['ar', 'ru'])),
    `${JSON.stringify(mergeLeadLanguages(['ru', 'ar']))} vs ${JSON.stringify(mergeLeadLanguages(['ar', 'ru']))}`)
  check('…or on the order they were listed in',
    eq(mergeLeadLanguages(['ru'], ['en'], ['ar']), ['en', 'ar', 'ru']))
}

console.log('\n── a saved spec round-trips its language ──')
{
  const saved = normalizeSpec({ countries: ['AE'], interests: [], leadLanguages: ['ar'] })
  check('an Arabic audience stays Arabic through normalisation',
    eq(saved.leadLanguages, ['ar']), JSON.stringify(saved.leadLanguages))
  const none = normalizeSpec({ countries: ['AE'], interests: [] })
  check('an audience with no language does not gain one',
    none.leadLanguages === undefined, JSON.stringify(none.leadLanguages))
  const junk = normalizeSpec({ countries: ['AE'], interests: [], leadLanguages: ['ar', 'ar', 'xx', 7] })
  check('duplicates collapse and junk is dropped on the way in',
    eq(junk.leadLanguages, ['ar']), JSON.stringify(junk.leadLanguages))
  check('a language cannot arrive as a bare string',
    normalizeSpec({ leadLanguages: 'ar' }).leadLanguages === undefined)

  // The full path, end to end: saved audience → launch merge.
  check('a saved Arabic audience narrows the launch',
    eq(mergeLeadLanguages(undefined, saved.leadLanguages), ['ar']))
  check('a saved audience with no language narrows nothing',
    eq(mergeLeadLanguages(undefined, none.leadLanguages), []))
}

console.log('\n── asked for and not applied is a refusal ──')
{
  // THE FAILURE THAT COST A CLIENT'S TRUST. Someone chose Arabic-speaking
  // buyers, the locale lookup came back empty — Meta unreachable, rate
  // limited, a token without ads scope — and the ad set launched reaching
  // EVERYONE while every screen still said Arabic. Unnarrowed is not a
  // smaller version of what was asked for; it is a different campaign, so it
  // must not launch at all.
  const CLIENT = readFileSync('lib/meta/client.ts', 'utf8')
  const launch = CLIENT.slice(CLIENT.indexOf('const languageCodes = mergeLeadLanguages'))
    .slice(0, 2200)
  check('a launch that cannot apply the requested languages is refused',
    /languageCodes\.length > 0 && leadLanguageLocales\.length === 0/.test(launch),
    'an unresolved language still launches unnarrowed')
  check('…by throwing, not by logging and carrying on',
    /throw new MetaConfigError/.test(launch), 'the failure is not fatal')
  check('…and the message names the languages that were asked for',
    /languageCodes\.join/.test(launch), 'the operator cannot tell what was lost')
  check('…and says what it would otherwise have spent the budget on',
    /everyone/i.test(launch), 'the consequence is not stated')
  check('no language selected still launches — this only guards a REQUEST',
    /languageCodes\.length > 0 &&/.test(launch),
    'a campaign with no language narrowing would be blocked too')
}

console.log('\n── an audience is named for what it targets, never for a nationality ──')
{
  // THE RULE, WITH ITS HISTORY. Targeting narrows by LANGUAGE and BEHAVIOUR,
  // never by nationality or origin — language is a real Meta field and the
  // only honest reason to narrow; nationality is not a field at all, only a
  // proxy stack that is wrong at the edges. See lib/freehold/audience-pattern.ts.
  //
  // The rule held in the SPECS and broke in the LABELS. Two ready-buyer cards
  // read "Local Emirati investor" over a pattern of `speakers: ['arabic'],
  // residency: ['resident']` — a language and a place of residence, with no
  // nationality expressible anywhere in it. That is two faults at once: the
  // card described an audience the system does not build, and it taught the
  // reader that nationality is a thing this product targets on.
  //
  // A label is not decoration here. It is what an operator picks from, and
  // what they will ask for more of next month.
  const dict = readFileSync('lib/i18n/dictionaries/lm_audiences.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  // Demonyms for the nationalities this market is tempted to name. A country
  // as a PLACE is legitimate — "Saudi investor" over a Saudi-Arabia geo is a
  // statement about where somebody lives, which Meta does target — so only
  // the ready-buyer NAME keys are scanned, and only for words that describe a
  // person's origin rather than their address.
  const FORBIDDEN = ['emirati', 'khaleeji', 'gcc national', 'expatriate of', 'nationality']
  const nameLines = dict.split('\n').filter((l) => /'lm\.aud\.ready\.[a-zA-Z]+\.name'/.test(l))
  check('there are ready-buyer names to check at all', nameLines.length > 0, String(nameLines.length))
  for (const word of FORBIDDEN) {
    const hit = nameLines.find((l) => l.toLowerCase().includes(word))
    check(`no ready-buyer card is named "${word}"`, !hit,
      (hit ?? '').trim() + ' — this names an origin the targeting cannot and must not use')
  }

  // …and the specs behind them still carry no such field, which is what makes
  // the labels checkable in the first place.
  const buyers = readFileSync('lib/freehold/ready-buyers.ts', 'utf8')
  check('no ready-buyer pattern carries a nationality field',
    !/nationality|citizenship|ethnicity|origin:/i.test(buyers),
    'a nationality reached the targeting spec itself')
}

if (failures > 0) {
  console.error(`\n${failures} audience-language rule(s) broken.`)
  console.error('An audience named for an origin teaches the reader we target on one.')
  process.exit(1)
}
console.log('\nAll audience-language rules hold.\n')
