/**
 * The Ads Coin ledger, on Postgres.
 *
 * The pure half (lib/freehold/wallet.ts) guarantees a transfer is balanced.
 * This half guarantees it is atomic and happens once. Those are different
 * problems and both have to hold, or the ledger is only balanced in theory:
 *
 *   · Both postings and both balance updates are ONE transaction. A crash
 *     between them would be exactly the "money from nowhere" the design
 *     exists to prevent.
 *   · Wallet rows are locked in a fixed order (by id) before either is
 *     touched. Two simultaneous transfers between the same pair, taken in
 *     opposite orders, deadlock otherwise — and the loser is a lost transfer.
 *   · `reference` is unique. A retried request, a double-clicked button and a
 *     replayed webhook all post once, and the second attempt is told the
 *     movement already happened rather than making another.
 *
 * Balances are a CACHE. `postings` is the truth, `recomputeBalances` rebuilds
 * from it, and `auditConservation` compares the two — so a drift is something
 * the system can find and report rather than something a person notices in a
 * screenshot months later.
 */

import { query, withTransaction, ensureOnce, type TxQuery } from '@/lib/db'
import {
  buildTransfer, canSend, conservationError, formatAccountNo, isValidAmount,
  TransferError, treasuryPosition,
  type Coins, type PostingKind, type TreasuryPosition, type Wallet, type WalletKind,
} from './wallet'

// ── Schema ────────────────────────────────────────────────────────────────────

async function ensure(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_wallets (
      id          text PRIMARY KEY,
      account_no  text NOT NULL,
      kind        text NOT NULL,
      owner_id    text,
      label       text NOT NULL DEFAULT '',
      balance     bigint NOT NULL DEFAULT 0,
      held        bigint NOT NULL DEFAULT 0,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `)
  // An account number is what someone types to send money. Two wallets sharing
  // one is the worst bug this system could have.
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS freehold_wallets_account_uidx ON freehold_wallets (account_no)`)
  // One wallet per broker — a second would split their balance in half without
  // anything being wrong on either row.
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS freehold_wallets_owner_uidx
               ON freehold_wallets (kind, owner_id) WHERE owner_id IS NOT NULL`)

  await query(`
    CREATE TABLE IF NOT EXISTS freehold_wallet_postings (
      id          bigserial PRIMARY KEY,
      transfer_id text NOT NULL,
      reference   text NOT NULL,
      kind        text NOT NULL,
      wallet_id   text NOT NULL,
      direction   text NOT NULL CHECK (direction IN ('debit','credit')),
      amount      bigint NOT NULL CHECK (amount > 0),
      memo        text NOT NULL DEFAULT '',
      actor       text,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `)
  // The idempotency key. One reference is one movement, forever.
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS freehold_postings_ref_uidx
               ON freehold_wallet_postings (reference, wallet_id, direction)`)
  await query(`CREATE INDEX IF NOT EXISTS freehold_postings_wallet_idx
               ON freehold_wallet_postings (wallet_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS freehold_postings_transfer_idx
               ON freehold_wallet_postings (transfer_id)`)
}

export const ensureWalletSchema = () => ensureOnce('freehold_wallets', ensure)

// ── Reads ─────────────────────────────────────────────────────────────────────

const mapWallet = (r: Record<string, unknown>): Wallet => ({
  id: String(r.id),
  accountNo: String(r.account_no),
  kind: String(r.kind) as WalletKind,
  ownerId: r.owner_id == null ? null : String(r.owner_id),
  label: String(r.label ?? ''),
  balance: Number(r.balance ?? 0),
  held: Number(r.held ?? 0),
})

export async function listWallets(): Promise<Wallet[]> {
  await ensureWalletSchema()
  const rows = await query(`SELECT * FROM freehold_wallets ORDER BY kind, label`)
  return rows.map(mapWallet)
}

export async function getWalletByAccountNo(accountNo: string): Promise<Wallet | null> {
  await ensureWalletSchema()
  const rows = await query(`SELECT * FROM freehold_wallets WHERE account_no = $1`, [accountNo.trim().toUpperCase()])
  return rows[0] ? mapWallet(rows[0]) : null
}

export async function getPosition(): Promise<TreasuryPosition> {
  return treasuryPosition(await listWallets())
}

export interface LedgerRow {
  transferId: string
  reference: string
  kind: PostingKind
  walletId: string
  direction: 'debit' | 'credit'
  amount: Coins
  memo: string
  actor: string | null
  createdAt: string
}

export async function listPostings(opts: { walletId?: string; limit?: number } = {}): Promise<LedgerRow[]> {
  await ensureWalletSchema()
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500)
  const rows = await query(
    `SELECT transfer_id, reference, kind, wallet_id, direction, amount, memo, actor, created_at::text
       FROM freehold_wallet_postings
      ${opts.walletId ? 'WHERE wallet_id = $1' : ''}
      ORDER BY id DESC LIMIT ${limit}`,
    opts.walletId ? [opts.walletId] : [],
  )
  return rows.map((r) => ({
    transferId: String(r.transfer_id),
    reference: String(r.reference),
    kind: String(r.kind) as PostingKind,
    walletId: String(r.wallet_id),
    direction: r.direction === 'credit' ? 'credit' : 'debit',
    amount: Number(r.amount),
    memo: String(r.memo ?? ''),
    actor: r.actor == null ? null : String(r.actor),
    createdAt: String(r.created_at),
  }))
}

// ── Opening a wallet ──────────────────────────────────────────────────────────

/**
 * Get or open a wallet. Serial numbers come from a sequence-like max so two
 * wallets can never be handed the same account number.
 */
export async function openWallet(input: {
  id: string
  kind: WalletKind
  ownerId?: string | null
  label: string
}): Promise<Wallet> {
  await ensureWalletSchema()
  const existing = await query(`SELECT * FROM freehold_wallets WHERE id = $1`, [input.id])
  if (existing[0]) return mapWallet(existing[0])

  return withTransaction(async (q) => {
    // Serialise account-number allocation per kind with an advisory lock.
    //
    // NOT `SELECT MAX(...) FOR UPDATE`: row locks are illegal alongside an
    // aggregate, and the rejected statement poisons the whole transaction — so
    // a `.catch()` fallback around it cannot work either, every later command
    // in the block fails with 25P02. The lock is transaction-scoped, so it is
    // released on commit or rollback without any cleanup path to forget.
    await q(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`wallet-serial:${input.kind}`])
    const seq = await q<{ next: string }>(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(account_no FROM 7 FOR 6) AS int)), 0) + 1 AS next
         FROM freehold_wallets WHERE kind = $1`,
      [input.kind],
    )
    const next = Number(seq[0]?.next ?? 1)

    const rows = await q(
      `INSERT INTO freehold_wallets (id, account_no, kind, owner_id, label)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label
       RETURNING *`,
      [input.id, formatAccountNo(input.kind, next), input.kind, input.ownerId ?? null, input.label],
    )
    return mapWallet(rows[0])
  })
}

// ── The one write path ────────────────────────────────────────────────────────

export type PostResult =
  | { ok: true; transferId: string; duplicate: boolean }
  | { ok: false; refusal: 'invalid_amount' | 'same_wallet' | 'insufficient_funds' | 'unknown_wallet' }

/**
 * Move coin. The ONLY function in the system that writes to the ledger.
 *
 * Everything else — issuing, allocating to the Lead Machine, a broker's spend,
 * a refund — is this with different wallets and a different `kind`, which is
 * what makes the invariant hold by construction rather than by discipline.
 */
export async function postTransfer(input: {
  reference: string
  kind: PostingKind
  amount: Coins
  fromWalletId: string
  toWalletId: string
  memo?: string
  actor?: string | null
}): Promise<PostResult> {
  await ensureWalletSchema()

  let transfer: ReturnType<typeof buildTransfer>
  try {
    transfer = buildTransfer(input)
  } catch (e) {
    // buildTransfer refuses invalid amounts and self-sends. Surface which,
    // rather than a generic failure — "you cannot send 0 coins" and "you
    // cannot send to yourself" need different fixes from whoever hit them.
    const refusal = e instanceof TransferError ? e.refusal : 'invalid_amount'
    return { ok: false, refusal: refusal === 'same_wallet' ? 'same_wallet' : 'invalid_amount' }
  }

  return withTransaction(async (q: TxQuery) => {
    // Already posted? Answer yes without doing it again.
    const seen = await q<{ transfer_id: string }>(
      `SELECT transfer_id FROM freehold_wallet_postings WHERE reference = $1 LIMIT 1`,
      [input.reference],
    )
    if (seen[0]) return { ok: true, transferId: seen[0].transfer_id, duplicate: true }

    // Lock BOTH wallets, always in id order. Two transfers between the same
    // pair taken in opposite orders would otherwise deadlock.
    const ids = [...new Set([input.fromWalletId, input.toWalletId])].sort()
    const locked = await q(
      `SELECT * FROM freehold_wallets WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE`,
      [ids],
    )
    if (locked.length !== ids.length) return { ok: false, refusal: 'unknown_wallet' }

    const byId = new Map(locked.map((r) => [String(r.id), mapWallet(r)]))
    const from = byId.get(input.fromWalletId)!

    // A hold moves balance → held inside one wallet; everything else moves
    // between two. Both still post two rows, so the ledger stays balanced.
    if (input.kind === 'hold') {
      if (from.balance < input.amount) return { ok: false, refusal: 'insufficient_funds' }
      await q(`UPDATE freehold_wallets SET balance = balance - $2, held = held + $2 WHERE id = $1`,
        [from.id, input.amount])
    } else if (input.kind === 'release') {
      if (from.held < input.amount) return { ok: false, refusal: 'insufficient_funds' }
      await q(`UPDATE freehold_wallets SET held = held - $2, balance = balance + $2 WHERE id = $1`,
        [from.id, input.amount])
    } else {
      if (!canSend(from, input.amount)) return { ok: false, refusal: 'insufficient_funds' }
      await q(`UPDATE freehold_wallets SET balance = balance - $2 WHERE id = $1`, [from.id, input.amount])
      await q(`UPDATE freehold_wallets SET balance = balance + $2 WHERE id = $1`, [input.toWalletId, input.amount])
    }

    const transferId = `tr_${input.reference}`
    for (const p of transfer.postings) {
      await q(
        `INSERT INTO freehold_wallet_postings
           (transfer_id, reference, kind, wallet_id, direction, amount, memo, actor)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [transferId, input.reference, input.kind, p.walletId, p.direction, p.amount,
         input.memo ?? '', input.actor ?? null],
      )
    }
    return { ok: true, transferId, duplicate: false }
  })
}

// ── The audit ─────────────────────────────────────────────────────────────────

export interface ConservationAudit {
  /** Non-zero means coin was created or destroyed outside a transfer. */
  ledgerNet: number
  /** Wallets whose cached balance disagrees with their postings. */
  drifted: { walletId: string; stored: Coins; fromLedger: Coins }[]
  healthy: boolean
}

/**
 * Check the books against themselves.
 *
 * Two independent questions: does the ledger balance, and does each cached
 * balance match its own postings. A dashboard that reports a total without
 * ever checking it is the thing this replaces.
 */
export async function auditConservation(): Promise<ConservationAudit> {
  await ensureWalletSchema()
  const rows = await query<{ wallet_id: string; direction: string; amount: string }>(
    `SELECT wallet_id, direction, SUM(amount)::text AS amount
       FROM freehold_wallet_postings GROUP BY wallet_id, direction`,
  )
  const postings = rows.map((r) => ({
    walletId: r.wallet_id,
    direction: r.direction === 'credit' ? ('credit' as const) : ('debit' as const),
    amount: Number(r.amount),
  }))
  const ledgerNet = conservationError(postings)

  const fromLedger = new Map<string, number>()
  for (const p of postings) {
    fromLedger.set(p.walletId, (fromLedger.get(p.walletId) ?? 0) + (p.direction === 'credit' ? p.amount : -p.amount))
  }

  const wallets = await listWallets()
  const drifted = wallets
    // held coin left `balance` without leaving the wallet, so the ledger's view
    // of the wallet is balance + held.
    .map((w) => ({ walletId: w.id, stored: w.balance + w.held, fromLedger: fromLedger.get(w.id) ?? 0 }))
    .filter((d) => d.stored !== d.fromLedger)

  return { ledgerNet, drifted, healthy: ledgerNet === 0 && drifted.length === 0 }
}

/** Amount validation, re-exported so callers need one import. */
export { isValidAmount }
