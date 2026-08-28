/**
 * A RATING IS A JUDGMENT, AND THE PRODUCT HAS TO COUNT IT — locked.
 *
 * The screenshot that produced this file, on the account's best campaign:
 *
 *   "What this campaign bought — the dearest here: 0 leads worth calling at
 *    about AED 8k+ each."
 *   "Lead quality — 176 leads arrived and none has been worked yet, so there
 *    is nothing to score."
 *   Advisor: "Address zero CRM quality leads … a severe issue with lead
 *    quality that needs immediate investigation."  [Pause campaign]
 *
 * Seventy-five of those leads had been rated 8 or better by a broker.
 *
 * A lead can be judged two ways here and only one was counted. `qualified`
 * reads the STATUS column — somebody dragged a card through the funnel. The
 * 0–10 value rating is a broker's direct verdict on the lead, one click, and
 * campaign-quality.ts's own comment calls it "the strongest signal in the
 * product". A team that rates diligently and lets the status column lag was
 * therefore reported as having produced nothing.
 *
 * THE PRODUCT HAD ALREADY SETTLED THIS, IN THE OTHER DIRECTION. writeBackDecision
 * in lead-stages.ts sends `qualified` to Meta on `rating >= VALUABLE_RATING`,
 * reason 'rating'. So the optimiser was told these leads were qualified while
 * the operator and the advisor were told none of them were. One rule, two
 * answers — and the answer given to the person paying was the wrong one.
 *
 * These assertions pin the rule in every place that reads it, and — as much —
 * pin what was NOT done: the advisor still proposes pausing a campaign when
 * the evidence supports it. The fix was never to muzzle the advice. It was to
 * stop handing it a payload with the strongest signal missing.
 *
 * Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { VALUABLE_RATING, AVOID_RATING, QUALIFIED_STATUSES } from '../lib/freehold/lead-stages'
import { writeBackFor } from '../lib/freehold/lead-stages'
import { scoreLeads, type ScorableLead } from '../lib/freehold/campaign-score'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
/** Comments quote the very shapes they removed; scan code, not prose. */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

console.log('\n── the contradiction that started it ──')
{
  // Meta was already being told a well-rated lead is qualified. That is the
  // rule; the reads simply did not follow it.
  const d = writeBackFor({ status: 'new', valueRating: VALUABLE_RATING })
  check('a well-rated lead is reported to Meta as qualified',
    d.stage === 'qualified' && d.reason === 'rating', JSON.stringify(d))
  check('…and a poorly-rated one is not',
    writeBackFor({ status: 'new', valueRating: AVOID_RATING }).stage === null)
  // The status route still works — this is a union, not a replacement.
  check('a status-qualified lead still counts',
    writeBackFor({ status: [...QUALIFIED_STATUSES][0], valueRating: null }).stage === 'qualified')
}

/**
 * One attributed lead. Defaults are the state a Meta lead actually arrives in.
 *
 * Each gets a UNIQUE phone. Sharing one made every generated lead a duplicate
 * of every other — which is correct behaviour and useless as a fixture, since
 * the duplicate rule then swamps whatever the test was actually about.
 */
let seq = 0
const lead = (o: Partial<ScorableLead> = {}): ScorableLead => {
  seq += 1
  return {
    id: `l${seq}`, status: 'new', blocked: null,
    phone: `+9715${String(10_000_000 + seq)}`, behaviour_score: null,
    value_rating: null, deal_value_aed: null, ...o,
  }
}
const many = (n: number, o: Partial<ScorableLead> = {}) =>
  Array.from({ length: n }, () => lead(o))

console.log('\n── THE CAMPAIGN FROM THE SCREENSHOT ──')
{
  // 176 leads, none moved out of 'new', 75 of them rated 8 by a broker. This
  // is the account's best campaign, reported as worthless on three panels at
  // once with a Pause button beside it.
  const c = scoreLeads([...many(75, { value_rating: 8 }), ...many(101)])

  check('the leads are attributed', c.attributed === 176, String(c.attributed))
  // "none has been worked yet, so there is nothing to score" — above 75
  // judgments. Looking at a lead and deciding what it is worth is the most
  // deliberate act in the CRM.
  check('the 75 rated leads count as worked', c.worked === 75, String(c.worked))
  // "0 leads worth calling at about AED 8k+ each" — a division by a
  // denominator built from the status column alone.
  check('…and as worth calling', c.worthCalling === 75, String(c.worthCalling))
  check('…all of them by rating, since no card moved',
    c.worthCallingByRating === 75, String(c.worthCallingByRating))
  // The old formula was funnel rates plus a ±15 nudge: every rate term zero,
  // so an 8/10 average scored 9 out of 100.
  check('the score is 80, not 9', c.score === 80, String(c.score))
  check('…and says it was judged on ratings', c.scoreBasis === 'ratings', String(c.scoreBasis))
  check('the funnel counts stay honest — no card was moved',
    c.reached === 0 && c.qualified === 0 && c.won === 0,
    `${c.reached}/${c.qualified}/${c.won}`)
}

console.log('\n── and the opposite case is not flattered ──')
{
  // A campaign whose leads brokers rated badly must score badly. The fix must
  // not turn the rating into a way of making every campaign look fine.
  const bad = scoreLeads([...many(50, { value_rating: 1 }), ...many(50)])
  check('leads rated 1 score 10, not 80', bad.score === 10, String(bad.score))
  check('…and none of them is worth calling', bad.worthCalling === 0, String(bad.worthCalling))
  check('…and they are still counted as worked', bad.worked === 50, String(bad.worked))
  check('the avoid band is counted', bad.valueAvoid === 50, String(bad.valueAvoid))
}

console.log('\n── withheld still means withheld ──')
{
  // The rule this product states everywhere: a number facing a threshold is
  // the bound or a stated Withheld, never a bare guess.
  const untouched = scoreLeads(many(176))
  check('nobody has judged anything → no score at all',
    untouched.score === null && untouched.scoreBasis === null, String(untouched.score))
  check('…and worked is zero, so the card can say why', untouched.worked === 0)

  check('no leads at all → no score', scoreLeads([]).score === null)
  // Two ratings is not a sample. Below the floor the score stays withheld
  // rather than swinging on one broker's afternoon.
  const two = scoreLeads([...many(2, { value_rating: 10 }), ...many(50)])
  check('two ratings are not enough to score a campaign',
    two.score === null, String(two.score))
  check('…but they still count as worked, so the card does not say "untouched"',
    two.worked === 2, String(two.worked))
}

console.log('\n── outcomes outrank opinions where both exist ──')
{
  // A funnel that has moved leads; the rating adjusts it rather than replacing
  // it, exactly as before this change.
  const moved = scoreLeads([
    ...many(10, { status: 'qualified', value_rating: 9 }),
    ...many(10, { status: 'contacted' }),
    ...many(30),
  ])
  check('a moved funnel is scored as a funnel', moved.scoreBasis === 'funnel', String(moved.scoreBasis))
  check('…and the status-qualified leads are counted', moved.qualified === 10, String(moved.qualified))
  check('…and reached counts everything past new', moved.reached === 20, String(moved.reached))

  // ONE LEAD IS ONE LEAD. Both judgments on the same lead must not double it.
  const both = scoreLeads(many(10, { status: 'qualified', value_rating: 9 }))
  check('a lead that is both qualified and well-rated is counted once',
    both.worthCalling === 10, String(both.worthCalling))
  check('…and none of it is attributed to the rating alone',
    both.worthCallingByRating === 0, String(both.worthCallingByRating))
  check('…and worked does not double-count it either',
    both.worked === 10, String(both.worked))
}

console.log('\n── junk, duplicates and money are unchanged ──')
{
  // Regression cover for the parts the extraction moved but must not alter.
  const blocked = scoreLeads([...many(5, { blocked: true }), ...many(5)])
  check('a blocked lead is junk', blocked.junk === 5, String(blocked.junk))
  const badphone = scoreLeads([...many(3, { status: 'lost', phone: '12' }), ...many(7)])
  check('a lost lead with an undialable phone is junk', badphone.junk === 3, String(badphone.junk))

  // Same person delivered twice is spend paid twice.
  const dupes = scoreLeads([
    lead({ id: 'a', phone: '+971500000001' }),
    lead({ id: 'b', phone: '+971500000001' }),
    lead({ id: 'c', phone: '+971500000002' }),
  ])
  check('a repeated phone number is a duplicate', dupes.duplicates === 1, String(dupes.duplicates))
  check('…and counts as junk once', dupes.junk === 1, String(dupes.junk))

  // Only money against a WON lead counts — a value on a lead that later went
  // cold is a hope, not a receipt.
  const money = scoreLeads([
    lead({ status: 'closed', deal_value_aed: 1_000_000 }),
    lead({ status: 'lost', deal_value_aed: 5_000_000 }),
  ])
  check('only a won lead contributes revenue', money.revenueAed === 1_000_000, String(money.revenueAed))
}

console.log('\n── the read delegates to the arithmetic, and keeps no copy ──')
{
  const q = code('lib/freehold/campaign-quality.ts')
  check('the database read calls the pure scorer', /scoreLeads\(rows\)/.test(q))
  // A second copy is how the two answers drift apart again.
  check('…and does not score anything itself',
    !/const score = /.test(q) && !/QUALIFIED_STATUSES\.has/.test(q),
    'the read is still doing its own arithmetic')
}

console.log('\n── "worth calling" means either judgment ──')
{
  // The union and the deduplication are proven by arithmetic above; what is
  // asserted here is that every CALLER reads it.
  // THE MONEY PANEL. "0 leads worth calling at about AED 8k+ each" was a
  // division by a denominator of zero built from the status column.
  const money = code('app/api/meta/campaigns/[id]/money/route.ts')
  check('the money ladder prices against worthCalling',
    /qualified: quality\?\.worthCalling \?\? 0/.test(money), money.slice(money.indexOf('qualified:'), money.indexOf('qualified:') + 120))
  const sv = code('lib/freehold/smart-view-build.ts')
  check('the campaign sheet counts worthCalling',
    /worthCalling: quality\?\.worthCalling \?\? 0/.test(sv))
  check('…on every channel, not just Meta',
    (sv.match(/worthCalling: quality\?\.worthCalling \?\? 0/g) ?? []).length >= 2,
    String((sv.match(/worthCalling: quality\?\.qualified/g) ?? []).length) + ' still on status')
  check('nothing still reads the status column for "worth calling"',
    !/worthCalling: quality\?\.qualified/.test(sv))
}

console.log('\n── the advisor is given the ratings, not protected from the data ──')
{
  const adv = code('app/api/freehold/ads/advisor/route.ts')
  const raw = read('app/api/freehold/ads/advisor/route.ts')

  // THE ACTUAL BUG. The payload carried five funnel counts and a score, and
  // nothing about the ratings. The model read {reached:0, qualified:0, won:0}
  // and reasoned correctly to a false conclusion.
  for (const field of ['valueRated', 'avgValueOutOf10', 'ratedValuable', 'ratedAvoid', 'worthCalling', 'worked']) {
    check(`the advisor is told ${field}`, new RegExp(`${field}:`).test(adv), 'missing from crmQuality')
  }
  // The two signals must not be blended in the model's head either.
  check('…and told the two judgments are different things',
    /TWO independent judgments of lead quality/.test(raw))
  check('…and told a rated-well campaign with a slow queue is not "zero quality"',
    /never call it "zero quality"/.test(raw))
  check('…and that an unjudged queue is the team\'s problem, not the budget\'s',
    /not a verdict on the campaign, and the action belongs to the team/.test(raw))

  // WHAT WAS DELIBERATELY NOT DONE. The operator's instruction was explicit:
  // do not fix this by making the advisor stop offering the action. Pausing a
  // campaign remains available and remains gated on the campaign's real state
  // — the change is to what it can see before it decides.
  check('pausing a campaign is still something the advisor can propose',
    /'pause_campaign'/.test(code('lib/freehold/advisor-actions.ts')))
  check('…still validated against the real campaign status',
    /campaignStatus === 'ACTIVE'/.test(code('lib/freehold/advisor-actions.ts')))
}

console.log('\n── and the panel says what it judged on ──')
{
  // The basis is proven by arithmetic in the sections above; here it is only
  // asserted that the SCREEN says it, which no unit test can see.

  const page = code('app/freehold-intelligence/ads-live/meta/[id]/page.tsx')
  // An 82 above a funnel row reading "qualified 0" is a panel arguing with
  // itself, and that argument is the question this change came from.
  check('the panel states the basis when it is ratings',
    /quality\.scoreBasis === 'ratings'/.test(page) && /lm\.cmd\.qualityFromRatings/.test(page))
  check('…and the worth-calling tile counts either judgment',
    /v: quality\.worthCalling/.test(page), page.slice(page.indexOf("fQualified"), page.indexOf("fQualified") + 200))
}

console.log(failures === 0
  ? '\n✅ both judgments of a lead are counted, and the advisor can see both.'
  : `\n❌ ${failures} rating-is-work guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
