/**
 * Destination comparison, locked.
 *
 * The scenario this exists for is the one Ads Manager cannot show you: an
 * instant form that is genuinely cheaper per lead AND genuinely worse per
 * buyer. Every dashboard reports the first half. Acting on it moves the whole
 * budget onto the destination that produces more people who were not really
 * asking.
 *
 * So the assertions are aimed at the disagreement — cost per lead pointing one
 * way while cost per QUALIFIED lead points the other — and at refusing to call
 * a winner before the qualified counts can carry it.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import {
  compareDestinations, readArm, qualifyRateDiffers,
  DESTINATION_VISIBILITY, DESTINATION_LABEL, type DestinationArm,
} from '../lib/freehold/destination-trial'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))
const near = (a: number, b: number, tol = 0.01) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b))

console.log('\n── the readings ──')
{
  const r = readArm({ destination: 'form', spend: 4000, impressions: 200_000, leads: 80, qualified: 8 })
  check('cost per lead is the easy number', near(r.cpl!, 50), String(r.cpl))
  check('cost per QUALIFIED lead is the real one', near(r.cpql!, 500), String(r.cpql))
  check('the qualify rate is exposed', near(r.qualifyRate!, 0.1), String(r.qualifyRate))
  check('leads per million is available early', near(r.lpm!, 400), String(r.lpm))
  check('the qualified cost carries a range', r.cpqlRange !== null && r.cpqlRange.lo < r.cpql!)

  const none = readArm({ destination: 'landing', spend: 500, impressions: 10_000, leads: 0, qualified: 0 })
  check('no leads means no cost per lead — never zero', none.cpl === null, String(none.cpl))
  check('…and no qualified cost either', none.cpql === null)
  check('…but the range still floors it honestly', none.cpqlRange !== null && none.cpqlRange.lo > 0,
    JSON.stringify(none.cpqlRange))
}

console.log('\n── the case Ads Manager cannot show you ──')
{
  // Form: cheap leads, few survive.   Landing: dear leads, most survive.
  // CPL says form. Cost per qualified lead says landing. Only one is right.
  const arms: DestinationArm[] = [
    { destination: 'form',    spend: 6000, impressions: 300_000, leads: 120, qualified: 8 },
    { destination: 'landing', spend: 6000, impressions: 300_000, leads: 30,  qualified: 24 },
  ]
  const c = compareDestinations(arms)

  const form = c.arms.find((a) => a.destination === 'form')!
  const landing = c.arms.find((a) => a.destination === 'landing')!
  check('the form really is cheaper per lead', form.cpl! < landing.cpl!,
    `${form.cpl?.toFixed(0)} vs ${landing.cpl?.toFixed(0)}`)
  check('…and really is dearer per qualified lead', form.cpql! > landing.cpql!,
    `${form.cpql?.toFixed(0)} vs ${landing.cpql?.toFixed(0)}`)

  check('the winner is decided on qualified cost', c.winner === 'landing', c.winner)
  check('the disagreement is FLAGGED, not smoothed over', c.cplIsMisleading, JSON.stringify(c))
  check('the recommendation leads with the warning',
    /COST PER LEAD IS POINTING THE WRONG WAY/.test(c.recommendation), c.recommendation)
  check('…and quotes both qualify rates',
    /80%/.test(c.recommendation) && /7%/.test(c.recommendation), c.recommendation)
  check('…and says Ads Manager only shows the first number',
    /Ads Manager only shows the first/.test(c.recommendation), c.recommendation)

  const q = qualifyRateDiffers(arms[0], arms[1])
  check('the quality gap is established independently', q.established, String(q.p))
}

console.log('\n── it will not call a winner early ──')
{
  // Same shape, a tenth of the volume. Nothing can be concluded.
  const thin: DestinationArm[] = [
    { destination: 'form',    spend: 600, impressions: 30_000, leads: 12, qualified: 1 },
    { destination: 'landing', spend: 600, impressions: 30_000, leads: 3,  qualified: 2 },
  ]
  const c = compareDestinations(thin)
  check('a promising gap on small numbers is undecided', c.winner === 'undecided',
    `${c.winner} p=${c.pQualified}`)
  check('the headline says it is not established',
    /not established yet/.test(c.headline), c.headline)
  check('nothing is called misleading without significance', !c.cplIsMisleading)

  // Volume separates long before quality does — and must not be mistaken for it.
  const volumeOnly: DestinationArm[] = [
    { destination: 'form',    spend: 6000, impressions: 300_000, leads: 200, qualified: 3 },
    { destination: 'landing', spend: 6000, impressions: 300_000, leads: 20,  qualified: 2 },
  ]
  const v = compareDestinations(volumeOnly)
  check('raw volume having separated is not a verdict', v.winner === 'undecided', v.winner)
  check('…and the recommendation says why volume is the weaker basis',
    /counts a form's easier lead\s+as equal/.test(v.recommendation.replace(/\s+/g, ' ')) ||
    /easier lead/.test(v.recommendation), v.recommendation)
}

console.log('\n── what each destination makes it impossible to know ──')
{
  check('an instant form cannot carry a placement',
    DESTINATION_VISIBILITY.form.placement === false)
  check('…nor a landing-behaviour score', DESTINATION_VISIBILITY.form.landingBehaviour === false)
  check('a landing page can carry both',
    DESTINATION_VISIBILITY.landing.placement && DESTINATION_VISIBILITY.landing.landingBehaviour)

  // When the form wins, the cost of winning must be stated.
  const formWins: DestinationArm[] = [
    { destination: 'form',    spend: 6000, impressions: 300_000, leads: 120, qualified: 60 },
    { destination: 'landing', spend: 6000, impressions: 300_000, leads: 20,  qualified: 8 },
  ]
  const c = compareDestinations(formWins)
  check('the form can win', c.winner === 'form', `${c.winner} p=${c.pQualified}`)
  check('…and its blind spots are named when it does',
    c.blindSpots.length === 2, JSON.stringify(c.blindSpots))
  check('…including that the placement audit cannot run on it',
    c.blindSpots.some((b) => /placement audit cannot run/.test(b)), c.blindSpots.join(' | '))
  check('…and the recommendation carries the cost',
    /Knowing what it costs you/.test(c.recommendation), c.recommendation)
}

console.log('\n── one destination is not a comparison ──')
{
  const solo = compareDestinations([
    { destination: 'form', spend: 6000, impressions: 300_000, leads: 120, qualified: 60 },
  ])
  check('a single destination yields no winner', solo.winner === 'undecided')
  check('…and says the variable has never been tested',
    /never tested the variable/.test(solo.recommendation), solo.recommendation)
  check('…and names which one has run',
    /instant form/i.test(solo.headline), solo.headline)

  const none = compareDestinations([])
  check('no delivery does not throw', none.arms.length === 0 && none.winner === 'undecided')
  check('…and says so', /No destination has delivered/.test(none.headline), none.headline)
  check('the labels are human', DESTINATION_LABEL.form === 'Instant form' && DESTINATION_LABEL.landing === 'Landing page')
}

if (failures > 0) {
  console.error(`\n${failures} destination rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll destination rules hold.\n')
