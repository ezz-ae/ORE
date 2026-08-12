/**
 * WHAT IT DID VERSUS WHAT IT MEANT TO DO — locked.
 *
 * The ads home led with "What the machine decided" and showed this, for ten
 * days:
 *
 *   Planned 3 Meta trial(s) … Nothing launches until the machine is started.
 *                                                            test one · 5d ago
 *   Planned 2 Meta trial(s) … Nothing launches until the machine is started.
 *                                                                   X · 10d ago
 *
 * The entry says in its own last sentence that nothing happened. And the badge
 * above it read "1 running · 0 live campaigns · AED 0" — three facts on one
 * line, the first contradicting the other two.
 *
 * A panel that shows intent as achievement cannot be trusted about achievement,
 * so the entries that ARE real stop being read. That is the whole cost.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import {
  ACTION_KINDS, INTENT_KINDS, isAction, intentIsFresh, pulseState,
  INTENT_FRESH_DAYS, PULSE_STATES,
} from '../lib/freehold/machine-activity'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const NOW = new Date('2026-08-12T09:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

console.log('\n── a plan is not a decision ──')
{
  // THE TWO ROWS FROM THE SCREENSHOT, by kind.
  check('a plan is not an action', !isAction('planned'))
  check('a prepared Google draft is not an action either — nothing on any '
    + 'platform changed', !isAction('google_draft_prepared'))

  check('launching is', isAction('launched'))
  check('moving budget is', isAction('budget_shift'))
  check('pausing a trial is', isAction('trial_paused'))
  check('blocking a lapsed permit is — it stopped real delivery',
    isAction('permit_blocked'))
  check('blocking wasted searches is', isAction('search_harvest'))

  // The two sets must not overlap, or a row would be both a record and a to-do.
  const both = ACTION_KINDS.filter((k) => (INTENT_KINDS as readonly string[]).includes(k))
  check('nothing is both an action and an intention', both.length === 0, both.join(','))
  check('both lists have members', ACTION_KINDS.length > 0 && INTENT_KINDS.length > 0)
}

console.log('\n── an intention goes stale, and repeating it does not help ──')
{
  check('a plan made this morning is still worth showing',
    intentIsFresh(daysAgo(0), NOW))
  check(`…and one from ${INTENT_FRESH_DAYS} days ago is`,
    intentIsFresh(daysAgo(INTENT_FRESH_DAYS), NOW))

  // THE TWO IN THE SCREENSHOT: 5 days and 10 days. Nobody pressed start, and
  // showing it again every morning does not make them likelier to.
  check('the 5-day-old plan is gone', !intentIsFresh(daysAgo(5), NOW))
  check('…and so is the 10-day-old one', !intentIsFresh(daysAgo(10), NOW))

  check('an unparseable date is not treated as fresh', !intentIsFresh('not a date', NOW))
}

console.log('\n── the switch is not the state ──')
{
  // THE BADGE FROM THE SCREENSHOT, exactly.
  const asSeen = pulseState({ total: 1, running: 1, liveCampaigns: 0, committedAed: 0 })
  check('a machine that is on with nothing live and nothing committed is NOT running',
    asSeen === 'onButIdle', asSeen)

  check('one live campaign makes it working',
    pulseState({ total: 1, running: 1, liveCampaigns: 1, committedAed: 0 }) === 'working')
  // Either signal counts: a machine can be mid-launch with budget committed
  // and no campaign live yet.
  check('…and so does committed budget with nothing live yet',
    pulseState({ total: 1, running: 1, liveCampaigns: 0, committedAed: 200 }) === 'working')

  check('the switch off is stopped',
    pulseState({ total: 2, running: 0, liveCampaigns: 0, committedAed: 0 }) === 'stopped')
  // "No machine" and "a stopped machine" are different sentences with
  // different answers — one is "make one", the other is "start it".
  check('no machine at all is its own state, not "stopped"',
    pulseState({ total: 0, running: 0, liveCampaigns: 0, committedAed: 0 }) === 'none')

  const seen = new Set([
    pulseState({ total: 1, running: 1, liveCampaigns: 2, committedAed: 400 }),
    pulseState({ total: 1, running: 1, liveCampaigns: 0, committedAed: 0 }),
    pulseState({ total: 1, running: 0, liveCampaigns: 0, committedAed: 0 }),
    pulseState({ total: 0, running: 0, liveCampaigns: 0, committedAed: 0 }),
  ])
  const missing = PULSE_STATES.filter((s) => !seen.has(s))
  check('every state is reachable — none is dead copy', missing.length === 0, missing.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} machine-activity rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe machine reports what it did, and says plainly when that is nothing.\n')
