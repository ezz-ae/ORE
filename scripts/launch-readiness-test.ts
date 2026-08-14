/**
 * THE LAUNCHER SAYS NO BEFORE THE WORK, NOT AFTER — locked.
 *
 * Every check that can refuse a launch fires at the END of the sequence,
 * inside the launch route, when the person has already picked a project,
 * written an ad, and set a budget. A missing permit and an unpublished landing
 * page are both knowable the moment the project is chosen.
 *
 * A wizard that fails on the last click teaches people to fear that button,
 * and the way people avoid a feared button is to stop using the tool.
 *
 * So these assertions are about the two ways a readiness strip stops being
 * read: crying wolf on an empty form, and refusing something that is a
 * legitimate choice rather than a fault.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import {
  readinessOf, canLaunch, readinessHeadline, readinessCounts,
  READINESS_CHECKS, READINESS_STATES, LEARNING_DAILY_AED, META_MIN_DAILY_AED,
  type LaunchDraft,
} from '../lib/freehold/launch-readiness'
import { PREFLIGHT_VERDICTS, blocksLaunch } from '../lib/freehold/landing-preflight'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const NOW = new Date('2026-08-12T09:00:00Z')

/** A draft with everything right, so each test changes exactly one thing. */
const draft = (o: Partial<LaunchDraft> = {}): LaunchDraft => ({
  // 'can' rather than left out: the ads permission on the Page is a fact Meta
  // reports, and a draft that has not been told it is not a complete draft.
  metaConnected: true, pageId: 'p1', pageAds: 'can',
  projectSlug: 'azizi-venice', permitExpiry: '2027-01-31',
  landingVerdict: 'ok', hasCreative: true, hasCopy: true,
  dailyBudgetAed: 300, hasAudience: true, ...o,
})
const rows = (o: Partial<LaunchDraft> = {}) => readinessOf(draft(o), NOW)
const state = (o: Partial<LaunchDraft>, id: string) => rows(o).find((r) => r.id === id)!.state

console.log('\n── an empty form is not a wall of red ──')
{
  // A launcher that shows five failures before you have typed anything is a
  // launcher nobody reads, and then it protects nothing.
  const empty = readinessOf({
    metaConnected: true, pageId: 'p1', pageAds: 'can', projectSlug: null,
    landingVerdict: null, hasCreative: false, hasCopy: false,
    dailyBudgetAed: null, hasAudience: false,
  }, NOW)
  check('nothing chosen yet blocks nothing', canLaunch(empty), JSON.stringify(readinessCounts(empty)))
  check('…and the unchosen rows read PENDING, not failed',
    empty.filter((r) => ['project', 'permit', 'destination', 'creative', 'budget'].includes(r.id))
      .every((r) => r.state === 'pending'),
    empty.map((r) => `${r.id}:${r.state}`).join(' '))
  check('…and the headline points at the first thing to DO',
    readinessHeadline(empty)?.id === 'project', String(readinessHeadline(empty)?.id))

  const complete = rows()
  check('a complete draft is entirely green', complete.every((r) => r.state === 'ok'),
    complete.filter((r) => r.state !== 'ok').map((r) => `${r.id}:${r.state}`).join(' '))
  check('…and has no headline left to raise', readinessHeadline(complete) === null)
}

console.log('\n── the account comes first, because nothing else can fix it ──')
{
  const off = rows({ metaConnected: false, pageId: null })
  check('no Meta connection blocks', off.find((r) => r.id === 'account')!.state === 'blocked')
  check('…and the Page waits rather than piling on a second failure',
    off.find((r) => r.id === 'page')!.state === 'pending')
  check('…and the headline is the connection, not the Page',
    readinessHeadline(off)?.id === 'account', String(readinessHeadline(off)?.id))
  check('…and it names where to go', !!off.find((r) => r.id === 'account')!.fix)

  check('connected with no Page blocks — no Page, no ad, at any budget',
    state({ pageId: null }, 'page') === 'blocked')
}

console.log('\n── the permit is a legal gate, and absence is not evidence ──')
{
  check('a live permit passes', state({}, 'permit') === 'ok')
  check('one that expired yesterday blocks',
    state({ permitExpiry: '2026-08-11' }, 'permit') === 'blocked')

  // Valid THROUGH the date in Dubai time. Treating it as dead at midnight UTC
  // would stop a legal campaign four hours early.
  check('one expiring today is still valid', state({ permitExpiry: '2026-08-12' }, 'permit') === 'ok')

  // MISSING AND EXPIRED ARE DIFFERENT. Refusing over a blank field would stop
  // launches on a data gap — the launch route takes the same position.
  check('a blank expiry warns, never blocks',
    state({ permitExpiry: null }, 'permit') === 'warn')
  check('…and a project not yet looked up is simply pending',
    state({ permitExpiry: undefined }, 'permit') === 'pending')
  check('no project means no permit question yet',
    state({ projectSlug: null, permitExpiry: undefined }, 'permit') === 'pending')
}

console.log('\n── the destination agrees with the pre-flight, exactly ──')
{
  // TWO MODULES, ONE DEFINITION OF A REFUSAL. If they drift, the strip would
  // show green on something the launch route then refuses — which is the exact
  // failure this whole panel exists to end, reintroduced one layer up.
  for (const v of PREFLIGHT_VERDICTS) {
    const s = state({ landingVerdict: v }, 'destination')
    const shouldBlock = blocksLaunch(v)
    check(`"${v}" ${shouldBlock ? 'blocks' : 'does not block'} in both modules`,
      (s === 'blocked') === shouldBlock, `strip says ${s}`)
  }

  // An instant form has no page to 404. It is the safest destination there is,
  // which is why the machine prefers it.
  check('an instant form needs no landing check at all',
    state({ usesInstantForm: true, landingVerdict: null }, 'destination') === 'ok')
}

console.log('\n── what is a fault and what is merely a choice ──')
{
  // BLOCKED IS FOR THINGS THAT CANNOT WORK. Everything else is somebody's
  // decision, and a tool that refuses a legitimate strategy gets routed around.
  check(`under Meta's own floor of AED ${META_MIN_DAILY_AED} blocks — Meta refuses it too`,
    state({ dailyBudgetAed: META_MIN_DAILY_AED - 1 }, 'budget') === 'blocked')
  check('a small but legal budget warns rather than blocks',
    state({ dailyBudgetAed: META_MIN_DAILY_AED }, 'budget') === 'warn')
  check(`…up to the learning floor of AED ${LEARNING_DAILY_AED}`,
    state({ dailyBudgetAed: LEARNING_DAILY_AED - 1 }, 'budget') === 'warn'
    && state({ dailyBudgetAed: LEARNING_DAILY_AED }, 'budget') === 'ok')

  // A broad audience is a real buy. This tool says it is happening; it does
  // not get a vote on whether it should.
  check('no audience warns, never blocks', state({ hasAudience: false }, 'audience') === 'warn')
  check('…and a launch with no audience still goes', canLaunch(rows({ hasAudience: false })))

  // Half an ad is a fault; no ad yet is not.
  check('a picture with no words warns', state({ hasCopy: false }, 'creative') === 'warn')
  check('…and words with no picture warns', state({ hasCreative: false }, 'creative') === 'warn')
  check('…while neither yet is pending',
    state({ hasCreative: false, hasCopy: false }, 'creative') === 'pending')
}

console.log('\n── the headline is what to do next ──')
{
  // A blocker outranks everything, then anything pending, then warnings.
  // Pending before warn on purpose: "you have not chosen a project" is more
  // useful than "your budget is small" to somebody who has not chosen one.
  const both = rows({ dailyBudgetAed: 50, projectSlug: null, permitExpiry: undefined })
  check('pending outranks a warning', readinessHeadline(both)?.id === 'project',
    String(readinessHeadline(both)?.id))

  const blocked = rows({ pageId: null, dailyBudgetAed: 50, projectSlug: null, permitExpiry: undefined })
  check('…and a blocker outranks both', readinessHeadline(blocked)?.id === 'page',
    String(readinessHeadline(blocked)?.id))

  const counts = readinessCounts(rows({ dailyBudgetAed: 50, hasAudience: false }))
  check('the counts add up to every check', Object.values(counts).reduce((a, b) => a + b, 0) === READINESS_CHECKS.length)
  check('…and name the two warnings', counts.warn === 2, JSON.stringify(counts))
}

console.log('\n── every check and every state is reachable ──')
{
  const seenIds = new Set(rows().map((r) => r.id))
  const missingIds = READINESS_CHECKS.filter((c) => !seenIds.has(c))
  check('every check is always present, so the strip never loses a row',
    missingIds.length === 0, missingIds.join(','))

  const seen = new Set<string>()
  for (const d of [
    {}, { metaConnected: false, pageId: null }, { permitExpiry: '2020-01-01' },
    { permitExpiry: null }, { dailyBudgetAed: 50 }, { projectSlug: null, permitExpiry: undefined },
  ]) for (const r of rows(d)) seen.add(r.state)
  const missing = READINESS_STATES.filter((s) => !seen.has(s))
  check('every state can happen — none is dead copy', missing.length === 0, missing.join(','))

  // A blocker with no route is a dead end somebody leaves the screen to solve,
  // and they do not come back.
  const noFix = rows({ metaConnected: false, pageId: null, permitExpiry: '2020-01-01', landingVerdict: 'notPublished' })
    .filter((r) => r.state === 'blocked' && !r.fix && r.id !== 'budget')
  check('every blocker a person can act on names where to act',
    noFix.length === 0, noFix.map((r) => r.id).join(','))
}

console.log('\n── the budget floor is this account\'s, not a constant ──')
{
  // THE WARNING WAS SILENT WHERE IT MATTERED. It fired below a fixed AED 150
  // while the real floor — fifty leads a week at this account's own lead price
  // — is several times that, so the entire range where a budget is too thin to
  // ever learn anything passed without a word.
  const atFixed = state({ dailyBudgetAed: 300 }, 'budget')
  check('AED 300/day looks fine against the old constant', atFixed === 'ok', String(atFixed))

  const real = state({ dailyBudgetAed: 300, learningFloorAed: 800 }, 'budget')
  check('…and is warned against the account\'s real floor', real === 'warn', String(real))
  check('the sentence carries the real number, not the constant',
    rows({ dailyBudgetAed: 300, learningFloorAed: 800 })
      .find((r) => r.id === 'budget')?.vars.learning === 800)

  // An account that has never bought a lead has no price to compute one from,
  // so the stated fallback stands rather than an invented figure.
  check('with no measured price the stated fallback stands',
    rows({ dailyBudgetAed: 300 }).find((r) => r.id === 'budget')?.vars.learning === LEARNING_DAILY_AED)
  check('a nonsense floor falls back too',
    rows({ dailyBudgetAed: 300, learningFloorAed: 0 }).find((r) => r.id === 'budget')?.vars.learning
      === LEARNING_DAILY_AED)

  // WARNED, NEVER BLOCKED. A small test budget is a legitimate thing to want,
  // and refusing it would be this tool deciding how much of somebody's money
  // is enough.
  check('a thin budget is never a blocker',
    state({ dailyBudgetAed: 300, learningFloorAed: 5000 }, 'budget') === 'warn')
  check('…and Meta\'s own hard minimum still is',
    state({ dailyBudgetAed: 10, learningFloorAed: 5000 }, 'budget') === 'blocked')
  check('a budget above the real floor is simply fine',
    state({ dailyBudgetAed: 900, learningFloorAed: 800 }, 'budget') === 'ok')
}

if (failures > 0) {
  console.error(`\n${failures} launch-readiness rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe launcher says no before the work, not after it.\n')
