/**
 * THE FILTERS MEAN WHAT THEY SAY, AND COST NO SCREEN — locked.
 *
 * "we need to add smart filters on the crm — today, yesterday, last 7 days,
 *  qualified, not rated, disqualified, junk. i dont want them to be taking
 *  space i want them smart, when user put his mouse on search to write this
 *  drop down appear."
 *
 * Two things worth pinning, and they pull in opposite directions.
 *
 * THE MEANINGS. "Qualified" in this product is not one column — a broker who
 * rates a lead 8 has said it is worth pursuing as surely as somebody who
 * dragged its card, and the campaign score already counts both. A filter that
 * read only the status column would disagree with the number on the campaign
 * page, and an operator would have no way to tell which was lying.
 *
 * THE TIME. "Today" on UTC boundaries includes four hours of yesterday evening
 * in Dubai. The CRM's count and Ads Manager's count for the same day would
 * differ and neither would look wrong on screen.
 *
 * Pure — the clock is injected. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CRM_FILTERS, CRM_FILTER_GROUPS, CRM_FILTER_DEFS,
  matchesFilters, parseFilters, filtersInGroup, filterCounts,
  type FilterableLead,
} from '../lib/freehold/crm-filters'
import { VALUABLE_RATING, AVOID_RATING } from '../lib/freehold/lead-stages'
import { dayBounds, dayKey, OPERATION_TZ } from '../lib/freehold/clock'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** A fixed instant mid-afternoon in Dubai, so "today" is unambiguous. */
const NOW = Date.parse('2026-08-30T10:00:00Z')
const atLocalDay = (offset: number, hour = 12) => {
  const { startMs } = dayBounds(dayKey(NOW - offset * 86_400_000, OPERATION_TZ), OPERATION_TZ)
  return new Date(startMs + hour * 3_600_000).toISOString()
}
const lead = (o: Partial<FilterableLead> = {}): FilterableLead => ({ createdAt: atLocalDay(0), ...o })
const keeps = (l: FilterableLead, ...f: string[]) =>
  matchesFilters(l, parseFilters(f), NOW)

console.log('\n── every filter the operator asked for exists ──')
{
  for (const id of ['today', 'yesterday', 'last7', 'qualified', 'notRated', 'disqualified', 'junk']) {
    check(`${id} is a filter`, (CRM_FILTERS as readonly string[]).includes(id))
  }
  check('and they are grouped', CRM_FILTER_GROUPS.length === 3, CRM_FILTER_GROUPS.join(','))
  check('every filter belongs to a group that exists',
    CRM_FILTER_DEFS.every((f) => (CRM_FILTER_GROUPS as readonly string[]).includes(f.group)))
  check('every group has filters in it',
    CRM_FILTER_GROUPS.every((g) => filtersInGroup(g).length > 0))
  check('no filter is defined twice',
    new Set(CRM_FILTER_DEFS.map((f) => f.id)).size === CRM_FILTER_DEFS.length)
}

console.log('\n── the day boundaries are the operation\'s, not UTC\'s ──')
{
  check('a lead from today is today', keeps(lead(), 'today'))
  check('…and is not yesterday', !keeps(lead(), 'yesterday'))
  check('a lead from yesterday is yesterday', keeps(lead({ createdAt: atLocalDay(1) }), 'yesterday'))

  // THE ONE THAT UTC GETS WRONG. 21:00 UTC is already tomorrow in Dubai
  // (UTC+4), so a UTC-boundary filter would file this under the wrong day and
  // the CRM would disagree with Ads Manager about the same lead.
  const lateEveningUtc = '2026-08-29T21:30:00Z' // = 01:30 on the 30th in Dubai
  check('an evening-UTC lead lands on the local day, not the UTC one',
    keeps(lead({ createdAt: lateEveningUtc }), 'today')
    && !keeps(lead({ createdAt: lateEveningUtc }), 'yesterday'),
    lateEveningUtc)

  // Seven local days INCLUDING today, anchored on day boundaries so the answer
  // does not shift while somebody is reading the list.
  check('last 7 days includes today', keeps(lead(), 'last7'))
  check('…and the sixth day back', keeps(lead({ createdAt: atLocalDay(6) }), 'last7'))
  check('…and excludes the seventh', !keeps(lead({ createdAt: atLocalDay(7) }), 'last7'))

  check('a lead with no date is not swept into a time filter',
    !keeps({ createdAt: undefined }, 'today') && !keeps({ createdAt: 'not a date' }, 'last7'))
}

console.log('\n── quality means what the campaign score means ──')
{
  // EITHER JUDGMENT. A filter reading only the status column would disagree
  // with the number on the campaign page, and nothing on screen would say
  // which was lying.
  check('a status-qualified lead is qualified',
    keeps(lead({ pipelineStage: 'qualified' }), 'qualified'))
  check('…and so is a well-rated one whose card never moved',
    keeps(lead({ pipelineStage: 'new', valueRating: VALUABLE_RATING }), 'qualified'))
  check('…but not a poorly-rated new one',
    !keeps(lead({ pipelineStage: 'new', valueRating: AVOID_RATING }), 'qualified'))

  check('not rated means nobody has judged it',
    keeps(lead({ valueRating: null }), 'notRated') && keeps(lead({}), 'notRated'))
  // Zero is a judgment — the bottom of the scale is the training signal.
  check('…and a rating of 0 is rated',
    !keeps(lead({ valueRating: 0 }), 'notRated'))

  check('disqualified is a human saying no',
    keeps(lead({ valueRating: AVOID_RATING }), 'disqualified')
    && !keeps(lead({ valueRating: VALUABLE_RATING }), 'disqualified'))

  // Junk is a defect in the RECORD, not a verdict on the person — the two
  // must not collapse into one another.
  check('junk is blocked or undialable',
    keeps(lead({ blocked: true }), 'junk')
    && keeps(lead({ wrongNumberRisk: true }), 'junk'))
  // A REPEAT IS NOT JUNK. This filter shipped counting duplicateRisk as junk,
  // which put somebody registering for a second apartment in the same bucket
  // as a blocked number — the strongest buying signal a funnel produces,
  // filed as waste. It has its own filter now, because "who came back" is a
  // question a sales team asks on purpose and the answer is a call list.
  check('somebody who registered twice is NOT junk',
    !keeps(lead({ duplicateRisk: true }), 'junk'))
  check('…they are findable on purpose',
    keeps(lead({ duplicateRisk: true }), 'repeat')
    && !keeps(lead({ duplicateRisk: false }), 'repeat'))
  check('…and a merely low-rated lead is not junk',
    !keeps(lead({ valueRating: 0 }), 'junk'))
  check('…and a junk lead is not automatically disqualified',
    !keeps(lead({ blocked: true }), 'disqualified'))
}

console.log('\n── where the lead came from ──')
{
  // An id is proof; a source string is a label somebody typed.
  check('a lead with a campaign id is Meta', keeps(lead({ campaignId: '120' }), 'meta'))
  check('…or an ad id', keeps(lead({ adId: '987' }), 'meta'))
  check('…or a source that says so', keeps(lead({ source: 'Facebook Lead Ad' }), 'meta'))
  check('a HubSpot lead is HubSpot', keeps(lead({ hubspotLeadId: 'h1' }), 'hubspot'))
  check('…and is not Meta by accident', !keeps(lead({ hubspotLeadId: 'h1' }), 'meta'))
  check('a landing lead is landing', keeps(lead({ landingId: 'lp1' }), 'landing'))
}

console.log('\n── OR inside a group, AND between groups ──')
{
  // The same rule Meta's flexible_spec uses, which this product already
  // documents. An operator should not have to learn a second, contradictory
  // version of it in the CRM.
  const yesterdayMeta = lead({ createdAt: atLocalDay(1), campaignId: '120' })
  check('two time filters WIDEN the answer',
    keeps(yesterdayMeta, 'today', 'yesterday'))
  check('a filter from another group NARROWS it',
    keeps(yesterdayMeta, 'yesterday', 'meta')
    && !keeps(yesterdayMeta, 'yesterday', 'hubspot'))
  check('…across three groups at once',
    keeps(lead({ campaignId: '1', valueRating: 9 }), 'today', 'meta', 'qualified'))

  // No filter is not a filter that excludes.
  check('an empty selection keeps everything', matchesFilters(lead(), [], NOW))
  // A view saved by an older deploy must not wedge the list.
  check('an unknown id is dropped, not obeyed',
    parseFilters(['today', 'nonsense']).length === 1
    && matchesFilters(lead(), parseFilters(['nonsense']), NOW))
  check('duplicates collapse', parseFilters(['today', 'today']).length === 1)
}

console.log('\n── the counts tell the truth before you click ──')
{
  const rows = [
    lead({ campaignId: '1', valueRating: 9 }),
    lead({ campaignId: '2', valueRating: null }),
    lead({ createdAt: atLocalDay(1), hubspotLeadId: 'h' }),
  ]
  const c = filterCounts(rows, [], NOW)
  check('counts reflect what each filter would leave',
    c.today === 2 && c.yesterday === 1 && c.meta === 2 && c.notRated === 2,
    JSON.stringify({ today: c.today, yesterday: c.yesterday, meta: c.meta, notRated: c.notRated }))
  // Counts are computed against what is ALREADY chosen, so the second click
  // shows what it will really leave rather than a number from a fresh list.
  const narrowed = filterCounts(rows, parseFilters(['hubspot']), NOW)
  check('…and narrow as a selection builds',
    narrowed.today === 0 && narrowed.yesterday === 1,
    JSON.stringify({ today: narrowed.today, yesterday: narrowed.yesterday }))
  // "Nothing here" is an answer; a missing option is a question.
  check('a zero is a number, not a hidden row',
    Object.values(narrowed).some((n) => n === 0))
}

console.log('\n── and it costs no screen until somebody is looking ──')
{
  const panel = readFileSync(join(process.cwd(), 'components/freehold/smart-filters.tsx'), 'utf8')
  const page = readFileSync(join(process.cwd(), 'app/freehold-intelligence/crm/page.tsx'), 'utf8')

  check('the panel renders nothing when closed', /if \(!open\) return null/.test(panel))

  // IT FLOATS OVER THE LEAD TABLE, SO IT HAS TO BE OPAQUE. surface-2 is
  // rgba(255,255,255,0.06) — raised GLASS, designed to sit on a solid card.
  // Used as a floating panel it let every row of the table read straight
  // through it, which is what shipped. Every other dropdown in this product
  // uses bg-surface (#181613, opaque) for exactly this reason.
  const panelDiv = panel.slice(panel.indexOf('absolute inset-x-0 top-full'))
  check('the floating panel has an opaque background',
    /bg-surface\b/.test(panelDiv.slice(0, 200)) && !/bg-surface-2\b/.test(panelDiv.slice(0, 200)),
    panelDiv.slice(0, 160))
  check('…and opens on the search box being focused',
    /onFocus=\{\(\) => setFiltersOpen\(true\)\}/.test(page))
  check('…and closes when it loses focus',
    /onBlur=\{\(\) => setFiltersOpen\(false\)\}/.test(page))

  // THE FAST PATH: type, click a filter, keep typing — in one movement. A
  // panel that stole focus would make that impossible, and closing on select
  // would make choosing two filters two gestures.
  check('clicking a filter never steals the keyboard',
    (panel.match(/e\.preventDefault\(\)/g) ?? []).length >= 3, panel.slice(0, 0))
  check('…and choosing one does not close the panel',
    !/setFiltersOpen\(false\)/.test(panel))

  // The rules belong in the pure module; a second copy in the view is how the
  // dropdown and the list start disagreeing.
  check('the page filters through the shared rule',
    /matchesFilters\(l, filters, filterNow\)/.test(page))
  check('…and the panel holds no filtering logic of its own',
    !/pipelineStage|valueRating|createdAt/.test(panel))

  // "Today" must not shift under a list somebody is reading.
  check('the clock is frozen for the session, not read per render',
    /useState\(\(\) => Date\.now\(\)\)/.test(panel) && /useState\(\(\) => Date\.now\(\)\)/.test(page))
}

console.log(failures === 0
  ? '\n✅ the filters mean what the rest of the product means, and hide until asked.'
  : `\n❌ ${failures} CRM-filter guard(s) failed`)
process.exit(failures === 0 ? 0 : 1)
