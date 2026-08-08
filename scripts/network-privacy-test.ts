/**
 * The shared brain must never hand one company's numbers to another.
 *
 * Every company's raw data stays its own; only aggregated dimension→outcome
 * counts are pooled, and that pool feeds everyone. The value of the network is
 * real and so is the risk: get the aggregation wrong and a competitor reads
 * your close rate off a benchmark table.
 *
 * Two things had gone wrong, and both are the same shape as every other bug
 * this codebase has produced — a guard that existed and was not applied.
 *
 *  1. The gate was `SUM(leads) >= 5`, a VOLUME threshold. A row backed by ONE
 *     company passed it. In this market a combination like (Palm Jumeirah,
 *     villa, 20M+, 45-54) is usually one specific brokerage, so its exact
 *     lead count, qualified rate and close rate reached every other tenant.
 *  2. `bucketCount` was written for exactly this, and was applied at ONE of
 *     four call sites, behind a setting that defaults off. The three that
 *     skipped it include the two that feed an LLM prompt.
 *
 * These assertions pin the SQL contract and the shape, so neither can drift
 * back without a red suite.
 *
 * Pure — no database. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { bucketCount, MIN_TENANTS_PER_BENCHMARK } from '../lib/entrestate/targeting-base'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const SRC = readFileSync('lib/entrestate/targeting-base.ts', 'utf8')
const CALLERS = [
  'lib/freehold/targeting-recommend.ts',
  'lib/freehold/coordinator-tools.ts',
  'lib/freehold/notebook-context.ts',
  'app/api/freehold/base/import/route.ts',
]

console.log('\n── a benchmark needs several companies behind it ──')
{
  check('k is at least 3 — below that a reader who knows the market can name the company',
    MIN_TENANTS_PER_BENCHMARK >= 3, String(MIN_TENANTS_PER_BENCHMARK))
  check('the query gates on DISTINCT tenants, not just on volume',
    /HAVING\s+COUNT\(DISTINCT tenant_id\)\s*>=/.test(SRC), 'no k-anonymity HAVING found')
  check('…and the volume floor is kept as well, not replaced',
    /SUM\(leads\)\s*>=\s*5/.test(SRC))
  check('the k threshold is bound as a parameter, not inlined',
    /MIN_TENANTS_PER_BENCHMARK\]/.test(SRC), 'threshold not passed as a query param')
}

console.log('\n── counts leave the brain bucketed, always ──')
{
  check('the aggregation buckets at the source',
    /leads: bucketCount\(/.test(SRC), 'raw leads still returned')
  check('no caller can opt out of masking',
    !/maskBenchmarkNumbers\s*\?/.test(SRC + CALLERS.map((f) => readFileSync(f, 'utf8')).join('')),
    'a conditional mask still exists somewhere')

  // The bucket itself must not leak the number it hides.
  check('small counts below 10 stay exact — they are already anonymous by k',
    bucketCount(4) === '4')
  check('anything larger becomes a range', bucketCount(10) === '10-24' && bucketCount(37) === '25-49')
  check('a big number does not reveal itself', bucketCount(4137) === '500+', bucketCount(4137))
  check('two different real numbers in one band are indistinguishable',
    bucketCount(101) === bucketCount(248), `${bucketCount(101)} vs ${bucketCount(248)}`)
  check('the bands never overlap and always ascend',
    [9, 10, 24, 25, 49, 50, 99, 100, 249, 250, 499, 500].map(bucketCount).join('|') ===
    '9|10-24|10-24|25-49|25-49|50-99|50-99|100-249|100-249|250-499|250-499|500+',
    [9, 10, 24, 25, 49, 50, 99, 100, 249, 250, 499, 500].map(bucketCount).join('|'))
}

console.log('\n── the raw side never crosses the line ──')
{
  // Only dimensions and outcome COUNTS are pooled. If a name, phone, email or
  // free-text payload ever reached the aggregate, the whole design is void.
  const agg = SRC.slice(SRC.indexOf('export async function getNetworkBenchmarks'))
  const forbidden = ['phone', 'email', 'name', 'payload', 'lead_date', 'campaign']
  const leaked = forbidden.filter((f) => new RegExp(`\\b${f}\\b`).test(agg.slice(0, 1200)))
  check('the cross-tenant query selects no identifying column',
    leaked.length === 0, leaked.join(','))
  check('…and no raw history table is read by it',
    !/entrestate_lead_history/.test(agg.slice(0, 1200)))
  check('the aggregate reads only the signals table',
    /FROM entrestate_targeting_signals/.test(agg.slice(0, 1200)))
}

console.log('\n── a file cannot teach the shared brain ──')
{
  // k-anonymity protects PRIVACY. It says nothing about TRUTH. An import is a
  // CLAIM about a past this system never watched — stale, guessed, or a
  // competitor's scraped list — and before this it reached every other
  // tenant's benchmarks the moment it landed. A benchmark is the one number
  // nobody goes back and re-checks.
  check('signals record where they came from',
    /origin text NOT NULL DEFAULT 'imported'/.test(SRC), 'origin is not stored')
  check('an import is recorded as a claim, not as evidence',
    /'imported'\n\s*FROM entrestate_lead_history/.test(SRC) || /-- IMPORTED/.test(SRC),
    'rebuildSignals does not mark its rows imported')
  check('the live fold is recorded as observed',
    (SRC.match(/'observed'/g) ?? []).length >= 2, 'the live folds are not marked observed')
  check('CROSS-TENANT BENCHMARKS READ ONLY WHAT WAS OBSERVED',
    /WHERE origin = 'observed'/.test(SRC),
    'an uploaded file still reaches other companies\' benchmarks')
  check('…and the k-anonymity gate is still there beside it, not replaced',
    /HAVING\s+COUNT\(DISTINCT tenant_id\)\s*>=/.test(SRC))

  // The tenant who uploaded still gets the benefit immediately — the quarantine
  // is about what crosses to OTHERS, not about withholding their own data.
  check('the imported rows are still written, so they serve their own tenant',
    /INSERT INTO entrestate_targeting_signals/.test(SRC))
}

console.log('\n── the type says what the number is ──')
{
  // Typing a bucketed range as `number` invites arithmetic on a figure that is
  // not one, and arithmetic is how a range becomes an estimate again.
  check('leads is typed as a range, not a number',
    /leads: string/.test(SRC), 'NetworkBenchmark.leads is still numeric')
}

if (failures > 0) {
  console.error(`\n${failures} network-privacy rule(s) broken.`)
  process.exit(1)
}
console.log('\nNo company can read another company off the shared brain.\n')
