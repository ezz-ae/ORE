/**
 * Paying a broker out of a deal, and remembering when the money arrived.
 *
 * The rules are pure and live in deal-payout.ts. This is the record of what was
 * received and when — the dates the wallet was missing — and the movement that
 * puts a broker's share in their own hands.
 *
 * ── COMMISSION IS DEPOSITED, NOT MINTED ──────────────────────────────────
 *
 * A payout is real money: the developer paid the agency, and the broker's share
 * of it is theirs. So it enters the bank as a DEPOSIT carrying the payment's
 * own reference, and it is cleared on arrival because the deal record IS the
 * evidence — there is a payment row, an amount and a date, which is exactly
 * what an admin clearing a bank claim would be checking against.
 *
 * Minting it instead would have been one line shorter and would have told the
 * bank screen that the company had printed money it had in fact been paid. The
 * whole reason `backing()` separates the two is so that figure means something.
 */
import { query, ensureOnce } from '@/lib/db'
import { owedNow, payoutReference, type PayoutBasis, type CommissionPayment } from '@/lib/freehold/deal-payout'
import { walletFor, ensureBankWallets, BANK_WALLET_ID } from '@/lib/freehold/bank-db'
import { postTransfer } from '@/lib/freehold/wallet-db'
import { randomUUID } from 'node:crypto'

async function ensure(): Promise<void> {
  // WHEN THE MONEY ARRIVED. The deal row carried a running total and no dates,
  // so a broker could see that AED 40,000 was outstanding and not when any of
  // it was due — the only part of it they can plan around.
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_deal_payments (
      id          text PRIMARY KEY,
      deal_id     text NOT NULL,
      amount_aed  numeric NOT NULL,
      received_at timestamptz NOT NULL DEFAULT now(),
      reference   text NOT NULL DEFAULT '',
      note        text NOT NULL DEFAULT '',
      created_by  text,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS freehold_deal_payments_deal_idx
               ON freehold_deal_payments (deal_id, received_at DESC)`)

  // What has actually reached each broker for each deal — the high-water mark.
  // One row per deal, so the mark cannot be double-counted across payments.
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_deal_payouts (
      deal_id    text PRIMARY KEY,
      broker_id  text NOT NULL,
      wallet_id  text NOT NULL,
      paid_aed   bigint NOT NULL DEFAULT 0 CHECK (paid_aed >= 0),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS freehold_deal_payouts_broker_idx
               ON freehold_deal_payouts (broker_id)`)
}

export const ensurePayoutSchema = () => ensureOnce('freehold_deal_payouts', ensure)

/** Record that commission arrived, with its date. Returns the new total. */
export async function recordCommissionPayment(input: {
  dealId: string
  amountAed: number
  receivedAt?: string
  reference?: string
  note?: string
  by?: string
}): Promise<number> {
  await ensurePayoutSchema()
  await query(
    `INSERT INTO freehold_deal_payments
       (id, deal_id, amount_aed, received_at, reference, note, created_by)
     VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()), $5, $6, $7)`,
    [`dp_${randomUUID()}`, input.dealId, input.amountAed, input.receivedAt ?? null,
     input.reference ?? '', input.note ?? '', input.by ?? null],
  )
  const rows = await query<{ total: string }>(
    `SELECT COALESCE(SUM(amount_aed), 0) AS total FROM freehold_deal_payments WHERE deal_id = $1`,
    [input.dealId],
  )
  return Number(rows[0]?.total ?? 0)
}

export interface PayoutOutcome {
  ok: boolean
  movedAed: number
  markAed: number
  state: string
  reason?: string
}

/**
 * Pay the broker whatever the receipts now entitle them to.
 *
 * Two movements, both idempotent on a reference derived from the MARK: the
 * commission enters the bank as a cleared deposit, and the broker's share is
 * signed out to their wallet. A crash between them is repaired by running
 * again — the deposit is already recorded and refuses to duplicate, and the
 * transfer completes.
 */
export async function payoutDeal(input: {
  dealId: string
  dealName: string
  brokerId: string
  basis: Omit<PayoutBasis, 'paidOutAed'>
}): Promise<PayoutOutcome> {
  try {
    await ensurePayoutSchema()
    await ensureBankWallets()

    const prior = await query<{ paid_aed: string }>(
      `SELECT paid_aed FROM freehold_deal_payouts WHERE deal_id = $1`, [input.dealId],
    )
    const paidOutAed = Number(prior[0]?.paid_aed ?? 0)
    const plan = owedNow({ ...input.basis, paidOutAed })

    if (plan.moveAed <= 0) {
      return { ok: true, movedAed: 0, markAed: plan.markAed, state: plan.state }
    }

    const walletId = await walletFor(input.brokerId, input.brokerId)
    const ref = payoutReference(input.dealId, plan.markAed)

    // The commission arriving. A DEPOSIT, not a mint — the company was paid
    // this money and the bank's backing figure has to say so.
    const lotId = `lot_${input.dealId}_${plan.markAed}`
    await query(
      `INSERT INTO freehold_cash_lots
         (id, origin, created_by, transaction_ref, deposit_state, amount, remaining, note)
       VALUES ($1, 'deposit', $2, $3, 'cleared', $4, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [lotId, input.brokerId, ref, plan.moveAed, `Commission · ${input.dealName}`],
    )
    const issued = await postTransfer({
      reference: `${ref}:issue`,
      kind: 'issue',
      amount: plan.moveAed,
      fromWalletId: 'w_treasury',
      toWalletId: BANK_WALLET_ID,
      memo: `Commission received · ${input.dealName}`,
      actor: input.brokerId,
    })
    if (!issued.ok) return { ok: false, movedAed: 0, markAed: paidOutAed, state: plan.state, reason: issued.refusal }

    // …and the broker's share leaving for their wallet.
    const paid = await postTransfer({
      reference: ref,
      kind: 'earn',
      amount: plan.moveAed,
      fromWalletId: BANK_WALLET_ID,
      toWalletId: walletId,
      memo: `Commission · ${input.dealName}`,
      actor: input.brokerId,
    })
    if (!paid.ok) return { ok: false, movedAed: 0, markAed: paidOutAed, state: plan.state, reason: paid.refusal }

    // The mark moves LAST and only upward. GREATEST rather than assignment so a
    // slow concurrent run cannot rewind it and pay the same share twice.
    await query(
      `INSERT INTO freehold_deal_payouts (deal_id, broker_id, wallet_id, paid_aed, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (deal_id) DO UPDATE SET
         paid_aed = GREATEST(freehold_deal_payouts.paid_aed, EXCLUDED.paid_aed),
         updated_at = now()`,
      [input.dealId, input.brokerId, walletId, plan.markAed],
    )

    return { ok: true, movedAed: plan.moveAed, markAed: plan.markAed, state: plan.state }
  } catch (err) {
    return {
      ok: false, movedAed: 0, markAed: 0, state: 'notYet',
      reason: err instanceof Error ? err.message : 'error',
    }
  }
}

export interface WalletCommission {
  dealId: string
  dealName: string
  status: string
  entitledAed: number
  paidAed: number
  awaitingAed: number
  state: string
  /** The dates — what the wallet could not say before. */
  payments: CommissionPayment[]
}

/**
 * What a broker is owed and when it has been arriving.
 *
 * Read for the WALLET, so it answers the two questions a person actually has:
 * how much is still coming, and when did the last of it land. A screen that
 * showed only the outstanding total would be the deal page again.
 */
export async function walletCommissions(brokerId: string): Promise<WalletCommission[]> {
  try {
    await ensurePayoutSchema()
    const deals = await query(
      `SELECT d.id, d.lead_name, d.status, d.agency_commission_aed, d.broker_commission_aed,
              d.commission_received_aed,
              COALESCE(p.paid_aed, 0) AS paid_aed
         FROM freehold_site_deals d
         LEFT JOIN freehold_deal_payouts p ON p.deal_id = d.id
        WHERE d.agent_id = $1 AND d.status IN ('approved','closed')
        ORDER BY d.updated_at DESC NULLS LAST
        LIMIT 50`,
      [brokerId],
    )
    if (deals.length === 0) return []

    const ids = deals.map((d) => String(d.id))
    const payments = await query(
      `SELECT deal_id, amount_aed, received_at::text, reference
         FROM freehold_deal_payments
        WHERE deal_id = ANY($1::text[])
        ORDER BY received_at DESC`,
      [ids],
    )

    return deals.map((d) => {
      const basis: PayoutBasis = {
        status: String(d.status),
        agencyCommissionAed: Number(d.agency_commission_aed ?? 0),
        commissionReceivedAed: Number(d.commission_received_aed ?? 0),
        brokerCommissionAed: Number(d.broker_commission_aed ?? 0),
        paidOutAed: Number(d.paid_aed ?? 0),
      }
      const plan = owedNow(basis)
      return {
        dealId: String(d.id),
        dealName: String(d.lead_name ?? ''),
        status: String(d.status),
        entitledAed: plan.entitledAed,
        paidAed: Number(d.paid_aed ?? 0),
        awaitingAed: plan.awaitingAed,
        state: plan.state,
        payments: payments
          .filter((p) => String(p.deal_id) === String(d.id))
          .map((p) => ({
            dealId: String(p.deal_id),
            dealName: String(d.lead_name ?? ''),
            amountAed: Number(p.amount_aed ?? 0),
            receivedAt: String(p.received_at),
            // The broker's share of THIS payment, so a row reads as money that
            // reached them rather than money the agency received.
            payoutAed: basis.agencyCommissionAed > 0
              ? Math.floor((basis.brokerCommissionAed * Number(p.amount_aed ?? 0)) / basis.agencyCommissionAed)
              : 0,
            reference: String(p.reference ?? ''),
          })),
      }
    })
  } catch { return [] }
}
