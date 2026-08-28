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

console.log('\n── a rating is work ──')
{
  const q = code('lib/freehold/campaign-quality.ts')

  // `worked` gates whether the score is shown at all. It counted status
  // movement only, so seventy-five ratings moved it not at all and the page
  // said "none has been worked yet" above seventy-five judgments.
  check('a value-rated lead counts as worked',
    /typeof r\.value_rating === 'number'/.test(q.slice(q.indexOf('const workedIds'))), q.slice(q.indexOf('const workedIds'), q.indexOf('const workedIds') + 400))
  // Counted by lead id: a lead that is both moved and rated is one lead.
  check('…deduplicated by lead, not summed',
    /const workedIds = new Set<string>\(\)/.test(q) && /const worked = workedIds\.size/.test(q))

  // The old formula was funnel rates plus a ±15 nudge. With no funnel movement
  // every rate term is zero, so a campaign averaging 8/10 scored 9 — the
  // adjustment could only help where it was least needed.
  check('ratings alone produce a score, at full weight',
    /const ratingScore =/.test(q) && /avgValue \* 10/.test(q), q.slice(q.indexOf('const ratingScore'), q.indexOf('const ratingScore') + 200))
  // Outcomes still outrank opinions where both exist.
  check('…but the funnel still leads when it has actually moved',
    /const funnelMoved =/.test(q) && /funnelMoved && funnelScore !== null/.test(q))
  // Withheld, not zero, when genuinely nothing is known.
  check('nothing judged at all is still withheld, never scored 0',
    /: null$/m.test(q.slice(q.indexOf('const score ='), q.indexOf('const score =') + 700)))

  // The bands are named constants, shared with the write-back rule.
  check('the rating bands come from lead-stages, not retyped numbers',
    />= VALUABLE_RATING/.test(q) && /<= AVOID_RATING/.test(q))
  check('…and no bare 6 / 2 thresholds are left',
    !/value_rating as number\) >= 6/.test(q) && !/value_rating as number\) <= 2/.test(q))
}

console.log('\n── "worth calling" means either judgment ──')
{
  const q = code('lib/freehold/campaign-quality.ts')
  check('worthCalling unions status-qualified with well-rated',
    /QUALIFIED_STATUSES\.has\(st\)\) \|\| \(rating !== null && rating >= VALUABLE_RATING\)/.test(q), q.slice(q.indexOf('worthCallingIds'), q.indexOf('worthCallingIds') + 500))
  check('…deduplicated, so one lead is one lead',
    /const worthCalling = worthCallingIds\.size/.test(q))
  // A screen should be able to say which judgment it is leaning on rather than
  // blending them silently.
  check('…and says how many got there by rating alone',
    /worthCallingByRating/.test(q))

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
  const q = code('lib/freehold/campaign-quality.ts')
  check('the read reports its basis', /scoreBasis: CampaignQuality\['scoreBasis'\]/.test(q))
  check('…ratings when the funnel has not moved',
    /ratingScore !== null \? 'ratings'/.test(q))
  check('…and null when nothing is known', /scoreBasis[\s\S]{0,200}: null/.test(q))

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
