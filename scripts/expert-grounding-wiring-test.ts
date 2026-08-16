/**
 * A TOOL RESULT MUST REACH THE THING THAT AUDITS IT — locked.
 *
 * The Expert ran a campaign check, read the real numbers out of it, wrote a
 * correct report — and then refused its own answer:
 *
 *     ACTIONS TAKEN: Checked your campaigns
 *     "some of those figures (4251) did not come from your live data …
 *      No data-returning check completed this turn."
 *
 * Both sentences on one screen, contradicting each other, under a chip saying
 * the check had run.
 *
 * The cause was one dropped value. `runExpertSdk` returned the tool NAMES and
 * threw the RESULTS away, and three separate features quietly read from the
 * missing half:
 *
 *   · auditFigures traces each number to a source. No results → the only
 *     source is the static context → every figure the model correctly read
 *     out of a tool is "ungrounded" → a true answer is replaced by a
 *     self-accusation.
 *   · sanitizeBlockHrefs keeps a link only if its id appeared in a tool
 *     result. No results → every genuine deep link is stripped.
 *   · the "what actually happened" notes are summarised from results. None →
 *     the reply says no check ran, under a chip saying one did.
 *
 * NOT ONE GATE COULD SEE IT. Types were satisfied — the function returned
 * exactly what its signature promised. The i18n audit does not read logic. The
 * guards check rules, not whether a value survives a function boundary. It
 * took a screenshot from somebody using the product.
 *
 * So this suite reads the wiring: every place that consumes a tool result is
 * checked against every path that produces one.
 *
 * Pure — reads files, no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** Comments stripped — a header that names a fault to explain it must not be
 *  what fails the rule. */
const code = (p: string): string =>
  readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const route = code('app/api/freehold/expert/chat/route.ts')
const runner = code('lib/freehold/expert-agent-run.ts')

console.log('\n── every path that runs a tool hands back what it answered ──')
{
  // THE DROPPED VALUE. A signature that returns only names is a signature that
  // compiles perfectly and starves three consumers.
  check('the SDK runner returns the tool results, not only the names',
    /toolResults: ExpertToolResult\[\]/.test(runner),
    'runExpertSdk is throwing its results away')
  check('…read from the steps it actually executed',
    /step\.toolResults/.test(runner))

  // Both paths must feed the SAME buffer, or the audit sees half the turn.
  const feeds = (route.match(/toolResultsText \+= /g) ?? []).length
  check('both the SDK path and the legacy loop feed the grounding buffer',
    feeds >= 2, `only ${feeds} place(s) write to it`)

  // …and the same summariser, so the two paths cannot describe one result in
  // two different ways.
  const notes = (route.match(/resultNotes\.push\(/g) ?? []).length
  check('both paths write the human-readable notes too',
    notes >= 2, `only ${notes} place(s) write them`)
  check('…through one summariser, not two descriptions of the same thing',
    (route.match(/summarizeToolResult\(/g) ?? []).length >= 3)
}

console.log('\n── a chip is only earned by a call that worked ──')
{
  // A failed call is not a taken action. The legacy loop has always known
  // this; the SDK path did not, so a refusal earned a green chip.
  check('the SDK path drops failed calls before they become chips',
    /toolResults\.filter\(\(r\) => !r\.failed/.test(runner),
    'a failed call can still earn a chip')
  check('…and a tool answering with an error is what "failed" means',
    /'error' in \(output as object\)/.test(runner))
  check('the legacy loop does the same', /if \(!failed\) toolsUsed\.push\(call\.name\)/.test(route))
}

console.log('\n── the reply never contradicts the chip above it ──')
{
  // THE SENTENCE THAT SHIPPED: "No data-returning check completed this turn"
  // printed under "Checked your campaigns". The reply calling itself a liar,
  // and a loop — it asks the user to run again the thing it says did not run.
  check('the "nothing ran" line is conditional on nothing having run',
    /: 'No check ran this turn/.test(route),
    'the unconditional "no data-returning check" sentence is back')
  check('…and there is a different sentence for "it ran and came back thin"',
    /The checks ran \(\$\{Array\.from\(new Set\(toolsUsed\)\)/.test(route))
  check('the old contradicting sentence is gone',
    !/No data-returning check completed this turn/.test(route),
    'it can still print under a chip saying a check ran')
}

console.log('\n── an empty answer is a failure, not an answer ──')
{
  // The SDK path was fatal-on-throw and trusting-on-return, so a run that came
  // back with '' ended as "I lost my train of thought — ask me once more": a
  // dead end that asks the user to repeat what just failed.
  check('an empty SDK answer falls through to the legacy path',
    /raw === undefined \|\| \(!raw\.trim\(\) && toolsUsed\.length === 0\)/.test(route),
    'an empty answer is still being treated as an answer')

  // …BUT ONLY WHEN NOTHING RAN. Re-running a turn whose tools already fired
  // would execute them twice, and some of them move money.
  check('…and never after a tool has already fired',
    /toolsUsed\.length === 0\)/.test(route),
    'a retry could run a money-moving tool twice')
  check('a turn that ran tools but wrote nothing reports instead of retrying',
    /if \(meaningless && toolsUsed\.length > 0\)/.test(route))
}

console.log('\n── the audit still sees everything it is supposed to ──')
{
  // Grounding is a property of the CONTEXT, not of the toolbelt — a session
  // with no tools is the one MOST likely to fabricate, because the model
  // cannot fetch and fills the gap from itself.
  check('the figure audit is not gated on holding tools',
    /if \(METRIC_SHAPED\.test\(replyJson\)\)/.test(route))
  check('…and traces against the tool results AND the context',
    /auditFigures\(replyJson, \[toolResultsText, JSON\.stringify\(fullContext\)\]\)/.test(route))
  check('links are still checked against real tool output',
    /sanitizeBlockHrefs\(blocks, toolResultsText\)/.test(route))
}

if (failures > 0) {
  console.error(`\n${failures} expert wiring rule(s) broken.`)
  console.error('A tool result that does not reach the audit turns a true answer into a refusal.')
  process.exit(1)
}
console.log('\nWhat the Expert did, what it says it did, and what it can prove all agree.\n')
