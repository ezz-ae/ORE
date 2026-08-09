/**
 * "Is this audience the right size for this money?" — locked.
 *
 * The question that decides whether the ads work at all, and the one the
 * product never asked. Two ways a perfectly written audience still fails:
 *
 *   · It never leaves the learning phase, because the budget divided by the
 *     ad sets cannot buy 50 results a week. The ad set keeps paying the
 *     beginner's price AND its numbers are noise, so every verdict drawn from
 *     them is noise too.
 *   · It burns out: the same people see the ad again and again, results fall,
 *     and cost per lead rises for a reason no creative can fix.
 *
 * The rule that protects this from becoming another false-alarm panel: EVERY
 * NUMBER COMES FROM A REAL INPUT. No assumed CPM, no invented audience size.
 * A missing input produces no finding rather than a modelled one — and
 * nothing at all is judged before a campaign is old enough to mean something.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  checkAudienceFit, budgetToLearn, weeklyResultsPerAdSet,
  LEARNING_RESULTS_PER_WEEK, BURNOUT_FREQUENCY, MIN_DAYS_FOR_JUDGEMENT,
} from '../lib/freehold/audience-fit'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))
const keys = (f: ReturnType<typeof checkAudienceFit>) => f.map((x) => `${x.level}:${x.key}`)
const find = (f: ReturnType<typeof checkAudienceFit>, k: string) => f.find((x) => x.key === k)

console.log('\n── the split that looks like control ──')
{
  // The real shape: AED 200/day across the four placement ad sets at a 150
  // CPL cap. Each ad set can buy 2 results a week. Meta needs 50.
  const split = checkAudienceFit({ dailyBudgetAED: 200, adSets: 4, targetCplAED: 150 })
  check('four ad sets on this budget is called out as starving them',
    keys(split).includes('wrong:splitStarves'), keys(split).join(' | '))
  check('…and it says what those four would get as one',
    Number(find(split, 'splitStarves')?.vars?.together) === 9,
    JSON.stringify(find(split, 'splitStarves')?.vars))
  check('…and names the budget one ad set would need to actually learn',
    weeklyResultsPerAdSet({ dailyBudgetAED: Number(find(split, 'splitStarves')!.vars!.need), adSets: 1, targetCplAED: 150 })! >= LEARNING_RESULTS_PER_WEEK,
    String(find(split, 'splitStarves')?.vars?.need))

  // A split is only a problem when it starves. Four ad sets on a budget that
  // feeds all four is a legitimate structure and must raise nothing — this is
  // the false-alarm direction, and it is the one that cost us before.
  check('a split that each ad set can afford raises nothing',
    keys(checkAudienceFit({ dailyBudgetAED: 4400, adSets: 4, targetCplAED: 150 })).join('|') === 'ok:learns',
    keys(checkAudienceFit({ dailyBudgetAED: 4400, adSets: 4, targetCplAED: 150 })).join(' | '))
  check('…and one just under the line is a watch on the split, not an alarm',
    keys(checkAudienceFit({ dailyBudgetAED: 4000, adSets: 4, targetCplAED: 150 })).join('|') === 'watch:slowLearn',
    keys(checkAudienceFit({ dailyBudgetAED: 4000, adSets: 4, targetCplAED: 150 })).join(' | '))

  // Same money, one ad set: 9 results a week. Still not 50 — but consolidating
  // is no longer the answer, so the honest advice is the budget.
  const one = checkAudienceFit({ dailyBudgetAED: 200, adSets: 1, targetCplAED: 150 })
  check('one ad set that still cannot learn asks for budget, not consolidation',
    keys(one).includes('wrong:cannotLearn'), keys(one).join(' | '))
  check('…and the budget it names would actually do it',
    weeklyResultsPerAdSet({ dailyBudgetAED: Number(find(one, 'cannotLearn')!.vars!.need), adSets: 1, targetCplAED: 150 })! >= LEARNING_RESULTS_PER_WEEK,
    String(find(one, 'cannotLearn')?.vars?.need))
  check('the required budget scales with the number of ad sets',
    budgetToLearn({ adSets: 4, targetCplAED: 150 })! === 4 * budgetToLearn({ adSets: 1, targetCplAED: 150 })!)
}

console.log('\n── a budget that can actually teach Meta something ──')
{
  const good = checkAudienceFit({ dailyBudgetAED: 1200, adSets: 1, targetCplAED: 150 })
  check('a budget that clears 50 a week raises no problem',
    good.every((f) => f.level === 'ok'), keys(good).join(' | '))
  check('…and still says what it buys, so the screen is not empty',
    Number(find(good, 'learns')?.vars?.n) >= LEARNING_RESULTS_PER_WEEK,
    JSON.stringify(find(good, 'learns')?.vars))
  check('just under the line is a watch, not an alarm',
    keys(checkAudienceFit({ dailyBudgetAED: 900, adSets: 1, targetCplAED: 150 })).includes('watch:slowLearn'))
}

console.log('\n── nothing is judged before it means anything ──')
{
  const young = checkAudienceFit({
    dailyBudgetAED: 1200, adSets: 1, targetCplAED: 150,
    frequency: 4.0, daysRunning: 2, results: 1,
  })
  check('a two-day-old campaign is not accused of burning out',
    !keys(young).some((k) => k.includes('burntOut') || k.includes('wearing')), keys(young).join(' | '))
  check('…nor of failing to leave the learning phase',
    !keys(young).some((k) => k.includes('stillLearning')), keys(young).join(' | '))
  check(`the line is ${MIN_DAYS_FOR_JUDGEMENT} days`,
    keys(checkAudienceFit({ dailyBudgetAED: 1200, adSets: 1, targetCplAED: 150, frequency: 4.0, daysRunning: MIN_DAYS_FOR_JUDGEMENT }))
      .some((k) => k.includes('burntOut')))
}

console.log('\n── the ladder trigger, on real numbers only ──')
{
  const base = { dailyBudgetAED: 1200, adSets: 1, targetCplAED: 150, daysRunning: 10 }
  check(`frequency at ${BURNOUT_FREQUENCY} is where widening starts`,
    keys(checkAudienceFit({ ...base, frequency: BURNOUT_FREQUENCY })).includes('watch:wearing'))
  check('well past it is a real problem',
    keys(checkAudienceFit({ ...base, frequency: 3.0 })).includes('wrong:burntOut'))
  check('below it, the audience is reported as still fresh',
    keys(checkAudienceFit({ ...base, frequency: 1.1 })).includes('ok:freshAudience'))
  check('no frequency from Meta means no frequency finding — not a guess',
    !keys(checkAudienceFit({ ...base, frequency: null })).some((k) => k.includes('wearing') || k.includes('freshAudience') || k.includes('burntOut')),
    keys(checkAudienceFit({ ...base, frequency: null })).join(' | '))
}

console.log('\n── what actually happened beats what was predicted ──')
{
  const stuck = checkAudienceFit({
    dailyBudgetAED: 1200, adSets: 1, targetCplAED: 150,
    daysRunning: 14, results: 6,
  })
  check('a fortnight and six results is named, however good the budget looked',
    keys(stuck).includes('wrong:stillLearning'), keys(stuck).join(' | '))
  const fine = checkAudienceFit({
    dailyBudgetAED: 1200, adSets: 1, targetCplAED: 150,
    daysRunning: 14, results: 140,
  })
  check('a campaign that really is delivering is left alone',
    !keys(fine).some((k) => k.includes('stillLearning')), keys(fine).join(' | '))
  check('no result count means no such finding',
    !keys(checkAudienceFit({ dailyBudgetAED: 1200, adSets: 1, targetCplAED: 150, daysRunning: 14 }))
      .some((k) => k.includes('stillLearning')))
}

console.log('\n── nothing is invented from nothing ──')
{
  check('no budget produces no learning finding at all',
    checkAudienceFit({ dailyBudgetAED: 0, adSets: 4, targetCplAED: 150 }).length === 0)
  check('no CPL cap produces none either',
    checkAudienceFit({ dailyBudgetAED: 200, adSets: 1, targetCplAED: 0 }).length === 0)
  check('zero ad sets cannot divide by zero',
    weeklyResultsPerAdSet({ dailyBudgetAED: 200, adSets: 0, targetCplAED: 150 }) === null)
  const mixed = checkAudienceFit({ dailyBudgetAED: 200, adSets: 4, targetCplAED: 150, daysRunning: 10, frequency: 3 })
  check('the worst thing is read first', mixed[0].level === 'wrong', keys(mixed).join(' | '))
}

if (failures > 0) {
  console.error(`\n${failures} audience-fit rule(s) broken.`)
  process.exit(1)
}
console.log('\nTargeting is judged on whether it can be bought.\n')
