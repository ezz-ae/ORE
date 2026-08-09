/**
 * WHAT META IS BUYING, AND THEREFORE WHAT THE CAP CAPS — locked.
 *
 * The wizard had a field labelled "max cost per lead". It becomes Meta's
 * `bid_amount`, and `bid_amount` caps the cost of whatever `optimization_goal`
 * the ad set was given — a goal nobody chose, derived from the objective.
 *
 * On a WhatsApp ad that goal is LINK_CLICKS. So the default launch was sending
 * COST_CAP at AED 150 PER LINK CLICK: perhaps thirty times what a Dubai
 * property click costs, which is to say no cap at all, under a label promising
 * one. The two objectives a brokerage reaches for most — WhatsApp and the
 * landing-page ad — were the two where the control did nothing.
 *
 * The rule locked here is narrow and absolute: THE WORDS "PER LEAD" MAY ONLY
 * APPEAR WHERE META IS ACTUALLY OPTIMISING FOR LEADS. Everything else follows
 * from that.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { objectiveToOptimizationGoal, capUnitFor, capIsPerLead } from '../lib/meta/optimization-goal'
import type { MetaOptimizationGoal } from '../lib/meta/types'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── every objective the wizard offers, and what Meta then buys ──')
{
  // The wizard's own PRODUCT_OBJECTIVES table, restated. If these drift apart,
  // the screen and the payload disagree — which is the whole fault this file
  // exists to prevent.
  const goal = (o: Parameters<typeof objectiveToOptimizationGoal>[0], pixel: boolean, d?: Parameters<typeof objectiveToOptimizationGoal>[2]) =>
    objectiveToOptimizationGoal(o, pixel, d)

  check('the instant-form ad buys leads',
    goal('LEAD_GENERATION', false, 'form') === 'LEAD_GENERATION')
  check('the call ad buys calls',
    goal('LINK_CLICKS', false, 'phone') === 'QUALITY_CALL')
  check('the WhatsApp ad buys CLICKS — not leads',
    goal('LINK_CLICKS', false, 'whatsapp') === 'LINK_CLICKS')
  check('the landing ad with no pixel buys page views, not leads',
    goal('LEAD_GENERATION', false, 'landing') === 'LANDING_PAGE_VIEWS')
  check('…and with a pixel it buys real conversions',
    goal('LEAD_GENERATION', true, 'landing') === 'OFFSITE_CONVERSIONS')
  check('the plain traffic ad buys clicks',
    goal('LINK_CLICKS', true, 'landing') === 'LINK_CLICKS')
  check('a pixel cannot rescue an objective that never asked for conversions',
    goal('LINK_CLICKS', true, 'whatsapp') === 'LINK_CLICKS')
}

console.log('\n── "per lead" may only be printed where leads are being bought ──')
{
  check('a form ad may say per lead', capIsPerLead('LEAD_GENERATION'))
  check('a pixel conversion ad may say per lead', capIsPerLead('OFFSITE_CONVERSIONS'))
  check('a WhatsApp ad may NOT — it is a cap on clicks',
    !capIsPerLead('LINK_CLICKS') && capUnitFor('LINK_CLICKS') === 'click')
  check('a landing ad with no pixel may NOT — it is a cap on page views',
    !capIsPerLead('LANDING_PAGE_VIEWS') && capUnitFor('LANDING_PAGE_VIEWS') === 'view')
  check('a call ad says per call, which is its own thing',
    capUnitFor('QUALITY_CALL') === 'call' && !capIsPerLead('QUALITY_CALL'))
}

console.log('\n── the whole path, end to end: objective → goal → what the label may say ──')
{
  const CASES: Array<{ what: string; goal: MetaOptimizationGoal; unit: string; perLead: boolean }> = [
    { what: 'Meta lead form',      goal: objectiveToOptimizationGoal('LEAD_GENERATION', false, 'form'),      unit: 'lead',  perLead: true  },
    { what: 'WhatsApp',            goal: objectiveToOptimizationGoal('LINK_CLICKS', false, 'whatsapp'),      unit: 'click', perLead: false },
    { what: 'Call',                goal: objectiveToOptimizationGoal('LINK_CLICKS', false, 'phone'),         unit: 'call',  perLead: false },
    { what: 'Landing, no pixel',   goal: objectiveToOptimizationGoal('LEAD_GENERATION', false, 'landing'),   unit: 'view',  perLead: false },
    { what: 'Landing, with pixel', goal: objectiveToOptimizationGoal('LEAD_GENERATION', true, 'landing'),    unit: 'lead',  perLead: true  },
  ]
  for (const c of CASES) {
    check(`${c.what}: the cap is per ${c.unit}`,
      capUnitFor(c.goal) === c.unit && capIsPerLead(c.goal) === c.perLead,
      `${c.goal} → ${capUnitFor(c.goal)}`)
  }
  // The count that matters: on the five real objectives, only two may honestly
  // print "per lead". Before this, all five did.
  check('exactly two of the five may say "per lead"',
    CASES.filter((c) => capIsPerLead(c.goal)).length === 2)
}

console.log('\n── a goal Meta adds later is never assumed to be a lead ──')
{
  const unknown = 'SOME_NEW_GOAL_2027' as MetaOptimizationGoal
  check('an unrecognised goal caps clicks, the cheapest event',
    capUnitFor(unknown) === 'click', capUnitFor(unknown))
  check('…and it certainly does not claim to cap the cost of a lead',
    !capIsPerLead(unknown))
}

if (failures > 0) {
  console.error(`\n${failures} cost-cap rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe cap is named after the thing it actually caps.\n')
