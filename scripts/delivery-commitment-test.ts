/**
 * FIFTY GOOD LEADS — the count that decides an invoice, locked.
 *
 * The client will not pay until fifty good leads have landed. That is a
 * commercial obligation with one dangerous word in it, and this suite locks the
 * three ways the number could quietly become the wrong one:
 *
 *   1. "GOOD" MUST NOT BE DECIDED BY US. Three tests exist in this system and
 *      they give different counts. Picking one and showing only it would be
 *      taking a side in somebody else's negotiation, and the side we picked
 *      would be the one that flatters us.
 *
 *   2. A LEAD THIS COMPANY DISOWNED CANNOT BE INVOICED. Archived and blocked
 *      rows pass nothing, whatever else is true of them.
 *
 *   3. THE FORECAST IS THE PART THAT LIES. "You need AED 5,000 more" is a
 *      division by the good rate, and a rate measured on two leads is a coin
 *      flip wearing a percentage. This account has already paid for exactly
 *      that mistake: a campaign read AED 168 per lead and over AED 8,000 per
 *      lead worth calling, because the cheap number was measured and the
 *      expensive one was not.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  DELIVERY_BARS, RECOMMENDED_BAR, FORECAST_REFUSALS, HOPELESS_RATE,
  passes, countAll, unratedCount, forecast, isHopeless,
  type CountableLead,
} from '../lib/freehold/delivery-commitment'
import { VALUABLE_RATING } from '../lib/freehold/lead-stages'
import { MIN_ATTRIBUTED_FOR_QUALITY } from '../lib/freehold/min-evidence'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const code = (p: string): string =>
  readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const lead = (o: Partial<CountableLead> = {}): CountableLead => ({
  phone: '+971501234567', email: 'a@b.com', status: 'new', valueRating: null, ...o,
})

console.log('\n── three tests, and we do not pick between them ──')
{
  check('all three bars exist and are distinct',
    DELIVERY_BARS.length === 3 && new Set(DELIVERY_BARS).size === 3, DELIVERY_BARS.join(','))
  check('the recommended bar is the human rating',
    RECOMMENDED_BAR === 'valuable', RECOMMENDED_BAR)

  // THE WHOLE POINT: the same leads give different counts, and the screen has
  // to show that rather than hide it behind one number.
  const leads = [
    lead({ valueRating: 8, status: 'qualified' }),          // passes all three
    lead({ valueRating: 3, status: 'qualified' }),          // rated low, in pipeline
    lead({ valueRating: null, status: 'new' }),             // contactable only
    lead({ phone: '123', email: '', status: 'new' }),       // passes nothing
  ]
  const bars = countAll(leads, 50)
  const of = (b: string) => bars.find((x) => x.bar === b)!.met
  check('contactable counts the reachable', of('contactable') === 3, String(of('contactable')))
  check('qualified counts the pipeline', of('qualified') === 2, String(of('qualified')))
  check('rated 6+ counts the judged', of('valuable') === 1, String(of('valuable')))
  check('…and the three genuinely disagree, which is why all three are shown',
    new Set([of('contactable'), of('qualified'), of('valuable')]).size === 3)

  // The bar is the house scale's own threshold, never a second copy of it.
  check('the rating bar is VALUABLE_RATING, not a number typed again',
    passes(lead({ valueRating: VALUABLE_RATING }), 'valuable')
      && !passes(lead({ valueRating: VALUABLE_RATING - 1 }), 'valuable'))
}

console.log('\n── a lead this company disowned is never invoiced ──')
{
  // Somebody archived or blocked it ON PURPOSE. Counting it toward a delivery
  // promise would be billing for a lead we ourselves threw away.
  for (const bar of DELIVERY_BARS) {
    check(`an archived lead passes nothing (${bar})`,
      !passes(lead({ valueRating: 10, status: 'closed', archived: true }), bar))
    check(`a blocked lead passes nothing (${bar})`,
      !passes(lead({ valueRating: 10, status: 'closed', blocked: true }), bar))
  }
  check('…and neither counts as merely unrated either',
    unratedCount([lead({ archived: true }), lead({ blocked: true })]) === 0)
}

console.log('\n── unrated is not failed ──')
{
  // AN UNRATED LEAD HAS NOT FAILED THE BAR — nobody has looked at it. On this
  // account that distinction is most of the answer: leads already bought and
  // paid for, one broker click away from counting.
  check('an unrated lead is counted as unrated', unratedCount([lead()]) === 1)
  check('…and a rated one is not', unratedCount([lead({ valueRating: 0 })]) === 0,
    'a lead rated zero would be reported as unlooked-at')

  // The rate must divide by what was JUDGED, not by everything bought.
  const db = code('lib/freehold/delivery-commitment-db.ts')
  check('the good rate divides by the rated leads, not by all of them',
    /judged = input\.bar === 'valuable'[\s\S]{0,120}valueRating != null/.test(db),
    'unrated leads would be counted as failures and the rate would read far worse than the truth')
}

console.log('\n── the forecast refuses rather than guesses ──')
{
  const base = { bar: 'valuable' as const, target: 50, met: 10, judged: 40, leadsBought: 200, spentAed: 4000 }

  // THE ONE THAT COSTS MONEY. Two rated leads is not a rate.
  const thin = forecast({ ...base, met: 1, judged: MIN_ATTRIBUTED_FOR_QUALITY - 1 })
  check('below the evidence floor it says so instead of forecasting',
    !thin.known && thin.reason === 'tooFewRated', JSON.stringify(thin))

  const done = forecast({ ...base, met: 50 })
  check('a met promise is done, not forecast', !done.known && done.reason === 'done')

  const free = forecast({ ...base, spentAed: 0 })
  check('no spend means no cost per lead to divide by',
    !free.known && free.reason === 'noSpend', JSON.stringify(free))

  // JUDGED ENOUGH AND NONE PASSED. The honest answer is not a huge number —
  // it is that budget is the wrong lever.
  const none = forecast({ ...base, met: 0, judged: 40 })
  check('judged enough with none good is named, not priced',
    !none.known && none.reason === 'noneGood', JSON.stringify(none))

  check('every refusal is walkable', FORECAST_REFUSALS.length === 4)
}

console.log('\n── and when it does answer, it answers with a range ──')
{
  // 10 good out of 40 rated = 25%, 200 leads for AED 4,000 = AED 20/lead.
  // 40 more good leads needed.
  const f = forecast({ bar: 'valuable', target: 50, met: 10, judged: 40, leadsBought: 200, spentAed: 4000 })
  check('it answers', f.known === true, JSON.stringify(f))
  if (f.known) {
    check('the rate is a range, not a point', f.rate.hi > f.rate.lo,
      `${f.rate.lo} ${f.rate.hi}`)
    check('…that brackets the naive 25%', f.rate.lo < 0.25 && f.rate.hi > 0.25,
      `${f.rate.lo}–${f.rate.hi}`)
    // INVERTED BOUNDS. A LOW rate means MANY leads needed, so the cheap end of
    // the spend range must come from the HIGH end of the rate range. Getting
    // this backwards is how a budget gets set from the optimistic figure.
    check('a worse rate means more leads needed, not fewer',
      f.leadsNeeded.hi > f.leadsNeeded.lo, `${f.leadsNeeded.lo} ${f.leadsNeeded.hi}`)
    check('…and the spend range follows the leads range',
      f.spendAed.hi > f.spendAed.lo, `${f.spendAed.lo} ${f.spendAed.hi}`)
    check('the naive answer sits inside the range',
      f.leadsNeeded.lo <= 160 && f.leadsNeeded.hi >= 160, `${f.leadsNeeded.lo}–${f.leadsNeeded.hi}`)
  }

  // MORE MONEY IS THE WRONG ANSWER below a certain rate, and a forecast that
  // merely returned a huge number would be read as a plan.
  const bad = forecast({ bar: 'valuable', target: 50, met: 1, judged: 200, leadsBought: 200, spentAed: 4000 })
  check('a hopeless rate is flagged as hopeless', bad.known === true && isHopeless(bad),
    JSON.stringify(bad))
  check('…and a healthy one is not', !isHopeless(f))
  check('the threshold is stated, not inlined', HOPELESS_RATE > 0 && HOPELESS_RATE < 0.5,
    String(HOPELESS_RATE))
}

console.log('\n── the screen shows all three and never invents a number ──')
{
  const panel = code('components/freehold/lead-rating-progress.tsx')
  check('the panel walks the bars rather than naming one',
    /DELIVERY_BARS\.map/.test(panel),
    'a bar added to the rule module would not appear on the screen')
  check('…and the two not selected are still shown',
    /totals\.filter\(\(b\) => b\.bar !== shown\)/.test(panel),
    'the screen shows one definition, which is taking a side in a negotiation')
  check('switching the bar re-reads the server',
    /useCallback[\s\S]{0,200}bar=\$\{shown\}/.test(panel) && /\}, \[target, shown\]\)/.test(panel),
    'one bar\'s count could be shown under another bar\'s forecast')
  // THE FORECAST IS BUILT AND NOT YET ON A SCREEN, and that is deliberate
  // rather than forgotten: "what finishing costs" is an ADS decision, and the
  // CRM panel that survives is for a broker who can only act on the unrated
  // count. The refusals stay walkable and translated so the ads-side surface
  // that renders them cannot ship a raw key — but nothing pretends they are
  // visible today.
  check('the forecast refusals stay walkable for whoever renders them',
    FORECAST_REFUSALS.length === 4 && new Set(FORECAST_REFUSALS).size === 4)
  const dict = code('lib/i18n/dictionaries/lm_core.ts')
  for (const r of FORECAST_REFUSALS) {
    check(`  "${r}" has a sentence waiting`, new RegExp(`'promise\\.cannot\\.${r}'`).test(dict))
  }
  // IT LIVES BESIDE THE WORK THAT MOVES IT. A target on a screen nobody can
  // act from is furniture; this one sits in the follow-up queue, where the
  // next unrated lead is one click away.
  const followUp = code('app/freehold-intelligence/crm/follow-up/page.tsx')
  check('the rating progress sits in the follow-up queue',
    /<LeadRatingProgress/.test(followUp),
    'the target is parked away from the queue that moves it')
  const adsHome = code('app/freehold-intelligence/lead-machine/page.tsx')
  check('…and not on the ads home, where it read as a scoreboard',
    !/LeadRatingProgress|DeliveryPromisePanel/.test(adsHome),
    'a progress bar on the ads home reads as "you are fine" to somebody who came to change something')
  check('…and no cost forecast is shown in the CRM',
    !/promise\.cost/.test(panel),
    'a broker rating leads cannot act on a budget range')

  const route = code('app/api/freehold/delivery/route.ts')
  check('the terms travel in the URL, not in a stored setting',
    /p\.get\('target'\)/.test(route) && /p\.get\('bar'\)/.test(route),
    'one side could change what was agreed with no trace of the change')
  check('an unknown bar falls back to the recommended one, never to a guess',
    /RECOMMENDED_BAR/.test(route))
  // Same rule the money card follows — a missing insights row is not zero spend.
  check('a missing spend row withholds the forecast rather than pricing from zero',
    /const spendKnown = row\?\.spend != null/.test(route))
}

console.log('\n── it counts the same leads the quality score counts ──')
{
  // TWO ATTRIBUTION RULES WOULD PUT TWO NUMBERS FOR ONE CAMPAIGN ON ONE SCREEN.
  const db = code('lib/freehold/delivery-commitment-db.ts')
  const quality = code('lib/freehold/campaign-quality.ts')
  const clause = /utm_id = \$1[\s\S]{0,200}lower\(utm_campaign\) = lower\(\$2\)/
  check('the promise uses the same attribution clause as the quality score',
    clause.test(db) && clause.test(quality),
    'the same campaign would report two different lead counts on two screens')
  check('archived rows are SELECTED and judged by the pure rule, not filtered in SQL',
    /SELECT phone, email, status, value_rating, archived, blocked/.test(db),
    'the "disowned leads are never invoiced" rule would live in a WHERE clause nobody can test')
}

if (failures > 0) {
  console.error(`\n${failures} delivery rule(s) broken.`)
  console.error('The number that decides an invoice is the one number that must not be flattering.')
  process.exit(1)
}
console.log('\nFifty good leads, counted three ways, forecast only when the evidence allows.\n')
