/**
 * How a destination resolves at launch, locked.
 *
 * Three behaviours have to hold at once, and they pull against each other:
 *
 *  1. Plans written before destination existed must launch EXACTLY as they did
 *     before — this ran live campaigns, and a silent change of where ads send
 *     people is the most expensive kind of regression.
 *  2. A plan that chose a destination must get the one it chose, or the pair
 *     is not a comparison.
 *  3. A trial asking for a form when no form exists must degrade to the
 *     landing page rather than fail — but that degradation collapses half of a
 *     pair into a duplicate of the other half, so it can never be silent.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import type { AdDestination } from '../lib/meta/types'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** The engine's resolver, exactly as it is written there. */
const resolveDestination = (
  planned: AdDestination | undefined,
  leadFormId: string | undefined | null,
): AdDestination => {
  if (!planned) return leadFormId ? 'form' : 'landing'
  if (planned === 'form' && !leadFormId) return 'landing'
  return planned
}

console.log('\n── old plans launch exactly as they did before ──')
{
  check('no choice + a lead form still means form',
    resolveDestination(undefined, 'form_123') === 'form')
  check('no choice + no lead form still means landing',
    resolveDestination(undefined, null) === 'landing')
  check('an empty form id counts as no form',
    resolveDestination(undefined, '') === 'landing')
}

console.log('\n── a chosen destination is honoured ──')
{
  check('landing is honoured even when a form exists — this is the whole pair',
    resolveDestination('landing', 'form_123') === 'landing')
  check('form is honoured when a form exists',
    resolveDestination('form', 'form_123') === 'form')
  check('whatsapp is honoured', resolveDestination('whatsapp', 'form_123') === 'whatsapp')
  check('phone is honoured', resolveDestination('phone', null) === 'phone')
}

console.log('\n── a form asked for with no form degrades, never fails ──')
{
  check('form without a form becomes landing',
    resolveDestination('form', null) === 'landing')
  check('…and the pair has therefore collapsed into two identical arms',
    resolveDestination('form', null) === resolveDestination('landing', null),
    `${resolveDestination('form', null)} vs ${resolveDestination('landing', null)}`)
  // That collapse is exactly why the engine logs it. A silent duplicate is two
  // ad sets bidding against each other and answering nothing.
  check('the degradation is detectable by the caller',
    resolveDestination('form', null) !== 'form')
}

console.log('\n── the pair is a controlled comparison ──')
{
  // With a form connected, A and B genuinely differ — one variable, one gap.
  const a = resolveDestination('landing', 'form_123')
  const b = resolveDestination('form', 'form_123')
  check('A and B differ when a form exists', a !== b, `${a} vs ${b}`)
  check('A is the landing page — the destination that always exists', a === 'landing')
  check('B is the instant form', b === 'form')
}

if (failures > 0) {
  console.error(`\n${failures} destination-plan rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll destination-plan rules hold.\n')
