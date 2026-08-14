/**
 * THE BANK'S PERSISTENCE KEEPS ITS PROMISES — locked.
 *
 * bank-test.ts checks the rules. This checks that the code which WRITES them
 * down has the shape the rules need, because a perfect authority module in
 * front of a careless INSERT is a perfect authority module and a broken bank.
 *
 * These are source-shape assertions rather than behaviour, deliberately. The
 * claims below are all of the form "there is no code anywhere that does X",
 * and no amount of calling functions can prove that — only reading can.
 *
 *   1. Nothing but wallet-db writes to the ledger.
 *   2. A mint can never carry a transaction number, enforced by the DATABASE.
 *   3. A deposit always carries one, same enforcement.
 *   4. Clearing is what issues the coin — a claim moves no balance.
 *   5. A cheque is burned out of the burner's own wallet, never anybody else's.
 *   6. Every spend writes its receipt.
 *   7. One identity per person, defined once.
 *
 * Pure — reads files, no network, no clock. Runs in `pnpm guards`.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

/** Comments stripped. A rule's header names the pattern it forbids so the next
 *  reader knows why, and a scanner that reads prose as code fails on the
 *  explanation — which teaches people to delete the explanation. */
const code = (p: string): string =>
  readFileSync(join(process.cwd(), p), { encoding: 'utf8' })
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const db = code('lib/freehold/bank-db.ts')

/**
 * The body of one function.
 *
 * Boundaries are CODE, never comment banners: the stripper above removes those,
 * `indexOf` then returns -1, and the slice silently widens to the rest of the
 * file — so a check that should have failed passes on text it was never meant
 * to read. This throws instead, because a guard that cannot find what it is
 * guarding must not report success.
 */
const between = (src: string, from: string, to: string): string => {
  const a = src.indexOf(from)
  const b = src.indexOf(to)
  if (a < 0 || b < 0 || b <= a) throw new Error(`bank-db-test: cannot slice ${from} → ${to}`)
  return src.slice(a, b)
}
const walletRoute = code('app/api/freehold/wallet/route.ts')
const bankRoute = code('app/api/freehold/bank/route.ts')

console.log('\n── there is still exactly one way to move money ──')
{
  // THE INVARIANT THE WHOLE LEDGER RESTS ON. wallet-db.postTransfer writes both
  // postings and both balances in one transaction; anything that inserts a
  // posting directly can write one side of a movement and call it done.
  check('bank-db never inserts a posting itself',
    !/INSERT\s+INTO\s+freehold_wallet_postings/i.test(db),
    'bank-db is writing to the ledger directly')
  check('…and never updates a balance itself',
    !/UPDATE\s+freehold_wallets\s+SET\s+balance/i.test(db),
    'bank-db is assigning a balance')
  check('every movement goes through postTransfer', /postTransfer\(/.test(db))

  // AND NO ROUTE REACHES PAST THE LIBRARY. A handler that imports the ledger
  // directly is one refactor away from being the second write path.
  for (const [name, src] of [['the wallet route', walletRoute], ['the bank route', bankRoute]] as const) {
    check(`${name} does not import postTransfer`,
      !/postTransfer/.test(src), `${name} can write to the ledger directly`)
  }
}

console.log('\n── the two doors cannot be confused, and Postgres is the one refusing ──')
{
  // A MINT WITH A TRANSACTION NUMBER WOULD READ AS REAL MONEY in every report.
  // That is the one confusion the two-door model exists to prevent, and it is
  // far too important to leave to whichever screen happens to write the row —
  // so it is a CHECK constraint, not an `if`.
  check('the database refuses a mint that carries a reference',
    /CHECK \(origin <> 'mint' OR transaction_ref IS NULL\)/.test(db))
  check('…and refuses a deposit that carries none',
    /CHECK \(origin <> 'deposit' OR transaction_ref IS NOT NULL\)/.test(db))

  // …and the function has no parameter to pass one through even by accident.
  const mint = between(db, 'export async function mintCash', 'export async function moveFromBank')
  check('mintCash has no transactionRef parameter to misuse',
    !/transactionRef/.test(mint), 'mintCash can be handed a reference')
  check('…and writes NULL for it explicitly', /'mint', \$2, NULL, 'cleared'/.test(mint))

  // ONE PAYMENT RECORDED TWICE IS ONE PAYMENT. Clearing both would issue the
  // money twice, and the second issue has nothing behind it.
  check('two deposits cannot claim the same bank reference',
    /CREATE UNIQUE INDEX IF NOT EXISTS freehold_cash_lots_txn_uidx/.test(db))
}

console.log('\n── a claim is not money ──')
{
  const record = between(db, 'export async function recordDeposit', 'export async function clearDeposit')
  // THE HOLE THIS CLOSES: if recording a deposit moved a balance, anybody could
  // type any transaction number and give themselves real ad spend.
  check('recording a deposit posts nothing',
    !/postTransfer/.test(record), 'a recorded deposit is moving money')
  check('…and opens the parcel with nothing in it', /'claimed', \$4, 0, \$5/.test(record))

  const clear = between(db, 'export async function clearDeposit', 'export async function rejectDeposit')
  check('clearing is what issues the coin', /kind: 'issue'/.test(clear))
  check('…only an admin clears', /isAdminActor/.test(clear))
  // The coin is posted BEFORE the state flips. postTransfer is idempotent on
  // its reference, so a crash between them is repaired by running it again; the
  // other order would leave a cleared deposit whose money never existed.
  check('the coin is posted before the state changes',
    clear.indexOf('postTransfer') < clear.indexOf("deposit_state = 'cleared'"))
  check('…and the flip only fires on a claim that is still open',
    /WHERE id = \$1 AND deposit_state = 'claimed'/.test(clear))
}

console.log('\n── a cheque comes out of the pocket that holds it ──')
{
  const burn = between(db, 'export async function burnCash', 'export async function spendCash')
  // THE RULE THIS ENCODES: float is burned from the bank, a cheque from the
  // MOVER'S OWN wallet. If they have sent it on they no longer hold it and the
  // burn fails on insufficient funds — which is the correct answer. Reaching
  // into whoever holds it now is the one operation this system does not have.
  check('a cheque is burned from the actor\'s own wallet',
    /lot\.movedBy \? input\.actor\.walletId : BANK_WALLET_ID/.test(burn))
  check('…and there is no other wallet it could name',
    !/toWalletId: input\.\w+WalletId/.test(burn), 'the burn can name a wallet')
  check('the authority answer comes from bank.ts, not from here',
    /authorise\(input\.actor/.test(burn) && !/isAdmin\(/.test(burn))
  check('burned coin goes back to the treasury', /toWalletId: TREASURY_WALLET_ID/.test(burn))
}

console.log('\n── a cheque is not torn in half ──')
{
  const move = between(db, 'export async function moveFromBank', 'export async function sendCash')
  // A HALF-MOVED PARCEL HAS TWO ANSWERS to "who may burn this" — any admin for
  // the half still in the float, only the mover for the half signed out. The
  // move takes the whole lot so the question keeps one answer.
  check('a move takes the whole remaining parcel', /amount: lot\.remaining/.test(move))
  check('…and has no amount parameter to take part of it',
    !/input\.amount/.test(move), 'a partial move is possible')
  // Stamped only after the money actually moved: the other order names an owner
  // for a cheque that was never signed out.
  check('the owner is stamped after the transfer, not before',
    move.indexOf('postTransfer') < move.indexOf('moved_by = $2'))
  check('…and only when nobody has signed it out already',
    /WHERE id = \$1 AND moved_by IS NULL/.test(move))
}

console.log('\n── nothing leaves without its receipt ──')
{
  const spend = between(db, 'export async function spendCash', 'export interface WithdrawalRow')
  check('a spend writes a withdrawal row', /INSERT INTO freehold_withdrawals/.test(spend))
  check('…filed under the reference bank.ts chose',
    /withdrawalReference\(input\.proof\)/.test(spend))
  check('…and the proof is checked before anything moves',
    spend.indexOf('authorise(') < spend.indexOf('postTransfer'))
  // A retried settlement tick must not record the same ad spend twice.
  check('a duplicate posting writes no second receipt',
    /if \(posted\.duplicate\) return \{ ok: true, duplicate: true \}/.test(spend))
}

console.log('\n── one person, one identity, one wallet ──')
{
  // Using brokerId when present and email otherwise would give one person two
  // wallets depending on how they signed in, and split their balance in half
  // with nothing looking wrong on either row.
  check('personId is defined exactly once, in the library',
    /export const personId/.test(db))
  for (const [name, src] of [['the wallet route', walletRoute], ['the bank route', bankRoute]] as const) {
    check(`${name} imports it rather than redefining it`,
      /personId/.test(src) && !/const personId =/.test(src),
      `${name} has its own copy of the identity rule`)
  }
  check('one wallet per person, enforced by the id', /`w_u_\$\{userId\}`/.test(db))
}

console.log('\n── the bank is a separate door from the wallet ──')
{
  // "May this person mint" is answered by which URL they reached, not by an
  // `if` in the middle of a handler that a refactor could invert.
  check('the bank route gates every method on management',
    (bankRoute.match(/requireSession\(MGMT_ROLES\)/g) ?? []).length >= 2,
    'a bank handler is reachable without the role')
  check('the wallet route gates on nothing — everybody has a wallet',
    /requireSession\(\)/.test(walletRoute))
  check('…and cannot mint', !/mintCash/.test(walletRoute), 'the wallet route can print money')
  check('…nor clear a deposit',
    !/clearDeposit/.test(walletRoute), 'the wallet route can turn its own claim into money')
  check('…nor burn', !/burnCash/.test(walletRoute), 'the wallet route can destroy money')
  check('the re-denomination is behind the management door and run by hand',
    /action === 'redenominate'/.test(bankRoute) && !/redenominate/.test(walletRoute))
}

if (failures > 0) {
  console.error(`\n${failures} bank persistence rule(s) broken.`)
  process.exit(1)
}
console.log('\nThe rules are written down the way the rules require.\n')
