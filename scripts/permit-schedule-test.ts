/**
 * The ad stops when the permit does — locked.
 *
 * trakheesi.ts states the rule: an ad running past its permit is as
 * non-compliant as one that never had a permit. It was enforced only by a cron
 * that runs twice a day (so up to twelve hours late) and not at all by the
 * manual launcher. Meta enforces it exactly, for free, via end_time.
 *
 * THE TRAP THIS FILE EXISTS FOR: Meta reads a bare timestamp in the AD
 * ACCOUNT's timezone, which this codebase never reads. On an account set west
 * of Dubai, "2026-08-31 23:59:59" keeps a lapsed permit advertising for hours
 * — the same direction of error trakheesi.ts warns about, reached a different
 * way. So the end time is always an ABSOLUTE INSTANT with an explicit offset,
 * which means the same moment everywhere.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { adEndTimeForPermit, endTimeHasPassed, DUBAI_OFFSET } from '../lib/freehold/permit-schedule'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── a permit is valid THROUGH its expiry date ──')
{
  const end = adEndTimeForPermit('2026-08-31')
  check('the ad runs to the last second of that Dubai day',
    end === `2026-08-31T23:59:59${DUBAI_OFFSET}`, String(end))
  check('…and not a moment past it',
    Date.parse(end!) < Date.parse('2026-09-01T00:00:00+04:00'))
  check('…while the whole expiry day is still covered',
    Date.parse(end!) > Date.parse('2026-08-31T23:00:00+04:00'))
}

console.log('\n── the timezone of the ad account cannot change the answer ──')
{
  const end = adEndTimeForPermit('2026-08-31')!
  check('the offset is explicit, never a bare local wall clock',
    /[+-]\d{2}:\d{2}$/.test(end), end)
  check('it names the same instant read from anywhere on earth',
    Date.parse(end) === Date.parse('2026-08-31T19:59:59Z'),
    `${Date.parse(end)} vs ${Date.parse('2026-08-31T19:59:59Z')}`)
}

console.log('\n── a deadline is never invented ──')
{
  check('no expiry on file means no end time at all', adEndTimeForPermit(null) === null)
  check('…and an empty string is the same', adEndTimeForPermit('') === null)
  check('…and prose is not a date', adEndTimeForPermit('expires next spring') === null)
  check('…and a date that does not exist is not a date',
    adEndTimeForPermit('2026-02-31') === null)
  check('a timestamp is trimmed to its calendar day, not rejected',
    adEndTimeForPermit('2026-08-31T09:12:00Z') === `2026-08-31T23:59:59${DUBAI_OFFSET}`,
    String(adEndTimeForPermit('2026-08-31T09:12:00Z')))
}

console.log('\n── a permit that already lapsed is caught before Meta sees it ──')
{
  const NOW = new Date('2026-09-01T08:00:00Z') // 12:00 Dubai, the day after
  check('yesterday’s permit has passed',
    endTimeHasPassed(adEndTimeForPermit('2026-08-31'), NOW))
  check('today’s permit has NOT — it is valid through today',
    !endTimeHasPassed(adEndTimeForPermit('2026-09-01'), NOW))
  check('tomorrow’s certainly has not',
    !endTimeHasPassed(adEndTimeForPermit('2026-09-02'), NOW))

  // The four hours that trakheesi.ts warns about: at 01:00 Dubai on the 1st it
  // is still 21:00 UTC on the 31st. A UTC-day comparison would call the permit
  // valid; an absolute instant does not.
  const JUST_AFTER = new Date('2026-08-31T20:30:00Z') // 00:30 Dubai on the 1st
  check('the Dubai day is what counts, not the server’s',
    endTimeHasPassed(adEndTimeForPermit('2026-08-31'), JUST_AFTER))

  check('no end time is not a lapse', !endTimeHasPassed(null, NOW))
  check('…and an unparseable one is not a lapse either',
    !endTimeHasPassed('whenever', NOW))
}

if (failures > 0) {
  console.error(`\n${failures} permit-window rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe permit window is the ad’s window.\n')
