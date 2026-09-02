/**
 * THE RATING FEEDS THE AUDIENCE ITSELF, AND THE OUTCOME NAMES THE AD — locked.
 *
 * Two instructions, one loop.
 *
 * "this is the rate every number and action — we need this to feed the
 *  audience not to wait for manual execution."
 *
 * "when the lead come rated send conversion result meta fix the same ad that
 *  generated the lead… if the rate goes on time to meta and feed the same ad
 *  on time this is the ultimate loop we want and its super higher than the
 *  lookalike."
 *
 * That second point reorders what matters. A value-based lookalike is slow and
 * indirect — build an audience, hand it over, hope. Sending the outcome back to
 * the ad that produced it teaches Meta's optimiser INSIDE the running campaign.
 * Which makes latency the binding constraint, so it is measured rather than
 * assumed.
 *
 * The table below is the operator's, reproduced exactly. A guard over a
 * business decision exists to stop it being quietly improved on.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  RATING_RULES, RATING_ACTIONS, ruleForRating, ratingAction,
  ratingWeight, ratingExcludes, ratingSeeds, ratingNeedsCrmWork,
} from '../lib/freehold/rating-actions'
import { splitCohorts, scoreLead, type SeedLead } from '../lib/freehold/seed-cohort'
import { buildQualifiedLeadEvent } from '../lib/meta/capi'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the table, exactly as dictated ──')
{
  // 1 Junk exclude · 2 Avoid exclude · 3 Unqualified exclude
  // 4 CRM · 5 CRM · 6 include +1 · 7 include +2 · 8,9,10 include +3
  const expect: Array<[number, string, number]> = [
    [1, 'exclude', 0], [2, 'exclude', 0], [3, 'exclude', 0],
    [4, 'crmExecution', 0], [5, 'crmExecution', 0],
    [6, 'include', 1], [7, 'include', 2],
    [8, 'include', 3], [9, 'include', 3], [10, 'include', 3],
  ]
  for (const [rating, action, weight] of expect) {
    check(`${rating} → ${action}${weight ? ` +${weight}` : ''}`,
      ratingAction(rating) === action && ratingWeight(rating) === weight,
      `${ratingAction(rating)} / ${ratingWeight(rating)}`)
  }
  // Absent from the written table. It sits below Junk, so it excludes — the
  // alternative is a rating that does nothing.
  check('0 is not in the written table and excludes anyway', ratingExcludes(0))
  check('every rating 0–10 has a rule', RATING_RULES.length === 11)
  check('every action is walkable', RATING_ACTIONS.length === 3)

  // An unrated lead must not fall into any audience by default.
  check('no rating means no rule and no weight',
    ruleForRating(null) === null && ruleForRating(undefined) === null
    && ratingWeight(null) === 0 && !ratingExcludes(null) && !ratingSeeds(null))
  check('a nonsense rating claims nothing', ruleForRating(NaN) === null)
}

console.log('\n── and it feeds the cohorts with no manual step ──')
{
  const lead = (id: string, o: Partial<SeedLead> = {}): SeedLead => ({
    id, email: `${id}@x.com`, phone: '+971501234567', status: 'new', ...o,
  })
  const c = splitCohorts([
    lead('r1', { valueRating: 1 }), lead('r3', { valueRating: 3 }),
    lead('r4', { valueRating: 4 }), lead('r5', { valueRating: 5 }),
    lead('r6', { valueRating: 6 }), lead('r10', { valueRating: 10 }),
  ])
  const has = (list: { id: string }[], id: string) => list.some((l) => l.id === id)

  check('1 and 3 are excluded', has(c.exclude, 'r1') && has(c.exclude, 'r3'))
  check('6 and 10 seed', has(c.seed, 'r6') && has(c.seed, 'r10'))
  // THE BAND THAT MUST FEED NEITHER. Seeding from "we could not tell" hands
  // Meta a cohort defined by our own uncertainty; excluding throws away people
  // who were simply never worked. They are a phone call.
  check('4 and 5 feed NEITHER audience',
    !has(c.seed, 'r4') && !has(c.exclude, 'r4')
    && !has(c.seed, 'r5') && !has(c.exclude, 'r5'))
  check('…and are findable as a call list',
    ratingNeedsCrmWork(4) && ratingNeedsCrmWork(5)
    && !ratingNeedsCrmWork(3) && !ratingNeedsCrmWork(6))

  // "+1 +2 +3" as Meta's value column: a 10 pulls three times as hard as a 6.
  const w = (r: number) => scoreLead(lead('x', { valueRating: r })).weight
  check('a 10 outweighs a 6 threefold', w(10) === w(6) * 3, `${w(6)} vs ${w(10)}`)
  check('…and a 7 sits between them', w(7) === w(6) * 2, String(w(7)))
  // A real closed deal still outranks an opinion.
  check('a real deal value still wins over the table',
    scoreLead(lead('d', { valueRating: 6, dealValueAed: 2_000_000 })).weight === 2_000_000)
  // A blocked person in a seed teaches Meta to find more of them.
  check('a blocked lead is excluded whatever the rating says',
    splitCohorts([lead('b', { valueRating: 10, blocked: true })]).exclude.length === 1)
  // Meta cannot match somebody with no email and no dialable phone.
  check('an unmatchable lead never dilutes the seed',
    splitCohorts([{ id: 'n', email: null, phone: null, status: 'new', valueRating: 9 }]).seed.length === 0)
}

console.log('\n── THE OUTCOME NAMES THE AD, NOT JUST THE PERSON ──')
{
  // Everything else identifies a PERSON — hashed email, hashed phone, a click
  // cookie — and Meta then has to work out which ad they came from. For a lead
  // that arrived through an instant form weeks ago it usually cannot, so the
  // ad that actually found the buyer got no credit.
  const withLead = buildQualifiedLeadEvent({
    eventId: 'e1', stage: 'qualified', email: 'a@b.com', leadId: '99887766',
  })
  const ud = (withLead?.user_data ?? {}) as Record<string, unknown>
  check('the leadgen id rides the event', ud.lead_id === '99887766', JSON.stringify(ud))
  // Meta's own identifier, matched by equality — hashing it matches nothing,
  // exactly like fbc.
  check('…unhashed, because Meta issued it', ud.lead_id === '99887766')

  // It is a match key in its own right: it identifies not just the person but
  // the submission they made.
  const only = buildQualifiedLeadEvent({ eventId: 'e2', stage: 'qualified', leadId: '123456' })
  check('a lead id alone is enough to send', only !== null)
  // An external id alone still is not — it matches nobody Meta has not
  // already seen it against.
  check('an external id alone is still not',
    buildQualifiedLeadEvent({ eventId: 'e3', stage: 'qualified', externalId: 'abc' }) === null)

  const wb = readFileSync(join(process.cwd(), 'lib/freehold/lead-writeback.ts'), 'utf8')
  check('the write-back sends the stored leadgen id',
    /leadId: lead\.meta_lead_id/.test(wb))
  check('…read from the row it already had', /meta_lead_id/.test(wb))
}

console.log('\n── and how late it arrives is measured, not assumed ──')
{
  const db = readFileSync(join(process.cwd(), 'lib/freehold/forecast-db.ts'), 'utf8')
  const code = db.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  // A rating sent the same afternoon steers an ad set that is still learning;
  // the identical rating a week later lands after the budget is spent.
  check('the lag from arrival to rating is measured',
    /value_rated_at - created_at/.test(code))
  check('…as a median and a slow quarter, not a mean',
    /medianHours/.test(code) && /p75Hours/.test(code))
  check('…and the share rated inside a day', /sameDayShare/.test(code))
  // A rating stamped before the lead arrived is a clock problem. Counting it
  // as zero would make the median flatter the more broken the account got.
  check('a negative lag is dropped, never counted as instant',
    /value_rated_at >= created_at/.test(code))
  check('the loop status carries it', /latency/.test(code))

  const advisor = readFileSync(join(process.cwd(), 'app/api/freehold/ads/advisor/route.ts'), 'utf8')
  check('the advisor is given it', /ratingLatency: loop\.latency/.test(advisor))
  // When the loop is slow that IS the finding — it caps every other
  // improvement on the page, and the team fixes it, not the budget.
  check('…and told that a slow loop is a finding in itself',
    /limits every other improvement on this page/.test(advisor))
}

console.log(failures === 0
  ? '\n✅ the rating feeds the audience itself, and the outcome tells Meta which ad earned it.'
  : `\n❌ ${failures} rating-action guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
