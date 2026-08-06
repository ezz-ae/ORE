/**
 * The Ads Coin ledger, against a real Postgres.
 *
 * The pure test proves a transfer is BALANCED. This one proves it is ATOMIC
 * and happens ONCE — neither of which can be demonstrated in memory, and both
 * of which are what separate a bank from a spreadsheet:
 *
 *   · a refused transfer must leave no trace at all
 *   · the same reference posted twice must move coin once
 *   · concurrent transfers must not double-spend a balance
 *   · the audit must actually catch a hand-corrupted ledger
 *
 * Run it the same way as db:smoke — see scripts/db-smoke.ts for the recipe.
 * Exits 2 (not 0) with no database, so "skipped" is never read as "passed".
 */
import { query } from '../lib/db'
import {
  ensureWalletSchema, openWallet, postTransfer, listWallets, listPostings,
  getWalletByAccountNo, getPosition, auditConservation,
} from '../lib/freehold/wallet-db'
import { parseAccountNo } from '../lib/freehold/wallet'

const HAS_DB = !!(process.env.NEON_DATABASE_URL || process.env.DATABASE_URL)
if (!HAS_DB) {
  console.error('\n⏭  wallet smoke SKIPPED — no NEON_DATABASE_URL / DATABASE_URL. Nothing was verified.\n')
  process.exit(2)
}

let failures = 0
const ok = (m: string, extra = '') => console.log(`  ✓ ${m}${extra ? ` — ${extra}` : ''}`)
const bad = (m: string, got: unknown) => { failures++; console.error(`  ✗ ${m}\n      ${got}`) }
const check = (m: string, cond: boolean, got: unknown = '') => (cond ? ok(m, String(got)) : bad(m, got))

const T = 'w_treasury_smoke'
const O = 'w_ops_smoke'
const M = 'w_machine_smoke'
const B = 'w_broker_smoke'

async function balanceOf(id: string): Promise<number> {
  const w = (await listWallets()).find((x) => x.id === id)
  return w ? w.balance : Number.NaN
}

async function main() {
  await ensureWalletSchema()
  // Clean slate, so counts and totals mean something.
  await query(`DELETE FROM freehold_wallet_postings WHERE reference LIKE 'smoke:%'`)
  await query(`DELETE FROM freehold_wallets WHERE id LIKE '%_smoke'`)

  console.log('\n── wallets open with usable account numbers ──')
  const treasury = await openWallet({ id: T, kind: 'treasury', label: 'Treasury' })
  const ops = await openWallet({ id: O, kind: 'operations', label: 'Operations' })
  const machine = await openWallet({ id: M, kind: 'lead_machine', label: 'Lead Machine' })
  const broker = await openWallet({ id: B, kind: 'broker', ownerId: 'u_smoke', label: 'Smoke Broker' })
  for (const w of [treasury, ops, machine, broker]) {
    check(`${w.label} has a valid number`, parseAccountNo(w.accountNo) !== null, w.accountNo)
  }
  const nums = new Set([treasury, ops, machine, broker].map((w) => w.accountNo))
  check('all four numbers are distinct', nums.size === 4, [...nums].join(' '))
  check('a wallet is findable by its number',
    (await getWalletByAccountNo(broker.accountNo))?.id === B, broker.accountNo)
  check('opening the same wallet twice does not make a second',
    (await openWallet({ id: B, kind: 'broker', ownerId: 'u_smoke', label: 'Smoke Broker' })).accountNo === broker.accountNo)

  console.log('\n── coin only enters at the treasury ──')
  const issue = await postTransfer({
    reference: 'smoke:issue-1', kind: 'issue', amount: 10_000,
    fromWalletId: T, toWalletId: O, memo: 'opening float',
  })
  check('the issue posted', issue.ok === true, JSON.stringify(issue))
  check('operations received it', (await balanceOf(O)) === 10_000, await balanceOf(O))
  check('the treasury is negative by the same amount', (await balanceOf(T)) === -10_000, await balanceOf(T))

  console.log('\n── transfer between accounts ──')
  await postTransfer({ reference: 'smoke:t-machine', kind: 'transfer', amount: 4_000, fromWalletId: O, toWalletId: M })
  await postTransfer({ reference: 'smoke:t-broker', kind: 'transfer', amount: 1_000, fromWalletId: O, toWalletId: B })
  check('the lead machine was funded', (await balanceOf(M)) === 4_000, await balanceOf(M))
  check('the broker was funded', (await balanceOf(B)) === 1_000, await balanceOf(B))
  check('operations paid for both', (await balanceOf(O)) === 5_000, await balanceOf(O))

  console.log('\n── a refusal leaves NO trace ──')
  const before = (await listPostings({ limit: 500 })).length
  const over = await postTransfer({
    reference: 'smoke:overdraw', kind: 'transfer', amount: 999_999, fromWalletId: B, toWalletId: M,
  })
  check('an overdraw is refused', over.ok === false, JSON.stringify(over))
  check('the broker balance is untouched', (await balanceOf(B)) === 1_000, await balanceOf(B))
  check('nothing was written to the ledger', (await listPostings({ limit: 500 })).length === before, before)

  console.log('\n── the same reference moves coin once ──')
  const first = await postTransfer({ reference: 'smoke:dup', kind: 'transfer', amount: 250, fromWalletId: O, toWalletId: B })
  const second = await postTransfer({ reference: 'smoke:dup', kind: 'transfer', amount: 250, fromWalletId: O, toWalletId: B })
  check('the first posted', first.ok === true && !('duplicate' in first && first.duplicate))
  check('the second is reported as a duplicate', second.ok === true && 'duplicate' in second && second.duplicate,
    JSON.stringify(second))
  check('the broker was credited exactly once', (await balanceOf(B)) === 1_250, await balanceOf(B))

  console.log('\n── concurrent transfers cannot double-spend ──')
  // Ten simultaneous 200-coin sends from a wallet holding 1,250. At most six
  // can succeed; a naive read-then-write lets all ten through.
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      postTransfer({ reference: `smoke:race-${i}`, kind: 'transfer', amount: 200, fromWalletId: B, toWalletId: M })),
  )
  const succeeded = results.filter((r) => r.ok).length
  const bal = await balanceOf(B)
  check('no more succeeded than the balance allowed', succeeded <= 6, `${succeeded} succeeded`)
  check('the balance never went negative', bal >= 0, bal)
  check('spent exactly what succeeded', bal === 1_250 - succeeded * 200, `${bal} after ${succeeded}`)

  console.log('\n── holds move coin without it leaving ──')
  await postTransfer({ reference: 'smoke:hold', kind: 'hold', amount: 500, fromWalletId: M, toWalletId: M })
  const held = (await listWallets()).find((w) => w.id === M)!
  check('held coin left the balance', held.held === 500, held.held)
  const pos = await getPosition()
  check('and shows as in-use, not lost', pos.inUse >= 500, JSON.stringify(pos))

  console.log('\n── the books balance, and the audit says so ──')
  const audit = await auditConservation()
  check('the ledger nets to zero', audit.ledgerNet === 0, audit.ledgerNet)
  check('no wallet has drifted from its postings', audit.drifted.length === 0, JSON.stringify(audit.drifted))
  check('the audit reports healthy', audit.healthy === true)

  console.log('\n── and the audit CATCHES a corrupted ledger ──')
  // Hand-write coin from nowhere — exactly what the old model did on every
  // allocation. If the audit cannot see this, it is decoration.
  await query(
    `INSERT INTO freehold_wallet_postings (transfer_id, reference, kind, wallet_id, direction, amount, memo)
     VALUES ('tr_smoke_bad', 'smoke:corrupt', 'issue', $1, 'credit', 777, 'invented')`, [B])
  const broken = await auditConservation()
  check('invented coin is detected', broken.ledgerNet === 777, broken.ledgerNet)
  check('the drift names the wallet', broken.drifted.some((d) => d.walletId === B), JSON.stringify(broken.drifted))
  check('and the audit reports unhealthy', broken.healthy === false)

  console.log('\n── cleanup ──')
  await query(`DELETE FROM freehold_wallet_postings WHERE reference LIKE 'smoke:%'`)
  await query(`DELETE FROM freehold_wallets WHERE id LIKE '%_smoke'`)
  ok('fixtures removed')

  console.log(failures === 0 ? '\n✅ the ledger holds against a real database.\n' : `\n❌ ${failures} failure(s).\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error('\nFATAL', e); process.exit(1) })
