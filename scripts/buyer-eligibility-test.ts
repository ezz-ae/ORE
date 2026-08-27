/**
 * THE BUYER'S ANSWER SURVIVES THE SYNC, AND NEVER REACHES THE TARGETING — locked.
 *
 * `buildEligibilityPreset` asks who can complete a purchase on restricted
 * stock, and the sync used to throw the answer away — extracted by nothing,
 * the broker asking it again on the phone. These assertions defend the two
 * properties that make keeping it safe:
 *
 *   · classification is exact across every shape the wire can carry, and an
 *     unreadable answer is NULL, never 'other' — misfiling the unknown as
 *     ineligible is the platform-inference failure the question replaced;
 *   · the stored answer routes and informs, and is structurally barred from
 *     the targeting layer. Nationality does not narrow an audience here
 *     (CLAUDE.md, with history), and a self-declared answer does not soften
 *     that rule.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  classifyEligibility, eligibilityFromFields,
  BUYER_ELIGIBILITIES, ELIGIBILITY_FIELD_KEY,
} from '../lib/freehold/buyer-eligibility'
import { buildEligibilityPreset } from '../lib/meta/form-templates'
import { p_forms } from '../lib/i18n/dictionaries/p_forms'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── every shape the wire can carry ──')
{
  // The English slugs Meta derives from the labels.
  check('the English slug values classify',
    classifyEligibility('uae_or_gcc_national') === 'gcc' &&
    classifyEligibility('other_nationality') === 'other' &&
    classifyEligibility('not_sure_please_advise_me') === 'unsure')

  // The positional fallbacks an Arabic or Russian form produces — the slugger
  // strips non-[a-z0-9], so a non-Latin label slugs to nothing and the options
  // become opt_1..3 in the order the preset states them.
  check('the positional opt_N values classify in the preset\'s order',
    classifyEligibility('opt_1') === 'gcc' &&
    classifyEligibility('opt_2') === 'other' &&
    classifyEligibility('opt_3') === 'unsure')

  // The display labels, exactly as each dictionary writes them — some Graph
  // paths return the label rather than the value.
  for (const locale of ['en', 'ar', 'ru'] as const) {
    const d = p_forms[locale]
    check(`${locale}: the live dictionary labels classify — a reworded label cannot silently stop`,
      classifyEligibility(d['pforms.eligibility.gcc']) === 'gcc' &&
      classifyEligibility(d['pforms.eligibility.other']) === 'other' &&
      classifyEligibility(d['pforms.eligibility.unsure']) === 'unsure',
      [d['pforms.eligibility.gcc'], d['pforms.eligibility.other'], d['pforms.eligibility.unsure']].join(' | '))
  }
  check('case and whitespace do not matter',
    classifyEligibility('  UAE OR GCC NATIONAL ') === 'gcc')
}

console.log('\n── an unknown is null, never a verdict ──')
{
  check('an empty answer is null', classifyEligibility('') === null && classifyEligibility('   ') === null)
  check('a missing answer is null', classifyEligibility(null) === null && classifyEligibility(undefined) === null)
  check('an unrelated answer is null, NEVER other',
    classifyEligibility('yes please call me') === null &&
    classifyEligibility('AED 2M') === null)
  check('a stray opt_4 from an edited form is null, not guessed',
    classifyEligibility('opt_4') === null)
}

console.log('\n── the answer is read from its own question only ──')
{
  const f = (name: string, v: string) => ({ name, values: [v] })
  check('matched by the question key', eligibilityFromFields([
    f('full_name', 'Ahmed'), f(ELIGIBILITY_FIELD_KEY, 'opt_1'),
  ]) === 'gcc')
  check('a normalized variant of the key still matches',
    eligibilityFromFields([f('Ownership-Eligibility', 'opt_2')]) === 'other')
  // The trap: a free-text answer that happens to contain "gcc" must not stamp
  // a citizenship answer the person never gave.
  check('a gcc-flavoured answer under ANOTHER key is ignored',
    eligibilityFromFields([f('message', 'I want a GCC compliant unit')]) === null)
  check('no fields is null', eligibilityFromFields([]) === null && eligibilityFromFields(null) === null)
  check('an unreadable answer under the right key is null',
    eligibilityFromFields([f(ELIGIBILITY_FIELD_KEY, 'banana')]) === null)
}

console.log('\n── the preset order is the contract the opt_N mapping rides on ──')
{
  const t = (k: string) => p_forms.en[k] ?? k
  const q = buildEligibilityPreset(t as never)
  check('the preset still asks under the stable key', q.key === ELIGIBILITY_FIELD_KEY)
  check('three options, in gcc / other / unsure order — opt_N classification depends on it',
    q.options.length === 3 &&
    q.options[0] === p_forms.en['pforms.eligibility.gcc'] &&
    q.options[1] === p_forms.en['pforms.eligibility.other'] &&
    q.options[2] === p_forms.en['pforms.eligibility.unsure'],
    q.options.join(' | '))
  check('the walkable const matches that order exactly',
    BUYER_ELIGIBILITIES.join(',') === 'gcc,other,unsure')
}

console.log('\n── the sync keeps it, and keeps it for old leads too ──')
{
  const sync = readFileSync(join(process.cwd(), 'lib/freehold/meta-lead-sync.ts'), { encoding: 'utf8' })
  check('the column exists', /buyer_eligibility text/.test(sync))
  check('the insert stores the classified answer',
    /eligibilityFromFields\(lead\.field_data\)/.test(sync) && /buyer_eligibility/.test(sync))
  check('the sweep backfills leads synced before the column existed',
    /SET buyer_eligibility = COALESCE\(buyer_eligibility, \$2\)/.test(sync))
  check('…and classified once is never overwritten by a later blank',
    /buyer_eligibility IS NULL/.test(sync))

  const page = readFileSync(join(process.cwd(), 'app/freehold-intelligence/crm/leads/[id]/page.tsx'), { encoding: 'utf8' })
  check('the broker sees it before the first call', /crm\.eligibility\./.test(page))
  check('…labelled as the buyer\'s own answer', /crm\.eligibilitySource/.test(page))
}

console.log('\n── and the targeting layer is structurally blind to it ──')
{
  // Not a code review — a structural scan. Every file that builds or parses a
  // CampaignTargeting, plus the audience layers, must not carry this module's
  // symbols. The day one does, this fails and the PR explains itself.
  const FORBIDDEN = [
    'lib/meta/client.ts', 'lib/meta/targeting-parse.ts', 'lib/meta/targeting-catalog.ts',
    'lib/meta/campaign-structure.ts', 'lib/meta/geo-spec.ts',
    'lib/freehold/audience-pattern.ts', 'lib/freehold/local-audiences.ts',
    'lib/freehold/persona-audience.ts', 'lib/freehold/audiences.ts',
    'lib/freehold/rating-audiences.ts', 'lib/freehold/crm-exclusion.ts',
    'lib/freehold/audience-weight.ts',
  ]
  for (const file of FORBIDDEN) {
    const src = readFileSync(join(process.cwd(), file), { encoding: 'utf8' })
    check(`${file} never reads the eligibility answer`,
      !/buyer_eligibility|buyerEligibility|BuyerEligibility|classifyEligibility|eligibilityFromFields/.test(src))
  }
  // And nothing anywhere feeds it into a CampaignTargeting literal.
  const offenders: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      if (e.isDirectory()) { walk(join(dir, e.name)); continue }
      if (!/\.(ts|tsx)$/.test(e.name) || e.name.endsWith('.d.ts')) continue
      const p = join(dir, e.name)
      const src = readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
      if (/CampaignTargeting/.test(src) && /buyer_eligibility|buyerEligibility/.test(src)) offenders.push(p)
    }
  }
  walk('lib'); walk('app/api')
  check('no file touches both CampaignTargeting and the eligibility answer',
    offenders.length === 0, offenders.join(', '))
}

if (failures > 0) {
  console.error(`\n${failures} buyer-eligibility guard(s) broken.`)
  process.exit(1)
}
console.log('\nThe buyer answered once. The CRM remembers, and the targeting never hears.\n')
