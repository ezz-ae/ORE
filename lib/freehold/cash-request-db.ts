/**
 * Cash requests, on Postgres.
 *
 * The rules live in lib/freehold/cash-request.ts and this file only stores and
 * settles them. Approving is the transfer: the row is marked approved ONLY
 * after `postTransfer` returns ok, and it carries that transfer's id and the
 * approver's signature. A request that says "approved" while no Cash moved is
 * the shape of lie this ledger exists to make impossible.
 *
 * ── WHY THIS IS NOT `freehold_wallet_requests` ───────────────────────────
 *
 * That table exists, is used by the older finance screen, and models a
 * different thing: one open-ended ask that an operator settles out of whichever
 * wallet they happen to pass in. It has no record of WHO WAS ASKED, so it
 * cannot express "wallet to wallet", it cannot be routed to the right person's
 * queue, and there is no answer to "why is this in front of me". Adding the
 * column would leave every existing row with a null in the field the whole
 * model now turns on. A new table starts every row complete.
 */
import { query, ensureOnce } from '@/lib/db'
import { randomUUID } from 'node:crypto'
import { postTransfer, listWallets } from '@/lib/freehold/wallet-db'
import { isValidAmount, type Coins, type Wallet } from '@/lib/freehold/wallet'
import { signMovement } from '@/lib/freehold/signature-db'
import {
  mayRequest, mayDecide, mayCancel,
  type CashRequest, type RequestActor, type RequestRefusal, type RequestState,
} from '@/lib/freehold/cash-request'

async function ensure(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_cash_requests (
      id             text PRIMARY KEY,
      asked_of       text NOT NULL,
      beneficiary    text NOT NULL,
      amount         bigint NOT NULL CHECK (amount > 0),
      reason         text NOT NULL DEFAULT '',
      state          text NOT NULL DEFAULT 'pending'
                       CHECK (state IN ('pending','approved','declined','cancelled')),
      requested_by   text NOT NULL,
      decided_by     text,
      decided_at     timestamptz,
      transfer_id    text,
      signature_ref  text,
      created_at     timestamptz NOT NULL DEFAULT now()
    )
  `)
  // A wallet is never asked for money by itself. Enforced here as well as in
  // the pure rule, because a row that violates it would sit in somebody's
  // approval queue forever with no way to act on it.
  await query(`
    ALTER TABLE freehold_cash_requests ADD CONSTRAINT freehold_cash_requests_not_self
      CHECK (asked_of <> beneficiary)
  `).catch(() => { /* already present */ })
  await query(`CREATE INDEX IF NOT EXISTS freehold_cash_requests_asked_idx
               ON freehold_cash_requests (asked_of, state, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS freehold_cash_requests_by_idx
               ON freehold_cash_requests (requested_by, created_at DESC)`)
}

export const ensureCashRequestSchema = () => ensureOnce('freehold_cash_requests', ensure)

const mapRow = (r: Record<string, unknown>): CashRequest => ({
  id: String(r.id),
  askedOfWalletId: String(r.asked_of),
  beneficiaryWalletId: String(r.beneficiary),
  amount: Number(r.amount ?? 0),
  reason: String(r.reason ?? ''),
  state: String(r.state ?? 'pending') as RequestState,
  requestedBy: String(r.requested_by),
  decidedBy: r.decided_by == null ? null : String(r.decided_by),
  decidedAt: r.decided_at == null ? null : String(r.decided_at),
  transferId: r.transfer_id == null ? null : String(r.transfer_id),
  signatureId: r.signature_ref == null ? null : String(r.signature_ref),
  createdAt: String(r.created_at),
})

export type RequestResult =
  | { ok: true; id: string; state: RequestState; duplicate?: boolean }
  | { ok: false; refusal: RequestRefusal | 'error' | string }

/**
 * Every request either side of a person, newest first.
 *
 * Reads BOTH directions in one query rather than two, because the screen shows
 * them together and two reads can return two different moments — a request
 * that was approved between them would appear in neither list or in both.
 */
export async function listRequestsFor(actor: RequestActor, limit = 60): Promise<CashRequest[]> {
  await ensureCashRequestSchema()
  const rows = await query(
    `SELECT * FROM freehold_cash_requests
      WHERE requested_by = $1 OR asked_of = $2
      ORDER BY (state = 'pending') DESC, created_at DESC
      LIMIT $3`,
    [actor.userId, actor.walletId ?? '', Math.min(200, Math.max(1, limit))],
  )
  return rows.map(mapRow)
}

/** Everything asked of the bank. The bank's own queue, for admins. */
export async function listRequestsOfBank(bankWalletId: string, limit = 60): Promise<CashRequest[]> {
  await ensureCashRequestSchema()
  const rows = await query(
    `SELECT * FROM freehold_cash_requests
      WHERE asked_of = $1
      ORDER BY (state = 'pending') DESC, created_at DESC
      LIMIT $2`,
    [bankWalletId, Math.min(200, Math.max(1, limit))],
  )
  return rows.map(mapRow)
}

export async function getRequest(id: string): Promise<CashRequest | null> {
  await ensureCashRequestSchema()
  const rows = await query(`SELECT * FROM freehold_cash_requests WHERE id = $1`, [id])
  return rows[0] ? mapRow(rows[0]) : null
}

/** Ask somebody — or the bank — for Cash. Moves nothing. */
export async function askForCash(input: {
  actor: RequestActor
  askedOfWalletId: string
  amount: Coins
  reason: string
}): Promise<RequestResult> {
  const check = mayRequest(
    input.actor,
    {
      askedOfWalletId: input.askedOfWalletId,
      beneficiaryWalletId: input.actor.walletId ?? '',
      amount: input.amount,
    },
    isValidAmount,
  )
  if (!check.ok) return { ok: false, refusal: check.refusal }

  try {
    await ensureCashRequestSchema()
    const id = `cr_${randomUUID()}`
    await query(
      `INSERT INTO freehold_cash_requests (id, asked_of, beneficiary, amount, reason, requested_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, input.askedOfWalletId, input.actor.walletId, input.amount, input.reason.slice(0, 300), input.actor.userId],
    )
    return { ok: true, id, state: 'pending' }
  } catch { return { ok: false, refusal: 'error' } }
}

/** Withdraw your own pending request. */
export async function cancelRequest(input: { actor: RequestActor; id: string }): Promise<RequestResult> {
  const req = await getRequest(input.id)
  if (!req) return { ok: false, refusal: 'noSuchRequest' }
  const check = mayCancel(input.actor, req)
  if (!check.ok) return { ok: false, refusal: check.refusal }
  await query(
    `UPDATE freehold_cash_requests SET state='cancelled', decided_by=$2, decided_at=now()
      WHERE id=$1 AND state='pending'`,
    [req.id, input.actor.userId],
  )
  return { ok: true, id: req.id, state: 'cancelled' }
}

/**
 * Answer a request.
 *
 * Approving posts the transfer and signs it in the same call. The reference is
 * derived from the request id, so a double-clicked Approve pays once — and the
 * signature, keyed on the same reference, is written once with it.
 */
export async function decideCashRequest(input: {
  actor: RequestActor
  /** The approver's name, as it will read on the signature. */
  actorName: string
  id: string
  approve: boolean
  bankWalletId: string
  /** Epoch ms. Passed in so the signed moment is the caller's, not two clocks'. */
  atMs: number
}): Promise<RequestResult> {
  await ensureCashRequestSchema()
  const req = await getRequest(input.id)
  if (!req) return { ok: false, refusal: 'noSuchRequest' }

  const check = mayDecide(input.actor, req, input.bankWalletId)
  if (!check.ok) return { ok: false, refusal: check.refusal }

  if (!input.approve) {
    await query(
      `UPDATE freehold_cash_requests SET state='declined', decided_by=$2, decided_at=now()
        WHERE id=$1 AND state='pending'`,
      [req.id, input.actor.userId],
    )
    return { ok: true, id: req.id, state: 'declined' }
  }

  const wallets = await listWallets()
  const to = wallets.find((w: Wallet) => w.id === req.beneficiaryWalletId)
  if (!to) return { ok: false, refusal: 'noBeneficiary' }

  const reference = `request:${req.id}`
  const posted = await postTransfer({
    reference,
    kind: 'transfer',
    amount: req.amount,
    fromWalletId: req.askedOfWalletId,
    toWalletId: req.beneficiaryWalletId,
    memo: req.reason || 'Approved request',
    actor: input.actor.userId,
  })
  if (!posted.ok) return { ok: false, refusal: posted.refusal }

  // Signed with the money, not after somebody remembers to. The beneficiary's
  // name and account number are frozen here as they read at this moment — a
  // wallet can be relabelled, and a receipt that re-resolves the name is a
  // receipt that changes what it says about a settled payment.
  await signMovement(reference, {
    action: 'approveRequest',
    amount: req.amount,
    fromWalletId: req.askedOfWalletId,
    beneficiary: { walletId: to.id, label: to.label, accountNo: to.accountNo },
    signerId: input.actor.userId,
    signerName: input.actorName,
    atMs: input.atMs,
  })

  await query(
    `UPDATE freehold_cash_requests
        SET state='approved', decided_by=$2, decided_at=now(), transfer_id=$3, signature_ref=$4
      WHERE id=$1 AND state='pending'`,
    [req.id, input.actor.userId, posted.transferId, reference],
  )
  return { ok: true, id: req.id, state: 'approved', duplicate: posted.duplicate }
}
