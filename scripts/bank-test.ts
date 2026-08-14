/**
 * MONEY IS PUSHED, NEVER PULLED — locked.
 *
 * wallet.ts already keeps the books: double entry, one place coin is created,
 * one place it is destroyed, and a conservation invariant that is checked. What
 * it does not say is WHO may make a movement, and that is the half a finance
 * system is judged on.
 *
 * Four rules, and this suite is here so none of them can be softened by a
 * future screen that finds them inconvenient:
 *
 *   1. Nobody takes from anybody. A transfer's source is the actor's own
 *      wallet, structurally — there is no branch that accepts somebody else's.
 *   2. A team leader funds their own team and no one else's.
 *   3. An admin may destroy only what they themselves deposited.
 *   4. Every dirham that leaves carries a receipt, and a spend that can prove
 *      nothing is refused.
 *
 * Pure — no network, no clock. Runs in `pnpm guards`.
 */
import {
  BANK_ACTIONS, SPEND_KINDS, BANK_REFUSALS, USE_STATES, SELF_EVIDENCING,
  IDLE_AFTER_DAYS,
  isAdmin, hasProof, authorise, withdrawalReference, readUse, bankImbalance,
  type Actor, type MoveRequest, type SpendProof, type AccountUse,
} from '../lib/freehold/bank'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const admin: Actor = { userId: 'u-admin', role: 'admin', walletId: 'w-admin', teamMemberIds: [] }
const leader: Actor = { userId: 'u-lead', role: 'team_leader', walletId: 'w-lead', teamMemberIds: ['u-b1', 'u-b2'] }
const broker: Actor = { userId: 'u-b1', role: 'broker', walletId: 'w-b1', teamMemberIds: [] }

const req = (o: Partial<MoveRequest> & { action: MoveRequest['action'] }): MoveRequest => ({
  amount: 100, fromWalletId: null, toWalletId: 'w-b1', ...o,
})
const why = (a: Actor, r: MoveRequest) => {
  const v = authorise(a, r)
  return v.ok ? 'ok' : v.refusal
}

console.log('\n── new money enters in one place ──')
{
  check('an admin may deposit', why(admin, req({ action: 'deposit', fromWalletId: 'treasury' })) === 'ok')
  check('a team leader may not', why(leader, req({ action: 'deposit', fromWalletId: 'treasury' })) === 'notAdmin')
  check('a broker certainly may not', why(broker, req({ action: 'deposit', fromWalletId: 'treasury' })) === 'notAdmin')
  check('…and a deposit needs somewhere to land',
    why(admin, req({ action: 'deposit', toWalletId: null })) === 'noSuchWallet')

  check('allocating is an admin\'s move too',
    why(admin, req({ action: 'allocate' })) === 'ok' && why(leader, req({ action: 'allocate' })) === 'notAdmin')
}

console.log('\n── NOBODY TAKES FROM ANYBODY ──')
{
  // The rule the whole design rests on. A transfer's source must be the
  // actor's own wallet — there is no branch that accepts anybody else's, which
  // is what makes this structural rather than a rule to remember.
  check('a leader moving their OWN money to their team is fine',
    why(leader, req({ action: 'transfer', fromWalletId: 'w-lead', toWalletId: 'w-b1', toUserId: 'u-b1' })) === 'ok')

  check('a leader reaching into a member\'s wallet is refused',
    why(leader, req({ action: 'transfer', fromWalletId: 'w-b1', toWalletId: 'w-lead', toUserId: 'u-lead' }))
      === 'notYourMoney')
  check('a broker pulling from the leader is refused',
    why(broker, req({ action: 'transfer', fromWalletId: 'w-lead', toWalletId: 'w-b1', toUserId: 'u-b1' }))
      === 'notYourMoney')
  // EVEN AN ADMIN CANNOT PULL. They can issue and allocate, which is a
  // different movement with its own name; taking from a wallet is not on the
  // list at all.
  check('even an ADMIN cannot transfer out of somebody else\'s wallet',
    why(admin, req({ action: 'transfer', fromWalletId: 'w-b1', toWalletId: 'w-admin', toUserId: 'u-admin' }))
      === 'notYourMoney')
  check('somebody with no account cannot transfer',
    why({ ...broker, walletId: null }, req({ action: 'transfer', fromWalletId: 'w-b1' })) === 'notYourMoney')
}

console.log('\n── a leader funds their own team and no one else\'s ──')
{
  const out = req({ action: 'transfer', fromWalletId: 'w-lead', toWalletId: 'w-x', toUserId: 'u-stranger' })
  check('somebody outside the team is refused', why(leader, out) === 'notYourTeam')
  check('the second member of the team is fine',
    why(leader, req({ action: 'transfer', fromWalletId: 'w-lead', toWalletId: 'w-b2', toUserId: 'u-b2' })) === 'ok')
  // An admin's transfer is not bounded by a team, because they lead everybody.
  check('an admin\'s own money may go to anyone',
    why(admin, req({ action: 'transfer', fromWalletId: 'w-admin', toWalletId: 'w-x', toUserId: 'u-stranger' })) === 'ok')
  check('a broker with no team can fund nobody',
    why(broker, req({ action: 'transfer', fromWalletId: 'w-b1', toWalletId: 'w-b2', toUserId: 'u-b2' }))
      === 'notYourTeam')
}

console.log('\n── you may only destroy what you put in ──')
{
  // Without this bound one admin could annihilate another's float, and a
  // ledger where anybody can destroy anybody's money is not a bank whatever
  // the double entry says.
  check('burning inside your own deposits is fine',
    why(admin, req({ action: 'burn', amount: 3000, toWalletId: null, burnableByActor: 5000 })) === 'ok')
  check('burning more than you deposited is refused',
    why(admin, req({ action: 'burn', amount: 6000, toWalletId: null, burnableByActor: 5000 }))
      === 'moreThanYouDeposited')
  check('having deposited nothing, you may burn nothing',
    why(admin, req({ action: 'burn', amount: 1, toWalletId: null, burnableByActor: 0 }))
      === 'moreThanYouDeposited')
  check('…and it is exactly the boundary, not one either side',
    why(admin, req({ action: 'burn', amount: 5000, toWalletId: null, burnableByActor: 5000 })) === 'ok')
  check('a team leader cannot burn at all',
    why(leader, req({ action: 'burn', amount: 1, toWalletId: null, burnableByActor: 99_999 })) === 'notAdmin')
}

console.log('\n── every dirham that leaves carries its receipt ──')
{
  // ADS PAY THEMSELVES. The ad account holds the invoice and the campaign id
  // ties the spend to what it bought — a stronger record than a number
  // somebody types, so no cheque is asked for.
  const adSpend: SpendProof = { kind: 'ads', campaignId: '120xxx' }
  check('an ads spend is proved by its campaign', hasProof(adSpend))
  check('…or by the ad account it came out of', hasProof({ kind: 'ads', adAccountId: 'act_1' }))
  check('an ads spend with neither is not proved', !hasProof({ kind: 'ads' }))

  // EVERYTHING ELSE LEAVES THROUGH A BANK, AND A BANK GIVES YOU A REFERENCE.
  check('a commission needs a cheque or transaction number',
    hasProof({ kind: 'commission', reference: 'CHQ-4471' }))
  check('…and is refused without one', !hasProof({ kind: 'commission' }))
  check('a campaign id does not prove a commission',
    !hasProof({ kind: 'commission', campaignId: '120xxx' }))

  // AN IMAGE IS NEVER ENOUGH ON ITS OWN. A photograph with no number attached
  // cannot be reconciled against a statement.
  check('a photograph alone proves nothing',
    !hasProof({ kind: 'vendor', imageUrl: 'https://x/cheque.jpg' }))
  // …and is never REQUIRED either. A system that refuses a real payment
  // because nobody could photograph the cheque teaches people to keep the
  // books somewhere else.
  check('…and is never required when there is a reference',
    hasProof({ kind: 'vendor', reference: 'TXN-9' }))
  check('whitespace is not a reference', !hasProof({ kind: 'other', reference: '   ' }))

  check('a spend with no receipt at all is refused',
    why(broker, req({ action: 'spend', fromWalletId: 'w-b1', spend: { kind: 'other' } })) === 'noProof')
  check('…and one with a receipt goes through',
    why(broker, req({ action: 'spend', fromWalletId: 'w-b1', spend: { kind: 'other', reference: 'TXN-1' } }))
      === 'ok')
  check('a broker cannot spend from a wallet that is not theirs',
    why(broker, req({ action: 'spend', fromWalletId: 'w-lead', spend: adSpend })) === 'notYourMoney')
  check('…but an admin may spend a company wallet',
    why(admin, req({ action: 'spend', fromWalletId: 'w-ops', spend: adSpend })) === 'ok')

  check('only ads prove themselves', SELF_EVIDENCING.length === 1 && SELF_EVIDENCING[0] === 'ads')
  check('an ads withdrawal is filed under its campaign',
    withdrawalReference(adSpend) === '120xxx', withdrawalReference(adSpend))
  check('…and everything else under its reference',
    withdrawalReference({ kind: 'commission', reference: ' CHQ-4471 ' }) === 'CHQ-4471')
}

console.log('\n── a malformed movement is refused before anything else ──')
{
  // Being told "you are not an admin" about a request that was never valid is
  // a confusing thing to read.
  for (const bad of [0, -5, 1.5, NaN, Infinity]) {
    check(`an amount of ${bad} is refused as an amount`,
      why(admin, req({ action: 'deposit', amount: bad as number })) === 'badAmount')
  }
  check('…even for an action the actor could not perform anyway',
    why(broker, req({ action: 'burn', amount: -1 })) === 'badAmount')
}

console.log('\n── who used it, and who did not ──')
{
  const use = (o: Partial<Omit<AccountUse, 'state'>>) => readUse({
    walletId: 'w', userId: 'u', label: 'x',
    fundedAed: 1000, spentAed: 400, balanceAed: 600, daysSinceSpend: 2, ...o,
  })

  check('money going out is spending', use({}) === 'spending')
  // IDLE MONEY IS THE FINDING. Overspending announces itself; money allocated
  // and never touched is invisible until somebody asks why the pipeline is thin.
  check('a fortnight untouched while holding money is idle',
    use({ daysSinceSpend: IDLE_AFTER_DAYS }) === 'idle')
  check('never spent at all is idle too', use({ daysSinceSpend: null }) === 'idle')
  check('…but not before the fortnight is up', use({ daysSinceSpend: IDLE_AFTER_DAYS - 1 }) === 'spending')

  // EMPTY AND IDLE ARE DIFFERENT. Telling somebody they are sitting on money
  // when they have none is how a report loses its reader.
  check('an account with nothing in it is empty, not idle',
    use({ fundedAed: 0, spentAed: 0, balanceAed: 0, daysSinceSpend: null }) === 'empty')
  check('one that spent everything it was given is spending, not idle',
    use({ balanceAed: 0, daysSinceSpend: null }) === 'spending')
  check('a negative balance is overdrawn, whatever else is true',
    use({ balanceAed: -5, daysSinceSpend: null }) === 'overdrawn')
}

console.log('\n── the books add up, and say how far out they are ──')
{
  const balanced = { depositedAed: 10_000, burnedAed: 1_000, withdrawnAed: 4_000, heldAed: 5_000 }
  check('a balanced bank reports zero', bankImbalance(balanced) === 0, String(bankImbalance(balanced)))
  // A NUMBER, NOT A BOOLEAN. "The books are wrong" is not actionable; "the
  // books are AED 40 out" is.
  check('money that appeared is reported as an amount',
    bankImbalance({ ...balanced, heldAed: 4_960 }) === 40,
    String(bankImbalance({ ...balanced, heldAed: 4_960 })))
  check('…and money that vanished is reported with its sign',
    bankImbalance({ ...balanced, heldAed: 5_040 }) === -40)
  check('an empty bank is balanced',
    bankImbalance({ depositedAed: 0, burnedAed: 0, withdrawnAed: 0, heldAed: 0 }) === 0)
}

console.log('\n── every list is walkable and every member reachable ──')
{
  check('every action is authorised by name',
    BANK_ACTIONS.every((a) => {
      const v = authorise(admin, req({ action: a, fromWalletId: 'w-admin', burnableByActor: 1e9,
        spend: { kind: 'ads', campaignId: 'c' } }))
      return typeof v.ok === 'boolean'
    }), BANK_ACTIONS.join(','))
  check('every spend kind has a proof rule',
    SPEND_KINDS.every((k) => typeof hasProof({ kind: k, reference: 'r' }) === 'boolean'))
  check('every use state is reachable', USE_STATES.length === 4)
  check('isAdmin agrees with the role list',
    isAdmin('admin') && isAdmin('ceo') && !isAdmin('team_leader') && !isAdmin('broker'))

  const seen = new Set<string>()
  for (const [a, r] of [
    [leader, req({ action: 'deposit' })],
    [leader, req({ action: 'transfer', fromWalletId: 'w-b1' })],
    [leader, req({ action: 'transfer', fromWalletId: 'w-lead', toUserId: 'u-x' })],
    [admin, req({ action: 'burn', amount: 9, burnableByActor: 1 })],
    [broker, req({ action: 'spend', fromWalletId: 'w-b1', spend: { kind: 'other' } })],
    [admin, req({ action: 'deposit', amount: -1 })],
    [admin, req({ action: 'deposit', toWalletId: null })],
  ] as Array<[Actor, MoveRequest]>) {
    const v = authorise(a, r)
    if (!v.ok) seen.add(v.refusal)
  }
  const missing = BANK_REFUSALS.filter((r) => !seen.has(r))
  check('every refusal can happen — none is dead copy', missing.length === 0, missing.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} bank rule(s) broken.`)
  process.exit(1)
}
console.log('\nMoney is pushed, never pulled, and nothing leaves without a receipt.\n')
