/**
 * THE LEARNING PHASE — the constraint that decides how many arms an account
 * can actually afford to run.
 *
 * Meta needs roughly 50 optimisation events per ad set per 7 days before
 * delivery stabilises. Below that the ad set sits in Learning Limited: costs
 * swing, delivery is erratic, and — worst for us — the numbers it produces are
 * not a fair read of the audience. An arm stuck in learning is not a slow
 * experiment. It is a broken instrument that still prints results.
 *
 * This is the real objection to splitting a level schema across many ad sets,
 * and it is arithmetic rather than opinion:
 *
 *     daily budget needed per arm = (50 x cost per event) / 7
 *
 * On the account this was built from — AED 848/day, blended cost per lead
 * AED 195.69 — ONE arm optimising for leads needs AED 1,398/day. The account
 * cannot get a single arm out of learning, let alone four. A planner that
 * cheerfully returns four arms there is not planning; it is producing four
 * broken instruments and a confident-looking screen.
 *
 * THE WAY THROUGH IS THE OPTIMISATION EVENT, NOT THE BUDGET. Fifty leads a
 * week is unreachable; fifty link clicks a week is not. The same account
 * supports nine arms optimising on clicks. So an exploratory arm — one that
 * exists to find out whether a level is worth anything — should optimise on a
 * shallow, plentiful event, where it can genuinely learn and where the signal
 * we actually read from it (leads per million impressions, from the
 * registration snapshot) does not depend on Meta's optimisation target at all.
 * Lead optimisation is reserved for arms that have earned the budget to
 * sustain it.
 *
 * That is not a workaround. An arm's job is to tell us whether a level is
 * worth buying, and we measure that ourselves from impressions and snapshots.
 * Asking Meta to optimise for a conversion it will only see nine times a week
 * buys nothing and costs stability.
 *
 * Pure — no I/O, no clock.
 */

/** Meta's documented threshold for exiting the learning phase. */
export const LEARNING_EVENTS = 50
export const LEARNING_WINDOW_DAYS = 7

/**
 * What an ad set can be told to optimise for, cheapest and most plentiful
 * first. The order is the ladder: an arm that cannot learn on one rung should
 * be moved DOWN it, not given more budget it does not have.
 */
export type OptimisationEvent = 'link_click' | 'landing_view' | 'lead'

export const EVENT_LABEL: Record<OptimisationEvent, string> = {
  link_click: 'Link clicks',
  landing_view: 'Landing page views',
  lead: 'Leads',
}

/** Observed cost per event, in AED. Any absent rung is estimated from the
 *  ones present rather than invented — and when nothing is known, the caller
 *  gets told so rather than given a default that looks like a measurement. */
export interface EventCosts {
  link_click?: number | null
  landing_view?: number | null
  lead?: number | null
}

/** Daily budget one arm needs to exit learning on a given event. */
export const dailyBudgetToLearn = (costPerEvent: number): number =>
  (LEARNING_EVENTS * costPerEvent) / LEARNING_WINDOW_DAYS

/** How many arms a budget can carry on a given event. Floor, not round — half
 *  an arm out of learning is an arm in learning. */
export const armsThatCanLearn = (dailyBudgetAed: number, costPerEvent: number): number =>
  costPerEvent > 0 ? Math.floor(dailyBudgetAed / dailyBudgetToLearn(costPerEvent)) : 0

export interface LearningVerdict {
  /** The event these arms should optimise for, given the budget. */
  event: OptimisationEvent | null
  costPerEvent: number | null
  /** Budget one arm needs on that event. */
  perArmDailyAed: number
  /** How many arms the budget supports on it. */
  supportedArms: number
  /** Arms the caller asked for. */
  requestedArms: number
  /** True when every requested arm can exit learning. */
  fits: boolean
  headline: string
  recommendation: string
}

/**
 * Pick the optimisation event that lets the requested arms actually learn, and
 * say plainly when none does.
 *
 * Walks the ladder from the deepest event to the shallowest — lead first,
 * because a lead is what we actually want, and only stepping down when the
 * arithmetic refuses. Stepping down is not a compromise on measurement: the
 * signal we read from an arm comes from the registration snapshot and the
 * impression count, neither of which depends on what Meta was optimising for.
 */
export function chooseOptimisation(
  requestedArms: number,
  dailyBudgetAed: number,
  costs: EventCosts,
): LearningVerdict {
  const ladder: OptimisationEvent[] = ['lead', 'landing_view', 'link_click']
  const known = ladder
    .map((e) => ({ event: e, cost: costs[e] }))
    .filter((x): x is { event: OptimisationEvent; cost: number } => typeof x.cost === 'number' && x.cost > 0)

  if (known.length === 0) {
    return {
      event: null, costPerEvent: null, perArmDailyAed: 0, supportedArms: 0, requestedArms, fits: false,
      headline: 'No cost per event is known yet, so the learning-phase budget cannot be computed.',
      recommendation: 'Run one arm until it has produced enough clicks and leads to measure a cost. Splitting the budget before that is guessing at a number this calculation depends on.',
    }
  }

  for (const { event, cost } of known) {
    const supported = armsThatCanLearn(dailyBudgetAed, cost)
    if (supported >= requestedArms && requestedArms > 0) {
      return {
        event, costPerEvent: cost,
        perArmDailyAed: Math.round(dailyBudgetToLearn(cost)),
        supportedArms: supported, requestedArms, fits: true,
        headline: `${requestedArms} arm${requestedArms === 1 ? '' : 's'} optimising for ${EVENT_LABEL[event].toLowerCase()} — each needs AED ${Math.round(dailyBudgetToLearn(cost))}/day to clear the learning phase, and the budget supports ${supported}.`,
        recommendation: event === 'lead'
          ? 'Optimising for the real objective and every arm can still learn. Nothing to trade off here.'
          : `Optimising for ${EVENT_LABEL[event].toLowerCase()} rather than leads, because ${LEARNING_EVENTS} leads a week per arm is out of reach at this budget. This does not weaken the read: what each arm is worth is measured from its own registration snapshots and impressions, not from Meta's optimisation target.`,
      }
    }
  }

  // Nothing on the ladder fits. Report against the CHEAPEST event, since that
  // is the most favourable honest framing, and say how many arms do fit.
  const cheapest = known[known.length - 1]
  const supported = armsThatCanLearn(dailyBudgetAed, cheapest.cost)
  const perArm = Math.round(dailyBudgetToLearn(cheapest.cost))
  return {
    event: cheapest.event, costPerEvent: cheapest.cost, perArmDailyAed: perArm,
    supportedArms: supported, requestedArms, fits: false,
    headline: supported === 0
      ? `AED ${Math.round(dailyBudgetAed)}/day cannot bring even one arm out of the learning phase — one arm needs AED ${perArm}/day at ${EVENT_LABEL[cheapest.event].toLowerCase()} of AED ${cheapest.cost.toFixed(2)}.`
      : `The budget supports ${supported} arm${supported === 1 ? '' : 's'} out of learning, not ${requestedArms}.`,
    recommendation: supported === 0
      ? `Run a single ad set until the budget or the cost per event supports splitting it. ${requestedArms} arms here would produce ${requestedArms} ad sets stuck in Learning Limited, each reporting numbers that are not a fair read of its audience.`
      : `Cut to ${supported} arm${supported === 1 ? '' : 's'} and add the others once the budget grows. An arm in Learning Limited is not a slow experiment — it is a broken instrument that still prints results.`,
  }
}

/**
 * The other half of the objection, and the one nobody budgets for: Meta RESETS
 * the learning phase on a significant edit — the targeting, the optimisation
 * goal, the creative, or a budget change past roughly 20%.
 *
 * A system that rotates arms and moves budget every night can therefore hold
 * every ad set in permanent learning while believing it is optimising. This is
 * the cost of tuning, stated as a number so it can be weighed against the
 * benefit rather than ignored.
 */
export const LEARNING_RESET_BUDGET_CHANGE = 0.2

export function wouldResetLearning(fromAed: number, toAed: number): boolean {
  if (fromAed <= 0) return true
  return Math.abs(toAed - fromAed) / fromAed > LEARNING_RESET_BUDGET_CHANGE
}

/** A budget change that gets as close as possible to the target without
 *  tripping a learning reset. Returns the target itself when it is already
 *  safe. */
export function safeBudgetStep(fromAed: number, targetAed: number): number {
  if (!wouldResetLearning(fromAed, targetAed)) {
    // The round itself can cross the boundary the target just passed: from
    // 288, a target of 345.6 is exactly 20%, and Math.round hands back 346 —
    // 20.14%, a reset manufactured by the rounding. When the plain round
    // crosses, round towards the current budget instead.
    const rounded = Math.round(targetAed)
    if (!wouldResetLearning(fromAed, rounded)) return rounded
    return targetAed > fromAed ? Math.floor(targetAed) : Math.ceil(targetAed)
  }
  const up = targetAed > fromAed
  // ROUND TOWARDS THE CURRENT BUDGET, never away from it. Math.round would
  // cross the very threshold this function exists to respect: from 288, a
  // rounded +20% is 346, which is 20.14% — a reset, produced by the guard
  // against resets. Flooring a raise and ceiling a cut keeps the result inside
  // the bound at every budget, at a cost of at most one dirham.
  const bound = fromAed * (1 + (up ? 1 : -1) * LEARNING_RESET_BUDGET_CHANGE)
  const stepped = up ? Math.floor(bound) : Math.ceil(bound)
  // A budget so small that a whole-dirham step cannot move it without
  // tripping the bound stays where it is. Returning `fromAed` means "no safe
  // step exists", and callers already treat a non-increase as nothing to do.
  return wouldResetLearning(fromAed, stepped) ? Math.round(fromAed) : stepped
}
