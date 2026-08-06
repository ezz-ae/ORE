/**
 * Ads Coin ledger rules, locked.
 *
 * "built truly as a banking system not a credit fake." The difference is not
 * the screen — it is whether coin can be created or destroyed by accident.
 * With the old model it could: `allocation +100` added to a number and nothing
 * anywhere was reduced. Every assertion here is a way that returns.
 *
 * Pure — postings are values, so the whole ledger is exercised without a
 * database.
 */
import {
  formatAccountNo, parseAccountNo, isAccountNo, isValidAmount,
  buildTransfer, canSend, projectBalance, conservationError, treasuryPosition,
  TransferError, filsToAed, aedToFils,
  type Posting, type Wallet,
} from '../lib/freehold/wallet'

let failures = 0
const ok = (m: string) => console.log(`  ✓ ${m}`)
const fail = (m: string, got: string) => { failures++; console.error(`  ✗ ${m}\n      got: ${got}`) }
const check = (m: string, cond: boolean, got = '') => (cond ? ok(m) : fail(m, got))

const wallet = (id: string, kind: Wallet['kind'], balance = 0, held = 0): Wallet =>
  ({ id, accountNo: formatAccountNo(kind, 1), kind, ownerId: null, label: id, balance, held })

console.log('\n── an account number can be read down a phone ──')
{
  const acc = formatAccountNo('broker', 4472)
  check('it has the shape people expect', /^FH-\d{2}-\d{6}-\d$/.test(acc), acc)
  check('it round-trips', parseAccountNo(acc)?.serial === 4472, JSON.stringify(parseAccountNo(acc)))
  check('the kind survives', parseAccountNo(acc)?.kind === 'broker')
  check('lowercase and spaces are forgiven', isAccountNo(` ${acc.toLowerCase()} `))

  // The whole reason for a check digit: a transfer typed from a screenshot.
  const digits = acc.replace(/\D/g, '')
  const bumped = acc.replace(digits[3], String((Number(digits[3]) + 1) % 10))
  check('one wrong digit is rejected', !isAccountNo(bumped), bumped)
  check('a made-up number is rejected', !isAccountNo('FH-30-000001-0'))
  check('junk is rejected', !isAccountNo('12345') && !isAccountNo('') && !isAccountNo('FH-99-000001-1'))
  // Two different wallets must never share a number.
  const seen = new Set(Array.from({ length: 500 }, (_, i) => formatAccountNo('broker', i)))
  check('500 serials give 500 distinct numbers', seen.size === 500, String(seen.size))
}

console.log('\n── an amount is whole, positive and real ──')
{
  check('a normal amount', isValidAmount(250))
  check('zero is not a movement', !isValidAmount(0))
  check('negative is not an amount', !isValidAmount(-5))
  check('there is no half coin', !isValidAmount(0.5) && !isValidAmount(10.01))
  check('NaN is refused', !isValidAmount(Number.NaN))
  check('Infinity is refused', !isValidAmount(Number.POSITIVE_INFINITY))
  check('a string is refused', !isValidAmount('100' as unknown))
  check('an absurd amount is refused', !isValidAmount(9e12))
}

console.log('\n── every movement has two sides ──')
{
  const t = buildTransfer({ reference: 'r1', kind: 'transfer', amount: 100, fromWalletId: 'a', toWalletId: 'b' })
  check('exactly two postings', t.postings.length === 2)
  check('one debit, one credit',
    t.postings.filter((p) => p.direction === 'debit').length === 1 &&
    t.postings.filter((p) => p.direction === 'credit').length === 1)
  check('equal and opposite', t.postings[0].amount === t.postings[1].amount)
  check('the pair cancels', conservationError(t.postings) === 0, String(conservationError(t.postings)))
  check('amounts are always positive; direction carries the sign',
    t.postings.every((p) => p.amount > 0))

  let threw = ''
  try { buildTransfer({ reference: 'r', kind: 'transfer', amount: 0, fromWalletId: 'a', toWalletId: 'b' }) }
  catch (e) { threw = (e as TransferError).refusal }
  check('a zero transfer cannot be built', threw === 'invalid_amount', threw)

  threw = ''
  try { buildTransfer({ reference: 'r', kind: 'transfer', amount: 10, fromWalletId: 'a', toWalletId: 'a' }) }
  catch (e) { threw = (e as TransferError).refusal }
  check('sending to yourself is refused', threw === 'same_wallet', threw)

  // …except a hold, which genuinely moves within one wallet.
  const h = buildTransfer({ reference: 'h', kind: 'hold', amount: 10, fromWalletId: 'a', toWalletId: 'a' })
  check('a hold may stay inside one wallet', h.postings.length === 2)
}

console.log('\n── coin is conserved across a whole day of trading ──')
{
  // Issue, distribute, spend, refund, hold, release — the real cycle.
  const all: Posting[] = []
  const post = (kind: Parameters<typeof buildTransfer>[0]['kind'], amount: number, from: string, to: string) => {
    all.push(...buildTransfer({ reference: `${kind}-${all.length}`, kind, amount, fromWalletId: from, toWalletId: to }).postings)
  }
  post('issue', 10_000, 'treasury', 'ops')
  post('transfer', 4_000, 'ops', 'machine')
  post('transfer', 1_500, 'ops', 'broker1')
  post('transfer', 900, 'ops', 'broker2')
  post('hold', 600, 'machine', 'machine')
  post('spend', 350, 'machine', 'ops')
  post('refund', 50, 'ops', 'broker1')
  post('release', 100, 'machine', 'machine')
  post('earn', 200, 'treasury', 'broker2')

  check('the books balance after every kind of movement', conservationError(all) === 0,
    String(conservationError(all)))

  // And the balances are what replaying the ledger says they are.
  const treasury = projectBalance(all, 'treasury')
  check('the treasury is negative by exactly what it issued', treasury === -10_200, String(treasury))
  const circulating = ['ops', 'machine', 'broker1', 'broker2']
    .reduce((n, id) => n + projectBalance(all, id), 0)
  check('circulating coin equals what the treasury put out', circulating === 10_200, String(circulating))
  check('nothing was created along the way', treasury + circulating === 0, String(treasury + circulating))
}

console.log('\n── a broken ledger is DETECTED, not absorbed ──')
{
  // This is the test that matters: if a one-sided posting ever reaches the
  // ledger, the invariant must say so rather than the UI quietly showing a
  // wrong total.
  const rigged: Posting[] = [
    ...buildTransfer({ reference: 'a', kind: 'transfer', amount: 100, fromWalletId: 'x', toWalletId: 'y' }).postings,
    { walletId: 'y', direction: 'credit', amount: 50 }, // coin from nowhere
  ]
  check('invented coin is caught', conservationError(rigged) === 50, String(conservationError(rigged)))
  const vanished: Posting[] = [{ walletId: 'x', direction: 'debit', amount: 30 }]
  check('vanished coin is caught', conservationError(vanished) === -30, String(conservationError(vanished)))
  check('an empty ledger is balanced', conservationError([]) === 0)
}

console.log('\n── nobody overdraws, except the one account that may ──')
{
  check('a broker may send what they hold', canSend(wallet('b', 'broker', 500), 500))
  check('a broker may not send a coin more', !canSend(wallet('b', 'broker', 500), 501))
  check('an empty wallet sends nothing', !canSend(wallet('b', 'broker', 0), 1))
  check('the lead machine is limited too', !canSend(wallet('m', 'lead_machine', 10), 11))
  check('operations is limited too', !canSend(wallet('o', 'operations', 10), 11))
  // The treasury going negative IS the float — that is where coin comes from.
  check('the treasury may issue beyond its balance', canSend(wallet('t', 'treasury', 0), 1_000_000))
  check('but not an invalid amount, even from the treasury', !canSend(wallet('t', 'treasury', 0), -5))
}

console.log('\n── the bank’s own position is derived, never stored ──')
{
  const wallets: Wallet[] = [
    wallet('t', 'treasury', -10_000),
    wallet('o', 'operations', 3_000),
    wallet('m', 'lead_machine', 4_000, 600),
    wallet('b1', 'broker', 1_500),
    wallet('b2', 'broker', 900),
  ]
  const pos = treasuryPosition(wallets)
  check('capital is what the treasury issued', pos.capital === 10_000, String(pos.capital))
  check('in use is what is held against live campaigns', pos.inUse === 600, String(pos.inUse))
  check('undistributed is what sits in operations', pos.undistributed === 3_000, String(pos.undistributed))
  check('liquidity is the spendable coin out with the spenders',
    pos.liquidity === 4_000 + 1_500 + 900, String(pos.liquidity))
  check('the parts add up to the capital',
    pos.liquidity + pos.inUse + pos.undistributed === pos.capital,
    `${pos.liquidity}+${pos.inUse}+${pos.undistributed} vs ${pos.capital}`)
}

console.log('\n── dirhams are an asset, and integral ──')
{
  check('AED is held in fils, so nothing rounds away', aedToFils(1234.56) === 123456, String(aedToFils(1234.56)))
  check('and reads back exactly', filsToAed(123456) === '1,234.56', filsToAed(123456))
  check('a half fils cannot exist', Number.isInteger(aedToFils(0.005)))
  check('zero reads as zero', filsToAed(0) === '0.00', filsToAed(0))
}

if (failures > 0) {
  console.error(`\n${failures} ledger rule(s) broken.`)
  process.exit(1)
}
console.log('\nAll ledger rules hold.\n')
