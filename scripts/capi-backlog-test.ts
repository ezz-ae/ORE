/**
 * THE JUDGMENT THAT NEVER LEFT THE BUILDING — locked.
 *
 * Measured on the live account, 4 Sep 2026:
 *
 *     878 leads · 292 rated · 124 rated 6 or better
 *     0 leads with any reported stage
 *     one pixel, named "test", last_fired_time NULL
 *
 * The write-back has never once succeeded, while every ad set runs on the
 * "Conversion leads" performance goal — Meta's QUALITY goal, which learns
 * from exactly the events we were not sending. Meta's report for the window
 * counts THREE qualified leads against ~AED 48,000 of spend.
 *
 * The optimiser was not aiming at the wrong target. It was aiming at the
 * right one and being fed nothing, so it fell back to the only signal it
 * could see: who fills in forms.
 *
 * Fixing the sender does not fix this. reportLeadToMeta fires on UPDATE, so
 * the next rating goes out and the 124 already sitting there never do —
 * nobody re-rates five weeks of leads to trigger a side effect.
 *
 * Runs in `pnpm guards`. Sends nothing.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { backlogPlan, summarise, SWEEP_BATCH, type BacklogLead } from '../lib/freehold/capi-backlog'
import { VALUABLE_RATING, QUALIFIED_STATUSES, WON_STATUSES } from '../lib/freehold/lead-stages'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const OPTS = { valuableRating: VALUABLE_RATING, wonStatuses: WON_STATUSES, qualifiedStatuses: QUALIFIED_STATUSES }
const lead = (o: Partial<BacklogLead> & { id: string }): BacklogLead => ({
  valueRating: null, status: 'new', metaLeadId: 'm1', email: null, phone: null,
  reported: [], createdAtMs: Date.parse('2026-09-01T00:00:00Z'), ...o,
})

console.log('\n── what is owed ──')
{
  const plan = backlogPlan([
    lead({ id: 'good', valueRating: VALUABLE_RATING }),
    lead({ id: 'better', valueRating: 10 }),
    lead({ id: 'poor', valueRating: VALUABLE_RATING - 1 }),
    lead({ id: 'unrated' }),
  ], OPTS)
  check('a lead rated at or above the valuable line is owed a qualified event',
    plan.map((p) => p.leadId).sort().join(',') === 'better,good',
    plan.map((p) => p.leadId).join(','))
  check('…and one below it is not', !plan.some((p) => p.leadId === 'poor'))
  check('…and an unrated lead is missing WORK, not a missing event',
    !plan.some((p) => p.leadId === 'unrated'))

  // Already sent is already sent. The deterministic event id makes a repeat
  // harmless, but spending a slot in the batch on it is not.
  check('a lead already reported is not swept again',
    backlogPlan([lead({ id: 'x', valueRating: 9, reported: ['qualified'] })], OPTS).length === 0)

  // Won outranks qualified — the same ladder writeBackFor uses.
  const won = backlogPlan([lead({ id: 'w', status: [...WON_STATUSES][0], valueRating: 9 })], OPTS)
  check('a closed lead is owed the won event, not the qualified one',
    won[0]?.stage === 'won', JSON.stringify(won))
  check('…and a lead already reported won is finished',
    backlogPlan([lead({ id: 'w', status: [...WON_STATUSES][0], reported: ['qualified', 'won'] })], OPTS).length === 0)
}

console.log('\n── nothing goes out that cannot be attached to anybody ──')
{
  // A slot in the batch spent on an event Meta cannot match teaches nothing.
  check('a lead with no lead_id and no contact is excluded',
    backlogPlan([lead({ id: 'nobody', valueRating: 9, metaLeadId: null })], OPTS).length === 0)
  check('…but a contact alone is enough to match a person',
    backlogPlan([lead({ id: 'em', valueRating: 9, metaLeadId: null, email: 'a@b.co' })], OPTS).length === 1)

  // The distinction that decides whether the event teaches Meta about
  // TARGETING or merely about a person.
  const withId = backlogPlan([lead({ id: 'id', valueRating: 9, metaLeadId: 'm9' })], OPTS)
  check('lead_id marks the event as traceable to the ad', withId[0].attributes === true)
  check('…and a contact-only event is marked as not',
    backlogPlan([lead({ id: 'c', valueRating: 9, metaLeadId: '', phone: '+9715' })], OPTS)[0].attributes === false)
}

console.log('\n── newest first, and capped ──')
{
  const old = lead({ id: 'july', valueRating: 9, createdAtMs: Date.parse('2026-07-15T00:00:00Z') })
  const recent = lead({ id: 'sept', valueRating: 9, createdAtMs: Date.parse('2026-09-03T00:00:00Z') })
  // A lead rated last week describes an ad still running; one from July
  // describes a campaign that has ended. Sweeping oldest-first would spend
  // the batch teaching Meta about ads nobody can buy any more.
  check('the newest owed lead is swept first',
    backlogPlan([old, recent], { ...OPTS, cap: 1 })[0].leadId === 'sept')

  const many = Array.from({ length: 60 }, (_, i) =>
    lead({ id: `l${i}`, valueRating: 9, createdAtMs: Date.parse('2026-09-01T00:00:00Z') + i }))
  check('the sweep is capped', backlogPlan(many, OPTS).length === SWEEP_BATCH, String(backlogPlan(many, OPTS).length))
  // Not a rate limit: Meta's lead-quality optimisation reads the RATE of
  // qualified events, and 124 in one minute after five weeks of silence is a
  // spike at a moment none of those people converted.
  check('…at a rate the business could plausibly have produced',
    SWEEP_BATCH > 0 && SWEEP_BATCH <= 50, String(SWEEP_BATCH))
}

console.log('\n── the number worth watching is what is left ──')
{
  const s = summarise(124, [
    { ok: true, attributes: true }, { ok: true, attributes: false }, { ok: false, attributes: true },
  ])
  check('remaining falls only by what actually sent', s.remaining === 122, String(s.remaining))
  check('failures are counted, not hidden', s.failed === 1)
  check('…and attribution counts only delivered events', s.attributing === 1)
  // A stuck backlog is what a missing pixel id looks like from the outside,
  // and it is exactly what this account has looked like all along.
  check('a sweep that sends nothing leaves the backlog whole',
    summarise(124, []).remaining === 124)
}

console.log('\n── and the sweep uses the one write-back path ──')
{
  const route = readFileSync(join(process.cwd(), 'app/api/cron/capi-backlog/route.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  // A second opinion about what qualifies is how the CRM and the ad machine
  // start disagreeing about the same person.
  check('every send goes through reportLeadToMeta', /reportLeadToMeta\(/.test(route))
  check('…and the route holds no rule of its own about what qualifies',
    !/value_rating\s*>=/.test(route) && /VALUABLE_RATING/.test(route))

  // Sequential: a burst is a shape Meta has never seen from this advertiser,
  // and a credential failure would otherwise hit twenty times before the
  // first answer came back.
  check('the batch is sent one at a time', /for \(const item of batch\)/.test(route))
  check('…and a stuck backlog raises an alarm', /capi_backlog_stuck/.test(route))

  const vercel = readFileSync(join(process.cwd(), 'vercel.json'), 'utf8')
  check('the sweep is actually scheduled', /api\/cron\/capi-backlog/.test(vercel))
}

console.log(failures === 0
  ? '\n✅ the backlog drains, newest first, at a rate that reads as real.'
  : `\n❌ ${failures} CAPI-backlog guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
