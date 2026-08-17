/**
 * ONE CLOCK, OR THE SAME LEAD ARRIVED AT THREE DIFFERENT TIMES — locked.
 *
 * Meta reports in the AD ACCOUNT's timezone (Asia/Dubai on this account). This
 * product rendered every timestamp with `toLocaleString(locale, {…})` and no
 * `timeZone`, which resolves to the BROWSER's zone on the client and the
 * SERVER's zone on a server-rendered page — UTC, on Vercel.
 *
 * So a lead that registered at 01:30 Dubai displayed as 21:30 THE PREVIOUS DAY
 * to anything rendering in UTC. Wrong hour, wrong day, and therefore wrong in
 * every "leads today" count and every response-time measurement built on it —
 * while looking completely precise on screen.
 *
 * The instant was never lost: created_at is timestamptz and the Meta sync
 * casts the ISO offset straight in. What was missing was one answer to "in
 * which zone do we SAY it".
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import {
  formatInstant, formatInstantZoned, dayKey, sameDay, dayBounds,
  offsetMinutes, zoneLabel,
} from '../lib/freehold/clock'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const DUBAI = 'Asia/Dubai'

console.log('\n── the day is the operation\'s day, not the server\'s ──')
{
  // THE EXACT CASE. 21:30 UTC is already tomorrow in Dubai. A UTC-rendered
  // screen puts this lead on the wrong date, and every daily count inherits it.
  const lateNight = '2026-08-16T21:30:00Z'
  check('an instant after 20:00 UTC belongs to the NEXT Dubai day',
    dayKey(lateNight, DUBAI) === '2026-08-17', dayKey(lateNight, DUBAI))
  check('…and to the same day in UTC, which is the disagreement',
    dayKey(lateNight, 'UTC') === '2026-08-16', dayKey(lateNight, 'UTC'))

  check('two instants either side of Dubai midnight are different days',
    !sameDay('2026-08-16T19:59:00Z', '2026-08-16T20:01:00Z', DUBAI))
  check('…and two inside the same Dubai day are the same day',
    sameDay('2026-08-16T20:01:00Z', '2026-08-17T10:00:00Z', DUBAI))
}

console.log('\n── a day is bounded where the operation says it is ──')
{
  // The half that makes counts agree with Ads Manager. UTC bounds include four
  // hours of yesterday evening and drop four hours of today.
  const { startMs, endMs } = dayBounds('2026-08-17', DUBAI)
  check('the Dubai day starts at 20:00 UTC the day before',
    new Date(startMs).toISOString() === '2026-08-16T20:00:00.000Z',
    new Date(startMs).toISOString())
  check('…and is exactly 24 hours long here, since Dubai has no DST',
    endMs - startMs === 86_400_000, String(endMs - startMs))
  check('…and the end is exclusive, so >= start && < end needs no off-by-one',
    dayKey(endMs, DUBAI) === '2026-08-18', dayKey(endMs, DUBAI))

  // A LEAD ON THE BOUNDARY lands on the right side of it.
  check('the first instant of the day is inside it',
    dayKey(startMs, DUBAI) === '2026-08-17', dayKey(startMs, DUBAI))
  check('…and the last millisecond too',
    dayKey(endMs - 1, DUBAI) === '2026-08-17', dayKey(endMs - 1, DUBAI))
}

console.log('\n── offsets are computed, never assumed ──')
{
  // Dubai is +4 always. The point of computing it is the operators who are not
  // in Dubai — a hardcoded offset is silently wrong twice a year for them.
  check('Dubai is +4 in winter', offsetMinutes(new Date('2026-01-15T12:00:00Z'), DUBAI) === 240)
  check('…and +4 in summer, because there is no DST to track',
    offsetMinutes(new Date('2026-07-15T12:00:00Z'), DUBAI) === 240)

  // A zone that DOES change proves the arithmetic is real rather than a
  // constant with extra steps.
  const londonWinter = offsetMinutes(new Date('2026-01-15T12:00:00Z'), 'Europe/London')
  const londonSummer = offsetMinutes(new Date('2026-07-15T12:00:00Z'), 'Europe/London')
  check('a DST zone reports two different offsets across the year',
    londonWinter === 0 && londonSummer === 60, `${londonWinter} / ${londonSummer}`)
}

console.log('\n── the zone is said out loud ──')
{
  // "12:32" reads as local to whoever is looking. One word removes the
  // question, and it is derived from the IANA id so a Riyadh operator gets
  // "Riyadh time" without anybody editing a file.
  check('the label is the city, not the IANA path', zoneLabel(DUBAI) === 'Dubai', zoneLabel(DUBAI))
  check('…and underscores become spaces', zoneLabel('America/New_York') === 'New York')

  const shown = formatInstantZoned('2026-08-17T08:32:00Z', 'en-GB', { timeStyle: 'short' }, DUBAI)
  check('an instant renders in Dubai time with the zone named',
    shown.includes('12:32') && shown.endsWith('Dubai time'), shown)

  // …AND THE SAME INSTANT IS A DIFFERENT WALL CLOCK ELSEWHERE, which is the
  // whole bug: without the zone, both strings look equally authoritative.
  const utc = formatInstant('2026-08-17T08:32:00Z', 'en-GB', { timeStyle: 'short' }, 'UTC')
  check('…and would have read 08:32 rendered on a UTC server',
    utc.includes('08:32'), utc)
}

console.log('\n── nothing renders as a crash ──')
{
  for (const bad of [null, undefined, '', 'not a date']) {
    check(`\`${String(bad)}\` renders as an em dash, not "Invalid Date"`,
      formatInstant(bad as string | null, 'en-GB') === '—',
      formatInstant(bad as string | null, 'en-GB'))
  }
  check('…and the zoned form does not append a zone to nothing',
    formatInstantZoned(null, 'en-GB') === '—', formatInstantZoned(null, 'en-GB'))
}

console.log('\n── the timezone-blind renders cannot grow ──')
{
  // A RATCHET, not a clean bill of health. 60-odd call sites render dates
  // without a zone and converting them all at once would be a blind sweep
  // across screens nobody has looked at. What must not happen is MORE of them,
  // so the count is pinned: the sweep can only shrink it.
  //
  // Date-shaped calls only. `n.toLocaleString()` on a number is everywhere and
  // is not a timezone question, so a bare toLocaleString counts only when its
  // options name a date or time field.
  const files = execSync(
    "git ls-files 'app/**/*.tsx' 'app/**/*.ts' 'lib/**/*.ts' 'lib/**/*.tsx' 'components/**/*.tsx'",
    { encoding: 'utf8' },
  ).split('\n').filter(Boolean)

  const offenders: string[] = []
  for (const f of files) {
    if (f.endsWith('lib/freehold/clock.ts')) continue
    const src = readFileSync(f, { encoding: 'utf8' })
    for (const [i, line] of src.split('\n').entries()) {
      const dateShaped = /\.toLocale(Date|Time)String\(/.test(line)
        || (/\.toLocaleString\(/.test(line)
            && /(dateStyle|timeStyle|year:|month:|day:|hour:|minute:|weekday)/.test(line))
      if (dateShaped && !/timeZone/.test(line)) offenders.push(`${f}:${i + 1}`)
    }
  }

  // Lower this number when you convert call sites. It must never go up.
  const BASELINE = 46
  check(`no new timezone-blind date renders (${offenders.length} ≤ ${BASELINE})`,
    offenders.length <= BASELINE,
    `${offenders.length} found — new one(s): ${offenders.slice(BASELINE).join(', ')}`)
  if (offenders.length < BASELINE) {
    console.log(`      ↓ ${BASELINE - offenders.length} converted since the baseline — lower BASELINE to ${offenders.length}`)
  }

  // THE SURFACES THE COMPLAINT WAS ABOUT must be clean, not merely capped.
  const converted = [
    'app/freehold-intelligence/crm/activity/page.tsx',
    'app/freehold-intelligence/crm/leads/[id]/page.tsx',
    'app/freehold-intelligence/crm/leads/[id]/_components/LeadViewingsCard.tsx',
  ]
  for (const f of converted) {
    check(`${f.split('/').slice(-2).join('/')} renders every date through the clock`,
      !offenders.some((o) => o.startsWith(`${f}:`)),
      offenders.filter((o) => o.startsWith(`${f}:`)).join(', '))
  }
}

console.log('\n── the day BUCKETS are the operation\'s day too ──')
{
  // Rendering the right hour is half of it. The other half is which day a
  // record is COUNTED under, and three places got that from UTC:
  //
  //   · the CRM activity feed sliced the ISO string (`iso.slice(0,10)`), which
  //     is the UTC date, and compared it against a UTC "today" — so between
  //     midnight and 04:00 Dubai a broker's own calls appeared under
  //     "Yesterday". Every night.
  //   · the tasks page counted "due today" the same way.
  //   · the Ads Machine daily series used `to_char(created_at, …)`, and
  //     Postgres formats a timestamptz in the SESSION's zone — UTC on Neon —
  //     so the series was on UTC days while Meta reports on Dubai days.
  const src = (p: string) => readFileSync(p, { encoding: 'utf8' })

  const activity = src('app/freehold-intelligence/crm/activity/page.tsx')
  check('the activity feed buckets by the operation\'s day',
    /return dayKey\(iso\)/.test(activity) && !/iso\.slice\(0, 10\)/.test(activity),
    'it is still slicing the UTC date out of the ISO string')
  check('…and "today" is the operation\'s today',
    /const TODAY {5}= dayKey\(Date\.now\(\)\)/.test(activity))

  const tasks = src('app/freehold-intelligence/tasks/page.tsx')
  check('"due today" is the operation\'s today',
    /const todayIso = dayKey\(Date\.now\(\)\)/.test(tasks),
    'tasks due today are counted on UTC days')

  const machine = src('lib/freehold/ads-machine.ts')
  check('the daily verdict series is grouped in the operation\'s zone',
    /to_char\(created_at AT TIME ZONE \$2, 'YYYY-MM-DD'\)/.test(machine),
    'Postgres is grouping on the session zone, which is UTC')
  // Passed as a parameter, not interpolated. It is a trusted env var today,
  // and building the habit of interpolating one into SQL is how an untrusted
  // one gets interpolated tomorrow.
  check('…with the zone passed as a parameter, never interpolated',
    /\[machineId, OPERATION_TZ\]/.test(machine)
      && !/AT TIME ZONE '\$\{/.test(machine))
}

if (failures > 0) {
  console.error(`\n${failures} clock rule(s) broken.`)
  console.error('A time with no zone is not precise, it is ambiguous in a font that looks precise.')
  process.exit(1)
}
console.log('\nEvery date this product states is stated in the zone it operates in.\n')
