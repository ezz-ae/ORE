/**
 * THE LIST IS IN AN ORDER, AND "TODAY" CAN SEE TODAY — locked.
 *
 * "leads arrange by time in the crm is not working, the crm has nothing
 *  called today, and the lead now not showing newest as it should be."
 *
 * Two failures with one shape, and this suite exists because neither could be
 * caught by anything the repo already ran.
 *
 * ── ONE: A FIELD THE CONSUMER READ AND NO PRODUCER WROTE ─────────────────
 *
 * `CRMLeadIntelligence.createdAt` was declared and documented, and three
 * filters — today, yesterday, last 7 days — matched on it. The only endpoint
 * that builds these rows never set it. The field is OPTIONAL, so `tsc` had
 * nothing to say; `Date.parse(undefined)` is NaN, so the filters returned
 * false rather than throwing. Every time filter in the CRM answered "no leads"
 * and looked exactly like a quiet day.
 *
 * `scripts/crm-filters-test.ts` proved the rules were right — against its own
 * literals. Correct rules fed a field nobody set. So the assertion here runs
 * the REAL mapper into the REAL filter: a lead that arrived today is a lead
 * Today can see. That is a property no unit test of either half can hold.
 *
 * ── TWO: AN ORDER THAT WAS A SIDE EFFECT OF A CONSTANT ───────────────────
 *
 * The list sorted by `intentScore` descending and nothing else. That looked
 * like arrival order for as long as intentScore was a four-way lookup off
 * `temperature` — nearly every row 90 or 30, so the sort was one huge tie, and
 * a stable sort left the API's `ORDER BY created_at DESC` intact.
 *
 * When intentScore became a real forecast the ties went, and the arrival order
 * nobody had written down went with them. An ordering that survives only while
 * its key is constant is not an ordering. It is written down now.
 *
 * Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CRM_SORTS, DEFAULT_CRM_SORT, sortLeads } from '../lib/freehold/crm-order'
import { CRM_FILTER_DEFS } from '../lib/freehold/crm-filters'
import { dbLeadToCRM, type DbLead } from '../lib/freehold/crm-row'
import { OPERATION_TZ } from '../lib/freehold/clock'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const NOW = Date.parse('2026-08-30T10:00:00Z')
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString()

/** A database row as the leads query actually returns one. */
const row = (over: Partial<DbLead> = {}): DbLead => ({
  id: 'l1', name: 'A', phone: '+971500000001', email: 'a@b.co', source: 'meta',
  project_slug: null, assigned_broker_id: null, status: 'new', priority: 'warm',
  created_at: daysAgo(0), last_contact_at: null, country: null, budget_aed: null,
  interest: null, message: null, landing_slug: null, updated_at: null,
  snooze_until: null, lead_code: null, duplicate_dismissed_at: null,
  utm_id: null, utm_campaign: null, value_rating: null, behaviour_score: null,
  meta_ad_id: null, meta_form_name: null, meta_ad_name: null,
  archived: false, blocked: false,
  ...over,
})

const filterById = (id: string) => {
  const def = CRM_FILTER_DEFS.find((d) => d.id === id)
  if (!def) throw new Error(`no filter ${id}`)
  return def
}

console.log('\n── the mapper writes the field the filters read ──')
{
  // THE ASSERTION THAT WOULD HAVE CAUGHT IT. Not "does the mapper emit a
  // createdAt key" — that is a spelling test. This runs a row through the
  // real mapper and asks the real Today filter whether it can see it.
  const today = dbLeadToCRM(row({ created_at: daysAgo(0) }))
  check('a lead that arrived today is one Today can see',
    filterById('today').match(today, NOW, OPERATION_TZ),
    `createdAt=${JSON.stringify((today as { createdAt?: string }).createdAt)}`)

  const yday = dbLeadToCRM(row({ created_at: daysAgo(1) }))
  check('…and yesterday\'s lead is Yesterday\'s, not Today\'s',
    filterById('yesterday').match(yday, NOW, OPERATION_TZ)
      && !filterById('today').match(yday, NOW, OPERATION_TZ))

  const old = dbLeadToCRM(row({ created_at: daysAgo(30) }))
  check('…and a month-old lead is in none of the three windows',
    !filterById('today').match(old, NOW, OPERATION_TZ)
      && !filterById('yesterday').match(old, NOW, OPERATION_TZ)
      && !filterById('last7').match(old, NOW, OPERATION_TZ))

  check('…while a three-day-old lead is inside Last 7',
    filterById('last7').match(dbLeadToCRM(row({ created_at: daysAgo(3) })), NOW, OPERATION_TZ))

  // The instant itself, not a rendered date: the filters compare against
  // zone-aware day bounds, and a pre-formatted string cannot be compared.
  const parsed = Date.parse(String((today as { createdAt?: string }).createdAt))
  check('the row carries a parseable instant, not a display string',
    Number.isFinite(parsed), String((today as { createdAt?: string }).createdAt))
}

console.log('\n── newest first, and undated last ──')
{
  const leads = [
    { id: 'old', createdAt: daysAgo(9), intentScore: 90, valueRating: null },
    { id: 'new', createdAt: daysAgo(0), intentScore: 10, valueRating: null },
    { id: 'mid', createdAt: daysAgo(4), intentScore: 50, valueRating: null },
  ]
  const order = sortLeads(leads, 'newest').map((l) => l.id)
  check('newest first regardless of forecast', order.join(',') === 'new,mid,old', order.join(','))

  // A missing date parses to NaN, and NaN in a comparator returns false for
  // every comparison — the list comes back neither sorted nor visibly broken.
  const withGap = sortLeads([
    { id: 'none', intentScore: 99, valueRating: null },
    { id: 'new', createdAt: daysAgo(0), intentScore: 1, valueRating: null },
    { id: 'old', createdAt: daysAgo(5), intentScore: 1, valueRating: null },
  ], 'newest').map((l) => l.id)
  check('a lead with no arrival time sorts last, never first',
    withGap.join(',') === 'new,old,none', withGap.join(','))

  check('the default order is arrival', DEFAULT_CRM_SORT === 'newest', DEFAULT_CRM_SORT)
}

console.log('\n── the other orders still mean what they meant ──')
{
  const leads = [
    { id: 'good', createdAt: daysAgo(1), intentScore: 20, valueRating: 9 },
    { id: 'junk', createdAt: daysAgo(2), intentScore: 30, valueRating: 1 },
    { id: 'unrated', createdAt: daysAgo(3), intentScore: 80, valueRating: null },
  ]
  const byValue = sortLeads(leads, 'value').map((l) => l.id)
  // Worst first — the deliberate inversion — but UNRATED IS NOT WORST. It is
  // unknown, and presenting it as the bottom of the book would teach the
  // machine to stop buying leads nobody has looked at yet.
  check('value ranks worst first, with unrated after the rated',
    byValue.join(',') === 'junk,good,unrated', byValue.join(','))

  const byIntent = sortLeads(leads, 'intent').map((l) => l.id)
  check('forecast order is highest first', byIntent.join(',') === 'unrated,junk,good', byIntent.join(','))

  // Every sort is total, so the list cannot reshuffle between renders on a tie.
  const tied = sortLeads([
    { id: 'older', createdAt: daysAgo(5), intentScore: 50, valueRating: 5 },
    { id: 'newer', createdAt: daysAgo(1), intentScore: 50, valueRating: 5 },
  ], 'intent').map((l) => l.id)
  check('ties break by arrival, so no order is ambiguous',
    tied.join(',') === 'newer,older', tied.join(','))
}

console.log('\n── the page uses the rule rather than a copy of it ──')
{
  const page = readFileSync(join(process.cwd(), 'app/freehold-intelligence/crm/page.tsx'), 'utf8')
  // Comments explain the rule and would match any regex written about it —
  // strip them, then look only at what actually executes.
  const code = page.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  check('the list is ordered by the shared module', /sortLeads\(/.test(code))
  check('…and holds no comparator of its own',
    !/\.sort\(\(a, b\)/.test(code), (code.match(/\.sort\([^)]*/) ?? [''])[0])
  check('…and every sort is offered, from the walkable list',
    /CRM_SORTS\.map/.test(code))
  check('…and it opens on the default rather than a hardcoded one',
    /useState<CrmSort>\(DEFAULT_CRM_SORT\)/.test(code))

  // The labels are rendered through a computed key, which `pnpm i18n` cannot
  // see; dynamic-keys-test enumerates the family off CRM_SORTS.
  const dyn = readFileSync(join(process.cwd(), 'scripts/dynamic-keys-test.ts'), 'utf8')
  check('the sort labels are enumerated for the key audit',
    /CRM_SORTS/.test(dyn) && CRM_SORTS.length === 3, String(CRM_SORTS.length))
}

console.log(failures === 0
  ? '\n✅ the list has an order, and the day filters can see the day.'
  : `\n❌ ${failures} CRM-order guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
