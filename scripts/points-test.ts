/**
 * PAYING FOR ACCURATE RATINGS WITHOUT PAYING FOR A SELF-FULFILLING ONE — locked.
 *
 * A rating that changes nothing is worse than no rating: it costs ten seconds a
 * lead and buys a number in a column, so brokers stop within a week — and the
 * rating is the strongest signal this product has. So rating pays.
 *
 * The trap that decides whether that works: pay for ACCURATE ratings and you
 * get a broker who rates a lead 1, never calls it, and is proven right by their
 * own inaction. The product would be funding people to write leads off instead
 * of working them.
 *
 * This suite locks the five refusals that close every way to print points:
 *
 *   notWorked      — you are not paid for judging what you never touched
 *   knewTheAnswer  — a forecast made after the answer is not a forecast
 *   notFirst       — only the first rating earns; a later edit saw the outcome
 *   noForecast     — "I do not know" is legitimate, and unpaid
 *   tooEarly       — a forecast judged the next morning is not judged
 *
 * Pure — no network, no clock. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  RATING_BANDS, LEAD_OUTCOMES, CLAIM_VERDICTS,
  POINTS_PER_ACCURATE_RATING, MAX_REFUND_SHARE_OF_SPEND, DEFAULT_SEASON_DAYS,
  bandOf, forecastHeld, settleClaim, refundCeiling, applyCeiling,
  ratingRefundReference, outcomeOf,
  type RatingClaim, type ClaimSettlement,
} from '../lib/freehold/points'
import { VALUABLE_RATING, AVOID_RATING, DEAL_RATING } from '../lib/freehold/lead-stages'
import {
  aedOf, cashText, CREDIT_VALUE_AED, TIER_MONTHLY_QUOTA, MAX_CREDIT_AMOUNT,
  creditsEarnedForCommission, creditsForDailyBudget,
  REDENOMINATION_FACTOR, REDENOMINATION_REFERENCE,
} from '../lib/freehold/credits-shared'

/**
 * A source file with its comments removed.
 *
 * Every guard below that scans source must go through this. A rule's header
 * states the pattern it forbids so the next reader knows WHY it is forbidden,
 * and a scanner that reads prose as code fails on the explanation — which
 * teaches people to delete the explanation.
 */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const NOW = new Date('2026-08-13T12:00:00Z')
/** Rated a month ago, so every claim below is seasoned unless it says otherwise. */
const RATED = '2026-07-13T12:00:00Z'

const claim = (o: Partial<RatingClaim> = {}): RatingClaim => ({
  leadId: 'l1', brokerId: 'b1', rating: 8, ratedAt: RATED,
  isFirstRating: true, outcomeAtRating: 'stalled', outcomeNow: 'qualified',
  worked: true, ...o,
})
const verdict = (o: Partial<RatingClaim> = {}, seasonDays?: number) =>
  settleClaim(claim(o), { now: NOW, seasonDays })

console.log('\n── the house scale, as a forecast ──')
{
  check('ten is a deal', bandOf(DEAL_RATING) === 'deal')
  check('eight is good', bandOf(8) === 'good' && bandOf(VALUABLE_RATING) === 'good')
  check('two is avoid', bandOf(AVOID_RATING) === 'avoid' && bandOf(0) === 'avoid')
  // 3–5 is "neither" on the house scale, and neither is not a forecast.
  check('a five forecasts nothing', bandOf(5) === 'unsure' && bandOf(3) === 'unsure')
  check('nonsense forecasts nothing', bandOf(NaN) === 'unsure')

  check('a good call is proven by a qualified lead', forecastHeld('good', 'qualified'))
  check('…and by a sale', forecastHeld('good', 'won'))
  check('an avoid is proven by a lead that went nowhere',
    forecastHeld('avoid', 'stalled') && forecastHeld('avoid', 'junk'))
  // Ten is the strongest claim on the scale. Only money proves it.
  check('a ten is only proven by a sale',
    forecastHeld('deal', 'won') && !forecastHeld('deal', 'qualified'))
  check('an unsure can never be right', LEAD_OUTCOMES.every((o) => !forecastHeld('unsure', o)))
}

console.log('\n── THE ONE THAT DECIDES WHETHER THIS WORKS ──')
{
  // A broker rates a lead 1, never calls it, and is proven right by their own
  // inaction. Paying that teaches the product to fund writing leads off.
  const lazy = verdict({ rating: 1, worked: false, outcomeNow: 'stalled' })
  check('an accurate rating on a lead nobody worked pays NOTHING',
    lazy.verdict === 'notWorked' && lazy.points === 0, JSON.stringify(lazy))

  // …and the same rating on a lead somebody actually worked DOES pay. The
  // rule is about the work, not about the direction of the call.
  const honest = verdict({ rating: 1, worked: true, outcomeNow: 'stalled' })
  check('the same call on a lead they DID work pays',
    honest.verdict === 'paid' && honest.points === POINTS_PER_ACCURATE_RATING,
    JSON.stringify(honest))

  // 'notWorked' outranks being right, deliberately: paying it would teach the
  // wrong lesson loudest.
  check('not working it outranks having been right',
    verdict({ rating: 9, worked: false, outcomeNow: 'won' }).verdict === 'notWorked')
}

console.log('\n── a forecast made after the answer is not a forecast ──')
{
  // Rating a closed deal 10 is copying, not judging.
  check('rating a lead that had already closed pays nothing',
    verdict({ rating: 10, outcomeAtRating: 'won', outcomeNow: 'won' }).verdict === 'knewTheAnswer')
  check('…and one that had already qualified pays nothing either',
    verdict({ rating: 9, outcomeAtRating: 'qualified', outcomeNow: 'won' }).verdict === 'knewTheAnswer')
  // A lead that had gone quiet is still a real forecast — nothing was known.
  check('a lead that had gone quiet is still an open question',
    verdict({ rating: 9, outcomeAtRating: 'stalled', outcomeNow: 'won' }).verdict === 'paid')
}

console.log('\n── only the first rating earns ──')
{
  // Rate 5, watch for a month, edit to 9. That is not a better forecast, it is
  // looking at the answer. The edit still feeds the audiences; it is not paid.
  check('a later edit earns nothing, however right it is',
    verdict({ rating: 10, isFirstRating: false, outcomeNow: 'won' }).verdict === 'notFirst')
  check('…and the first one still does',
    verdict({ rating: 10, isFirstRating: true, outcomeNow: 'won' }).verdict === 'paid')
}

console.log('\n── "I do not know" is legitimate, and unpaid ──')
{
  const five = verdict({ rating: 5, outcomeNow: 'won' })
  check('a middling rating pays nothing', five.verdict === 'noForecast' && five.points === 0)
  // NOT PUNISHED. Nothing is deducted — a broker who genuinely cannot tell
  // should say so rather than guess to chase a point.
  check('…and nothing is taken away for it', five.points >= 0)
}

console.log('\n── a forecast is judged after it has had time ──')
{
  const fresh = settleClaim(claim({ rating: 9, outcomeNow: 'won' }), {
    now: NOW, seasonDays: DEFAULT_SEASON_DAYS,
  })
  check('a month-old rating is ready to judge', fresh.verdict === 'paid')

  const yesterday = settleClaim(
    claim({ rating: 9, ratedAt: '2026-08-12T12:00:00Z', outcomeNow: 'won' }),
    { now: NOW },
  )
  check('yesterday\'s rating is not judged yet', yesterday.verdict === 'tooEarly', yesterday.verdict)
  // The account's own measured cycle wins over the default when there is one.
  const longCycle = settleClaim(claim({ rating: 9, outcomeNow: 'won' }), { now: NOW, seasonDays: 90 })
  check('a slower account waits longer', longCycle.verdict === 'tooEarly', longCycle.verdict)
  check('a broken timestamp is never paid',
    settleClaim(claim({ ratedAt: 'not a date' }), { now: NOW }).verdict === 'tooEarly')
  check(`the default season is ${DEFAULT_SEASON_DAYS} days`, DEFAULT_SEASON_DAYS === 7)
}

console.log('\n── being wrong pays nothing, and costs nothing ──')
{
  const wrong = verdict({ rating: 9, outcomeNow: 'junk' })
  check('a confident call that went nowhere pays nothing',
    wrong.verdict === 'wrong' && wrong.points === 0, JSON.stringify(wrong))
  check('…and nothing is deducted for it', wrong.points === 0)
  check('an avoid on a lead that closed pays nothing',
    verdict({ rating: 1, outcomeNow: 'won' }).verdict === 'wrong')
}

console.log('\n── rating can never out-earn advertising ──')
{
  // Past the ceiling the cheapest way to get points would be to buy a few
  // leads and rate a great many, and an economy whose best strategy is not
  // advertising is a broken economy.
  check('the ceiling is a share of what was actually spent',
    refundCeiling(100) === Math.floor(100 * MAX_REFUND_SHARE_OF_SPEND), String(refundCeiling(100)))
  check('an account that spent nothing can earn nothing', refundCeiling(0) === 0)
  check('…and a nonsense spend earns nothing', refundCeiling(NaN) === 0)
  check('the share is a half', MAX_REFUND_SHARE_OF_SPEND === 0.5)

  const paidRow = (): ClaimSettlement => ({ verdict: 'paid', points: 1, band: 'good' })
  const ten = Array.from({ length: 10 }, paidRow)
  const capped = applyCeiling(ten, { spentThisCycle: 8, alreadyRefundedThisCycle: 0 })
  check('only what fits under the ceiling is paid', capped.paid === 4, String(capped.paid))
  check('…and the rest is reported, not dropped',
    capped.cappedOut === 6 && capped.settled.length === 10,
    `${capped.cappedOut} / ${capped.settled.length}`)
  // A BROKER WHO HIT THE CAP SHOULD SEE THAT THEY HIT IT.
  check('a capped row is still on the list with zero points',
    capped.settled.filter((s) => s.points === 0).length === 6)

  // AND IT MUST NOT BE 'tooEarly'. The caller marks anything it settles as
  // done, so reusing that verdict closed a right call for ever, worth nothing,
  // and told the broker it was too soon to tell. They earned it and lost it.
  check('a capped row is CAPPED, never "too soon to tell"',
    capped.settled.filter((s) => s.points === 0).every((s) => s.verdict === 'cappedOut'),
    capped.settled.map((s) => s.verdict).join(','))

  const already = applyCeiling(ten, { spentThisCycle: 100, alreadyRefundedThisCycle: 48 })
  check('what was already refunded this cycle counts against the ceiling',
    already.paid === 2, String(already.paid))
  check('a full cycle pays nothing more',
    applyCeiling(ten, { spentThisCycle: 10, alreadyRefundedThisCycle: 5 }).paid === 0)
  check('rows that were never going to pay are untouched by the ceiling',
    applyCeiling([{ verdict: 'wrong', points: 0, band: 'good' }],
      { spentThisCycle: 100, alreadyRefundedThisCycle: 0 }).settled[0].verdict === 'wrong')
}

console.log('\n── one claim per lead, ever ──')
{
  // The ledger's idempotency spine is (broker, type, reference), so the
  // reference has to be the LEAD — not the rating, not the day. Re-running the
  // settlement can then never pay twice for the same judgement.
  check('the reference is the lead', ratingRefundReference('lead-9') === 'rating:lead-9')
  check('…and two leads never collide',
    ratingRefundReference('a') !== ratingRefundReference('b'))
}

console.log('\n── reading a CRM row into an outcome ──')
{
  check('closed and converted are both won',
    outcomeOf({ status: 'closed' }) === 'won' && outcomeOf({ status: 'converted' }) === 'won')
  check('qualified, viewing and negotiation are all qualified',
    ['qualified', 'viewing', 'negotiation'].every((s) => outcomeOf({ status: s }) === 'qualified'))
  check('blocked is junk', outcomeOf({ status: 'lost', blocked: true }) === 'junk')
  check('an undialable number is junk', outcomeOf({ status: 'lost', badPhone: true }) === 'junk')
  // Stalled and junk are kept apart so a screen can say which, even though
  // both prove the same forecast.
  check('a lead that just went quiet is stalled, not junk',
    outcomeOf({ status: 'new' }) === 'stalled')
  check('an unknown status is stalled rather than a guess',
    outcomeOf({ status: null }) === 'stalled')
}

console.log('\n── every verdict is reachable ──')
{
  const seen = new Set<string>([
    applyCeiling([{ verdict: 'paid', points: 1, band: 'good' }],
      { spentThisCycle: 0, alreadyRefundedThisCycle: 0 }).settled[0].verdict,
    verdict({ rating: 1, worked: false }).verdict,
    verdict({ rating: 10, outcomeAtRating: 'won' }).verdict,
    verdict({ rating: 9, isFirstRating: false }).verdict,
    verdict({ rating: 5 }).verdict,
    settleClaim(claim({ ratedAt: '2026-08-12T12:00:00Z' }), { now: NOW }).verdict,
    verdict({ rating: 9, outcomeNow: 'junk' }).verdict,
    verdict({ rating: 9, outcomeNow: 'won' }).verdict,
  ])
  const missing = CLAIM_VERDICTS.filter((v) => !seen.has(v))
  check('every verdict can happen — none is dead copy', missing.length === 0, missing.join(','))
  check('every band is reachable from the scale',
    RATING_BANDS.every((b) => [0, 5, 8, 10].some((r) => bandOf(r) === b)))
  check('a point is a whole point',
    Number.isInteger(POINTS_PER_ACCURATE_RATING) && POINTS_PER_ACCURATE_RATING > 0)
}

console.log('\n── a broker reads money, not a token ──')
{
  // ONE CASH IS ONE DIRHAM. The unit used to be a "credit" worth AED 10, which
  // made every balance a translation exercise and gave a real-money system
  // arcade vocabulary. The identity is asserted here because everything else in
  // this section is only true while it holds.
  check('one Cash is one dirham', CREDIT_VALUE_AED === 1, String(CREDIT_VALUE_AED))
  check('…so a balance of 40 is forty dirhams', aedOf(40) === 40, String(aedOf(40)))
  check('the written form carries the word', cashText(40) === 'Cash 40', cashText(40))
  check('a big balance is grouped so it can be read',
    cashText(12_340) === 'Cash 12,340', cashText(12_340))
  check('nothing is nothing, not NaN', aedOf(0) === 0 && cashText(0) === 'Cash 0')
  check('a nonsense balance never renders NaN', aedOf(NaN) === 0, String(aedOf(NaN)))

  // THE MONEY DID NOT CHANGE WHEN THE UNIT DID. Every constant denominated in
  // units had to move by the same factor, or the re-denomination silently cut
  // the product's economics to a tenth. Each of these is the old number × 10.
  check('an accurate rating still returns ten dirhams',
    POINTS_PER_ACCURATE_RATING * CREDIT_VALUE_AED === 10,
    String(POINTS_PER_ACCURATE_RATING * CREDIT_VALUE_AED))
  check('the tier quotas still buy the same ad budget',
    TIER_MONTHLY_QUOTA.Starter === 120 && TIER_MONTHLY_QUOTA.Elite === 400,
    `${TIER_MONTHLY_QUOTA.Starter}/${TIER_MONTHLY_QUOTA.Elite}`)
  check('a closed deal still earns one percent of commission',
    creditsEarnedForCommission(50_000) * CREDIT_VALUE_AED === 500,
    String(creditsEarnedForCommission(50_000) * CREDIT_VALUE_AED))
  check('a day of budget costs its own price',
    creditsForDailyBudget(300) === 300, String(creditsForDailyBudget(300)))
  check('the fail-closed ceiling is still AED 10m',
    MAX_CREDIT_AMOUNT * CREDIT_VALUE_AED === 10_000_000, String(MAX_CREDIT_AMOUNT))

  // AND EVERY STORED BALANCE HAD TO BE SCALED TO MATCH, or the rate change
  // would have taken 90% of everybody's ad budget without moving a single
  // number on screen — the quietest way a money system can rob someone.
  check('the migration factor is the change in the unit',
    REDENOMINATION_FACTOR * CREDIT_VALUE_AED === 10, String(REDENOMINATION_FACTOR))
  // Comments stripped first. This suite has now twice failed on a header that
  // NAMED the forbidden pattern in order to explain why it is forbidden — a
  // guard that cannot tell prose from code punishes the documentation.
  const db = stripComments(
    readFileSync(join(process.cwd(), 'lib/freehold/credits-db.ts'), { encoding: 'utf8' }))
  check('…and it is one appended entry, never a rewrite of history',
    !/UPDATE\s+credit_ledger\s+SET\s+amount/i.test(db), 'the ledger is being rewritten in place')
  check('…idempotent through the same unique index as every other movement',
    /reference: REDENOMINATION_REFERENCE/.test(db))
  check('…and bounded by a cutoff, so money that arrived after is left alone',
    /created_at < \$2::timestamptz/.test(db))
  check('the version is in the key, so a second re-denomination cannot reuse it',
    /-v\d+$/.test(REDENOMINATION_REFERENCE), REDENOMINATION_REFERENCE)

  const page = readFileSync(
    join(process.cwd(), 'app/freehold-intelligence/points/page.tsx'), { encoding: 'utf8' })
  check('the balance is rendered as Cash', /value=\{data\.balance === null \? '—' : cashText\(/.test(page))
  check('…and so is what rating earned back', /value=\{cashText\(data\.paid\)\}/.test(page))
  check('…and the ceiling', /ceiling: cashText\(data\.ceiling\)/.test(page))

  // THE PER-VERDICT NUMBERS ARE COUNTS OF LEADS AND MUST STAY COUNTS. "6 calls
  // were wrong" is the fact; "Cash 6" beside it would read as a debt.
  check('the verdict counts are not dressed up as money',
    !/cashText\(n\)/.test(page), 'a lead count is being rendered as currency')
}

console.log('\n── the scheme is wired where it says it is ──')
{
  const read = (p: string) => readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
  const code = (p: string) => stripComments(read(p))

  // THE SNAPSHOT MUST BE TAKEN AT THE RATING. Settle against today's row and a
  // broker who edits after the outcome lands looks like somebody who called it
  // early — the integrity of the whole scheme is this one moment.
  // Asserted against the WRITE PATH, not against a screen's route. The rating
  // used to be writable only through PATCH /crm/leads/[id]; it now also moves
  // when the assistant is asked to rate a lead, and both go through
  // lib/freehold/crm-write.ts. The rule is that the claim is opened WHEREVER
  // the rating is written — pinning the old route file would have passed while
  // a second, claimless path grew beside it.
  const crm = code('lib/freehold/crm-write.ts')
  check('a claim is opened where the rating is written', /openRatingClaim\(/.test(crm))
  check('…carrying what was known AT THAT MOMENT', /outcomeAtRating: outcomeOf\(/.test(crm))
  // And there is only ONE place the rating is written, so "wherever" is one
  // place. A second writer would need its own claim and would not have one.
  const writers = ['lib/freehold/crm-write.ts', 'app/api/freehold/crm/leads/[id]/route.ts']
    .filter((f) => /value_rating\s*=\s*\$/.test(code(f)))
  check('…and the rating has exactly one writer', writers.length === 1, writers.join(','))

  // ONLY THE FIRST RATING EARNS, enforced by the database rather than by a
  // check somebody can forget.
  const db = code('lib/freehold/points-db.ts')
  check('the claim table is keyed by the lead', /lead_id\s+TEXT PRIMARY KEY/.test(db))
  check('…so a second rating writes nothing', /ON CONFLICT \(lead_id\) DO NOTHING/.test(db))

  // PAYING GOES THROUGH THE EXISTING LEDGER, whose unique index on
  // (broker, type, reference) is what stops a settlement run paying twice.
  check('payment goes through the credit ledger, not a second one',
    /refundCredits\(/.test(db) && !/INSERT INTO credit_ledger/.test(db))
  check('…keyed on the lead, so a rerun cannot pay twice',
    /ratingRefundReference\(g\.row\.lead_id\)/.test(db))
  check('the point is paid BEFORE the claim is marked settled',
    db.indexOf('refundCredits(') < db.indexOf('SET settled_at = now()'))

  // A CAPPED CLAIM STAYS OPEN so it can pay next cycle. Closing it would
  // destroy a point somebody had genuinely earned.
  // Read the capped branch itself rather than counting characters — the
  // assertion is that this branch never closes the claim, whatever else it
  // grows to do.
  const cappedFrom = db.indexOf("s.verdict === 'cappedOut'")
  const cappedBranch = cappedFrom > 0 ? db.slice(cappedFrom, db.indexOf('continue', cappedFrom)) : ''
  check('the capped branch exists', cappedBranch.length > 0, String(cappedFrom))
  check('…and never marks the claim settled',
    !/settled_at = now\(\)/.test(cappedBranch), cappedBranch.slice(0, 200))
  check('…it only records the verdict, leaving the claim open',
    /SET verdict = \$2/.test(cappedBranch) && /settled_at IS NULL/.test(cappedBranch),
    cappedBranch.slice(0, 200))

  // BOTH SIDES OF THE CEILING MUST BE THE SAME WINDOW. Lifetime spend against
  // this cycle's refunds is not a loose cap, it is no cap: an old account
  // could earn back half of everything it ever spent, again, every month.
  check('the ceiling measures spend over the same cycle as the refunds',
    /spentThisCycle\(brokerId\)/.test(db) && /cl\.type = 'spend'[\s\S]{0,120}cycle_start/.test(db),
    'the cap is comparing lifetime spend to cycle refunds')
  check('…so the lifetime figure is no longer read here',
    !/total_spent/.test(db), 'total_spent is still being used as the cycle spend')

  // A capped claim carries a VERDICT while staying OPEN, so "open" can no
  // longer be read as "not yet judged" — otherwise the broker is shown "too
  // soon to tell" about a call they got right and are owed for.
  check('a capped claim records its verdict without closing',
    /SET verdict = \$2\s*\n\s*WHERE lead_id = \$1 AND settled_at IS NULL/.test(db),
    'a capped claim writes no verdict, so the screen cannot tell it apart')
  check('open is counted from settled_at, not from a null verdict',
    /\(settled_at IS NULL\) AS is_open/.test(db) && /if \(r\.is_open\) open \+= n/.test(db),
    'open is still inferred from the verdict being null')

  // RATING IS NOT WORK. If rating counted as working the lead, the
  // self-fulfilling rating would satisfy its own condition.
  check('the work test excludes the records that are not work',
    /'assignment', 'created', 'repeat_inquiry', 'whatsapp_received'/.test(db))
  check('…and a claim too young to judge stays OPEN',
    /verdict !== 'tooEarly'/.test(db))

  // The settlement must use the ACCOUNT'S OWN cycle, not a constant, or a
  // brokerage whose leads take six weeks has its forecasts marked in one.
  const cron = code('app/api/cron/settle-ratings/route.ts')
  check('the cron seasons claims on the account\'s measured cycle',
    /seasonDays: basis\?\.cycle\.daysToQualify/.test(cron))
  check('…and reports which way the settlements went, not just how many',
    /byVerdict/.test(cron))
}

if (failures > 0) {
  console.error(`\n${failures} points rule(s) broken.`)
  process.exit(1)
}
console.log('\nRating pays, and a self-fulfilling rating pays nothing.\n')
