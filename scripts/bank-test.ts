/**
 * MONEY IS PUSHED, NEVER PULLED — locked.
 *
 * wallet.ts already keeps the books: double entry, one place coin is created,
 * one place it is destroyed, and a conservation invariant that is checked. What
 * it does not say is WHO may make a movement, and that is the half a finance
 * system is judged on.
 *
 * Six rules, and this suite exists so none of them can be softened by a future
 * screen that finds them inconvenient:
 *
 *   1. Nobody takes from anybody. A send's source is the actor's own wallet,
 *      structurally — there is no branch that accepts somebody else's.
 *   2. Any wallet may send to any wallet. There is no hierarchy in a payment.
 *   3. A deposit is real money and carries a transaction number; a mint has no
 *      cash in front of it and is admins only. The two are never summed.
 *   4. Cash in the bank belongs to nobody and any admin may burn it. Once moved
 *      it is a cheque, and only the admin who moved it may burn it — however
 *      far it has travelled since.
 *   5. A claimed deposit is not money until somebody has read the statement.
 *   6. Every dirham that leaves carries a receipt, and a spend that can prove
 *      nothing is refused.
 *
 * Pure — no network, no clock. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BANK_ACTIONS, BANK_SIDES, CASH_ORIGINS, CASH_STATES, DEPOSIT_STATES,
  SPEND_KINDS, BANK_REFUSALS, USE_STATES, SELF_EVIDENCING, IDLE_AFTER_DAYS,
  isAdmin, hasProof, authorise, mayBurn, cashState, isSpendable, backing,
  withdrawalReference, readUse, bankImbalance,
  type Actor, type MoveRequest, type SpendProof, type AccountUse, type CashLot,
} from '../lib/freehold/bank'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const admin: Actor = { userId: 'u-admin', role: 'admin', walletId: 'w-admin' }
const admin2: Actor = { userId: 'u-admin2', role: 'admin', walletId: 'w-admin2' }
const leader: Actor = { userId: 'u-lead', role: 'team_leader', walletId: 'w-lead' }
const broker: Actor = { userId: 'u-b1', role: 'broker', walletId: 'w-b1' }

const req = (o: Partial<MoveRequest> & { action: MoveRequest['action'] }): MoveRequest => ({
  amount: 100, fromWalletId: null, toWalletId: 'w-b1', ...o,
})
const why = (a: Actor, r: MoveRequest) => {
  const v = authorise(a, r)
  return v.ok ? 'ok' : v.refusal
}
const lot = (o: Partial<CashLot> = {}): CashLot => ({
  id: 'lot-1', origin: 'mint', createdBy: 'u-admin', transactionRef: null,
  deposit: 'cleared', amount: 1000, movedBy: null, remaining: 1000, closedBy: null, ...o,
})

console.log('\n── the two doors Cash comes through ──')
{
  // A DEPOSIT IS REAL MONEY AND ANYONE MAY RECORD ONE. Somebody paying for
  // their own ads is not an administrative act; refusing to let them record it
  // is how a finance system ends up with a WhatsApp thread beside it.
  check('a broker may record money they actually paid in',
    why(broker, req({ action: 'deposit', transactionRef: 'TT-8891' })) === 'ok')
  check('…so may a team leader',
    why(leader, req({ action: 'deposit', transactionRef: 'TT-8891' })) === 'ok')

  // …AND IT CARRIES THE NUMBER THE STATEMENT CAN BE READ AGAINST. Without one
  // there is nothing to clear the claim against, so it is not a deposit at all.
  check('a deposit with no transaction number is refused',
    why(broker, req({ action: 'deposit' })) === 'noTransactionNumber')
  check('…and neither is whitespace a transaction number',
    why(broker, req({ action: 'deposit', transactionRef: '   ' })) === 'noTransactionNumber')

  // A MINT IS CASH WITH NO CASH IN FRONT OF IT, so only an admin may make one.
  check('only an admin mints', why(admin, req({ action: 'mint' })) === 'ok')
  check('a team leader may not mint', why(leader, req({ action: 'mint' })) === 'notAdmin')
  check('a broker may not mint', why(broker, req({ action: 'mint' })) === 'notAdmin')

  // The absence of a reference IS the difference between the doors, so it is a
  // field on the lot rather than a flag two screens could set differently.
  const minted = lot()
  check('a mint carries no transaction reference', minted.transactionRef === null)
  check('…and is spendable the moment it is made', isSpendable(minted))
}

console.log('\n── a claim is not money until somebody reads the statement ──')
{
  // THE HOLE THIS CLOSES: if typing a transaction number credited a wallet, any
  // broker could type any number and give themselves real ad spend. Depositing
  // stays open to everyone; the money becomes spendable when the bank agrees.
  const claimed = lot({ origin: 'deposit', transactionRef: 'TT-1', deposit: 'claimed' })
  check('a recorded-but-uncleared deposit is not spendable', !isSpendable(claimed))
  const cleared = lot({ origin: 'deposit', transactionRef: 'TT-1', deposit: 'cleared' })
  check('…and is, once the statement agrees', isSpendable(cleared))
  check('an uncleared deposit cannot even be burned',
    why(admin, req({ action: 'burn', lot: claimed })) === 'notCleared')

  // AND THE THREE FIGURES NEVER MERGE. A single "we have AED 900,000" blending
  // real deposits with printed money is not a balance, it is a mood.
  const b = backing([
    lot({ origin: 'deposit', deposit: 'cleared', amount: 200 }),
    lot({ origin: 'deposit', deposit: 'claimed', amount: 50 }),
    lot({ origin: 'deposit', deposit: 'rejected', amount: 999 }),
    lot({ origin: 'mint', amount: 700 }),
  ])
  check('real money is counted as real money', b.depositedAed === 200, String(b.depositedAed))
  check('printed money is counted separately', b.mintedAed === 700, String(b.mintedAed))
  check('an unread claim is counted as neither', b.claimedAed === 50, String(b.claimedAed))
  check('a rejected deposit is counted nowhere',
    b.depositedAed + b.mintedAed + b.claimedAed === 950,
    String(b.depositedAed + b.mintedAed + b.claimedAed))
}

console.log('\n── in the bank it is float; once it moves it is a cheque ──')
{
  const float = lot()
  check('unmoved Cash is in the bank', cashState(float) === 'inBank', cashState(float))
  check('…and belongs to nobody, so any admin may burn it', mayBurn(admin2, float).ok)
  check('…including the one who minted it', mayBurn(admin, float).ok)

  // THE MOMENT IT MOVES IT HAS AN OWNER, and the owner is the mover.
  const cheque = lot({ movedBy: 'u-admin' })
  check('moved Cash is a cheque', cashState(cheque) === 'cheque', cashState(cheque))
  check('the admin who moved it may burn it', mayBurn(admin, cheque).ok)
  const refused = mayBurn(admin2, cheque)
  check('another admin may not — however senior',
    !refused.ok && refused.refusal === 'notYourCheque')

  // …AND THE RIGHT DOES NOT TRAVEL WITH THE MONEY. The bank can see from the
  // log where a cheque went; the signature on it stays where it was written.
  const holder: Actor = { userId: 'u-b1', role: 'admin', walletId: 'w-b1' }
  const travelled = mayBurn(holder, cheque)
  check('nor may whoever is holding it now',
    !travelled.ok && travelled.refusal === 'notYourCheque')

  // TEARING UP A CHEQUE NEEDS BOTH SIGNATURES ON IT. "Any admin may burn what
  // is still in the bank" and "nobody burns Cash they did not create" disagree
  // about one case, and this is where they are reconciled: in the bank is the
  // carve-out, and outside it BOTH rules apply.
  const split = lot({ createdBy: 'u-admin', movedBy: 'u-admin2' })
  const mover = mayBurn(admin2, split)
  check('the mover alone cannot burn what somebody else created',
    !mover.ok && mover.refusal === 'notYourMint')
  const minter = mayBurn(admin, split)
  check('…and the creator alone cannot burn what somebody else signed out',
    !minter.ok && minter.refusal === 'notYourCheque')
  // This deadlocks that parcel, deliberately. Being unable to destroy money is
  // recoverable — it is still there to be spent or sent back. Being able to
  // destroy somebody else's is not.
  check('a cheque with two different names on it can be burned by neither',
    !mayBurn(admin, split).ok && !mayBurn(admin2, split).ok)

  // A ledger where anybody can annihilate anybody's money is not a bank.
  check('a broker cannot burn at all',
    why(broker, req({ action: 'burn', lot: float })) === 'notAdmin')
  check('nor a team leader',
    why(leader, req({ action: 'burn', lot: float })) === 'notAdmin')
  check('and nobody burns more than the parcel holds',
    why(admin, req({ action: 'burn', lot: lot({ remaining: 40 }), amount: 100 })) === 'badAmount')

  // Both endings are reachable, so neither is dead vocabulary.
  check('a fully spent parcel reads as spent',
    cashState(lot({ remaining: 0, closedBy: 'spent' })) === 'spent')
  check('a fully burned parcel reads as burned',
    cashState(lot({ remaining: 0, closedBy: 'burned' })) === 'burned')
}

console.log('\n── signing Cash out of the bank ──')
{
  // THE MOVE IS WHAT CREATES THE CHEQUE AND NAMES ITS OWNER, so an admin signs
  // it into their OWN wallet. Wanting somebody else to have it is a send, made
  // in the open, afterwards — which puts a named human between the printing
  // press and a broker's balance.
  check('an admin moves Cash into their own wallet',
    why(admin, req({ action: 'move', toWalletId: 'w-admin' })) === 'ok')
  check('…and not straight into somebody else\'s',
    why(admin, req({ action: 'move', toWalletId: 'w-b1' })) === 'notYourMoney')
  check('a broker cannot sign money out of the bank',
    why(broker, req({ action: 'move', toWalletId: 'w-b1' })) === 'notAdmin')

  // THE OLD "ALLOCATE" IS GONE. It was the one movement whose source was not
  // the actor's own wallet, and while it existed "nobody takes from anybody"
  // was a sentence rather than a shape.
  check('there is no allocate action left to reach for',
    !(BANK_ACTIONS as readonly string[]).includes('allocate'), BANK_ACTIONS.join(','))
}

console.log('\n── any wallet to any wallet, out of your own pocket ──')
{
  // ANY WALLET MAY SEND TO ANY WALLET. People pay each other; a payment has no
  // hierarchy and no team boundary.
  check('a broker sends to another broker',
    why(broker, req({ action: 'send', fromWalletId: 'w-b1', toWalletId: 'w-b9' })) === 'ok')
  check('a team leader sends outside their own team',
    why(leader, req({ action: 'send', fromWalletId: 'w-lead', toWalletId: 'w-x' })) === 'ok')
  check('a broker sends to an admin',
    why(broker, req({ action: 'send', fromWalletId: 'w-b1', toWalletId: 'w-admin' })) === 'ok')

  // WHAT NOBODY CAN DO IS REACH INTO SOMEBODY ELSE'S WALLET. This is the rule
  // the whole module is shaped around.
  check('nobody sends from a wallet that is not theirs',
    why(broker, req({ action: 'send', fromWalletId: 'w-lead', toWalletId: 'w-b1' })) === 'notYourMoney')
  check('…and an admin is not an exception',
    why(admin, req({ action: 'send', fromWalletId: 'w-b1', toWalletId: 'w-admin' })) === 'notYourMoney')
  check('somebody with no wallet cannot send',
    why({ ...broker, walletId: null }, req({ action: 'send', fromWalletId: 'w-b1' })) === 'notYourMoney')
  check('a send to nowhere is refused',
    why(broker, req({ action: 'send', fromWalletId: 'w-b1', toWalletId: null })) === 'noSuchWallet')
  check('a send to yourself is refused',
    why(broker, req({ action: 'send', fromWalletId: 'w-b1', toWalletId: 'w-b1' })) === 'sameWallet')

  // THE STRUCTURAL CLAIM, CHECKED AS A SHAPE. A permission test passes until
  // somebody adds a branch; this fails the moment one is added.
  const src = readFileSync(join(process.cwd(), 'lib/freehold/bank.ts'), { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  const sendBranch = src.slice(src.indexOf("case 'send'"), src.indexOf("case 'burn'"))
  check('the send branch requires the source to be the actor\'s own wallet',
    /req\.fromWalletId !== actor\.walletId/.test(sendBranch))
  check('…and has no escape hatch for a role',
    !/isAdmin/.test(sendBranch), 'a role check appeared in the send branch')
}

console.log('\n── every dirham that leaves carries its receipt ──')
{
  const proof = (o: Partial<SpendProof> = {}): SpendProof => ({ kind: 'other', ...o })

  // ADS PAY THEMSELVES. The ad account holds the invoice and the campaign id
  // ties the spend to what it bought — a stronger record than a typed number,
  // and it reconciles against Meta's and Google's own invoices.
  check('a campaign id proves an ad spend', hasProof(proof({ kind: 'ads', campaignId: '120' })))
  check('so does the ad account', hasProof(proof({ kind: 'ads', adAccountId: 'act_9' })))
  check('an ad spend proving neither is refused', !hasProof(proof({ kind: 'ads' })))

  // EVERYTHING ELSE LEAVES THROUGH A BANK, AND A BANK GIVES YOU A REFERENCE.
  check('a commission needs a cheque number', !hasProof(proof({ kind: 'commission' })))
  check('…and is fine with one', hasProof(proof({ kind: 'commission', reference: 'CHQ-4471' })))
  check('a campaign id does NOT prove a salary',
    !hasProof(proof({ kind: 'salary', campaignId: '120' })))

  // AN IMAGE IS EVIDENCE, NEVER PROOF. A photograph with no number attached
  // cannot be reconciled against anything — and a system that refuses to record
  // a real payment because nobody could photograph the cheque teaches people to
  // keep the books somewhere else.
  check('a photograph alone does not authorise a withdrawal',
    !hasProof(proof({ kind: 'vendor', imageUrl: 'https://x/y.jpg' })))
  check('…and a payment with a reference and no photograph is fine',
    hasProof(proof({ kind: 'vendor', reference: 'TT-2231' })))

  check('a spend with nothing behind it is refused',
    why(broker, req({ action: 'spend', fromWalletId: 'w-b1', spend: proof() })) === 'noProof')
  check('a proven spend goes through',
    why(broker, req({ action: 'spend', fromWalletId: 'w-b1', spend: proof({ reference: 'X' }) })) === 'ok')
  check('a broker cannot spend from a wallet that is not theirs',
    why(broker, req({ action: 'spend', fromWalletId: 'w-lead', spend: proof({ reference: 'X' }) })) === 'notYourMoney')
  check('an admin may spend from a company wallet',
    why(admin, req({ action: 'spend', fromWalletId: 'w-company', spend: proof({ reference: 'X' }) })) === 'ok')

  // The withdraw record files ads under the campaign, so the record, the
  // campaign page and the platform invoice read against each other with nobody
  // re-typing an id.
  check('an ads withdrawal is filed under its campaign',
    withdrawalReference({ kind: 'ads', campaignId: '120', reference: 'ignored' }) === '120')
  check('…falling back to the ad account',
    withdrawalReference({ kind: 'ads', adAccountId: 'act_9' }) === 'act_9')
  check('everything else is filed under its cheque',
    withdrawalReference({ kind: 'salary', reference: 'CHQ-1' }) === 'CHQ-1')
}

console.log('\n── the books, and who is sitting on money ──')
{
  // A NUMBER, NOT A BOOLEAN. "The books are wrong" is not actionable; "the
  // books are AED 40 out" is.
  check('books that add up read zero',
    bankImbalance({ issuedAed: 1000, burnedAed: 100, withdrawnAed: 400, heldAed: 500 }) === 0)
  check('…and books that do not say how far out they are',
    bankImbalance({ issuedAed: 1000, burnedAed: 100, withdrawnAed: 400, heldAed: 460 }) === 40)

  const use = (o: Partial<AccountUse>): AccountUse['state'] => readUse({
    walletId: 'w', userId: 'u', label: 'x',
    fundedAed: 1000, spentAed: 0, balanceAed: 1000, daysSinceSpend: 1, ...o,
  })
  // IDLE MONEY IS THE FINDING. Overspending announces itself; money that was
  // sent and never used is invisible until somebody asks why the pipeline is
  // thin.
  check('money sitting untouched for a fortnight is idle',
    use({ daysSinceSpend: IDLE_AFTER_DAYS }) === 'idle')
  check('money that has never been spent at all is idle',
    use({ daysSinceSpend: null }) === 'idle')
  check('…but yesterday is not a fortnight', use({ daysSinceSpend: 1 }) === 'spending')

  // EMPTY IS NOT IDLE. Telling somebody they are sitting on money when they
  // have none is how a report loses its reader.
  check('an account with nothing in it is empty, not idle',
    use({ balanceAed: 0, fundedAed: 0, daysSinceSpend: null }) === 'empty')
  check('an account that spent everything it was given is spending',
    use({ balanceAed: 0, fundedAed: 1000, spentAed: 1000 }) === 'spending')
  check('an overdrawn account says so first',
    use({ balanceAed: -5, fundedAed: 0, daysSinceSpend: null }) === 'overdrawn')
}

console.log('\n── the vocabulary is walkable and nothing in it is dead ──')
{
  // Every list a screen renders from is a const array, so the UI can enumerate
  // it and the i18n audit can see the keys.
  for (const [name, list] of [
    ['actions', BANK_ACTIONS], ['sides', BANK_SIDES], ['origins', CASH_ORIGINS],
    ['cash states', CASH_STATES], ['deposit states', DEPOSIT_STATES],
    ['spend kinds', SPEND_KINDS], ['refusals', BANK_REFUSALS], ['use states', USE_STATES],
  ] as const) {
    check(`${name} is a non-empty walkable list`, list.length > 0 && new Set(list).size === list.length)
  }
  check('ads is the only self-evidencing kind',
    SELF_EVIDENCING.length === 1 && SELF_EVIDENCING[0] === 'ads', SELF_EVIDENCING.join(','))
  check('every self-evidencing kind is a real spend kind',
    SELF_EVIDENCING.every((k) => (SPEND_KINDS as readonly string[]).includes(k)))
  check('management is management', isAdmin('admin') && !isAdmin('broker'))

  // EVERY REFUSAL MUST BE REACHABLE. A refusal nobody can trigger is a sentence
  // in a dictionary that no screen will ever show, and it rots.
  const reached = new Set<string>([
    why(broker, req({ action: 'mint' })),
    why(admin, req({ action: 'send', fromWalletId: 'w-b1' })),
    why(admin2, req({ action: 'burn', lot: lot({ movedBy: 'u-admin' }) })),
    why(broker, req({ action: 'deposit' })),
    why(admin, req({ action: 'burn', lot: lot({ deposit: 'claimed' }) })),
    why(broker, req({ action: 'spend', fromWalletId: 'w-b1', spend: { kind: 'other' } })),
    why(broker, req({ action: 'send', fromWalletId: 'w-b1', amount: -1 })),
    why(broker, req({ action: 'send', fromWalletId: 'w-b1', toWalletId: null })),
    why(broker, req({ action: 'send', fromWalletId: 'w-b1', toWalletId: 'w-b1' })),
    why(admin, req({ action: 'move', toWalletId: 'w-b1' })),
    why(admin2, req({ action: 'burn', lot: lot({ createdBy: 'u-admin', movedBy: 'u-admin2' }) })),
  ])
  const unreachable = BANK_REFUSALS.filter((r) => !reached.has(r))
  check('every refusal is reachable — none is dead copy',
    unreachable.length === 0, unreachable.join(','))
}

if (failures > 0) {
  console.error(`\n${failures} bank rule(s) broken.`)
  process.exit(1)
}
console.log('\nCash comes from one place, moves only forward, and never leaves without a receipt.\n')
