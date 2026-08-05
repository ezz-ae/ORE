/**
 * The authority rules, locked.
 *
 * These are the rules the owner stated in words, and they are the ones most
 * likely to be "simplified" by a future change that looks harmless:
 *
 *   "team leader can see all the campaigns and work with them on it but
 *    doesn't own campaigns"
 *   "always the only one can even delete them and the lead — the system is the
 *    one who paying, anyone else is account with limitations"
 *   "the system must be fair by default — any authorised actions by leader must
 *    meet events to get activated — they can't reassign a new lead within a
 *    time frame, they can't reassign a lead has any type of follow up"
 *
 * Every assertion below is one of those sentences. If a change breaks one, CI
 * says which sentence broke rather than which line moved.
 *
 * Pure — no database, no network. Runs in `pnpm guards`, so it costs nothing
 * and can never be skipped. The SQL half lives in scripts/db-smoke.ts, which
 * needs a real Postgres.
 */
import {
  decideReassign, decideDelete, decideCampaignEdit, decideMemberAdmin,
  hasFollowUp, statusForDenial, FAIRNESS, type ReassignFacts,
} from '../lib/freehold/authority'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const HOUR = 3_600_000
const NOW = 1_800_000_000_000 // fixed clock — the decision must be deterministic

/** A lead held by u2, assigned `hoursAgo`, with the given work history. */
function lead(hoursAgo: number, work: Partial<ReassignFacts> = {}): ReassignFacts {
  return {
    assignedTo: 'u2',
    assignedAt: new Date(NOW - hoursAgo * HOUR).toISOString(),
    contactCount: 0,
    lastContactAt: null,
    status: 'new',
    inActorsTeam: true,
    now: NOW,
    ...work,
  }
}

console.log('\n── "they cant reassign a new lead within a time frame" ──')
{
  const d = decideReassign('team_leader', lead(1))
  check('a leader cannot take a lead assigned an hour ago', !d.allowed && d.reason === 'grace_period', d.reason)
  check('the denial says when it lifts', !!d.unlocksAt, String(d.unlocksAt))
  const stillInside = decideReassign('team_leader', lead(FAIRNESS.graceMs / HOUR - 0.5))
  check('still protected just inside the window', !stillInside.allowed, stillInside.reason)
}

console.log('\n── "they cant reassign a lead has anytype of follow up" ──')
{
  check('a logged call counts as follow-up', hasFollowUp({ contactCount: 1, lastContactAt: null, status: 'new' }))
  check('a contact timestamp counts', hasFollowUp({ contactCount: 0, lastContactAt: new Date(NOW).toISOString(), status: 'new' }))
  check('a status past new counts', hasFollowUp({ contactCount: 0, lastContactAt: null, status: 'contacted' }))
  check('an untouched new lead is not follow-up', !hasFollowUp({ contactCount: 0, lastContactAt: null, status: 'new' }))
  check('empty status is not follow-up', !hasFollowUp({ contactCount: 0, lastContactAt: null, status: null }))

  // The rule outranks time: a worked lead stays put no matter how old.
  const d = decideReassign('team_leader', lead(1000, { contactCount: 4, status: 'viewing' }))
  check('a worked lead cannot be taken even after weeks', !d.allowed && d.reason === 'has_follow_up', d.reason)
}

console.log('\n── "protected" must not become "parked" ──')
{
  const d = decideReassign('team_leader', lead(FAIRNESS.graceMs / HOUR + 1))
  check('an untouched lead past grace CAN be moved', d.allowed && d.reason === 'leader_unlocked', d.reason)
  // Guards the removal of the dead `neglectMs`: grace is the ONLY time gate,
  // so nothing may re-protect a lead once the window has passed.
  const week = decideReassign('team_leader', lead(24 * 7))
  check('and stays movable a week later', week.allowed && week.reason === 'leader_unlocked', week.reason)
  const unknown = decideReassign('team_leader', { ...lead(1), assignedAt: null })
  check('unknown assignment time counts as long ago, not as protection', unknown.allowed, unknown.reason)
}

console.log('\n── a leader leads their own team only ──')
{
  const outside = decideReassign('team_leader', lead(1000, { inActorsTeam: false }))
  check('a leader cannot touch another team\'s lead', !outside.allowed && outside.reason === 'not_your_team', outside.reason)
  check('management is not fenced by team', decideReassign('admin', lead(1000, { inActorsTeam: false })).allowed)
  check('a broker cannot reassign at all', !decideReassign('broker', lead(1000)).allowed)
}

console.log('\n── unassigned leads harm nobody ──')
{
  const free = { ...lead(0), assignedTo: null }
  check('a leader may take an unassigned lead', decideReassign('team_leader', free).allowed)
  check('a broker still may not', !decideReassign('broker', free).allowed)
}

console.log('\n── "always the only one can even delete them and the lead" ──')
{
  check('the owner deletes', decideDelete('ceo').allowed)
  for (const r of ['admin', 'director', 'sales_manager', 'team_leader', 'marketing', 'broker'] as const) {
    check(`${r} cannot delete`, !decideDelete(r).allowed, decideDelete(r).reason)
  }
}

console.log('\n── "can work with campaigns but doesnt own them" ──')
{
  check('a leader may edit a campaign they do not own', decideCampaignEdit('team_leader').allowed)
  check('marketing may edit', decideCampaignEdit('marketing').allowed)
  check('a broker may not edit', !decideCampaignEdit('broker').allowed)
  check('but a leader still cannot DELETE one', !decideDelete('team_leader').allowed)
}

console.log('\n── "anyone else is account with limitations" ──')
{
  check('a leader cannot change roles or suspend', !decideMemberAdmin('team_leader').allowed)
  check('management can', decideMemberAdmin('admin').allowed)
}

console.log('\n── denials carry the right status ──')
{
  check('a role denial is 403', statusForDenial({ allowed: false, reason: 'insufficient_role' }) === 403)
  check('a "not yet" denial is 409, not 403', statusForDenial({ allowed: false, reason: 'grace_period' }) === 409)
  check('a worked-lead denial is 409', statusForDenial({ allowed: false, reason: 'has_follow_up' }) === 409)
}

check('there is exactly one fairness number', Object.keys(FAIRNESS).length === 1, Object.keys(FAIRNESS).join(','))
console.log(`\nfairness in force: grace ${FAIRNESS.graceMs / HOUR}h (the only time gate)`)
if (failures > 0) {
  console.error(`\n${failures} authority rule(s) broken.`)
  process.exit(1)
}
console.log('All authority rules hold.\n')
