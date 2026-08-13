/**
 * A BAD HOUR IS NOT ALWAYS A BAD HOUR — locked.
 *
 * Nothing in this product reads the clock. Every number is a total over thirty
 * days, and an account that spends the same at 03:00 as at 19:00 is leaving the
 * easiest money on the table there is.
 *
 * The obvious fix is the wrong one. "Leads at 3am never convert, so stop
 * advertising at 3am" is what every dashboard does, and on a brokerage it is
 * usually backwards: a lead that arrives at 03:00 is not called at 03:00, it
 * waits until 09:00 and goes cold. The hour did not fail — the cover did, and
 * switching the hour off deletes the evidence instead of the problem.
 *
 * So this suite locks the separation: `weak` only when those leads were
 * answered as fast as everywhere else, `unanswered` when they were not, and
 * only `weak` may ever remove an hour from a schedule.
 *
 * Pure — no network, no clock. Runs in `pnpm guards`.
 */
import {
  DAY_BLOCKS, HOUR_VERDICTS, BLOCK_HOURS, MIN_LEADS_PER_BLOCK, SLOW_RESPONSE_MULTIPLE,
  DUBAI_UTC_OFFSET_HOURS, blockOf, readDay, scheduleFrom, hoursOf,
  type HourLead, type DayBlock,
} from '../lib/freehold/hour-truth'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** A lead arriving at a given DUBAI hour. */
const at = (dubaiHour: number, o: Partial<HourLead> = {}): HourLead => ({
  createdAt: Date.UTC(2026, 5, 10, dubaiHour - DUBAI_UTC_OFFSET_HOURS, 0, 0),
  qualified: false,
  responseMinutes: 20,
  ...o,
})
const many = (n: number, dubaiHour: number, o: Partial<HourLead> = {}) =>
  Array.from({ length: n }, () => at(dubaiHour, o))
const verdictOf = (leads: HourLead[], b: DayBlock) => readDay(leads).find((r) => r.block === b)!

console.log('\n── the clock is read in Dubai, not in UTC ──')
{
  // An hour report computed in UTC is wrong by four hours and looks perfectly
  // reasonable, which is why it would never be caught by eye.
  check('21:00 Dubai is evening, not afternoon', blockOf(at(21).createdAt) === 'evening',
    String(blockOf(at(21).createdAt)))
  check('03:00 Dubai is night', blockOf(at(3).createdAt) === 'night')
  check('09:00 Dubai is morning', blockOf(at(9).createdAt) === 'morning')
  check('15:00 Dubai is afternoon', blockOf(at(15).createdAt) === 'afternoon')
  check('a broken timestamp lands in no block', blockOf('not a date') === null)

  // The blocks must tile the whole day with no gap and no overlap, or leads
  // vanish from the report without anything saying so.
  const covered = new Set<number>()
  for (const b of DAY_BLOCKS) {
    const [from, to] = BLOCK_HOURS[b]
    for (let h = from; h < to; h++) {
      check(`hour ${h} belongs to exactly one block`, !covered.has(h), `${h} already claimed`)
      covered.add(h)
    }
  }
  check('every hour of the day is in a block', covered.size === 24, String(covered.size))
}

console.log('\n── a block nobody can judge says so ──')
{
  const thin = [...many(4, 3, { qualified: true }), ...many(40, 10)]
  check(`under ${MIN_LEADS_PER_BLOCK} leads a block is THIN, whatever its rate`,
    verdictOf(thin, 'night').verdict === 'thin', verdictOf(thin, 'night').verdict)
  // A perfect rate on four leads must never read as the best hour of the day.
  check('…even at a 100% qualified rate', verdictOf(thin, 'night').rate === 1)

  // And a block cannot be judged against a rest-of-day that is itself thin.
  const both = [...many(20, 3), ...many(4, 10)]
  check('nor against a rest-of-day with nothing in it',
    verdictOf(both, 'night').verdict === 'thin', verdictOf(both, 'night').verdict)
}

console.log('\n── the hour that is genuinely worse ──')
{
  // Night leads answered just as fast as everyone else's, and they still do
  // not qualify. That is the hour, and it is fair to stop buying it.
  const leads = [
    ...many(40, 3, { qualified: false, responseMinutes: 20 }),
    ...many(30, 10, { qualified: true, responseMinutes: 20 }),
    ...many(30, 20, { qualified: true, responseMinutes: 20 }),
  ]
  const night = verdictOf(leads, 'night')
  check('answered as fast as the rest and still converting nothing is WEAK',
    night.verdict === 'weak', `${night.verdict} p=${night.p.toFixed(4)}`)
  check('…and it cites a real separation', night.p < 0.05, night.p.toFixed(4))
  check('the hours that do convert read STRONG',
    verdictOf(leads, 'morning').verdict === 'strong', verdictOf(leads, 'morning').verdict)
}

console.log('\n── THE ONE THAT MATTERS: nobody was awake ──')
{
  // The same night leads, converting just as badly — but they waited seven
  // hours for a call while everyone else waited twenty minutes. The hour has
  // not been given the same chance, and switching it off would delete the
  // evidence rather than the problem.
  const leads = [
    ...many(40, 3, { qualified: false, responseMinutes: 420 }),
    ...many(30, 10, { qualified: true, responseMinutes: 20 }),
    ...many(30, 20, { qualified: true, responseMinutes: 20 }),
  ]
  const night = verdictOf(leads, 'night')
  check('slow-answered leads are UNANSWERED, not weak',
    night.verdict === 'unanswered', night.verdict)
  check('…and the report carries the median wait that proves it',
    night.medianResponseMinutes === 420, String(night.medianResponseMinutes))

  // Nobody answered at all is the slowest possible answer.
  const never = [
    ...many(40, 3, { qualified: false, responseMinutes: null }),
    ...many(30, 10, { qualified: true, responseMinutes: 20 }),
    ...many(30, 20, { qualified: true, responseMinutes: 20 }),
  ]
  const silent = verdictOf(never, 'night')
  check('nobody answering at all is not evidence against the hour',
    silent.verdict === 'unanswered', silent.verdict)
  check('…and how many went unanswered is reported', silent.neverAnswered === 40,
    String(silent.neverAnswered))

  // NORMAL SPREAD IS NOT AN EXCUSE. A block a little slower than the best is
  // still judged on its results, or every bad hour hides behind "nobody
  // answered".
  const slightly = [
    ...many(40, 3, { qualified: false, responseMinutes: 20 * SLOW_RESPONSE_MULTIPLE - 1 }),
    ...many(30, 10, { qualified: true, responseMinutes: 20 }),
    ...many(30, 20, { qualified: true, responseMinutes: 20 }),
  ]
  check('a block only slightly slower is still judged on its results',
    verdictOf(slightly, 'night').verdict === 'weak', verdictOf(slightly, 'night').verdict)
}

console.log('\n── a day where nothing separates ──')
{
  const flat = [...many(30, 3, { qualified: true }), ...many(30, 10, { qualified: true }),
    ...many(30, 15, { qualified: true }), ...many(30, 20, { qualified: true })]
  check('four blocks converting alike are EVEN, not ranked',
    readDay(flat).every((r) => r.verdict === 'even'),
    readDay(flat).map((r) => `${r.block}:${r.verdict}`).join(' '))
  check('…and an even day produces no schedule at all', scheduleFrom(readDay(flat)) === null)
  check('an empty account does not throw',
    readDay([]).length === DAY_BLOCKS.length && readDay([]).every((r) => r.verdict === 'thin'))
}

console.log('\n── only a proven bad hour is ever switched off ──')
{
  const weakNight = [
    ...many(40, 3, { qualified: false, responseMinutes: 20 }),
    ...many(30, 10, { qualified: true, responseMinutes: 20 }),
    ...many(30, 20, { qualified: true, responseMinutes: 20 }),
  ]
  const sched = scheduleFrom(readDay(weakNight))
  check('a weak block is dropped from the schedule',
    !!sched && !sched.includes('night'), JSON.stringify(sched))
  check('…and every other block is kept', !!sched && sched.includes('morning') && sched.includes('evening'))

  // AN UNANSWERED BLOCK IS A ROTA PROBLEM AND THE ADS ARE THE WRONG LEVER.
  const unanswered = [
    ...many(40, 3, { qualified: false, responseMinutes: 420 }),
    ...many(30, 10, { qualified: true, responseMinutes: 20 }),
    ...many(30, 20, { qualified: true, responseMinutes: 20 }),
  ]
  check('an unanswered block is NOT switched off',
    scheduleFrom(readDay(unanswered)) === null,
    JSON.stringify(scheduleFrom(readDay(unanswered))))

  // A schedule of nothing would buy no hours at all — worse than no schedule.
  check('a schedule is never empty', scheduleFrom(
    DAY_BLOCKS.map((block) => ({
      block, leads: 40, qualified: 0, rate: 0, medianResponseMinutes: 20,
      neverAnswered: 0, verdict: 'weak' as const, p: 0.001,
    }))) === null)

  check('the schedule carries real hour ranges',
    hoursOf(['morning']).length === 1 && hoursOf(['morning'])[0][0] === BLOCK_HOURS.morning[0])
}

console.log('\n── the reading carries counts, never people ──')
{
  // The reading is spread straight into an API response. It used to carry the
  // lead rows it was built from, so a panel about four bars would have shipped
  // every lead's arrival time, qualified flag and response delay to the
  // browser. Counts leave this function; people do not.
  const reading = readDay(many(40, 3, { qualified: true }))[0] as unknown as Record<string, unknown>
  const leaked = Object.entries(reading).filter(([, v]) => Array.isArray(v) || (v !== null && typeof v === 'object'))
  check('no lead rows survive into the reading', leaked.length === 0,
    leaked.map(([k]) => k).join(','))
  check('…and every field on it is a number, a string or null',
    Object.values(reading).every((v) => v === null || ['number', 'string'].includes(typeof v)),
    Object.entries(reading).map(([k, v]) => `${k}:${typeof v}`).join(' '))
}

console.log('\n── every verdict is reachable ──')
{
  const seen = new Set<string>()
  for (const set of [
    [...many(40, 3, { qualified: false, responseMinutes: 20 }), ...many(30, 10, { qualified: true }),
     ...many(30, 20, { qualified: true }), ...many(3, 15)],
    [...many(40, 3, { qualified: false, responseMinutes: 420 }), ...many(30, 10, { qualified: true }),
     ...many(30, 20, { qualified: true })],
    [...many(30, 3, { qualified: true }), ...many(30, 10, { qualified: true }),
     ...many(30, 15, { qualified: true }), ...many(30, 20, { qualified: true })],
  ]) for (const r of readDay(set)) seen.add(r.verdict)
  const missing = HOUR_VERDICTS.filter((v) => !seen.has(v))
  check('every verdict can happen — none is dead copy', missing.length === 0, missing.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} hour rule(s) broken.`)
  process.exit(1)
}
console.log('\nAn hour is only switched off when the hour, not the rota, is what failed.\n')
