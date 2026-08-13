/**
 * A REPORT YOU ASK FOR IN PROPERTY WORDS — locked.
 *
 * Meta's "Create view" saves a report, and to build one you must first know
 * that Frequency is the fatigue number, that Reach and Impressions are
 * different, and which twelve of three hundred columns matter for a property
 * lead. Nobody running a brokerage knows that and nobody should have to.
 *
 * So a Smart View has NO COLUMN PICKER: the question picks the columns, the
 * sort, the grouping and the filter. This suite locks the three things that
 * makes true —
 *
 *   · every template narrows to something (a question that keeps every row is
 *     not a question);
 *   · no cost is ever printed for something that bought nothing, and an empty
 *     cell never takes the top row of a worst-first sheet;
 *   · and the words on screen are the trade's, not the platform's.
 *
 * Pure — no network, no clock. Runs in `pnpm guards`.
 */
import {
  VIEW_TEMPLATES, VIEW_COLUMNS, VIEW_FILTERS, VIEW_SCHEDULES, VIEW_RANGES, VIEW_ACCESS,
  VIEW_GROUPINGS, RISK_KINDS,
  TEMPLATE_SPEC, TIRED_TIMES_SEEN, SLOW_ANSWER_MINUTES, MIN_ROWS_TO_FLAG,
  cellOf, keeps, sortRows, buildSheet, totalsOf, isDue,
  type ViewRow, type ViewColumn,
} from '../lib/freehold/smart-view'
import { FREQUENCY_CEILING } from '../lib/freehold/lookalike-ladder'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const row = (o: Partial<ViewRow> & { id: string }): ViewRow => ({
  label: o.id, spend: 1000, enquiries: 10, worthCalling: 4, viewings: 2, sold: 1,
  moneyIn: 1_200_000, seenBy: 40_000, timesSeen: 1.2, answeredIn: 20, daysLive: 30,
  saturated: false, risks: [], ...o,
})

console.log('\n── every question narrows to something ──')
{
  // A template that keeps every row is a list, not an answer — and a list is
  // what the operator already has.
  for (const t of VIEW_TEMPLATES) {
    const spec = TEMPLATE_SPEC[t]
    check(`${t}: has a filter`, VIEW_FILTERS.includes(spec.keep), spec.keep)
    check(`${t}: sorts by a column it actually shows`,
      spec.columns.includes(spec.sortBy), `sorts by ${spec.sortBy}, shows ${spec.columns.join(',')}`)
    check(`${t}: shows a readable number of columns`,
      spec.columns.length >= 3 && spec.columns.length <= 8, String(spec.columns.length))
    check(`${t}: every column is one this product knows`,
      spec.columns.every((c) => (VIEW_COLUMNS as readonly string[]).includes(c)))
  }
  // No duplicate columns — a sheet with "Spent" twice is a bug nobody reports.
  for (const t of VIEW_TEMPLATES) {
    const spec = TEMPLATE_SPEC[t]
    check(`${t}: no column appears twice`, new Set(spec.columns).size === spec.columns.length)
  }
}

console.log('\n── a cost with nothing bought is not a number ──')
{
  const nothing = row({ id: 'a', spend: 5000, enquiries: 0, sold: 0 })
  check('no cost per enquiry when nothing enquired', cellOf(nothing, 'costPerEnquiry') === null)
  check('no cost per sale when nothing sold', cellOf(nothing, 'costPerSale') === null)
  // ZERO WOULD READ AS "FREE", which is the exact opposite of AED 5,000 spent
  // for nothing — the same position min-evidence takes everywhere else.
  check('…and certainly not zero', cellOf(nothing, 'costPerEnquiry') !== 0)

  const real = row({ id: 'b', spend: 1000, enquiries: 10, sold: 2 })
  check('a real cost is the plain division', cellOf(real, 'costPerEnquiry') === 100)
  check('…and per sale too', cellOf(real, 'costPerSale') === 500)

  // A platform that reported nothing is an empty cell, not a zero.
  const unseen = row({ id: 'c', seenBy: 0, timesSeen: 0 })
  check('an unreported audience size is blank, not zero', cellOf(unseen, 'seenBy') === null)
  check('…and so are the times it was seen', cellOf(unseen, 'timesSeen') === null)
  check('nobody answered is blank, not instant',
    cellOf(row({ id: 'd', answeredIn: null }), 'answeredIn') === null)
}

console.log('\n── an empty cell never takes the top row ──')
{
  // On a worst-first sheet the top row is the loudest thing on the page. A row
  // with no number in the sorted column has no claim to it.
  const rows = [
    row({ id: 'blank', spend: 400, enquiries: 0 }),
    row({ id: 'dear', spend: 1000, enquiries: 2 }),
    row({ id: 'cheap', spend: 1000, enquiries: 20 }),
  ]
  const worst = sortRows(rows, 'costPerEnquiry', true)
  check('worst-first puts the cheapest first and the blank last',
    worst[0].id === 'cheap' && worst[worst.length - 1].id === 'blank',
    worst.map((r) => r.id).join(' '))
  const best = sortRows(rows, 'costPerEnquiry', false)
  check('…and biggest-first still leaves the blank last',
    best[best.length - 1].id === 'blank', best.map((r) => r.id).join(' '))

  check('ties fall back to the name, so the sheet does not shuffle each build',
    sortRows([row({ id: 'b', spend: 100 }), row({ id: 'a', spend: 100 })], 'spend', false)
      .map((r) => r.id).join('') === 'ab')
}

console.log('\n── gone stale means tired AND not working ──')
{
  // A WINNER AT SCALE IS ALSO TIRED. Putting winners on a list headed "gone
  // stale" is how the list stops being read by the second week.
  const tiredWinner = row({ id: 'w', timesSeen: 2.4, saturated: true, enquiries: 40, sold: 6 })
  const tiredLoser = row({ id: 'l', timesSeen: 2.4, saturated: true, enquiries: 4, sold: 0 })
  const fresh = row({ id: 'f', timesSeen: 1.1, saturated: false, enquiries: 20 })

  check('a tired, saturated ad is on the list', keeps(tiredLoser, 'stale'))

  // WITH A REAL SLOPE, the slope decides — and the slope knows the difference
  // between a picture people are bored of and an audience that changed.
  check('a measured fatigue is on the list',
    keeps(row({ id: 'd1', decay: 'fatigued', timesSeen: 1.0, saturated: false }), 'stale'))
  // A NEW PICTURE IS THE WRONG ANSWER HERE, and this sheet's title asks for
  // one — so the row that needs an audience change stays off it.
  check('an audience that moved is NOT on the "make a new picture" list',
    !keeps(row({ id: 'd2', decay: 'audienceMoved', timesSeen: 2.4, saturated: true }), 'stale'))
  check('a measured-fresh picture is off it too, whatever its frequency says',
    !keeps(row({ id: 'd3', decay: 'fresh', timesSeen: 2.4, saturated: true }), 'stale'))
  check('too little history falls back to the frequency rule, not to silence',
    keeps(row({ id: 'd4', timesSeen: 2.4, saturated: true, enquiries: 4 }), 'stale'))
  check('a fresh ad is not', !keeps(fresh, 'stale'))
  // Saturation is the second half and it is not optional: a high count on a
  // pool that is still growing is a popular ad, not a dying one.
  check('a high count on an audience still growing is not stale',
    !keeps(row({ id: 'x', timesSeen: 3, saturated: false }), 'stale'))
  check('the tired line matches the ladder\'s ceiling, so a report and the ladder cannot disagree',
    TIRED_TIMES_SEEN === FREQUENCY_CEILING, `${TIRED_TIMES_SEEN} vs ${FREQUENCY_CEILING}`)
  // The winner is still listed — it IS saturating — but the panel's job is to
  // show it beside its enquiries so a person can see which kind it is.
  check('a tired winner is shown too, with its numbers beside it', keeps(tiredWinner, 'stale'))
}

console.log('\n── who did nobody call ──')
{
  const slow = row({ id: 's', enquiries: 20, answeredIn: SLOW_ANSWER_MINUTES + 1 })
  const never = row({ id: 'n', enquiries: 20, answeredIn: null })
  const quick = row({ id: 'q', enquiries: 20, answeredIn: 15 })
  check('a slow desk is on the list', keeps(slow, 'slowlyAnswered'))
  check('nobody answering at all is the slowest of all', keeps(never, 'slowlyAnswered'))
  check('a quick desk is not', !keeps(quick, 'slowlyAnswered'))

  // ONE SLOW ANSWER IS A TUESDAY, NOT A PATTERN. This list names people.
  check(`under ${MIN_ROWS_TO_FLAG} enquiries nothing is flagged`,
    !keeps(row({ id: 't', enquiries: MIN_ROWS_TO_FLAG - 1, answeredIn: null }), 'slowlyAnswered'))
  check('four hours is the line', SLOW_ANSWER_MINUTES === 240, String(SLOW_ANSWER_MINUTES))
}

console.log('\n── what deserves more money ──')
{
  check('proven and still finding new people qualifies',
    keeps(row({ id: 'a', sold: 3, saturated: false }), 'provenAndFresh'))
  // WITHOUT THE SECOND HALF this is a list of campaigns about to stop working,
  // and the money would go to them the week they die.
  check('proven but used up does NOT',
    !keeps(row({ id: 'b', sold: 3, saturated: true }), 'provenAndFresh'))
  check('unproven does not, whatever else is true',
    !keeps(row({ id: 'c', sold: 0, saturated: false }), 'provenAndFresh'))

  check('only rows with something wrong reach the risk list',
    keeps(row({ id: 'r', risks: ['permitLapsing'] }), 'atRisk')
    && !keeps(row({ id: 'o', risks: [] }), 'atRisk'))
  check('a row that never spent is not "where the money went"',
    !keeps(row({ id: 'z', spend: 0 }), 'anySpend'))
}

console.log('\n── the totals are re-derived, never averaged ──')
{
  // An average of two costs weights a campaign that spent AED 40 the same as
  // one that spent AED 40,000. The strip at the top of a sheet is the number
  // that gets screenshotted, so it is the one that must not be wrong.
  const rows = [
    row({ id: 'big', spend: 40_000, enquiries: 100, sold: 4 }),
    row({ id: 'tiny', spend: 40, enquiries: 1, sold: 0 }),
  ]
  const t = totalsOf(rows)
  check('the total cost per enquiry is total spend over total enquiries',
    t.costPerEnquiry === 40_040 / 101, String(t.costPerEnquiry))
  const naive = (40_000 / 100 + 40 / 1) / 2
  check('…and is NOT the average of the two rows', t.costPerEnquiry !== naive,
    `${t.costPerEnquiry} vs ${naive}`)
  check('the counts add up', t.spend === 40_040 && t.enquiries === 101 && t.sold === 4)
  check('a total cost with nothing sold is withheld',
    totalsOf([row({ id: 'a', sold: 0 })]).costPerSale === null)
  check('an empty sheet does not throw',
    totalsOf([]).rows === 0 && totalsOf([]).costPerEnquiry === null)
}

console.log('\n── built before it is opened ──')
{
  const NOW = new Date('2026-08-13T09:00:00Z')
  // A VIEW THAT HAS NEVER BEEN BUILT IS DUE IMMEDIATELY, so a freshly saved
  // view is never an empty screen.
  check('never built is always due', isDue('everyMorning', null, NOW))
  check('a broken timestamp is due, not trusted', isDue('everyMorning', 'not a date', NOW))
  check('built an hour ago is not due', !isDue('everyMorning', '2026-08-13T08:00:00Z', NOW))
  check('built yesterday is due', isDue('everyMorning', '2026-08-12T06:00:00Z', NOW))
  check('a weekly view built yesterday is not due', !isDue('everyMonday', '2026-08-12T06:00:00Z', NOW))
  check('…and one built a fortnight ago is', isDue('everyMonday', '2026-07-30T06:00:00Z', NOW))
  check('"when I open it" is always due', isDue('onOpen', '2026-08-13T08:59:00Z', NOW))
}

console.log('\n── the whole sheet, end to end ──')
{
  const rows = [
    row({ id: 'venice', label: 'Azizi Venice', spend: 9000, enquiries: 30, worthCalling: 18, viewings: 9, sold: 6, moneyIn: 7_200_000 }),
    row({ id: 'creek', label: 'Creek Harbour', spend: 9000, enquiries: 90, worthCalling: 0, viewings: 0, sold: 0, moneyIn: 0 }),
    row({ id: 'quiet', label: 'Never launched', spend: 0, enquiries: 0, worthCalling: 0, viewings: 0, sold: 0, moneyIn: 0 }),
  ]
  const sheet = buildSheet(rows, 'sellingProjects')
  check('the project that never spent is not on the sheet',
    !sheet.some((r) => r.id === 'quiet'), sheet.map((r) => r.id).join(' '))
  check('the one bringing money is first', sheet[0].id === 'venice', sheet.map((r) => r.id).join(' '))
  check('…and the one buying cheap nothing is still shown, so it can be seen',
    sheet.some((r) => r.id === 'creek'))

  // Every template must survive a real sheet without throwing, and every
  // column must render for every row.
  for (const t of VIEW_TEMPLATES) {
    const built = buildSheet(rows, t)
    check(`${t}: builds`, Array.isArray(built))
    const cols = TEMPLATE_SPEC[t].columns
    check(`${t}: every cell resolves`,
      built.every((r) => cols.every((c) => cellOf(r, c as ViewColumn) !== undefined)))
  }
  check('an empty account builds an empty sheet, not an error',
    VIEW_TEMPLATES.every((t) => buildSheet([], t).length === 0))
}

console.log('\n── the vocabulary is the trade\'s, not the platform\'s ──')
{
  // The point of the whole feature. If a platform word reaches this list it
  // reaches the screen, and then the operator is back to choosing between
  // frequency and spend.
  const PLATFORM_WORDS = [
    'frequency', 'reach', 'impressions', 'cpm', 'cpc', 'ctr', 'roas',
    'attribution', 'conversion', 'breakdown', 'objective', 'adset', 'placement',
  ]
  const hits = (VIEW_COLUMNS as readonly string[]).filter((c) =>
    PLATFORM_WORDS.some((w) => c.toLowerCase().includes(w)))
  check('no column is named after a platform metric', hits.length === 0, hits.join(','))

  // Every list has to be walkable for the i18n guard, and every member has to
  // be reachable or the dictionary carries dead copy.
  check('every template has a spec', VIEW_TEMPLATES.every((t) => !!TEMPLATE_SPEC[t]))
  const usedFilters = new Set(VIEW_TEMPLATES.map((t) => TEMPLATE_SPEC[t].keep))
  const unused = VIEW_FILTERS.filter((f) => !usedFilters.has(f) && f !== 'hasSales')
  check('every filter is used by a template — none is dead code', unused.length === 0, unused.join(','))
  const usedColumns = new Set(VIEW_TEMPLATES.flatMap((t) => TEMPLATE_SPEC[t].columns))
  const deadColumns = VIEW_COLUMNS.filter((c) => !usedColumns.has(c))
  check('every column appears on at least one sheet', deadColumns.length === 0, deadColumns.join(','))
  check('the walkable lists are non-empty',
    VIEW_SCHEDULES.length > 0 && VIEW_RANGES.length > 0 && VIEW_ACCESS.length > 0
    && RISK_KINDS.length > 0)
  // A grouping with no honest data behind it is exactly what this file exists
  // to avoid — every template must group by something the product can build.
  check('every template groups by something this product can build',
    VIEW_TEMPLATES.every((t) => (VIEW_GROUPINGS as readonly string[]).includes(TEMPLATE_SPEC[t].groupBy)),
    VIEW_TEMPLATES.map((t) => `${t}:${TEMPLATE_SPEC[t].groupBy}`).join(' '))
}

if (failures > 0) {
  console.error(`\n${failures} smart-view rule(s) broken.`)
  process.exit(1)
}
console.log('\nA report you ask for in property words, built before you open it.\n')
