/**
 * SILENCE IS NOT PROOF — locked.
 *
 * "i need a final confidence targeting mechanism."
 *
 * This product judges targeting in five places — fit, reach, audience weight,
 * placement, lead quality — and every one is soundly evidence-gated. Nothing
 * composed them: no caller used more than one, so an operator got five
 * verdicts on five screens and no answer to the only question being asked.
 *
 * And the gap had a sharp edge. A brand-new setup returns `unknown` from
 * weight, `undecided` from placement, `unknown` from reach and `ok` from fit,
 * so NOTHING IS FLAGGED — which on screen is indistinguishable from a setup
 * proven over months. Every "no issues found" this product ever showed about a
 * new audience was that.
 *
 * These assertions pin the three decisions that make the composite honest:
 * silence reports as `none`, a chain takes its weakest link rather than an
 * average, and a structural fault needs no sample.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */
import {
  targetingConfidence, levelOf, fitSignal,
  CONFIDENCE_LEVELS, TARGETING_VERDICTS, CONFIDENCE_SIGNALS,
  MIN_EVENTS_TO_SPEAK, EVENTS_FOR_HIGH,
  type ConfidenceSignal,
} from '../lib/freehold/targeting-confidence'
import { MIN_FIELD_EVENTS } from '../lib/freehold/audience-weight'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const sig = (id: ConfidenceSignal['id'], reading: ConfidenceSignal['reading'], events: number,
             blocking = false): ConfidenceSignal => ({ id, reading, events, blocking })

console.log('\n── THE FAILURE THIS EXISTS FOR ──')
{
  // A brand-new setup: nothing is wrong because nothing is known.
  const fresh = targetingConfidence([
    sig('fit', 'good', 0), sig('reach', 'unknown', 0),
    sig('audience', 'unknown', 0), sig('placement', 'unknown', 0),
    sig('quality', 'unknown', 0),
  ])
  check('an unproven setup reports NO confidence', fresh.level === 'none', fresh.level)
  // The whole point: it must not read as a pass.
  check('…and is NOT told to run', fresh.verdict === 'notYet', fresh.verdict)
  check('…and says what is missing', fresh.weakest !== null && fresh.needsMoreEvents !== null,
    JSON.stringify(fresh))

  // A proven setup and a silent one must never render the same.
  const proven = targetingConfidence([
    sig('fit', 'good', 40), sig('reach', 'good', 40),
    sig('audience', 'good', 40), sig('placement', 'good', 40), sig('quality', 'good', 40),
  ])
  check('a proven setup reads differently from a silent one',
    proven.level === 'high' && proven.verdict === 'run', `${proven.level}/${proven.verdict}`)
  check('…and has nothing left to chase',
    proven.weakest === null && proven.needsMoreEvents === null)
}

console.log('\n── a chain is its weakest link, never its average ──')
{
  // Four strong signals and one unknown. An average says "quite confident";
  // the unknown is the one that decides.
  const c = targetingConfidence([
    sig('fit', 'good', 100), sig('reach', 'good', 100),
    sig('audience', 'good', 100), sig('placement', 'good', 100),
    sig('quality', 'unknown', 0),
  ])
  check('one unknown caps the whole composite', c.level === 'none', c.level)
  check('…and it is NAMED rather than buried in a total', c.weakest === 'quality', String(c.weakest))
  check('…so the answer is not "run"', c.verdict !== 'run', c.verdict)

  // A thin signal caps it too, without being unknown.
  const thin = targetingConfidence([
    sig('fit', 'good', 100), sig('audience', 'good', 100), sig('quality', 'good', 2),
  ])
  check('a thinly-evidenced signal caps it as well',
    thin.level === 'low' && thin.weakest === 'quality', `${thin.level}/${thin.weakest}`)
  check('…and low confidence means watch, not run', thin.verdict === 'watch', thin.verdict)
  check('…and it says how many more observations would settle it',
    thin.needsMoreEvents === MIN_EVENTS_TO_SPEAK - 2, String(thin.needsMoreEvents))
}

console.log('\n── a structural fault needs no sample ──')
{
  // You do not need evidence to know a budget divided six ways cannot reach
  // Meta's learning threshold. Running it longer will not make it untrue.
  const broken = targetingConfidence([
    sig('fit', 'bad', 0, true),
    sig('audience', 'good', 100), sig('quality', 'good', 100),
  ])
  check('a blocking fault says fix, whatever the evidence', broken.verdict === 'fix', broken.verdict)
  check('…names the fault', broken.weakest === 'fit', String(broken.weakest))
  // Waiting does not fix a budget that cannot learn.
  check('…and does not suggest waiting for more data',
    broken.needsMoreEvents === null, String(broken.needsMoreEvents))

  // A bad reading WITHOUT evidence is not a fault, it is noise.
  const noisy = targetingConfidence([sig('quality', 'bad', 1)])
  check('one bad observation is not a verdict', noisy.verdict === 'notYet', noisy.verdict)
  // With evidence it is.
  const real = targetingConfidence([sig('quality', 'bad', 30), sig('fit', 'good', 30)])
  check('a proven bad reading is', real.verdict === 'fix' && real.weakest === 'quality',
    `${real.verdict}/${real.weakest}`)
}

console.log('\n── the thresholds are the product\'s, not new ones ──')
{
  // A signal "decided" on one screen and "too early" on another is how two
  // parts of a product disagree about the same campaign on the same day.
  check('the speaking floor matches audience-weight',
    MIN_EVENTS_TO_SPEAK === MIN_FIELD_EVENTS, `${MIN_EVENTS_TO_SPEAK} vs ${MIN_FIELD_EVENTS}`)
  check('nothing observed is no confidence', levelOf(0) === 'none' && levelOf(-3) === 'none')
  check('below the floor is low', levelOf(MIN_EVENTS_TO_SPEAK - 1) === 'low')
  check('at the floor it may speak', levelOf(MIN_EVENTS_TO_SPEAK) === 'medium')
  check('well evidenced is high', levelOf(EVENTS_FOR_HIGH) === 'high')
  check('junk input claims nothing', levelOf(NaN) === 'none')

  check('every level is walkable', CONFIDENCE_LEVELS.length === 4)
  check('every verdict is walkable', TARGETING_VERDICTS.length === 4)
  check('every signal is walkable', CONFIDENCE_SIGNALS.length === 5)
  // A signal nobody defined must not be able to vote.
  check('an unknown signal id is ignored, not counted',
    targetingConfidence([{ id: 'made_up' as never, reading: 'good', events: 999 }]).level === 'none')
}

console.log('\n── and the fit findings map in without being re-judged ──')
{
  // audience-fit already decides wrong/watch/ok. This only translates.
  check('a wrong finding blocks',
    fitSignal([{ level: 'wrong' }], 30).blocking === true)
  check('a watch finding is bad but does not block',
    (() => { const s = fitSignal([{ level: 'watch' }], 30); return s.reading === 'bad' && !s.blocking })())
  check('all-ok reads good', fitSignal([{ level: 'ok' }], 30).reading === 'good')
  // Fit is judged from the SETUP, so its evidence is time, not results — a fit
  // verdict on day one is arithmetic about a budget, worth stating and not
  // worth being confident about.
  check('fit on day one carries almost no confidence',
    levelOf(fitSignal([{ level: 'ok' }], 1).events) === 'low')
  check('…and earns confidence by running', levelOf(fitSignal([{ level: 'ok' }], 40).events) === 'high')
}

console.log(failures === 0
  ? '\n✅ nothing known reads as nothing known, and the weakest link sets the answer.'
  : `\n❌ ${failures} targeting-confidence guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
