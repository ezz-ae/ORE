/**
 * THE GUARD REACHES A PERSON, AND ONLY WHEN THERE IS NEWS — locked.
 *
 * The targeting guard's own header said it "stores the run, and raises an
 * alarm only when something needs stopping." It did neither: it ran daily,
 * decided the right actions, and returned them as an HTTP response body that
 * a Vercel cron discards.
 *
 * Correct and unreachable is worth the same as wrong.
 *
 * The second half is the harder rule. The route's header also says "a muted
 * guard is worse than none" — and a guard that alerts on STATE sends the same
 * alarm every morning until somebody fixes it, which is precisely how a person
 * learns to swipe it away. So the notification is gated on CHANGE, and the
 * record is written either way.
 *
 * Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { newStops, clearedStops, shouldNotify, type GuardStop } from '../lib/freehold/guard-runs'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const s = (campaignId: string, key: string): GuardStop => ({ campaignId, name: campaignId, key })

console.log('\n── the alarm fires on news, not on state ──')
{
  const yesterday = [s('c1', 'expansion')]
  const today = [s('c1', 'expansion')]
  check('an unchanged problem does not interrupt anybody',
    !shouldNotify(today, yesterday), 'the daily repeat is back')
  check('…and a new campaign going broad does',
    shouldNotify([...today, s('c2', 'expansion')], yesterday))

  // Same campaign, different fault: a broad campaign that is now ALSO running
  // on a retired targeting signal is a new sentence, not a repeat.
  check('the same campaign for a different reason is news',
    shouldNotify([s('c1', 'deadSignals')], yesterday),
    'a second fault on a known campaign would stay silent')

  check('a run with nothing wrong says nothing', !shouldNotify([], []))
  check('…and going quiet is not itself an interruption',
    !shouldNotify([], yesterday), 'clearing would page somebody')
  check('…though it is reported, because it is the only proof acting worked',
    clearedStops([], yesterday).length === 1)

  // THE COUNT IS DELIBERATELY NOT A TRIGGER. Three unchanged stops are the
  // same unread message as one, and resending it is how it stops being read.
  check('more of the same is still the same message',
    !shouldNotify([s('c1', 'expansion'), s('c1', 'expansion')], yesterday))

  check('newStops names what changed, so the alert can say it',
    newStops([s('c1', 'expansion'), s('c9', 'noProperty')], yesterday)
      .map((x) => x.campaignId).join(',') === 'c9')
}

console.log('\n── and the cron actually does both ──')
{
  const route = readFileSync(join(process.cwd(), 'app/api/cron/targeting-guard/route.ts'), 'utf8')
  const code = route.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

  // THE ASSERTION THAT WOULD HAVE CAUGHT IT. The header described a store and
  // an alarm for as long as the file has existed; only the prose had them.
  check('the run is written down, not returned into a discarded body',
    /INSERT INTO freehold_targeting_guard_runs/.test(code), 'nothing is persisted')
  check('…and a person is notified when something new needs stopping',
    /notify\(/.test(code), 'the guard still tells nobody')
  check('…through the change gate, not on every run',
    /shouldNotify\(/.test(code), 'it would alert daily and get muted')
  check('…and the notification carries where to go',
    /href:/.test(code))

  // Neither half may take the run down with it: a guard that throws on its own
  // bookkeeping stops guarding.
  check('storing and alerting can never fail the run',
    (code.match(/catch/g) ?? []).length >= 3, String((code.match(/catch/g) ?? []).length))
}

console.log(failures === 0
  ? '\n✅ the guard writes what it found and interrupts only when it is new.'
  : `\n❌ ${failures} guard-run assertion(s) failed`)
process.exit(failures === 0 ? 0 : 1)
