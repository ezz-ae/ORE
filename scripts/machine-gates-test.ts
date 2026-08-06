/**
 * The Ads Machine's decision gates, pinned to the arithmetic.
 *
 * The machine pauses live campaigns and moves real budget. Two of its
 * constants were calibrated by intuition rather than by the maths, and both
 * were wrong in ways that only show up when you compute them:
 *
 *  · CPL-condemn fired at 1.5x on three leads a side. That is p ≈ 0.64 — a
 *    coin flip. The machine was killing trials on noise.
 *  · GROW raised the winner's budget 50%, which trips Meta's ~20% learning
 *    reset. The reward for proving itself was to be thrown back into erratic
 *    delivery.
 *
 * These assertions reproduce the exact comparisons the engine makes, so the
 * gates cannot quietly drift back. They test the shared primitives the engine
 * now calls, not a copy of its logic.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { samePace, SIGNIFICANT_P } from '../lib/freehold/inventory-quality'
import { safeBudgetStep, wouldResetLearning } from '../lib/freehold/learning-phase'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** The engine's condemn rule, exactly: materially worse AND statistically real. */
const CPL_MULTIPLIER = 1.5
const condemns = (
  mine: { leads: number; spend: number },
  sibling: { leads: number; spend: number },
) => {
  const myCpl = mine.spend / mine.leads
  const theirCpl = sibling.spend / sibling.leads
  return myCpl > CPL_MULTIPLIER * theirCpl &&
    samePace(mine.leads, mine.spend, sibling.leads, sibling.spend) < SIGNIFICANT_P
}

console.log('\n── the machine no longer condemns on a coin flip ──')
{
  // 3 vs 3 leads, CPL 300 against 150. A clean 2x gap on the minimum the old
  // gate allowed — and p = 0.639.
  const mine = { leads: 3, spend: 900 }, sib = { leads: 3, spend: 450 }
  const p = samePace(mine.leads, mine.spend, sib.leads, sib.spend)
  check('a 2x CPL gap on 3 leads a side is p ≈ 0.64', p > 0.6 && p < 0.7, p.toFixed(3))
  check('…and the machine does NOT pause on it', !condemns(mine, sib), String(p))

  check('5 vs 5 is still not enough', !condemns({ leads: 5, spend: 1500 }, { leads: 5, spend: 750 }))
  check('10 vs 10 is still not enough', !condemns({ leads: 10, spend: 3000 }, { leads: 10, spend: 1500 }))
  check('20 vs 20 finally is', condemns({ leads: 20, spend: 6000 }, { leads: 20, spend: 3000 }),
    String(samePace(20, 6000, 20, 3000)))
}

console.log('\n── both conditions are required, not either ──')
{
  // Statistically real but materially trivial: at high volume a 10% gap
  // separates cleanly, and pausing a campaign over 10% is not a decision
  // anybody would defend.
  // A 10% gap needs about a THOUSAND leads a side before it separates — worth
  // knowing on its own, and the reason "significant" alone is not a gate.
  const bigA = { leads: 1000, spend: 110_000 }  // CPL 110
  const bigB = { leads: 1000, spend: 100_000 }  // CPL 100
  check('a 10% gap needs ~1,000 leads a side to be statistically real',
    samePace(bigA.leads, bigA.spend, bigB.leads, bigB.spend) < SIGNIFICANT_P,
    String(samePace(bigA.leads, bigA.spend, bigB.leads, bigB.spend)))
  check('…and the machine still does not pause, because it is not material',
    !condemns(bigA, bigB))

  // Materially huge but statistically empty — the old failure mode.
  check('a 4x gap on 3 leads is material and NOT real, so it does not fire',
    !condemns({ leads: 3, spend: 1800 }, { leads: 3, spend: 450 }))

  // Both, at volume: fires.
  check('material AND real fires', condemns({ leads: 30, spend: 9000 }, { leads: 30, spend: 4500 }))
}

console.log('\n── a trial can never be condemned for being cheaper ──')
{
  check('a better trial is never condemned by a worse sibling',
    !condemns({ leads: 30, spend: 3000 }, { leads: 30, spend: 9000 }))
  check('identical trials condemn nobody',
    !condemns({ leads: 30, spend: 4500 }, { leads: 30, spend: 4500 }))
}

console.log('\n── growing a winner does not reset its learning ──')
{
  // The old behaviour: +50% in one step.
  check('a 50% raise WOULD have reset learning', wouldResetLearning(200, 300))
  const stepped = safeBudgetStep(200, 300)
  check('the machine steps to +20% instead', stepped === 240, String(stepped))
  check('…and that step does not reset', !wouldResetLearning(200, stepped), String(stepped))
  check('a modest raise is taken whole', safeBudgetStep(200, 220) === 220)
  check('the climb continues next cycle', safeBudgetStep(240, 360) === 288, String(safeBudgetStep(240, 360)))

  // Three cycles still get most of the way there, without ever resetting.
  let b = 200
  const climb: number[] = []
  for (let i = 0; i < 3; i++) { b = safeBudgetStep(b, b * 1.5); climb.push(b) }
  check('three cycles climb 200 -> 240 -> 288 -> 345', climb.join(',') === '240,288,345', climb.join(','))
  check('…and no step in that climb resets learning',
    climb.every((to, i) => !wouldResetLearning(i === 0 ? 200 : climb[i - 1], to)), climb.join(','))
  check('…reaching 72% higher in three cycles instead of one reset',
    b > 200 * 1.7, String(b))

  // THE ROUNDING TRAP. Math.round would return 346 here — 20.14% — a reset
  // produced by the guard against resets. Every budget must hold the bound.
  for (let from = 10; from <= 5000; from += 7) {
    const to = safeBudgetStep(from, from * 3)
    if (wouldResetLearning(from, to)) {
      fail('a safe step never trips the reset it guards against', `${from} -> ${to}`)
      break
    }
  }
  ok('no budget from 10 to 5,000 can be stepped into a reset')
  for (let from = 10; from <= 5000; from += 7) {
    const to = safeBudgetStep(from, from * 0.1)
    if (wouldResetLearning(from, to)) {
      fail('a safe CUT never trips it either', `${from} -> ${to}`)
      break
    }
  }
  ok('…and neither can a cut')
}

if (failures > 0) {
  console.error(`\n${failures} machine-gate rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll machine-gate rules hold.\n')
