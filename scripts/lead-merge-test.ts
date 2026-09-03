/**
 * A MERGE ADDS; IT NEVER REPLACES — locked.
 *
 * "we dont do replacement — we do MERGE, so we get any new info added to the
 *  second registration, it could be valuable. the lead gets updated with a
 *  merged profile and keeps assign or rates as it was, so the first
 *  registration is the base — but it should be noticed that this lead double
 *  registered."
 *
 * What shipped as "Merge into primary" sent PATCH { status: 'lost' } to the
 * second record and copied nothing. The button was honest about the row and
 * silent about the person: every field they gave us the second time — an email
 * we never had, a bigger budget, a different tower, the ad that finally moved
 * them — was marked lost and left there.
 *
 * Three rules, and each has a way of going wrong that looks reasonable:
 *
 *   1. THE BASE IS THE FIRST REGISTRATION. Letting the newer record win is a
 *      replacement with extra steps, and it destroys the judgment attached to
 *      the record that has actually been worked.
 *   2. A RATING IS NEVER INHERITED. If the base is unrated and the duplicate
 *      was rated 8, the merged lead stays unrated — nobody has looked at the
 *      combined person. Adopting the other row's rating would feed the ad
 *      machine a number no human said about this lead, and the rating is the
 *      ground truth the whole forecast loop calibrates against.
 *   3. A CONFLICT IS KEPT, NOT RESOLVED. Registered for a studio, then for a
 *      two-bed: the disagreement IS the finding — that is somebody shopping,
 *      which repeat-intent already calls a buying signal rather than waste.
 *
 * Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  planMerge, mergePatch, MERGEABLE_FIELDS, NEVER_MERGED, type MergeRow,
} from '../lib/freehold/lead-merge'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const row = (id: string, day: string, over: Record<string, unknown> = {}): MergeRow => ({
  id, created_at: `2026-08-${day}T09:00:00Z`, ...over,
})

console.log('\n── the first registration is the base ──')
{
  const first = row('a', '01', { email: 'buyer@gmail.com', value_rating: 8, assigned_broker_id: 'sara' })
  const second = row('b', '20', { email: 'other@gmail.com', value_rating: 2, assigned_broker_id: 'omar' })

  const plan = planMerge([second, first])!
  check('the base is decided by arrival, not by argument order',
    plan.baseId === 'a', plan.baseId)
  check('…and the later record is the one merged away',
    plan.mergedIds.join(',') === 'b', plan.mergedIds.join(','))
  check('…and the person is recorded as having registered twice',
    plan.registrations === 2, String(plan.registrations))

  // NO REPLACEMENT. The base already has an email; the second one is a
  // disagreement to record, never an overwrite.
  const patch = mergePatch(plan)
  check('a value the base already has is never overwritten',
    !('email' in patch), JSON.stringify(patch))
  check('…and the second answer is kept as a conflict, not dropped',
    plan.conflicts.some((c) => c.field === 'email' && c.later === 'other@gmail.com'),
    JSON.stringify(plan.conflicts))

  check('one row is not a merge', planMerge([first]) === null)
}

console.log('\n── new information is added, which is the whole point ──')
{
  const first = row('a', '01', { name: 'Omar', phone: '+971500000001' })
  const second = row('b', '05', {
    name: 'Omar', phone: '+971500000001',
    email: 'omar@gmail.com', budget_aed: 3_000_000, interest: 'Volta 2-bed',
  })
  const plan = planMerge([first, second])!
  const patch = mergePatch(plan)
  check('an email we did not have arrives on the base',
    patch.email === 'omar@gmail.com', JSON.stringify(patch))
  check('…and a budget they only stated the second time',
    patch.budget_aed === 3_000_000, String(patch.budget_aed))
  check('…and every fill says which registration supplied it',
    plan.fills.every((f) => f.fromId === 'b'), JSON.stringify(plan.fills))
  check('a value identical on both is not reported as new',
    !('name' in patch) && !plan.conflicts.some((c) => c.field === 'name'))

  // A stated budget of 0 is a statement; only absence is absence.
  const zero = mergePatch(planMerge([row('a', '01'), row('b', '02', { budget_aed: 0 })])!)
  check('zero is an answer, not an empty field', zero.budget_aed === 0, String(zero.budget_aed))
  const blank = mergePatch(planMerge([row('a', '01'), row('b', '02', { interest: '   ' })])!)
  check('…while whitespace is not', !('interest' in blank), JSON.stringify(blank))
}

console.log('\n── the team\'s work is not merged, in either direction ──')
{
  const first = row('a', '01', { assigned_broker_id: null, value_rating: null, status: 'new' })
  const second = row('b', '09', { assigned_broker_id: 'omar', value_rating: 8, status: 'qualified', priority: 'hot' })
  const patch = mergePatch(planMerge([first, second])!)

  // THE ONE THAT WOULD BE MOST TEMPTING TO ALLOW: the base is unrated and the
  // duplicate carries an 8. Inheriting it manufactures a judgment nobody made
  // about the merged person, and every audience push and calibration downstream
  // would treat it as a broker's verdict.
  for (const field of NEVER_MERGED) {
    check(`${field} is never carried over, even when the base has none`,
      !(field in patch), `${field}=${String(patch[field])}`)
  }
  check('and it is not merely absent from the fixture — the field list excludes it',
    NEVER_MERGED.every((f) => !(MERGEABLE_FIELDS as readonly string[]).includes(f)))
}

console.log('\n── two later registrations, and the earlier one wins the gap ──')
{
  const plan = planMerge([
    row('a', '01'),
    row('b', '05', { email: 'first@gmail.com' }),
    row('c', '09', { email: 'later@gmail.com' }),
  ])!
  check('three registrations are counted as three', plan.registrations === 3, String(plan.registrations))
  check('the earliest answer fills the gap', mergePatch(plan).email === 'first@gmail.com')
  check('…and the third is a conflict against it, not a second fill',
    plan.fills.length === 1 && plan.conflicts.some((c) => c.later === 'later@gmail.com'),
    `${plan.fills.length} fills / ${plan.conflicts.length} conflicts`)

  // An unparseable date must not win the base by accident — the base decides
  // which rating and which owner survive.
  const undated = planMerge([
    { id: 'x', created_at: 'not a date' },
    row('a', '01'),
  ])!
  check('a row with no arrival time never becomes the base', undated.baseId === 'a', undated.baseId)
}

console.log('\n── and the route, not the page, decides what merging means ──')
{
  const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  const route = code('app/api/freehold/crm/leads/[id]/merge/route.ts')
  const page = code('app/freehold-intelligence/crm/duplicates/page.tsx')

  check('the page no longer calls a merge a status change',
    !/status: 'lost'/.test(page), 'the discard is back')
  check('…and posts two ids and nothing else',
    /JSON\.stringify\(\{ duplicateId: cluster\.duplicate\.id \}\)/.test(page))

  // If the page could send values, the ordinary update path would have to
  // accept name/email/phone writes from any caller.
  check('the route reads the rows itself rather than trusting a body',
    /SELECT \$\{SELECT_FIELDS\}|SELECT_FIELDS/.test(route) && /planMerge\(rows\)/.test(route))
  check('…and writes only fields the merge rules allow',
    /MERGEABLE_FIELDS as readonly string\[\]\)\.includes/.test(route))

  // The second registration was a real form fill on a real ad.
  check('the merged record is kept, never deleted',
    /merged_into = \$2/.test(route) && !/DELETE FROM freehold_site_leads/.test(route))

  // The base's own timeline is where a broker finds out this happened.
  check('what moved is written to the lead\'s activity, conflicts included',
    /activity_type, description/.test(route) && /Also answered differently/.test(route))

  // THE PAGE HAS PROMISED THIS SINCE IT SHIPPED — "all calls, notes, WhatsApp
  // events and stage changes from both records are combined into one
  // timeline" — and nothing did it. A broker who merged and then looked for
  // the call they logged last week would not have found it.
  check('the timeline follows the person, as the page has always claimed',
    /UPDATE freehold_site_lead_activity SET lead_id/.test(route))
}

console.log('\n── the double registration stays visible after the merge ──')
{
  const code = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const api = code('app/api/freehold/crm/leads/route.ts')
  const rowMap = code('lib/freehold/crm-row.ts')
  const page = code('app/freehold-intelligence/crm/page.tsx')

  // Two counts: how many times they registered (a fact about the buyer) and
  // how many records are still separate (a fact about our filing). Merging
  // changes the second and must not change the first.
  check('the risk flag counts only unmerged records',
    /FILTER \(WHERE merged_into IS NULL\)/.test(api))
  check('…while the registration count counts them all',
    /COUNT\(\*\) AS total/.test(api))
  check('the row carries how many times this person registered',
    /registrations: dup\?\.registrations\.get/.test(rowMap))
  check('…and the list says so above one, never on every row',
    /\(lead\.registrations \?\? 1\) > 1/.test(page))

  // The page and the route must agree on which record is the primary, or the
  // operator approves one merge and the server performs another.
  const dup = code('app/freehold-intelligence/crm/duplicates/page.tsx')
  check('the duplicates page picks its primary by arrival, as the route does',
    /arrived\(x\) - arrived\(y\)/.test(dup) && !/y\.intentScore - x\.intentScore/.test(dup))
}

console.log(failures === 0
  ? '\n✅ a merge adds what was learned and keeps what was judged.'
  : `\n❌ ${failures} lead-merge guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
