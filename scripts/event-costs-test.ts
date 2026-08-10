/**
 * What an event costs on this account — locked.
 *
 * `learning-phase.ts` decides how many ad sets a budget can carry, and the
 * whole calculation divides by one number: the observed cost per optimisation
 * event. That number had no producer. `EventCosts` was declared, tested and
 * imported by the planner, and every production call reached the planner with
 * it undefined — which switched the entire learning ceiling off. Four ad sets
 * were being planned for accounts that could not fund one.
 *
 * This file guards the producer, and three things it must never do:
 *
 *   1. Turn "no events" into a cost. Zero landing-page views does not mean
 *      landing-page views are free. A 0 here tells the planner an arm needs
 *      AED 0/day to learn, and it will approve any number of arms.
 *   2. Count `clicks` where Meta counts `link_click`. The bigger number
 *      divides the same spend by more events, understates the cost, and
 *      overstates how many arms the budget supports — the error points the
 *      wrong way, towards spending.
 *   3. Count one lead more than once. Meta reports the same lead under several
 *      overlapping action types.
 *
 * Pure — no network, no database. Runs in `pnpm guards`.
 */
import { eventCostsFromInsights, noCostsKnown, LINK_CLICK_ACTION, LANDING_VIEW_ACTION } from '../lib/meta/event-costs'
import { armsThatCanLearn } from '../lib/freehold/learning-phase'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const act = (action_type: string, value: number) => ({ action_type, value: String(value) })

console.log('\n── spend divided by the events it actually bought ──')
{
  const c = eventCostsFromInsights({
    spend: '1000',
    actions: [act(LINK_CLICK_ACTION, 80), act(LANDING_VIEW_ACTION, 50), act('lead', 5)],
  })
  check('cost per link click is spend over link clicks', c.link_click === 12.5, String(c.link_click))
  check('cost per landing view is spend over landing views', c.landing_view === 20, String(c.landing_view))
  check('cost per lead is spend over leads', c.lead === 200, String(c.lead))
  check('and the account is not treated as unmeasured', !noCostsKnown(c))
}

console.log('\n── an event nobody bought has no price ──')
{
  const c = eventCostsFromInsights({ spend: '1000', actions: [act(LINK_CLICK_ACTION, 80)] })
  check('no leads means the cost per lead is UNKNOWN, not zero',
    c.lead === null, String(c.lead))
  check('…and not Infinity either', c.lead === null && Number.isFinite(c.link_click ?? 0))
  check('no landing views means unknown too', c.landing_view === null, String(c.landing_view))

  // The reason rule 1 exists, stated as the arithmetic it prevents: a zero
  // cost per event makes any number of arms look affordable.
  check('a zero cost would have approved unlimited arms — which is why it is null',
    armsThatCanLearn(848, 0) === 0 && c.lead === null)

  const spent = eventCostsFromInsights({ spend: '0', actions: [act(LINK_CLICK_ACTION, 80)] })
  check('no spend at all measures nothing', noCostsKnown(spent), JSON.stringify(spent))
  const nothing = eventCostsFromInsights(null)
  check('no insights row at all measures nothing', noCostsKnown(nothing), JSON.stringify(nothing))
  check('an empty actions array measures nothing',
    noCostsKnown(eventCostsFromInsights({ spend: '500', actions: [] })))
}

console.log('\n── link clicks, not clicks ──')
{
  // Meta's `clicks` counts every click on the ad — a like, a profile tap, an
  // expand. Only `link_click` is the event Meta optimises on.
  const c = eventCostsFromInsights({
    spend: '1000',
    actions: [act(LINK_CLICK_ACTION, 80), act('post_engagement', 900), act('like', 400)],
  })
  check('engagement actions do not become link clicks', c.link_click === 12.5, String(c.link_click))
  check('…which keeps the arm count honest',
    armsThatCanLearn(848, c.link_click!) === 9, String(armsThatCanLearn(848, c.link_click!)))
  check('…where counting all 1,380 clicks would have claimed far more',
    armsThatCanLearn(848, 1000 / 1380) > 100)
}

console.log('\n── one lead is one lead ──')
{
  // The same lead arrives under several overlapping rollups. Summing them
  // multiplies the count, divides the spend too many ways, and reports a cost
  // per lead a fraction of the real one.
  const c = eventCostsFromInsights({
    spend: '1000',
    actions: [
      act('lead', 5),
      act('leadgen_grouped', 5),
      act('onsite_conversion.lead_grouped', 5),
      act('offsite_conversion.fb_pixel_lead', 5),
    ],
  })
  check('overlapping lead rollups are not summed', c.lead === 200, String(c.lead))

  const grouped = eventCostsFromInsights({
    spend: '1000',
    actions: [act('leadgen_grouped', 4), act('onsite_conversion.lead_grouped', 4)],
  })
  check('…and with no exact `lead` total the canonical rollup is used',
    grouped.lead === 250, String(grouped.lead))
}

console.log('\n── numbers arrive from Meta as strings ──')
{
  const c = eventCostsFromInsights({ spend: '1234.56', actions: [act(LINK_CLICK_ACTION, 100)] })
  check('a decimal string spend divides correctly',
    Math.abs((c.link_click ?? 0) - 12.3456) < 1e-9, String(c.link_click))
  check('junk in a value does not become a cost',
    eventCostsFromInsights({ spend: '1000', actions: [{ action_type: LINK_CLICK_ACTION, value: 'n/a' }] }).link_click === null)
}

if (failures > 0) {
  console.error(`\n${failures} event-cost rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe learning ceiling has a real number to stand on.\n')
