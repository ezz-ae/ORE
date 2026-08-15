/**
 * The bank, on Postgres.
 *
 * Three layers, and each one only does its own job:
 *
 *   wallet.ts      a movement is balanced        (pure)
 *   wallet-db.ts   a movement is atomic and happens once
 *   bank.ts        a movement is ALLOWED         (pure)
 *   this file      a movement is recorded, with what backs it
 *
 * Nothing here writes to the ledger. Every movement goes through
 * `postTransfer`, which is still the only function in the system that touches
 * postings — so the conservation invariant holds by construction and this file
 * cannot break it however wrong it is.
 *
 * ── WHAT THIS FILE ADDS: THE THING BEHIND THE NUMBER ─────────────────────
 *
 * A ledger says AED 5,000 moved from here to there. It cannot say whether that
 * money was ever real. `freehold_cash_lots` is the parcel record — every Cash
 * in the system traces to one row saying which door it came through, who
 * opened that door, and whether a bank statement agrees:
 *
 *   · a DEPOSIT lot carries a transaction number and starts `claimed`. No coin
 *     exists yet. Clearing it is what issues the coin.
 *   · a MINT lot carries no reference, is `cleared` on arrival, and is the
 *     company printing money.
 *
 * ── A LOT IS A CHEQUE AND A CHEQUE IS NOT TORN IN HALF ───────────────────
 *
 * `moveFromBank` signs out a WHOLE lot. Partial moves were the obvious design
 * and they are wrong here: a half-moved parcel has one foot in the float — any
 * admin may burn that half and only the mover may burn the other — and then
 * "who may destroy this money" has two answers for one row. Splitting a lot
 * into two lots is a thing a future screen can do explicitly; a `move` that
 * silently does it is how the cheque model would rot.
 *
 * ── AND THE BURN RIGHT ENDS WHERE THE MONEY DOES ─────────────────────────
 *
 * Burning a cheque takes it out of the mover's OWN wallet. If they have already
 * sent it on, they no longer hold it, and the burn fails on insufficient funds —
 * which is the right answer and a readable one: you signed this out and passed
 * it along, so it is not yours to destroy any more. The alternative would be
 * reaching into whoever holds it now, and that is the exact operation this
 * whole system does not have.
 */
import { query, withTransaction, ensureOnce, type TxQuery } from '@/lib/db'
import {
  authorise, mayBurn, cashState, withdrawalReference, readUse, backing,
  type Actor, type ActivityState, type CashLot, type CashOrigin, type DepositState,
  type SpendKind, type SpendProof, type BankRefusal, type AccountUse, type Backing,
} from '@/lib/freehold/bank'
import { openWallet, postTransfer, listPostings } from '@/lib/freehold/wallet-db'
import { isValidAmount, type Coins } from '@/lib/freehold/wallet'
import { randomUUID } from 'node:crypto'

/** The one bank account. Cash that exists and has not been signed out lives here. */
export const BANK_WALLET_ID = 'w_bank'
const TREASURY_WALLET_ID = 'w_treasury'
const OPERATIONS_WALLET_ID = 'w_operations'

// ── Schema ───────────────────────────────────────────────────────────────────

async function ensure(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_cash_lots (
      id              text PRIMARY KEY,
      origin          text NOT NULL CHECK (origin IN ('deposit','mint')),
      created_by      text NOT NULL,
      transaction_ref text,
      deposit_state   text NOT NULL DEFAULT 'cleared'
                        CHECK (deposit_state IN ('claimed','cleared','rejected')),
      amount          bigint NOT NULL CHECK (amount > 0),
      remaining       bigint NOT NULL CHECK (remaining >= 0),
      moved_by        text,
      moved_at        timestamptz,
      closed_by       text CHECK (closed_by IN ('spent','burned')),
      note            text NOT NULL DEFAULT '',
      created_at      timestamptz NOT NULL DEFAULT now()
    )
  `)
  // A MINT MUST NEVER CARRY A REFERENCE. Without this a mint could be written
  // with a transaction number and would then read as real money in every
  // report — the one confusion the two-door model exists to prevent, and far
  // too important to leave to whichever screen happens to insert the row.
  await query(`
    ALTER TABLE freehold_cash_lots DROP CONSTRAINT IF EXISTS freehold_cash_lots_mint_unbacked
  `).catch(() => {})
  await query(`
    ALTER TABLE freehold_cash_lots ADD CONSTRAINT freehold_cash_lots_mint_unbacked
      CHECK (origin <> 'mint' OR transaction_ref IS NULL)
  `).catch(() => { /* already present */ })
  // …and a deposit must carry one, for the same reason in reverse.
  await query(`
    ALTER TABLE freehold_cash_lots ADD CONSTRAINT freehold_cash_lots_deposit_backed
      CHECK (origin <> 'deposit' OR transaction_ref IS NOT NULL)
  `).catch(() => { /* already present */ })

  await query(`CREATE INDEX IF NOT EXISTS freehold_cash_lots_state_idx
               ON freehold_cash_lots (deposit_state, remaining DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS freehold_cash_lots_mover_idx
               ON freehold_cash_lots (moved_by) WHERE moved_by IS NOT NULL`)
  // Two deposits claiming the same bank reference are one payment recorded
  // twice, and clearing both would issue the money twice.
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS freehold_cash_lots_txn_uidx
               ON freehold_cash_lots (transaction_ref)
               WHERE transaction_ref IS NOT NULL AND deposit_state <> 'rejected'`)

  await query(`
    CREATE TABLE IF NOT EXISTS freehold_withdrawals (
      id         text PRIMARY KEY,
      wallet_id  text NOT NULL,
      user_id    text NOT NULL,
      amount     bigint NOT NULL CHECK (amount > 0),
      kind       text NOT NULL,
      reference  text NOT NULL,
      image_url  text,
      note       text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS freehold_withdrawals_wallet_idx
               ON freehold_withdrawals (wallet_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS freehold_withdrawals_kind_idx
               ON freehold_withdrawals (kind, created_at DESC)`)
  // ADS ARE FILED UNDER THEIR CAMPAIGN, once. The settlement job runs on a
  // timer and a retried tick must not write a second withdrawal for spend it
  // already recorded.
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS freehold_withdrawals_ref_uidx
               ON freehold_withdrawals (kind, reference, created_at)`)
}

export const ensureBankSchema = () => ensureOnce('freehold_bank', ensure)

/** The house accounts. Opened on first touch so no screen is ever empty. */
export async function ensureBankWallets(): Promise<void> {
  await openWallet({ id: TREASURY_WALLET_ID, kind: 'treasury', label: 'Treasury' })
  await openWallet({ id: BANK_WALLET_ID, kind: 'bank', label: 'The Bank' })
  await openWallet({ id: OPERATIONS_WALLET_ID, kind: 'operations', label: 'Operations' })
}

/**
 * WHO A PERSON IS, for the ledger.
 *
 * The email, for everybody, and it lives HERE rather than in each route — the
 * whole point of the rule is that there is one key, and a second copy of it in
 * a handler somewhere is how the two drift apart.
 *
 * A broker session also carries `brokerId`. Using whichever happened to be
 * present would give one person two wallets depending on how they signed in,
 * and their balance would split in half with nothing looking wrong on either
 * row.
 */
export const personId = (u: { email: string }): string => u.email.trim().toLowerCase()

/** Everyone has a wallet. Opened the first time they look at it. */
export async function walletFor(userId: string, label: string): Promise<string> {
  const id = `w_u_${userId}`
  await openWallet({ id, kind: 'broker', ownerId: userId, label })
  return id
}

// ── Reads ────────────────────────────────────────────────────────────────────

const mapLot = (r: Record<string, unknown>): CashLot => ({
  id: String(r.id),
  origin: String(r.origin) as CashOrigin,
  createdBy: String(r.created_by),
  transactionRef: r.transaction_ref == null ? null : String(r.transaction_ref),
  deposit: String(r.deposit_state) as DepositState,
  amount: Number(r.amount ?? 0),
  remaining: Number(r.remaining ?? 0),
  movedBy: r.moved_by == null ? null : String(r.moved_by),
  closedBy: r.closed_by == null ? null : (String(r.closed_by) as 'spent' | 'burned'),
})

export interface LotRow extends CashLot {
  state: ReturnType<typeof cashState>
  note: string
  createdAt: string
  movedAt: string | null
}

export async function listLots(opts: { limit?: number } = {}): Promise<LotRow[]> {
  await ensureBankSchema()
  const rows = await query(
    `SELECT * FROM freehold_cash_lots ORDER BY created_at DESC LIMIT $1`,
    [Math.min(500, Math.max(1, opts.limit ?? 200))],
  )
  return rows.map((r) => {
    const lot = mapLot(r)
    return {
      ...lot,
      state: cashState(lot),
      note: String(r.note ?? ''),
      createdAt: String(r.created_at),
      movedAt: r.moved_at == null ? null : String(r.moved_at),
    }
  })
}

/**
 * How much of the float is real money and how much the company printed.
 *
 * Reads only lots that still exist as money. A burned or fully spent parcel was
 * real once and is not part of what is being held now — counting it would make
 * the backing figure grow forever and mean nothing.
 */
export async function readBacking(): Promise<Backing> {
  await ensureBankSchema()
  const rows = await query(`SELECT * FROM freehold_cash_lots WHERE remaining > 0 OR deposit_state = 'claimed'`)
  return backing(rows.map(mapLot))
}

// ── Money in: the two doors ──────────────────────────────────────────────────

export type BankResult =
  | { ok: true; lotId?: string; duplicate?: boolean }
  | { ok: false; refusal: BankRefusal | 'notEnough' | 'noSuchLot' | 'error' }

type LedgerRefusal = 'invalid_amount' | 'same_wallet' | 'insufficient_funds' | 'unknown_wallet'

/**
 * The ledger's refusals, said in the bank's words.
 *
 * Translated rather than unioned. The ledger has its own vocabulary because it
 * knows nothing about deposits or cheques, and letting both sets reach a screen
 * would mean two different sentences for "you cannot send that much" depending
 * on which layer noticed — and a user reading a refusal should never be able to
 * tell which of our modules answered.
 */
const fromLedger = (r: LedgerRefusal): BankResult =>
  ({ ok: false, refusal:
      r === 'insufficient_funds' ? 'notEnough'
    : r === 'same_wallet'        ? 'sameWallet'
    : r === 'unknown_wallet'     ? 'noSuchWallet'
    :                              'badAmount' })

/**
 * Record that real money arrived. ANYONE may do this.
 *
 * It creates a CLAIM, not Cash. Nothing is issued and no balance moves until an
 * admin has cleared it against a statement — see the header of bank.ts for why
 * that gate cannot be removed without handing everybody a printing press.
 */
export async function recordDeposit(input: {
  actor: Actor
  amount: Coins
  transactionRef: string
  note?: string
}): Promise<BankResult> {
  const check = authorise(input.actor, {
    action: 'deposit', amount: input.amount,
    fromWalletId: null, toWalletId: BANK_WALLET_ID,
    transactionRef: input.transactionRef,
  })
  if (!check.ok) return { ok: false, refusal: check.refusal }

  try {
    await ensureBankSchema()
    const id = `lot_${randomUUID()}`
    const rows = await query<{ id: string }>(
      `INSERT INTO freehold_cash_lots
         (id, origin, created_by, transaction_ref, deposit_state, amount, remaining, note)
       VALUES ($1, 'deposit', $2, $3, 'claimed', $4, 0, $5)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [id, input.actor.userId, input.transactionRef.trim(), input.amount, input.note ?? ''],
    )
    // The unique index on transaction_ref caught a payment already recorded.
    // That is a normal answer, not an error — somebody pressed the button twice.
    if (!rows[0]) return { ok: true, duplicate: true }
    return { ok: true, lotId: id }
  } catch { return { ok: false, refusal: 'error' } }
}

/**
 * An admin has seen the money on the statement. THIS is where the Cash exists.
 *
 * The issue and the state change are one transaction: a crash between them
 * would leave a cleared deposit whose money was never created, or coin with
 * nothing saying where it came from.
 */
export async function clearDeposit(input: {
  actor: Actor
  lotId: string
}): Promise<BankResult> {
  if (!input.actor.walletId && !isAdminActor(input.actor)) return { ok: false, refusal: 'notAdmin' }
  if (!isAdminActor(input.actor)) return { ok: false, refusal: 'notAdmin' }
  try {
    await ensureBankSchema()
    await ensureBankWallets()
    const lot = await getLot(input.lotId)
    if (!lot) return { ok: false, refusal: 'noSuchLot' }
    if (lot.deposit === 'cleared') return { ok: true, lotId: lot.id, duplicate: true }
    if (lot.deposit === 'rejected') return { ok: false, refusal: 'notCleared' }

    // Coin first. `postTransfer` is idempotent on its reference, so a retry
    // after a crash re-runs this whole function safely — and if the state
    // update below is what failed, the second attempt finds `duplicate` and
    // completes it rather than issuing twice.
    const posted = await postTransfer({
      reference: `deposit:${lot.id}`,
      kind: 'issue',
      amount: lot.amount,
      fromWalletId: TREASURY_WALLET_ID,
      toWalletId: BANK_WALLET_ID,
      memo: `Deposit cleared · ${lot.transactionRef ?? ''}`,
      actor: input.actor.userId,
    })
    if (!posted.ok) return fromLedger(posted.refusal)

    await query(
      `UPDATE freehold_cash_lots
       SET deposit_state = 'cleared', remaining = amount
       WHERE id = $1 AND deposit_state = 'claimed'`,
      [lot.id],
    )
    return { ok: true, lotId: lot.id }
  } catch { return { ok: false, refusal: 'error' } }
}

/** The money never arrived, or it was recorded wrongly. No coin was ever made,
 *  so there is nothing to unwind — which is exactly why claims exist. */
export async function rejectDeposit(input: {
  actor: Actor
  lotId: string
  reason?: string
}): Promise<BankResult> {
  if (!isAdminActor(input.actor)) return { ok: false, refusal: 'notAdmin' }
  try {
    await ensureBankSchema()
    const rows = await query<{ id: string }>(
      `UPDATE freehold_cash_lots
       SET deposit_state = 'rejected', note = CASE WHEN $2 = '' THEN note ELSE note || ' · ' || $2 END
       WHERE id = $1 AND deposit_state = 'claimed'
       RETURNING id`,
      [input.lotId, input.reason ?? ''],
    )
    return rows[0] ? { ok: true, lotId: rows[0].id } : { ok: false, refusal: 'noSuchLot' }
  } catch { return { ok: false, refusal: 'error' } }
}

/**
 * Cash with no cash in front of it.
 *
 * Deliberately has no `transactionRef` parameter. A mint that could carry one
 * would look like a deposit in every report, and the database refuses it too
 * (freehold_cash_lots_mint_unbacked) so no future caller can slip one in.
 */
export async function mintCash(input: {
  actor: Actor
  amount: Coins
  note?: string
}): Promise<BankResult> {
  const check = authorise(input.actor, {
    action: 'mint', amount: input.amount, fromWalletId: null, toWalletId: BANK_WALLET_ID,
  })
  if (!check.ok) return { ok: false, refusal: check.refusal }

  try {
    await ensureBankSchema()
    await ensureBankWallets()
    const id = `lot_${randomUUID()}`
    await query(
      `INSERT INTO freehold_cash_lots
         (id, origin, created_by, transaction_ref, deposit_state, amount, remaining, note)
       VALUES ($1, 'mint', $2, NULL, 'cleared', $3, $3, $4)`,
      [id, input.actor.userId, input.amount, input.note ?? ''],
    )
    const posted = await postTransfer({
      reference: `mint:${id}`,
      kind: 'issue',
      amount: input.amount,
      fromWalletId: TREASURY_WALLET_ID,
      toWalletId: BANK_WALLET_ID,
      memo: input.note ? `Minted · ${input.note}` : 'Minted',
      actor: input.actor.userId,
    })
    if (!posted.ok) {
      // The lot exists and the coin does not. Mark it rejected rather than
      // deleting it: a mint that failed is a thing that happened, and a bank
      // that quietly erases its own failures is not one anybody should use.
      await query(`UPDATE freehold_cash_lots SET deposit_state = 'rejected', remaining = 0 WHERE id = $1`, [id])
      return fromLedger(posted.refusal)
    }
    return { ok: true, lotId: id }
  } catch { return { ok: false, refusal: 'error' } }
}

// ── Signing Cash out of the bank ─────────────────────────────────────────────

/**
 * Move a WHOLE lot from the bank into the admin's own wallet.
 *
 * This is the act that turns float into a cheque and writes a name on it. It
 * moves the whole parcel — see the header on why half a cheque is not a thing
 * this model can represent.
 */
export async function moveFromBank(input: {
  actor: Actor
  lotId: string
}): Promise<BankResult> {
  try {
    await ensureBankSchema()
    await ensureBankWallets()
    const lot = await getLot(input.lotId)
    if (!lot) return { ok: false, refusal: 'noSuchLot' }
    if (lot.deposit !== 'cleared') return { ok: false, refusal: 'notCleared' }
    if (lot.movedBy) return { ok: true, lotId: lot.id, duplicate: true }
    if (!isValidAmount(lot.remaining)) return { ok: false, refusal: 'badAmount' }

    const check = authorise(input.actor, {
      action: 'move', amount: lot.remaining,
      fromWalletId: BANK_WALLET_ID, toWalletId: input.actor.walletId,
    })
    if (!check.ok) return { ok: false, refusal: check.refusal }

    const posted = await postTransfer({
      reference: `move:${lot.id}`,
      kind: 'transfer',
      amount: lot.remaining,
      fromWalletId: BANK_WALLET_ID,
      toWalletId: input.actor.walletId!,
      memo: 'Signed out of the bank',
      actor: input.actor.userId,
    })
    if (!posted.ok) return fromLedger(posted.refusal)

    // Stamped only after the money actually moved. The other order would name
    // an owner for a cheque that was never signed out.
    await query(
      `UPDATE freehold_cash_lots SET moved_by = $2, moved_at = now()
       WHERE id = $1 AND moved_by IS NULL`,
      [lot.id, input.actor.userId],
    )
    return { ok: true, lotId: lot.id }
  } catch { return { ok: false, refusal: 'error' } }
}

// ── Wallet to wallet ─────────────────────────────────────────────────────────

/** Any wallet to any wallet, out of your own pocket. */
export async function sendCash(input: {
  actor: Actor
  toWalletId: string
  amount: Coins
  memo?: string
  /** Supplied by the caller so a retried request posts once. */
  reference?: string
}): Promise<BankResult> {
  const check = authorise(input.actor, {
    action: 'send', amount: input.amount,
    fromWalletId: input.actor.walletId, toWalletId: input.toWalletId,
  })
  if (!check.ok) return { ok: false, refusal: check.refusal }

  try {
    await ensureBankSchema()
    const posted = await postTransfer({
      reference: input.reference ?? `send:${randomUUID()}`,
      kind: 'transfer',
      amount: input.amount,
      fromWalletId: input.actor.walletId!,
      toWalletId: input.toWalletId,
      memo: input.memo ?? '',
      actor: input.actor.userId,
    })
    return posted.ok
      ? { ok: true, duplicate: posted.duplicate }
      : fromLedger(posted.refusal)
  } catch { return { ok: false, refusal: 'error' } }
}

// ── Money out ────────────────────────────────────────────────────────────────

/**
 * Destroy Cash.
 *
 * Float comes out of the bank; a cheque comes out of the MOVER'S OWN WALLET,
 * which is what makes "the mover may burn it" survive the money travelling. If
 * they have sent it on they no longer hold it, the transfer fails on
 * insufficient funds, and that is the correct answer — reaching into whoever
 * holds it now is the one operation this system does not have.
 */
export async function burnCash(input: {
  actor: Actor
  lotId: string
  amount: Coins
}): Promise<BankResult> {
  try {
    await ensureBankSchema()
    await ensureBankWallets()
    const lot = await getLot(input.lotId)
    if (!lot) return { ok: false, refusal: 'noSuchLot' }

    const check = authorise(input.actor, {
      action: 'burn', amount: input.amount,
      fromWalletId: null, toWalletId: null, lot,
    })
    if (!check.ok) return { ok: false, refusal: check.refusal }

    const from = lot.movedBy ? input.actor.walletId : BANK_WALLET_ID
    if (!from) return { ok: false, refusal: 'noSuchWallet' }

    const posted = await postTransfer({
      reference: `burn:${lot.id}:${lot.amount - lot.remaining + input.amount}`,
      kind: 'burn',
      amount: input.amount,
      fromWalletId: from,
      toWalletId: TREASURY_WALLET_ID,
      memo: lot.movedBy ? 'Cheque burned' : 'Burned in the bank',
      actor: input.actor.userId,
    })
    if (!posted.ok) return fromLedger(posted.refusal)
    if (posted.duplicate) return { ok: true, lotId: lot.id, duplicate: true }

    await query(
      `UPDATE freehold_cash_lots
       SET remaining = GREATEST(0, remaining - $2),
           closed_by = CASE WHEN remaining - $2 <= 0 THEN 'burned' ELSE closed_by END
       WHERE id = $1`,
      [lot.id, input.amount],
    )
    return { ok: true, lotId: lot.id }
  } catch { return { ok: false, refusal: 'error' } }
}

/**
 * A withdrawal. Cash leaves the system and becomes a dirham on the debit side.
 *
 * The withdraw row and the posting are one transaction, because a spend with no
 * record of what it bought is the single failure a finance system exists to
 * prevent — and "the posting went through but the receipt did not" is exactly
 * that failure wearing a crash for a costume.
 */
export async function spendCash(input: {
  actor: Actor
  amount: Coins
  proof: SpendProof
  note?: string
  /** Supplied by the settlement job so a retried tick charges once. */
  reference?: string
}): Promise<BankResult> {
  const check = authorise(input.actor, {
    action: 'spend', amount: input.amount,
    fromWalletId: input.actor.walletId, toWalletId: OPERATIONS_WALLET_ID,
    spend: input.proof,
  })
  if (!check.ok) return { ok: false, refusal: check.refusal }

  try {
    await ensureBankSchema()
    await ensureBankWallets()
    const filed = withdrawalReference(input.proof)
    const posted = await postTransfer({
      reference: input.reference ?? `spend:${randomUUID()}`,
      kind: 'spend',
      amount: input.amount,
      fromWalletId: input.actor.walletId!,
      toWalletId: OPERATIONS_WALLET_ID,
      memo: `${input.proof.kind} · ${filed}`,
      actor: input.actor.userId,
    })
    if (!posted.ok) return fromLedger(posted.refusal)
    if (posted.duplicate) return { ok: true, duplicate: true }

    await query(
      `INSERT INTO freehold_withdrawals
         (id, wallet_id, user_id, amount, kind, reference, image_url, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [`wd_${randomUUID()}`, input.actor.walletId, input.actor.userId, input.amount,
       input.proof.kind, filed, input.proof.imageUrl ?? null, input.note ?? ''],
    )
    return { ok: true }
  } catch { return { ok: false, refusal: 'error' } }
}

// ── The withdraw record and the spend analysis ───────────────────────────────

export interface WithdrawalRow {
  id: string
  walletId: string
  userId: string
  userName: string | null
  amount: number
  kind: SpendKind
  reference: string
  imageUrl: string | null
  note: string
  at: string
}

export async function listWithdrawals(opts: { kind?: SpendKind; limit?: number } = {}): Promise<WithdrawalRow[]> {
  await ensureBankSchema()
  const rows = await query(
    `SELECT w.*, u.name AS user_name
       FROM freehold_withdrawals w
       LEFT JOIN users u ON u.id = w.user_id
      WHERE ($1::text IS NULL OR w.kind = $1)
      ORDER BY w.created_at DESC
      LIMIT $2`,
    [opts.kind ?? null, Math.min(500, Math.max(1, opts.limit ?? 100))],
  )
  return rows.map((r) => ({
    id: String(r.id),
    walletId: String(r.wallet_id),
    userId: String(r.user_id),
    userName: r.user_name == null ? null : String(r.user_name),
    amount: Number(r.amount ?? 0),
    kind: String(r.kind) as SpendKind,
    reference: String(r.reference ?? ''),
    imageUrl: r.image_url == null ? null : String(r.image_url),
    note: String(r.note ?? ''),
    at: String(r.created_at),
  }))
}

/**
 * Who was given money, and what they did with it.
 *
 * The finding is IDLE money, not overspending. Overspending announces itself —
 * a campaign runs, a balance drops, somebody notices. Money that was sent and
 * never touched is invisible until a quarter later when the pipeline is thin
 * and nobody can say why.
 */
export async function spendAnalysis(): Promise<AccountUse[]> {
  await ensureBankSchema()
  const rows = await query(
    `SELECT w.id, w.owner_id, w.label, w.balance,
            COALESCE(f.funded, 0)  AS funded,
            COALESCE(s.spent, 0)   AS spent,
            s.last_spend
       FROM freehold_wallets w
       LEFT JOIN (
         SELECT wallet_id, SUM(amount) AS funded
           FROM freehold_wallet_postings
          WHERE direction = 'credit' AND kind IN ('transfer','issue','earn','refund')
          GROUP BY wallet_id
       ) f ON f.wallet_id = w.id
       LEFT JOIN (
         SELECT wallet_id, SUM(amount) AS spent, MAX(created_at) AS last_spend
           FROM freehold_wallet_postings
          WHERE direction = 'debit' AND kind = 'spend'
          GROUP BY wallet_id
       ) s ON s.wallet_id = w.id
      WHERE w.kind = 'broker'
      ORDER BY w.label`,
  )
  const now = Date.now()
  return rows.map((r) => {
    const last = r.last_spend ? Date.parse(String(r.last_spend)) : NaN
    const base = {
      walletId: String(r.id),
      userId: r.owner_id == null ? null : String(r.owner_id),
      label: String(r.label ?? ''),
      fundedAed: Number(r.funded ?? 0),
      spentAed: Number(r.spent ?? 0),
      balanceAed: Number(r.balance ?? 0),
      // Never spent reads as null, not as a huge number of days. "Has not
      // spent in 20,000 days" is how a report gets laughed at and then ignored.
      daysSinceSpend: Number.isFinite(last) ? Math.floor((now - last) / 86_400_000) : null,
    }
    return { ...base, state: readUse(base) }
  })
}

/** Every movement, newest first — the bank log the whole system is read from. */
export async function bankLog(opts: { walletId?: string; limit?: number } = {}) {
  await ensureBankSchema()
  return listPostings({ walletId: opts.walletId, limit: opts.limit ?? 100 })
}

// ─── One wallet's activity, the way a wallet reads it ───────────────────────

export interface Activity {
  /** The reference, which is this system's transaction hash. */
  id: string
  kind: string
  direction: 'in' | 'out'
  amount: number
  /** The other side, by name where we have one. Null for the house accounts. */
  counterparty: string | null
  counterpartyAccount: string | null
  memo: string
  state: ActivityState
  at: string
}

/**
 * What this wallet has done, newest first.
 *
 * ── WHY THE OTHER SIDE IS JOINED HERE AND NOT ON THE SCREEN ──────────────
 *
 * A posting knows its own wallet and nothing else; the counterparty is the
 * OTHER posting sharing its transfer_id. A screen that rendered the raw row
 * would show "Payment · −400" with no answer to "to whom", which is the first
 * question anybody asks of a payment. Resolving it here means one query rather
 * than one per row, and it means the answer is the same everywhere.
 */
export async function walletActivity(
  walletId: string,
  userId: string,
  limit = 60,
): Promise<Activity[]> {
  await ensureBankSchema()

  const rows = await query(
    `SELECT p.reference, p.kind, p.direction, p.amount, p.memo, p.created_at::text AS at,
            o.label AS other_label, o.account_no AS other_account, o.kind AS other_kind
       FROM freehold_wallet_postings p
       LEFT JOIN freehold_wallet_postings q
              ON q.transfer_id = p.transfer_id AND q.wallet_id <> p.wallet_id
       LEFT JOIN freehold_wallets o ON o.id = q.wallet_id
      WHERE p.wallet_id = $1
      ORDER BY p.id DESC
      LIMIT $2`,
    [walletId, Math.min(200, Math.max(1, limit))],
  )

  const moves: Activity[] = rows.map((r) => ({
    id: String(r.reference),
    kind: String(r.kind),
    direction: r.direction === 'credit' ? 'in' : 'out',
    amount: Number(r.amount ?? 0),
    // The treasury and the bank are plumbing, not people. Naming them on a
    // personal wallet row would answer the question with a machine.
    counterparty: r.other_kind === 'treasury' || r.other_kind === 'bank'
      ? null : (r.other_label == null ? null : String(r.other_label)),
    counterpartyAccount: r.other_account == null ? null : String(r.other_account),
    memo: String(r.memo ?? ''),
    state: 'confirmed',
    at: String(r.at),
  }))

  // The claims this person has recorded and nobody has matched yet. They carry
  // no posting — there is no money — so they are joined in here rather than
  // read from the ledger, and they sort in by time like anything else.
  const claims = await query(
    `SELECT id, amount, transaction_ref, deposit_state, created_at::text AS at
       FROM freehold_cash_lots
      WHERE origin = 'deposit' AND created_by = $1 AND deposit_state <> 'cleared'
      ORDER BY created_at DESC LIMIT 20`,
    [userId],
  )
  for (const c of claims) {
    moves.push({
      id: String(c.transaction_ref ?? c.id),
      kind: 'deposit',
      direction: 'in',
      amount: Number(c.amount ?? 0),
      counterparty: null,
      counterpartyAccount: null,
      memo: '',
      state: String(c.deposit_state) === 'rejected' ? 'rejected' : 'pending',
      at: String(c.at),
    })
  }

  return moves.sort((a, b) => (a.at < b.at ? 1 : -1))
}

// ── Small shared pieces ──────────────────────────────────────────────────────

async function getLot(id: string): Promise<CashLot | null> {
  const rows = await query(`SELECT * FROM freehold_cash_lots WHERE id = $1`, [id])
  return rows[0] ? mapLot(rows[0]) : null
}

/** The same test bank.ts uses, so authority never has two definitions. */
function isAdminActor(actor: Actor): boolean {
  const probe = authorise(actor, {
    action: 'mint', amount: 1, fromWalletId: null, toWalletId: BANK_WALLET_ID,
  })
  return probe.ok
}

/** Re-exported so a screen can ask about a burn without importing two modules. */
export { mayBurn, cashState }
export type { CashLot, TxQuery }
