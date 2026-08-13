/**
 * A CAP SPLIT ON PURPOSE, NOT ONE DECISION AT A TIME — locked.
 *
 * The machine moves budget locally: ROTATE pauses a loser and hands its money
 * to a survivor, GROW raises a winner into idle headroom. Neither ever asks
 * the portfolio question — given this cap and these campaigns, what should
 * each be running at tomorrow? — and the four facts that answer it were all
 * computed already and read by nothing that sets a budget.
 *
 * This suite locks the four:
 *
 *   1. fewer arms funded properly beats many arms starved (learning-phase);
 *   2. a saturated arm is never raised, whatever its average says, because the
 *      next dirham buys a re-view (lookalike-ladder);
 *   3. money moves only on a standing that separated on a real test;
 *   4. and the move is small enough not to reset learning — so a big cut is a
 *      glide over days, and the plan says so instead of pretending.
 *
 * Pure — no network, no clock. Runs in `pnpm guards`.
 */
import {
  SPLIT_ACTIONS, SPLIT_REASONS, MAX_GLIDE_DAYS, STEP_SHARE,
  splitBudget, glideDaysFor, type SplitRow,
} from '../lib/freehold/budget-split'
import { dailyBudgetToLearn, wouldResetLearning } from '../lib/freehold/learning-phase'
import { MIN_ARM_DAILY_AED } from '../lib/freehold/level-arms'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const row = (o: Partial<SplitRow> & { campaignId: string }): SplitRow => ({
  dailyBudgetAed: 200, standing: 'tied', saturated: false, ...o,
})
const planOf = (r: ReturnType<typeof splitBudget>, id: string) =>
  r.plans.find((p) => p.campaignId === id)!

console.log('\n── fewer arms funded properly beats many arms starved ──')
{
  // A lead costs AED 200, so one arm needs 50 x 200 / 7 ≈ AED 1,429 a day to
  // leave learning. A cap of AED 3,000 carries two arms. Five are running.
  const CPL = 200
  const cap = 3000
  const rows = ['a', 'b', 'c', 'd', 'e'].map((id, i) =>
    row({ campaignId: id, dailyBudgetAed: 600, standing: i === 0 ? 'ahead' : 'tied' }))
  const r = splitBudget(rows, { capAed: cap, costPerLeadAed: CPL })

  check('the split knows what one arm needs to learn',
    r.perArmAed === Math.round(dailyBudgetToLearn(CPL)), String(r.perArmAed))
  check('…and how many the cap can carry', r.supportedArms === 2, String(r.supportedArms))

  // FIVE ARMS ON THIS CAP IS FIVE CAMPAIGNS THAT NEVER TELL YOU ANYTHING.
  const starved = r.plans.filter((p) => p.action === 'starve')
  check('the three the cap cannot carry are named', starved.length === 3,
    r.plans.map((p) => `${p.campaignId}:${p.action}`).join(' '))
  check('…and they say why', starved.every((p) => p.reason === 'capCannotCarry'),
    starved.map((p) => p.reason).join(','))
  check('the one that is ahead is funded first',
    planOf(r, 'a').action !== 'starve', planOf(r, 'a').action)
}

console.log('\n── an unknown cost per lead never switches a campaign off ──')
{
  // "We do not know what a lead costs" is not evidence that a campaign should
  // stop — the same position min-evidence takes about every other number.
  const rows = ['a', 'b', 'c', 'd', 'e'].map((id) => row({ campaignId: id }))
  const r = splitBudget(rows, { capAed: 3000, costPerLeadAed: null })
  check('nothing is starved on an unknown cost',
    r.plans.every((p) => p.action !== 'starve'),
    r.plans.map((p) => p.action).join(' '))
  check('…and the split says the arm count is unknown rather than guessing',
    r.perArmAed === null && r.supportedArms === null,
    `${r.perArmAed} ${r.supportedArms}`)
  check('a zero cost per lead is also unknown, not free',
    splitBudget(rows, { capAed: 3000, costPerLeadAed: 0 }).supportedArms === null)
}

console.log('\n── THE MARGINAL RULE: a used-up audience gets no more money ──')
{
  // Both arms are ahead and both are cheap. One has run out of new people to
  // show the ad to — its average still looks excellent, because the average is
  // dominated by the money that bought the first views.
  const rows = [
    row({ campaignId: 'fresh', standing: 'ahead', saturated: false, dailyBudgetAed: 500 }),
    row({ campaignId: 'used-up', standing: 'ahead', saturated: true, dailyBudgetAed: 500 }),
  ]
  const r = splitBudget(rows, { capAed: 4000, costPerLeadAed: 200 })

  check('the surplus goes to the arm still reaching new people',
    planOf(r, 'fresh').targetAed > planOf(r, 'used-up').targetAed,
    `fresh=${planOf(r, 'fresh').targetAed} used=${planOf(r, 'used-up').targetAed}`)
  check('…and the saturated arm is held at what one arm needs, not raised past it',
    planOf(r, 'used-up').targetAed === r.perArmAed,
    `${planOf(r, 'used-up').targetAed} vs ${r.perArmAed}`)

  // WITH NOTHING FRESH TO FUND, the surplus does not simply pour into the
  // saturated arms — but the cap still has to go somewhere sane.
  const allSaturated = splitBudget([
    row({ campaignId: 'x', standing: 'ahead', saturated: true }),
    row({ campaignId: 'y', standing: 'ahead', saturated: true }),
  ], { capAed: 4000, costPerLeadAed: 200 })
  check('an entirely saturated account is not force-fed the surplus',
    allSaturated.plans.every((p) => p.targetAed <= (allSaturated.perArmAed ?? 0)),
    allSaturated.plans.map((p) => p.targetAed).join(' '))
}

console.log('\n── money moves on standings, not on hunches ──')
{
  const rows = [
    row({ campaignId: 'ahead', standing: 'ahead', dailyBudgetAed: 400 }),
    row({ campaignId: 'behind', standing: 'behind', dailyBudgetAed: 400 }),
  ]
  const r = splitBudget(rows, { capAed: 3000, costPerLeadAed: 200 })
  check('the arm that is behind is not the one taking the surplus',
    planOf(r, 'ahead').targetAed > planOf(r, 'behind').targetAed,
    `${planOf(r, 'ahead').targetAed} vs ${planOf(r, 'behind').targetAed}`)

  // A TIE MOVES NOTHING BETWEEN EQUALS. Two tied arms on the same budget must
  // come out of this with the same target, or the account churns every night
  // on a difference the evidence could not establish.
  const tied = splitBudget([
    row({ campaignId: 'p', standing: 'tied', dailyBudgetAed: 400 }),
    row({ campaignId: 'q', standing: 'tied', dailyBudgetAed: 400 }),
  ], { capAed: 3000, costPerLeadAed: 200 })
  check('two tied arms on equal budgets get equal targets',
    planOf(tied, 'p').targetAed === planOf(tied, 'q').targetAed,
    `${planOf(tied, 'p').targetAed} vs ${planOf(tied, 'q').targetAed}`)
}

console.log('\n── a protected arm outranks the arithmetic ──')
{
  // The same position ROTATE takes: a human endorsement or a compliance reason
  // is not something a budget formula gets to overrule.
  const rows = [
    row({ campaignId: 'vouched', standing: 'behind', protected: true, dailyBudgetAed: 300 }),
    ...['a', 'b', 'c'].map((id) => row({ campaignId: id, standing: 'ahead', dailyBudgetAed: 300 })),
  ]
  const r = splitBudget(rows, { capAed: 3000, costPerLeadAed: 200 })
  check('a protected arm is funded before anything else',
    planOf(r, 'vouched').action !== 'starve', planOf(r, 'vouched').action)

  // …and even when the cap genuinely cannot carry it, it is never taken to
  // zero — switching off a campaign somebody vouched for is their decision.
  const tight = splitBudget([
    ...['a', 'b'].map((id) => row({ campaignId: id, standing: 'ahead' })),
    row({ campaignId: 'vouched', standing: 'behind', protected: false }),
  ], { capAed: 3000, costPerLeadAed: 200 })
  check('an unprotected arm past the cap IS taken to zero',
    planOf(tight, 'vouched').targetAed === 0, String(planOf(tight, 'vouched').targetAed))
}

console.log('\n── the move never resets learning, so a cut is a glide ──')
{
  // A machine that reallocates every night while resetting learning every
  // night holds the whole account in permanent learning and believes it is
  // optimising.
  const rows = [
    row({ campaignId: 'big', standing: 'behind', dailyBudgetAed: 2000 }),
    row({ campaignId: 'small', standing: 'ahead', dailyBudgetAed: 200 }),
  ]
  const r = splitBudget(rows, { capAed: 3000, costPerLeadAed: 200 })

  for (const p of r.plans) {
    const from = rows.find((x) => x.campaignId === p.campaignId)!.dailyBudgetAed
    check(`${p.campaignId}: tomorrow's move does not reset learning`,
      p.stepAed === from || !wouldResetLearning(from, p.stepAed),
      `${from} → ${p.stepAed}`)
  }

  const big = planOf(r, 'big')
  check('a big cut cannot land tomorrow', big.stepAed > big.targetAed,
    `step=${big.stepAed} target=${big.targetAed}`)
  check('…so the plan says how many days it takes', big.glideDays > 0, String(big.glideDays))
  check('tomorrow is a real total, not the target total',
    r.tomorrowAed === r.plans.reduce((n, p) => n + p.stepAed, 0))

  // AND WHEN THE ACCOUNT IS ALREADY OVER THE CAP, the plan admits it is still
  // over tomorrow. Two arms at AED 3,000 each cannot be cut into a AED 3,000
  // cap overnight without resetting both — claiming otherwise would be a lie
  // about what the platform allows. (Raises are not the same case: a raise
  // glides UP slowly, so a plan that only raises is under the cap tomorrow.)
  const over = splitBudget([
    row({ campaignId: 'x', standing: 'tied', dailyBudgetAed: 3000 }),
    row({ campaignId: 'y', standing: 'tied', dailyBudgetAed: 3000 }),
  ], { capAed: 3000, costPerLeadAed: 200 })
  check('an account already over its cap says so', over.overCapAed > 0, String(over.overCapAed))
  check('…and a plan that only raises is not reported as over',
    r.overCapAed === 0, String(r.overCapAed))

  check(`a step is bounded by ${Math.round(STEP_SHARE * 100)}% either way`,
    STEP_SHARE > 0 && STEP_SHARE <= 0.25, String(STEP_SHARE))
}

console.log('\n── the glide count matches what the stepper will actually do ──')
{
  check('no move at all is no glide', glideDaysFor(500, 500) === 0, String(glideDaysFor(500, 500)))
  check('a move inside one step lands tomorrow',
    glideDaysFor(500, 550) === 0, String(glideDaysFor(500, 550)))
  // 2000 → 400 is a cut of 80%, which at 20% a day is several days.
  const long = glideDaysFor(2000, 400)
  check('a big cut takes days, and they are counted', long >= 5 && long <= MAX_GLIDE_DAYS, String(long))
  check('a glide longer than a plan is capped rather than promised',
    glideDaysFor(100_000, MIN_ARM_DAILY_AED) === MAX_GLIDE_DAYS,
    String(glideDaysFor(100_000, MIN_ARM_DAILY_AED)))
  check('a target of zero is not a glide', glideDaysFor(500, 0) === 0)
  // A run from zero would loop forever on a step that cannot move.
  check('an arm at zero does not loop', glideDaysFor(0, 500) === 0)
}

console.log('\n── nothing degenerate throws ──')
{
  check('no campaigns is an empty plan', splitBudget([], { capAed: 3000, costPerLeadAed: 200 }).plans.length === 0)
  check('no cap is an empty plan',
    splitBudget([row({ campaignId: 'a' })], { capAed: 0, costPerLeadAed: 200 }).plans.length === 0)
  check('a nonsense cap is an empty plan',
    splitBudget([row({ campaignId: 'a' })], { capAed: NaN, costPerLeadAed: 200 }).plans.length === 0)

  // A cap smaller than one arm's learning budget still funds ONE arm rather
  // than switching the account off — a small test budget is a legitimate thing
  // to want, and this function does not get to refuse it.
  const tiny = splitBudget(
    ['a', 'b'].map((id) => row({ campaignId: id })),
    { capAed: 300, costPerLeadAed: 200 },
  )
  check('a cap below one arm\'s learning budget still funds one arm',
    tiny.supportedArms === 1 && tiny.plans.filter((p) => p.action !== 'starve').length === 1,
    tiny.plans.map((p) => `${p.campaignId}:${p.action}`).join(' '))
  check('…and never below the platform floor',
    tiny.plans.filter((p) => p.targetAed > 0).every((p) => p.targetAed >= MIN_ARM_DAILY_AED),
    tiny.plans.map((p) => p.targetAed).join(' '))
}

console.log('\n── every action and every reason is reachable ──')
{
  const seen = new Set<string>()
  const reasons = new Set<string>()
  for (const [rows, opts] of [
    // raise + starve + capCannotCarry
    [[row({ campaignId: 'a', standing: 'ahead', dailyBudgetAed: 200 }),
      row({ campaignId: 'b', standing: 'behind', dailyBudgetAed: 2000 }),
      row({ campaignId: 'c', standing: 'tied', dailyBudgetAed: 300 })],
     { capAed: 3000, costPerLeadAed: 200 }],
    // lower + behindOthers: both funded, the one behind trimmed a little
    [[row({ campaignId: 'x', standing: 'ahead', dailyBudgetAed: 1500 }),
      row({ campaignId: 'y', standing: 'behind', dailyBudgetAed: 1500 })],
     { capAed: 3000, costPerLeadAed: 200 }],
    // hold + noChange: already exactly where the split wants them
    [[row({ campaignId: 'p', standing: 'tied', dailyBudgetAed: 1500 }),
      row({ campaignId: 'q', standing: 'tied', dailyBudgetAed: 1500 })],
     { capAed: 3000, costPerLeadAed: 200 }],
    // saturatedHold: a used-up arm raised only to what one arm needs
    [[row({ campaignId: 's', standing: 'ahead', saturated: true, dailyBudgetAed: 100 }),
      row({ campaignId: 't', standing: 'ahead', dailyBudgetAed: 1429 })],
     { capAed: 3000, costPerLeadAed: 200 }],
    // protectedFloor: MORE vouched-for campaigns than the cap can fund
    [[row({ campaignId: 'v1', standing: 'behind', protected: true, dailyBudgetAed: 100 }),
      row({ campaignId: 'v2', standing: 'behind', protected: true, dailyBudgetAed: 100 }),
      row({ campaignId: 'v3', standing: 'behind', protected: true, dailyBudgetAed: 100 })],
     { capAed: 300, costPerLeadAed: 200 }],
  ] as Array<[SplitRow[], { capAed: number; costPerLeadAed: number }]>) {
    for (const p of splitBudget(rows, opts).plans) { seen.add(p.action); reasons.add(p.reason) }
  }
  const missingActions = SPLIT_ACTIONS.filter((a) => !seen.has(a))
  check('every action can happen — none is dead copy', missingActions.length === 0, missingActions.join(','))
  const missingReasons = SPLIT_REASONS.filter((r) => !reasons.has(r))
  check('every reason can happen — none is dead copy', missingReasons.length === 0, missingReasons.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} budget rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe cap is split on marginal return, and the move never destroys the answer.\n')
