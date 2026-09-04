/**
 * BETTER TARGETING IS NOT FREE — locked.
 *
 * "can you implement the better target if there's any to the current ads."
 *
 * The engine now builds a materially better audience than anything running in
 * this account. Every live campaign was built by hand in Ads Manager and
 * carries none of it, so the obvious move is to push the new targeting onto
 * the running ad sets.
 *
 * A TARGETING EDIT RE-ENTERS LEARNING. The ad set goes back to unstable
 * delivery at a higher cost per result until it re-accumulates conversions —
 * on a NEW audience, so nothing it learned carries over. On an ad set that is
 * producing, a better audience applied badly is worse than a worse audience
 * left alone.
 *
 * So "is this targeting better" and "should we apply it" are different
 * questions, and this suite pins the second one. Nothing here edits anything.
 *
 * Runs in `pnpm guards`.
 */
import {
  TARGETING_GAPS, diffTargeting, instructionFor, type LiveAdSet,
} from '../lib/freehold/targeting-diff'
import { MIN_ATTRIBUTED_FOR_QUALITY } from '../lib/freehold/min-evidence'
import { VALUABLE_RATING } from '../lib/freehold/lead-stages'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const OPTS = { valuableRating: VALUABLE_RATING, standardExclusions: ['Real estate broker'] }
const adSet = (o: Partial<LiveAdSet> = {}): LiveAdSet => ({
  id: 's1', name: 'A',
  signals: ['Residential real estate (real estate)'],
  excluded: ['Real estate broker'],
  expanding: false, subCountry: true,
  leads: 0, rated: 0, meanRating: 0,
  ...o,
})

console.log('\n── a reset is worth it when there is nothing to lose ──')
{
  const dead = diffTargeting(adSet({ signals: [], rated: 0 }), OPTS)
  check('an ad set with no property gate is flagged',
    dead.some((f) => f.gap === 'noPropertyGate'), JSON.stringify(dead.map((f) => f.gap)))
  check('…and every fix is marked as costing a learning reset',
    dead.every((f) => f.resetsLearning))
  check('…which is worth paying when the ad set has produced nothing',
    dead.find((f) => f.gap === 'noPropertyGate')!.worthApplying)
  check('the instruction is to edit it', instructionFor(dead) === 'edit')
}

console.log('\n── …and when what it learned is the problem ──')
{
  // THE CASE THAT MATTERS MOST. An ad set producing well WITH Advantage on
  // has spent its learning becoming efficient at an audience nobody chose.
  // "Producing" must not protect it.
  const advantage = diffTargeting(
    adSet({ expanding: true, rated: 40, meanRating: 9 }), OPTS)
  const f = advantage.find((x) => x.gap === 'advantageOn')!
  check('Advantage is worth resetting even on a producing ad set',
    f.worthApplying && f.because === 'learningIsWrong', JSON.stringify(f))

  // The gate that does not narrow — the failure this codebase carries three
  // times. Same reasoning: the learning is about the wrong audience.
  const wide = diffTargeting(
    adSet({ signals: ['Real estate investing (investing)'], rated: 40, meanRating: 9 }), OPTS)
  check('a gate that does not narrow is wrong learning, not an asset',
    wide.find((x) => x.gap === 'wideGate')?.worthApplying === true,
    JSON.stringify(wide.map((x) => x.gap)))
  check('…and a finance proxy is never read as a property signal',
    wide.some((x) => x.gap === 'wideGate'))
}

console.log('\n── and never on an ad set that is producing ──')
{
  const good = adSet({ excluded: [], subCountry: false, rated: 40, meanRating: 9 })
  const findings = diffTargeting(good, OPTS)
  check('missing exclusions are still reported on a producing ad set',
    findings.some((x) => x.gap === 'noExclusions'))
  // The whole point. A better audience applied badly is worse than a worse
  // audience left alone.
  check('…but not applied to it',
    findings.every((x) => !x.worthApplying), JSON.stringify(findings))
  check('the instruction is to run the better audience alongside',
    instructionFor(findings) === 'duplicate')

  // BOTH HALVES OF "PRODUCING". Forty leads all rated 2 is producing junk
  // efficiently, which is not something to protect.
  const junk = diffTargeting(adSet({ excluded: [], rated: 40, meanRating: 2 }), OPTS)
  check('volume alone does not count as producing',
    junk.find((x) => x.gap === 'noExclusions')!.worthApplying)

  // …and a great mean on two leads is not evidence of anything.
  const thin = diffTargeting(
    adSet({ excluded: [], rated: MIN_ATTRIBUTED_FOR_QUALITY - 1, meanRating: 10 }), OPTS)
  check('nor does a perfect rating on a sample too small to mean it',
    thin.find((x) => x.gap === 'noExclusions')!.worthApplying)
}

console.log('\n── one instruction, not a list ──')
{
  check('a clean ad set is left alone', instructionFor(diffTargeting(adSet(), OPTS)) === 'leave')
  // An operator with four findings and no verdict does nothing.
  const many = diffTargeting(adSet({ signals: [], excluded: [], subCountry: false, expanding: true }), OPTS)
  check('four faults still produce one instruction',
    many.length >= 4 && instructionFor(many) === 'edit', String(many.length))
  check('every gap is walkable', TARGETING_GAPS.length === 5)
}

console.log(failures === 0
  ? '\n✅ better targeting is applied where the learning is worth losing, and nowhere else.'
  : `\n❌ ${failures} targeting-diff guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
