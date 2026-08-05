/**
 * The figure-provenance rules, locked.
 *
 * The case that started it, verbatim from a screenshot: the chat reported
 * "Villanova (C267) — spend 11,450 AED, CPL 75.33, quality 78/100" as live
 * performance. Those campaigns do not exist. The reply that has to be
 * impossible is the one that mixes a real number with invented ones, because
 * that is the one a reader believes.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { auditFigures, significantFigures, METRIC_SHAPED, evidenceLine } from '../lib/freehold/evidence'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── what counts as a figure ──')
{
  check('commas are stripped', significantFigures('spend 11,450 AED').includes('11450'))
  check('decimals survive', significantFigures('CPL 75.33').includes('75.33'))
  check('small numbers are ignored as noise', !significantFigures('3 campaigns, rated 8').length,
    significantFigures('3 campaigns, rated 8').join(','))
  check('duplicates collapse', significantFigures('120 and 120 and 120').length === 1)
}

console.log('\n── the real incident: nothing traces back ──')
{
  const reply = 'Villanova (C267): spend 11,450 AED, CPL 75.33, quality 78/100.'
  const r = auditFigures(reply, ['{"campaigns":[]}'])
  check('verdict is fabricated', r.verdict === 'fabricated', r.verdict)
  check('every figure is ungrounded', r.ungroundedCount === r.figures.length, JSON.stringify(r.figures))
}

console.log('\n── the case the old check let through ──')
{
  // One true figure, the rest invented. The previous rule marked this
  // "verified" and shipped it.
  const reply = 'Spend was 1506 AED. CPL 75.33, quality 78, reach 44210, ROAS 312.'
  const r = auditFigures(reply, ['{"spend": 1506}'])
  check('verdict is tainted, not clean', r.verdict === 'tainted', r.verdict)
  check('the true figure is still credited', r.groundedCount >= 1, String(r.groundedCount))
  check('the invented ones are named', r.ungroundedCount >= 3, JSON.stringify(r.figures))
  check('and it is NOT clean', r.verdict !== 'clean', r.verdict)
}

console.log('\n── honest maths is not fabrication ──')
{
  // CPL computed from a real spend and a real lead count appears nowhere in
  // the tool output, and must not be treated as invented.
  const r = auditFigures('Spend 1506 AED across 20 leads — that is 75.30 per lead.',
    ['{"spend":1506,"leads":20}'])
  check('the ratio is recognised as derived', r.figures.some((f) => f.value === '75.30' && f.status === 'derived'),
    JSON.stringify(r.figures))
  check('verdict stays clean', r.verdict === 'clean', r.verdict)
  check('the formula is reported', !!r.figures.find((f) => f.status === 'derived')?.formula,
    JSON.stringify(r.figures))
}
{
  const r = auditFigures('Conversion came in at 25 percent.', ['{"leads":80,"deals":20}'])
  check('a percentage is derived', r.verdict === 'clean', JSON.stringify(r.figures))
}
{
  const r = auditFigures('Together they spent 3200 AED.', ['{"a":1200,"b":2000}'])
  check('a sum is derived', r.verdict === 'clean', JSON.stringify(r.figures))
}
{
  const r = auditFigures('That is 400 AED more than last week.', ['{"now":1600,"prev":1200}'])
  check('a difference is derived', r.verdict === 'clean', JSON.stringify(r.figures))
}

console.log('\n── grounding comes from anywhere real this turn ──')
{
  const r = auditFigures('You have 2840 projects and 1506 in spend.',
    ['{"spend":1506}', '{"totalProjects":2840}'])
  check('context counts as much as tool results', r.verdict === 'clean', JSON.stringify(r.figures))
  check('both are grounded verbatim', r.groundedCount === 2, String(r.groundedCount))
}

console.log('\n── nothing to check is not the same as verified ──')
{
  const r = auditFigures('Meta is not connected, so I have no campaign data to report.', ['{}'])
  check('no figures → no_figures, never clean', r.verdict === 'no_figures', r.verdict)
  check('and it is not counted as grounded', r.groundedCount === 0)
}

console.log('\n── only performance talk is audited ──')
{
  check('a spend report is metric-shaped', METRIC_SHAPED.test('Your spend this week'))
  check('a CPL question is metric-shaped', METRIC_SHAPED.test('what is the cost per lead'))
  check('ordinary prose is not', !METRIC_SHAPED.test('I created the landing page for Emaar Beachfront'))
  check('the fairness window is not a metric', !METRIC_SHAPED.test('the 24 hour protection window'))
}

console.log('\n── the summary line never overstates ──')
{
  const tainted = auditFigures('spend 1506, CPL 99, reach 4321, ROAS 777', ['{"spend":1506}'])
  const line = evidenceLine(tainted)
  check('an untraceable figure is named in the summary', /NOT traceable/.test(line), line)
  const clean = auditFigures('spend 1506', ['{"spend":1506}'])
  check('a clean summary claims no more than it should', !/NOT traceable/.test(evidenceLine(clean)), evidenceLine(clean))
}

console.log('\n── a bounded derivation search cannot rubber-stamp ──')
{
  // A wall of grounded numbers must not make an arbitrary target "derived".
  const many = JSON.stringify(Array.from({ length: 60 }, (_, i) => i * 7 + 3))
  const r = auditFigures('CPL was 8123456.77', [many])
  check('an unrelated figure stays ungrounded', r.figures[0]?.status === 'ungrounded', JSON.stringify(r.figures[0]))
}

if (failures > 0) {
  console.error(`\n${failures} evidence rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll evidence rules hold.\n')
