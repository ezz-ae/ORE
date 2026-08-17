/**
 * AN ACCEPT BUTTON ON A WRONG CLAIM MOVES REAL MONEY — locked.
 *
 * The product is being turned from one that explains into one that asks:
 * instead of "this placement is draining your budget", it says "Instagram Feed
 * is producing leads at half the cost of Facebook Feed — move the budget?"
 * with Accept, Later and Recheck.
 *
 * That raises the stakes on the arithmetic. A wrong sentence wastes attention.
 * A wrong PROPOSAL spends money, with the reader's consent borrowed on the
 * strength of our numbers. So the evidence bar for offering an Accept is
 * higher than the bar for saying anything at all: the cost ranges must not
 * overlap. "AED 90 vs AED 140" on a handful of leads is not two placements —
 * it is one placement measured twice.
 *
 * Pure — no database, no network. Runs in `pnpm guards`.
 */
import {
  PROPOSAL_RESPONSES, PROPOSAL_STATES, PROPOSAL_KINDS,
  placementProposal, differenceIsReal, deferUntil, wake, canAccept, canRecheck,
  DEFER_MS, type PlacementResult,
} from '../lib/freehold/proposal'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const P = (label: string, spendAed: number, leads: number): PlacementResult => ({ label, spendAed, leads })

console.log('\n── a proposal is only offered when the gap is real ──')
{
  // Wide, unambiguous: 40 leads at ~AED 50 against 10 at ~AED 300. Nobody
  // needs a statistician to see it, and the ranges do not come close.
  const clear = placementProposal('c1', [P('Instagram Feed', 2000, 40), P('Facebook Feed', 3000, 10)], true)
  check('a large, well-evidenced gap becomes a proposal',
    clear?.kind === 'placementShift', JSON.stringify(clear))
  check('…and it offers all three answers', clear ? clear.responses.length === 3 : false,
    clear?.responses.join(','))
  check('…naming the winner, the loser and both costs',
    clear?.vars.best === 'Instagram Feed' && clear?.vars.worst === 'Facebook Feed'
      && Number(clear?.vars.bestCpl) === 50 && Number(clear?.vars.worstCpl) === 300,
    JSON.stringify(clear?.vars))

  // THE ONE THAT MATTERS. Point estimates say 90 vs 140 — a 55% difference, and
  // exactly the shape of claim a dashboard would make confidently. With 6 and 7
  // leads the ranges overlap heavily: this is noise, and asking to move a
  // budget on it is the most expensive kind of confident nonsense.
  const noisy = placementProposal('c2', [P('A', 540, 6), P('B', 980, 7)], true)
  check('a difference that could be noise is NOT offered as a shift',
    noisy?.kind === 'notYet', JSON.stringify(noisy))
  check('…and it is said out loud rather than hidden', noisy !== null)
  check('…with no Accept, because there is nothing to stand behind',
    noisy ? !canAccept(noisy) : false, noisy?.responses.join(','))
  check('…but Recheck is still there', noisy ? canRecheck(noisy) : false)
  check('…and it says why the Accept is missing',
    noisy?.blocked === 'thin_evidence', String(noisy?.blocked))
}

console.log('\n── the attribution floor is not negotiable ──')
{
  // Below the floor the arithmetic can produce any ratio you like. Two leads
  // against five is not a trend, however clean the division looks.
  check('two leads against one is never a real difference',
    !differenceIsReal(P('A', 100, 2), P('B', 400, 1)))
  check('…even when the point estimates are miles apart',
    !differenceIsReal(P('A', 50, 1), P('B', 5000, 1)))
  check('a properly evidenced gap does pass',
    differenceIsReal(P('A', 2000, 40), P('B', 3000, 10)))

  // Symmetry: the floor applies to BOTH sides. A well-measured winner against
  // an unmeasured loser is still one measurement.
  check('a well-measured winner against a barely-measured loser does not pass',
    !differenceIsReal(P('A', 2000, 40), P('B', 900, 3)))
}

console.log('\n── a placement that spent real money and returned nothing ──')
{
  // Its own proposal — no comparison needed. But the floor still applies:
  // zero leads on AED 30 is a normal morning, not a finding.
  const dead = placementProposal('c3', [P('Audience Network', 1200, 0), P('Instagram Feed', 800, 12)], true)
  check('a placement spending with nothing back is proposed for stopping',
    dead?.kind === 'placementShift' || dead?.kind === 'placementStop', JSON.stringify(dead?.kind))

  const tiny = placementProposal('c4', [P('X', 20, 0), P('Y', 15, 0)], true)
  check('…but a few dirhams with no leads yet is not a finding', tiny === null, JSON.stringify(tiny))

  check('one placement alone is never a comparison',
    placementProposal('c5', [P('Only', 5000, 50)], true) === null)
}

console.log('\n── Accept is never shown for something we cannot do ──')
{
  // A button that turns out to be advice spends trust as well as time, and
  // trust is the thing that makes the next proposal work.
  const manual = placementProposal('c6', [P('A', 2000, 40), P('B', 3000, 10)], false)
  check('an unexecutable proposal withholds Accept',
    manual ? !canAccept(manual) : false, manual?.responses.join(','))
  check('…and says so, rather than leaving the reader to wonder',
    manual?.blocked === 'not_executable', String(manual?.blocked))
  check('…while Later and Recheck remain',
    manual ? manual.responses.includes('later') && canRecheck(manual) : false)
}

console.log('\n── Later is a snooze, and never a dismiss ──')
{
  const at = 1_000_000
  check('the deferral is a full day of delivery', deferUntil(at) - at === DEFER_MS)
  check('it stays asleep before its time', wake(at, at + DEFER_MS - 1, true) === 'deferred')

  // IT DOES NOT SIMPLY REAPPEAR. The world moved while it slept, so it is
  // re-measured — and a proposal that comes back after the problem fixed
  // itself is how people learn to ignore the entire queue.
  check('when the time is up and the reason still holds, it returns',
    wake(at, at + DEFER_MS, true) === 'open')
  check('…and when the reason has gone, it withdraws instead',
    wake(at, at + DEFER_MS, false) === 'withdrawn')

  // THERE IS NO DISMISS, deliberately. A finding a person can delete without
  // changing anything is a finding the product stops making.
  check('there is no way to answer that changes nothing',
    !(PROPOSAL_RESPONSES as readonly string[]).includes('dismiss')
      && !(PROPOSAL_RESPONSES as readonly string[]).includes('ignore'),
    PROPOSAL_RESPONSES.join(','))
}

console.log('\n── the vocabulary is walkable and complete ──')
{
  check('the three answers are exactly accept, later, recheck',
    PROPOSAL_RESPONSES.length === 3
      && (PROPOSAL_RESPONSES as readonly string[]).join(',') === 'accept,later,recheck',
    PROPOSAL_RESPONSES.join(','))
  check('every state is distinct', new Set(PROPOSAL_STATES).size === PROPOSAL_STATES.length)
  check('every kind is distinct', new Set(PROPOSAL_KINDS).size === PROPOSAL_KINDS.length)

  // AN ACCEPTED PROPOSAL THAT DID NOT WORK MUST BE SAYABLE. Without `failed`,
  // a change that silently did not apply reads as done, and the reader
  // believes a budget moved that never moved.
  check('there is a state for "we accepted it and it did not work"',
    (PROPOSAL_STATES as readonly string[]).includes('failed'))
  check('…and one for a reason that stopped being true',
    (PROPOSAL_STATES as readonly string[]).includes('withdrawn'))

  // Every kind the builder can emit must be declared, or it reaches a screen
  // as its own key name.
  const emitted = new Set<string>()
  for (const rs of [
    [P('A', 2000, 40), P('B', 3000, 10)],
    [P('A', 540, 6), P('B', 980, 7)],
    [P('Audience Network', 1200, 0), P('IG', 800, 12)],
  ]) {
    const p = placementProposal('s', rs, true)
    if (p) emitted.add(p.kind)
  }
  const stray = [...emitted].filter((k) => !(PROPOSAL_KINDS as readonly string[]).includes(k))
  check('every kind the builder emits is declared', stray.length === 0, stray.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} proposal rule(s) broken.`)
  console.error('Asking "shall I move your budget?" about noise is worse than saying nothing.')
  process.exit(1)
}
console.log('\nEvery proposal offered is one the evidence can stand behind.\n')
