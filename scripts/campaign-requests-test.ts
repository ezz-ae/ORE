/**
 * A broker's ask walks one way — locked.
 *
 * The INBOUND deal: a broker requests, management decides, a launch is the
 * receipt. The money deliberately moves NOWHERE at request time — the charge
 * rides the launch through the same credits rail every launch uses — so the
 * only thing this suite must hold is the status walk, because the walk is
 * what prevents the double-charge: a launched or rejected request can never
 * be launched again.
 *
 * Pure — no model, no database, no network. Runs in `pnpm guards`.
 */
import { canTransition, REQUEST_STATUSES, type RequestStatus } from '../lib/freehold/campaign-requests'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

console.log('\n── the walk is one-way ──')
{
  check('a request can be approved', canTransition('requested', 'approved'))
  check('a request can be rejected before approval', canTransition('requested', 'rejected'))
  check('an approved request can launch', canTransition('approved', 'launched'))
  check('an approved request can still be rejected', canTransition('approved', 'rejected'))

  check('a request cannot launch WITHOUT approval — the manager is the gate',
    !canTransition('requested', 'launched'))

  // The double-charge guards: terminal means terminal.
  for (const from of ['launched', 'rejected'] as RequestStatus[]) {
    for (const to of REQUEST_STATUSES) {
      check(`${from} → ${to} is refused`, !canTransition(from, to), `${from}→${to}`)
    }
  }
  check('nothing returns to requested',
    REQUEST_STATUSES.every((from) => !canTransition(from, 'requested')))
  check('every status the code produces is enumerable', REQUEST_STATUSES.length === 4)
}

if (failures > 0) {
  console.error(`\n${failures} campaign-request rule(s) broken.`)
  process.exit(1)
}
console.log('\nA broker asks, a manager decides, a launch is the receipt.\n')
