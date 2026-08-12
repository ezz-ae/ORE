/**
 * WHICH LEVER TO PULL ON SEARCH — locked.
 *
 * Google reports two reasons you did not show, and they have OPPOSITE fixes:
 *
 *   outranked      raise the bid, fix the ad and the page. More budget buys
 *                  nothing — those auctions were never winnable at any spend.
 *   out of money   the auctions were already won and the money ran out. A bid
 *                  rise makes it strictly worse: the same budget, spent faster.
 *
 * Telling somebody to raise the budget when they are being outbid is the most
 * expensive routine mistake in Search, and it is invisible unless somebody
 * opens a report nobody opens. So these assertions are about the two ways this
 * module could send a person the wrong way: naming a cause that did not
 * dominate, and reporting Google's own reporting CLAMP as if it were a
 * measurement.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import {
  competitionOf, shareOf, sharePct, rollUpCompetition,
  IS_CLAMP_HIGH, IS_CLAMP_LOW, MIN_IMPRESSIONS_FOR_SHARE, DOMINANT_LOSS,
  COMPETITION_VERDICTS,
} from '../lib/google/competition'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** Enough impressions that no assertion below is accidentally about the floor. */
const BIG = MIN_IMPRESSIONS_FOR_SHARE * 10

console.log('\n── a clamp is a bound, never a measurement ──')
{
  // Google reports ANY share above 0.9 as exactly 0.9 and any below 0.1 as
  // 0.0999. Printing "90%" as a point estimate is the bare-point-estimate
  // failure min-evidence.ts exists to prevent.
  const high = shareOf(IS_CLAMP_HIGH)
  check('a clamped-high share is carried as "over"', high?.bound === 'over', JSON.stringify(high))
  const low = shareOf(IS_CLAMP_LOW)
  check('a clamped-low share is carried as "under"', low?.bound === 'under', JSON.stringify(low))

  // THE BUG THIS LOCKS OUT: an earlier draft replaced the value with the clamp
  // CONSTANT, which nearly doubled a 5% loss inside the split that decides
  // whether somebody is told to raise a bid or a budget.
  check('a bounded share keeps the number Google actually reported',
    shareOf(0.05)?.value === 0.05, JSON.stringify(shareOf(0.05)))
  const mid = shareOf(0.42)
  check('a value between the clamps is exact', mid?.bound === null && mid.value === 0.42, JSON.stringify(mid))

  check('absent is null, never zero — "we do not know" is not "you showed nowhere"',
    shareOf(null) === null && shareOf(undefined) === null)
  check('…and a nonsense value is refused rather than rendered',
    shareOf(Number.NaN) === null && shareOf(-1) === null)

  const p = sharePct(shareOf(0.95))
  check('the bound survives all the way to the screen', p?.bound === 'over', JSON.stringify(p))
}

console.log('\n── the two losses are never merged, because their fixes are opposite ──')
{
  const budget = competitionOf({ impressions: BIG, impressionShare: 0.3, rankLost: 0.05, budgetLost: 0.65 })
  check('mostly out of money says so', budget.verdict === 'losingToBudget', budget.verdict)

  const rank = competitionOf({ impressions: BIG, impressionShare: 0.3, rankLost: 0.65, budgetLost: 0.05 })
  check('mostly outbid says so', rank.verdict === 'losingToRank', rank.verdict)

  // THE FAILURE THIS PREVENTS: naming one cause because it edged ahead sends
  // somebody to do half a job and conclude the tool was wrong.
  const both = competitionOf({ impressions: BIG, impressionShare: 0.3, rankLost: 0.36, budgetLost: 0.34 })
  check('a near-tie is reported as BOTH, not as whichever edged ahead',
    both.verdict === 'losingToBoth', both.verdict)
  check(`…and the tie-break is a stated threshold (${DOMINANT_LOSS})`,
    DOMINANT_LOSS > 0.5 && DOMINANT_LOSS < 1)

  // The attribution is of the LOSS, not of the total. Losing 20% to budget
  // means something completely different at 75% share than at 5%.
  check('the split is of what was MISSED, not of the whole auction',
    Math.abs((budget.ofLoss?.budget ?? 0) - 0.65 / 0.7) < 0.001,
    JSON.stringify(budget.ofLoss))
  check('…and the two sides sum to one', Math.abs((rank.ofLoss!.rank + rank.ofLoss!.budget) - 1) < 0.001)
}

console.log('\n── no verdict on evidence that cannot carry one ──')
{
  const thin = competitionOf({ impressions: 40, impressionShare: 0.2, rankLost: 0.8, budgetLost: 0 })
  check(`under ${MIN_IMPRESSIONS_FOR_SHARE} impressions there is no read`,
    thin.verdict === 'thin', thin.verdict)
  check('…and no cause is attributed either', thin.ofLoss === null)
  check('…but the numbers Google did give are still carried',
    thin.rankLost?.value === 0.8, JSON.stringify(thin.rankLost))

  // THIN and UNKNOWN are different sentences with different answers, and
  // collapsing them would tell somebody to wait when the real problem is that
  // nothing is reporting at all.
  const nothing = competitionOf({ impressions: BIG })
  check('nothing reported at all is UNKNOWN, not thin', nothing.verdict === 'unknown', nothing.verdict)

  const shareOnly = competitionOf({ impressions: BIG, impressionShare: 0.4 })
  check('a share with no loss breakdown attributes nothing rather than guessing',
    shareOnly.verdict === 'unknown' && shareOnly.ofLoss === null, shareOnly.verdict)
  check('…while still reporting the share itself', shareOnly.share?.value === 0.4)
}

console.log('\n── showing nearly everywhere is its own answer ──')
{
  // Over 90% there is no meaningful auction left to win, and the honest advice
  // is more keywords rather than more money — the opposite of both loss cases.
  const won = competitionOf({ impressions: BIG, impressionShare: 0.95, rankLost: 0.03, budgetLost: 0.02 })
  check('a clamped-high share reads as winning', won.verdict === 'winning', won.verdict)
  check('…and its share is stated as a bound rather than as a point estimate',
    won.share?.bound === 'over', JSON.stringify(won.share))
}

console.log('\n── an account roll-up is weighted by impressions ──')
{
  // A campaign with forty impressions and one with forty thousand are not two
  // equal opinions about the account. A plain mean lets the smallest campaign
  // in the account set the headline.
  const rolled = rollUpCompetition([
    { impressions: 40, impressionShare: 0.05, rankLost: 0.95, budgetLost: 0 },
    { impressions: 40_000, impressionShare: 0.8, rankLost: 0.05, budgetLost: 0.15 },
  ])
  check('the big campaign dominates the roll-up',
    (rolled.impressionShare ?? 0) > 0.75, String(rolled.impressionShare))
  check('…and the impressions add up', rolled.impressions === 40_040, String(rolled.impressions))

  const empty = rollUpCompetition([])
  check('an empty account rolls up to nulls, never to zeros',
    empty.impressionShare === null && empty.impressions === 0, JSON.stringify(empty))
  check('…and reads as unknown rather than as a verdict',
    competitionOf(empty).verdict === 'unknown')

  // The roll-up returns an INPUT, not a verdict: competitionOf stays the one
  // place a verdict is reached, so account and campaign cannot drift apart.
  check('the roll-up hands back inputs for the same single verdict function',
    !('verdict' in (rolled as object)), Object.keys(rolled).join(','))
}

console.log('\n── every verdict this module can reach has a sentence ──')
{
  const seen = new Set<string>()
  for (const c of [
    competitionOf({ impressions: BIG, impressionShare: 0.95 }),
    competitionOf({ impressions: BIG, impressionShare: 0.3, budgetLost: 0.7 }),
    competitionOf({ impressions: BIG, impressionShare: 0.3, rankLost: 0.7 }),
    competitionOf({ impressions: BIG, impressionShare: 0.3, rankLost: 0.35, budgetLost: 0.35 }),
    competitionOf({ impressions: 10, impressionShare: 0.3 }),
    competitionOf({ impressions: BIG }),
  ]) seen.add(c.verdict)
  const missing = COMPETITION_VERDICTS.filter((v) => !seen.has(v))
  check('every verdict is reachable — none is dead copy on the screen',
    missing.length === 0, missing.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} Google-competition rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe auction names one lever, or says it cannot.\n')
