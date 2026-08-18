/**
 * ASKING FOR CASH, WITHOUT ANYBODY BEING ABLE TO TAKE IT — locked.
 *
 * This ledger has one structural rule above all others: money is PUSHED, never
 * pulled. There is no operation anywhere that reaches into somebody else's
 * wallet. A request is the missing half of that rule — the only way to be paid
 * by somebody is to ask them — and it is also the most obvious place to
 * accidentally build the pull operation back in.
 *
 * The three ways that could happen, each pinned below:
 *
 *   1. AN ADMIN APPROVING OUT OF SOMEBODY ELSE'S WALLET. That is taking their
 *      money with extra steps. A wallet is answered by the person who owns it
 *      and by nobody else; the bank is answered by an admin, because the bank
 *      belongs to nobody until somebody signs Cash out of it.
 *   2. A REQUEST NAMING A THIRD-PARTY BENEFICIARY. Then approving carries a
 *      second question — who is this actually paying — and the day somebody
 *      approves without asking it, the request has routed money to a stranger
 *      with a manager's signature on it.
 *   3. "APPROVED" WITHOUT THE MONEY. A row that says approved while nothing
 *      moved is the exact shape of lie the ledger exists to make impossible.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  mayRequest, mayDecide, mayCancel, splitRequests,
  REQUEST_STATES, REQUEST_REFUSALS,
  type CashRequest, type RequestActor,
} from '../lib/freehold/cash-request'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const code = (p: string): string =>
  readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const BANK = 'w_bank'
const valid = (n: number) => Number.isInteger(n) && n > 0

const ahmed: RequestActor = { userId: 'ahmed@x.com', walletId: 'w_a', isAdmin: false }
const sara: RequestActor = { userId: 'sara@x.com', walletId: 'w_s', isAdmin: false }
const boss: RequestActor = { userId: 'boss@x.com', walletId: 'w_b', isAdmin: true }

const req = (over: Partial<CashRequest> = {}): CashRequest => ({
  id: 'cr_1', askedOfWalletId: 'w_s', beneficiaryWalletId: 'w_a',
  amount: 5000, reason: 'float', state: 'pending', requestedBy: 'ahmed@x.com',
  decidedBy: null, decidedAt: null, transferId: null, signatureId: null,
  createdAt: '2026-08-18T09:00:00Z', ...over,
})

console.log('\n── you ask for money for yourself, and for nobody else ──')
{
  check('asking for your own account is fine',
    mayRequest(ahmed, { askedOfWalletId: 'w_s', beneficiaryWalletId: 'w_a', amount: 100 }, valid).ok)

  // RULE 2. The safety property that makes approving cheap to think about.
  const third = mayRequest(ahmed, { askedOfWalletId: 'w_s', beneficiaryWalletId: 'w_x', amount: 100 }, valid)
  check('naming somebody else as the beneficiary is refused',
    !third.ok && third.refusal === 'notYourWallet',
    'a request could route money to a stranger with an approver\'s name on it')

  const self = mayRequest(ahmed, { askedOfWalletId: 'w_a', beneficiaryWalletId: 'w_a', amount: 100 }, valid)
  check('asking your own account is refused',
    !self.ok && self.refusal === 'askingYourself', JSON.stringify(self))

  const bad = mayRequest(ahmed, { askedOfWalletId: 'w_s', beneficiaryWalletId: 'w_a', amount: 0 }, valid)
  check('a bad amount is answered first, before anything else',
    !bad.ok && bad.refusal === 'badAmount',
    'somebody is told "you cannot ask yourself" about a request that was never valid')

  const noWallet = mayRequest({ userId: 'z@x.com', walletId: null, isAdmin: false },
    { askedOfWalletId: 'w_s', beneficiaryWalletId: '', amount: 100 }, valid)
  check('somebody with no account cannot ask for one to be paid', !noWallet.ok)

  // The bank is an ordinary target. Asking the company for float is the
  // commonest request there is and must not be a special case.
  check('the Bank can be asked like anybody else',
    mayRequest(ahmed, { askedOfWalletId: BANK, beneficiaryWalletId: 'w_a', amount: 100 }, valid).ok)
}

console.log('\n── only the person asked may answer ──')
{
  check('the person asked may answer', mayDecide(sara, req(), BANK).ok)

  // RULE 1. THE ONE THAT MATTERS. There is deliberately no admin branch here.
  const adminOnSomebodyElse = mayDecide(boss, req(), BANK)
  check('an admin may NOT answer a request asked of somebody else\'s account',
    !adminOnSomebodyElse.ok && adminOnSomebodyElse.refusal === 'notAskedOfYou',
    'an admin can approve a payment out of an account that is not theirs — that is a pull operation')

  check('a bystander may not answer',
    !mayDecide({ userId: 'nobody@x.com', walletId: 'w_n', isAdmin: false }, req(), BANK).ok)

  // The bank is answered by an admin, because it belongs to nobody.
  check('the Bank is answered by an admin', mayDecide(boss, req({ askedOfWalletId: BANK }), BANK).ok)
  const notAdmin = mayDecide(ahmed, req({ askedOfWalletId: BANK }), BANK)
  check('…and not by anybody else', !notAdmin.ok && notAdmin.refusal === 'notAdmin', JSON.stringify(notAdmin))

  // ANSWERING TWICE MUST NOT PAY TWICE.
  for (const state of ['approved', 'declined', 'cancelled'] as const) {
    const r = mayDecide(sara, req({ state }), BANK)
    check(`a request already ${state} cannot be answered again`,
      !r.ok && r.refusal === 'alreadyDecided', JSON.stringify(r))
  }
}

console.log('\n── withdrawing is the asker\'s, and only while it is open ──')
{
  check('the asker may withdraw their own', mayCancel(ahmed, req()).ok)
  const notMine = mayCancel(sara, req())
  check('nobody else may', !notMine.ok && notMine.refusal === 'notYours', JSON.stringify(notMine))
  check('and not after it has been answered', !mayCancel(ahmed, req({ state: 'approved' })).ok)

  // Cancelled and declined are kept apart on purpose: "I no longer need this"
  // and "I am not paying this" are different facts about the same row.
  check('cancelled is its own state, not folded into declined',
    (REQUEST_STATES as readonly string[]).includes('cancelled')
      && (REQUEST_STATES as readonly string[]).includes('declined'))
}

console.log('\n── the two piles are split by what the reader can do ──')
{
  const all = [
    req({ id: '1', askedOfWalletId: 'w_s', requestedBy: 'ahmed@x.com' }),          // Sara must answer
    req({ id: '2', askedOfWalletId: 'w_a', beneficiaryWalletId: 'w_s', requestedBy: 'sara@x.com' }), // Sara asked
    req({ id: '3', askedOfWalletId: 'w_x', beneficiaryWalletId: 'w_y', requestedBy: 'other@x.com' }), // neither
    req({ id: '4', state: 'approved' }),
  ]
  const s = splitRequests(sara, all, BANK)
  check('what you must answer is its own list',
    s.waitingOnMe.map((r) => r.id).join(',') === '1', s.waitingOnMe.map((r) => r.id).join(','))
  check('what you are waiting on is another',
    s.waitingOnThem.map((r) => r.id).join(',') === '2', s.waitingOnThem.map((r) => r.id).join(','))
  check('an answered one is in neither', s.settled.map((r) => r.id).join(',') === '4')

  // A WALLET THAT LISTED EVERYBODY'S ASKS WOULD BE PUBLISHING WHO IS SHORT OF
  // MONEY THIS MONTH.
  check('somebody else\'s pending request appears nowhere',
    !s.waitingOnMe.some((r) => r.id === '3')
      && !s.waitingOnThem.some((r) => r.id === '3')
      && !s.settled.some((r) => r.id === '3'),
    'the wallet is publishing requests between two other people')

  // An admin sees the bank's queue, and still not other people's wallets.
  const b = splitRequests(boss, [
    req({ id: '5', askedOfWalletId: BANK }),
    req({ id: '6', askedOfWalletId: 'w_s' }),
  ], BANK)
  check('an admin is shown what was asked of the Bank',
    b.waitingOnMe.map((r) => r.id).join(',') === '5', b.waitingOnMe.map((r) => r.id).join(','))
}

console.log('\n── approving IS the transfer, and it is signed ──')
{
  const db = code('lib/freehold/cash-request-db.ts')

  // RULE 3. The row is marked approved only after the money actually moved.
  check('nothing is marked approved before the transfer returns ok',
    /if \(!posted\.ok\) return \{ ok: false, refusal: posted\.refusal \}/.test(db)
      && db.indexOf('if (!posted.ok)') < db.indexOf("SET state='approved'"),
    'a request could read approved while no Cash moved')
  check('the approval carries the transfer\'s own id', /transfer_id=\$3/.test(db))

  // A DOUBLE-CLICKED APPROVE PAYS ONCE. The reference is derived from the
  // request id, so the second post is the same movement, not another one.
  check('the movement\'s reference is derived from the request',
    /const reference = `request:\$\{req\.id\}`/.test(db),
    'a double-clicked Approve could pay twice')
  check('…and only a still-pending row is updated',
    /WHERE id=\$1 AND state='pending'/.test(db))

  check('the approver signs it in the same call', /await signMovement\(reference/.test(db))
  check('…with the beneficiary\'s name frozen as it read at that moment',
    /label: to\.label, accountNo: to\.accountNo/.test(db),
    'a relabelled wallet would change what a settled receipt says')
  check('a beneficiary that no longer exists stops the payment',
    /if \(!to\) return \{ ok: false, refusal: 'noBeneficiary' \}/.test(db),
    'money could post into a wallet nobody can read')

  // The database refuses the self-request too, because a row that violated it
  // would sit in somebody's queue forever with no way to act on it.
  check('the database refuses a self-request as well as the rule',
    /CHECK \(asked_of <> beneficiary\)/.test(db))
}

console.log('\n── every refusal has a sentence somebody can read ──')
{
  const en = code('lib/i18n/dictionaries/wallet.ts')
  for (const r of REQUEST_REFUSALS) {
    check(`"${r}" is sayable`, new RegExp(`'wal\\.no\\.${r}'`).test(en),
      'this refusal would arrive on screen as a raw code')
  }
  const page = code('app/freehold-intelligence/wallet/page.tsx')
  check('the screen builds its sayable list from the union, not by hand',
    /\.\.\.REQUEST_REFUSALS/.test(page),
    'a refusal added to the rule module would reach the screen unreadable')
}

if (failures > 0) {
  console.error(`\n${failures} request rule(s) broken.`)
  console.error('A request that can move somebody else\'s money is the pull operation this ledger does not have.')
  process.exit(1)
}
console.log('\nAsking is a row; only the person asked can turn it into money.\n')
