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
import { mergeLeadLanguages, SUPPORTED_LEAD_LANGUAGES } from '../lib/meta/lead-language'
import { normalizeSpec } from '../lib/freehold/audiences'

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

console.log('\n── only real, servable languages ──')
{
  check('an unsupported language is dropped, not passed to Meta',
    eq(mergeLeadLanguages(['fr', 'ar', 'zh']), ['ar']), JSON.stringify(mergeLeadLanguages(['fr', 'ar', 'zh'])))
  check('junk types cannot become a locale',
    eq(mergeLeadLanguages([null, 42, {}, 'ar'] as unknown[]), ['ar']))
  check('a non-array source is ignored rather than throwing',
    eq(mergeLeadLanguages('ar' as unknown as string[]), []))
  check('every supported language is actually supported',
    eq(mergeLeadLanguages([...SUPPORTED_LEAD_LANGUAGES]), ['en', 'ar', 'ru']))
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

if (failures > 0) {
  console.error(`\n${failures} audience-language rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll audience-language rules hold.\n')
