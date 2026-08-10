/**
 * KEYS THE i18n AUDIT CANNOT SEE — locked.
 *
 * `pnpm i18n` reports "full EN/AR/RU parity, all used keys resolve". It passed
 * on every run while a live campaign page printed the raw string
 * `lm.place.verdict.noClicks` to a client, in place of a word.
 *
 * Both statements are true. The audit walks LITERAL `t('...')` calls, and these
 * families are rendered through a computed key:
 *
 *     t(`lm.place.verdict.${r.verdict}`)
 *     t(`lm.setupCheck.${f.key}`)
 *     t(`lm.geo.${f.key}`)
 *
 * Parity across three dictionaries is not the same property as coverage of the
 * values the code can actually produce. A key absent from ALL THREE languages
 * is in perfect parity and renders as itself.
 *
 * So each family below is enumerated at runtime — as a `const` array the TYPE
 * is derived from, so a new member cannot be added without appearing here —
 * and checked against every language. This is the audit for the half the audit
 * cannot reach.
 *
 * Runs in `pnpm guards`.
 */
import { PLACEMENT_VERDICTS } from '../lib/freehold/placement-audit'
import { lm_ads } from '../lib/i18n/dictionaries/lm_ads'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const LOCALES = ['en', 'ar', 'ru'] as const

/** Every key the code can compute, checked in every language. */
function family(label: string, prefix: string, members: readonly string[]) {
  const missing: string[] = []
  for (const locale of LOCALES) {
    for (const m of members) {
      const key = `${prefix}${m}`
      const value = lm_ads[locale][key]
      // Present but empty is the same failure with a quieter symptom.
      if (typeof value !== 'string' || value.trim() === '') missing.push(`${locale}:${key}`)
    }
  }
  check(`${label} — all ${members.length} values have words in all three languages`,
    missing.length === 0, missing.join(', '))

  // A value that merely echoes its own key is what the screen was showing.
  const echoes = LOCALES.flatMap((l) => members
    .filter((m) => lm_ads[l][`${prefix}${m}`] === `${prefix}${m}`)
    .map((m) => `${l}:${prefix}${m}`))
  check(`${label} — none of them renders as its own key`, echoes.length === 0, echoes.join(', '))
}

console.log('\n── placement verdicts ──')
{
  // The exact family that broke, and the exact member that broke it.
  check('the verdict list is enumerable at runtime, not only a type',
    Array.isArray(PLACEMENT_VERDICTS) && PLACEMENT_VERDICTS.length > 0)
  check('…and it contains the click verdict that shipped without a word',
    (PLACEMENT_VERDICTS as readonly string[]).includes('noClicks'))
  family('lm.place.verdict', 'lm.place.verdict.', PLACEMENT_VERDICTS)
}

console.log('\n── setup-check findings ──')
{
  // Not derived from a type: `checkCampaignSetup` builds these keys as string
  // literals at each push site. Listed here so adding a finding without a word
  // fails the build rather than reaching a client.
  const SETUP_KEYS = [
    'noAdSets', 'adSetPaused', 'noAds', 'noLiveAd', 'noTargeting',
    'noPlace', 'place', 'manyCountries', 'visitors', 'residents',
    'noProperty', 'property', 'expansion', 'youngAge', 'age',
    'anyPlacement', 'offPlatform', 'loosePlacement', 'placements',
    'softGoal', 'noBudget', 'capped', 'capChoking',
  ]
  family('lm.setupCheck', 'lm.setupCheck.', SETUP_KEYS)
}

console.log('\n── geo delivery findings ──')
{
  family('lm.geo', 'lm.geo.', ['onTarget', 'strayed'])
}

if (failures > 0) {
  console.error(`\n${failures} computed-key rule(s) broken.`)
  process.exit(1)
}
console.log('\nEvery key the code can build has a word behind it.\n')
