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

console.log('\n── THE FEEDBACK GOES ON THE RATING, NOT ON A BUTTON ──')
{
  // "sending the feedback has to be once rate done with no need for ACTION."
  //
  // Half was already true: rating a lead fires the Meta conversion event
  // immediately. The AUDIENCES were not — membership only moved when somebody
  // opened a screen and pressed a button, so a lead rated 10 on Monday sat
  // outside the seed until a person remembered on Thursday.
  const write = readFileSync(join(process.cwd(), 'lib/freehold/crm-write.ts'), 'utf8')
  const code = write.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  check('rating a lead reports the conversion to Meta', /void reportLeadToMeta\(id\)/.test(code))
  check('…and moves it into its audience, with no button',
    /void pushRatedLeadToAudience\(id\)/.test(code))
  // Only a rating. Nothing else in a patch changes what a person is worth, and
  // re-uploading on every status change would spend the account's match rate
  // on bookkeeping.
  check('…only when a rating actually changed',
    /if \('value_rating' in body\) void pushRatedLeadToAudience/.test(code))
  // A rating must never fail because Meta was slow.
  check('…fire-and-forget, so Meta cannot fail the CRM write',
    /void pushRatedLeadToAudience/.test(code))

  const aud = readFileSync(join(process.cwd(), 'lib/freehold/rating-audiences.ts'), 'utf8')
  const fn = aud.slice(aud.indexOf('export async function pushRatedLeadToAudience'))
  const fnCode = fn.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  // The operator's table decides here exactly as it does in the periodic sync.
  check('the same table decides which audience', /ruleForRating\(rating\)/.test(fnCode))
  check('…4 and 5 push nowhere',
    /rule\.action === 'crmExecution'\) return \{ pushed: null/.test(fnCode))
  // A blocked contact in a seed teaches Meta to find more people like them.
  check('a blocked lead never seeds whatever its rating',
    /lead\.blocked === true/.test(fnCode))
  // The weight is only honoured on a value-based audience.
  check('a good rating carries its weight',
    /addWeightedBuyers/.test(fnCode) && /rule\.weight \* 1000/.test(fnCode))

  // Appends one row; the periodic sync stays the reconciler. Rebuilding both
  // cohorts on every tap would be a full CRM re-upload per rating.
  check('it appends one person rather than rebuilding the cohorts',
    !/splitCohorts/.test(fnCode) && !/seedUpload/.test(fnCode))
  // Creating an audience is a deliberate act with the operator's name on it.
  check('it will not silently create an audience nobody asked for',
    /audience_not_built/.test(fnCode) && !/createCustomAudience/.test(fnCode))
  check('…and says why when it does nothing',
    /reason: 'unmatchable'/.test(fnCode) && /reason: 'meta_not_connected'/.test(fnCode))
}

console.log('\n── ALWAYS EXCLUDE THE CRM. NOT A CHECKBOX. ──')
{
  // "always always always we have a custom list not lookalike of any one in
  //  crm always they have to be excluded — this is very important and it
  //  should be rule."
  //
  // It was `if (body.excludeCrmAudience)`. The browser had to ask, so any
  // caller that forgot the flag — and every launch made before the switch
  // existed — paid to advertise to people already in the pipeline. There is no
  // campaign for which "show this to somebody we are already talking to" is
  // the right answer, and a rule that depends on a checkbox is a preference.
  const launch = readFileSync(join(process.cwd(), 'app/api/meta/launch/route.ts'), 'utf8')
  const code = launch.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  check('the exclusion is no longer behind a flag',
    !/if \(body\.excludeCrmAudience\)/.test(code), 'the opt-in is back')
  check('every launch resolves it', /crmExclusionAudienceId\(\)/.test(code))
  // "Always" that silently does nothing on a fresh account is the same as not
  // having it.
  check('…and builds the list when there is none yet',
    /syncCrmExclusionAudience\(\)/.test(code))
  // A launch that could not exclude will pay to re-reach people. Not a
  // failure, but it must never pass silently — the symptom arrives weeks later
  // as duplicates and looks like a CRM problem, not a targeting one.
  check('a launch that could NOT exclude says so',
    /crmExclusionApplied \? \[\] :/.test(code) && /WITHOUT the/.test(launch))

  // The list is people, hashed — never a lookalike of them. A lookalike of
  // your own CRM is the opposite of an exclusion.
  const excl = readFileSync(join(process.cwd(), 'lib/freehold/crm-exclusion.ts'), 'utf8')
  check('the exclusion is a hashed custom list, not a lookalike',
    /createCustomAudience/.test(excl) && !/createLookalike/i.test(excl))
  check('…covering everyone not archived, worked or not',
    /archived IS NOT TRUE/.test(excl))
}

console.log('\n── and the page shows the loop rather than hiding it ──')
{
  const page = readFileSync(join(process.cwd(), 'app/freehold-intelligence/lead-machine/rating/page.tsx'), 'utf8')
  const nav = readFileSync(join(process.cwd(), 'app/freehold-intelligence/lead-machine/layout.tsx'), 'utf8')

  check('Rating sits in the ads menu, next to Lead forms',
    /lm\.nav\.rating/.test(nav) && nav.indexOf('lm.nav.rating') > nav.indexOf('lm.nav.forms'))

  // The rule goes first because it is unconditional.
  check('the page states the exclusion rule',
    /lm\.rating\.rule\.title/.test(page))
  check('…and says whether the list actually exists',
    /crmExclusionAudienceId/.test(page) && /lm\.rating\.rule\.missing/.test(page))

  // Rated, how fast, how many reached Meta, what it built.
  check('it shows what the team said and how fast',
    /ratingLatency/.test(page) && /lm\.rating\.stat\.median/.test(page))
  check('…how many outcomes actually reached Meta',
    /meta_reported_stages/.test(page))
  check('…what each rating did', /RATING_RULES\.map/.test(page))
  check('…and what it built', /currentCohorts/.test(page))

  // The lookalike is not built early: below Meta's floor it is
  // indistinguishable from open targeting, so waiting is said, not hidden.
  check('waiting for a bigger seed is stated, not hidden',
    /lm\.rating\.lookalikeWaiting/.test(page))
  // A forecast that is not measuring the world must not move money.
  check('the forecast error is shown beside its verdicts',
    /accuracy\.meanAbsoluteError !== null/.test(page))
}

console.log(failures === 0
  ? '\n✅ the rating feeds the audience itself, and the outcome tells Meta which ad earned it.'
  : `\n❌ ${failures} rating-action guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
