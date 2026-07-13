import { query, withTransaction } from '@/lib/db'
import { notifyBrokerLowCredits } from '@/lib/transactional-email'
import { creditsEarnedForCommission, type CreditTier } from '@/lib/freehold/credits-shared'

export interface CreditBalance {
  broker_id: string
  tier: string
  allocated: number
  balance: number
  total_spent: number
  cycle_start: string
  cycle_end: string
}

export interface CreditLedgerEntry {
  id: string
  broker_id: string
  type: 'allocation' | 'spend' | 'refund' | 'adjustment' | 'earn'
  amount: number
  note: string | null
  reference: string | null
  meta: Record<string, unknown>
  created_by: string | null
  created_at: string
}

/** Per-broker row for the management balances list. */
export interface BrokerBalanceRow {
  id: string
  name: string
  email: string
  tier: string
  allocated: number
  total_spent: number
  balance: number
  earned: number
  cycle_end: string | null
}

export interface AdSpendAllocation {
  id: string
  broker_id: string
  campaign_id: string | null
  campaign_name: string | null
  credits_allocated: number
  credits_spent: number
  daily_cap: number | null
  status: string
  created_at: string
}

export async function getCreditBalance(brokerId: string): Promise<CreditBalance | null> {
  try {
    const rows = await query<CreditBalance>(
      `SELECT broker_id, tier, allocated, balance, total_spent,
              cycle_start::text, cycle_end::text
       FROM broker_credit_balances
       WHERE broker_id = $1`,
      [brokerId]
    )
    return rows[0] ?? null
  } catch { return null }
}

export async function getCreditLedger(brokerId: string, limit = 50): Promise<CreditLedgerEntry[]> {
  try {
    return await query<CreditLedgerEntry>(
      `SELECT id, broker_id, type, amount, note, reference, meta, created_by, created_at::text
       FROM credit_ledger
       WHERE broker_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [brokerId, limit]
    )
  } catch { return [] }
}

export async function getAdSpendAllocations(brokerId: string): Promise<AdSpendAllocation[]> {
  try {
    return await query<AdSpendAllocation>(
      `SELECT id, broker_id, campaign_id, campaign_name,
              credits_allocated, credits_spent, daily_cap, status, created_at::text
       FROM ad_spend_allocations
       WHERE broker_id = $1
       ORDER BY created_at DESC`,
      [brokerId]
    )
  } catch { return [] }
}

export async function ensureCreditsSchema(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS broker_credit_accounts (
        broker_id   TEXT PRIMARY KEY,
        user_id     TEXT,
        tier        TEXT NOT NULL DEFAULT 'Starter',
        allocated   INTEGER NOT NULL DEFAULT 0,
        cycle_start TIMESTAMPTZ NOT NULL DEFAULT now(),
        cycle_end   TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
        created_at  TIMESTAMPTZ DEFAULT now(),
        updated_at  TIMESTAMPTZ DEFAULT now()
      )
    `, [])
    await query(`
      CREATE TABLE IF NOT EXISTS credit_ledger (
        id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        broker_id  TEXT NOT NULL,
        type       TEXT NOT NULL,
        amount     INTEGER NOT NULL,
        note       TEXT,
        meta       JSONB DEFAULT '{}',
        created_by TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `, [])
    // Deal-earn idempotency: 'earn' entries store the deal id in `reference`.
    await query(`ALTER TABLE credit_ledger ADD COLUMN IF NOT EXISTS reference TEXT`, [])
    await query(`CREATE INDEX IF NOT EXISTS idx_credit_ledger_reference ON credit_ledger(reference)`, [])
    await query(`
      CREATE TABLE IF NOT EXISTS ad_spend_allocations (
        id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        broker_id         TEXT NOT NULL,
        campaign_id       TEXT,
        campaign_name     TEXT,
        credits_allocated INTEGER NOT NULL DEFAULT 0,
        credits_spent     INTEGER NOT NULL DEFAULT 0,
        daily_cap         INTEGER,
        status            TEXT NOT NULL DEFAULT 'active',
        created_at        TIMESTAMPTZ DEFAULT now(),
        updated_at        TIMESTAMPTZ DEFAULT now()
      )
    `, [])
    await query(`
      CREATE OR REPLACE VIEW broker_credit_balances AS
      SELECT
        bca.broker_id, bca.user_id, bca.tier, bca.allocated, bca.cycle_start, bca.cycle_end,
        COALESCE(SUM(CASE
          WHEN cl.type = 'allocation' THEN  cl.amount
          WHEN cl.type = 'spend'      THEN -cl.amount
          WHEN cl.type = 'refund'     THEN  cl.amount
          WHEN cl.type = 'adjustment' THEN  cl.amount
          WHEN cl.type = 'earn'       THEN  cl.amount
          ELSE 0
        END), 0)::integer AS balance,
        COALESCE(SUM(CASE WHEN cl.type = 'spend' THEN cl.amount ELSE 0 END), 0)::integer AS total_spent
      FROM broker_credit_accounts bca
      LEFT JOIN credit_ledger cl ON cl.broker_id = bca.broker_id
      GROUP BY bca.broker_id, bca.user_id, bca.tier, bca.allocated, bca.cycle_start, bca.cycle_end
    `, [])
  } catch { /* Non-blocking */ }
}

export async function deductCreditsForCampaign(
  brokerId: string,
  campaignId: string,
  campaignName: string,
  credits: number
): Promise<{ ok: boolean; newBalance?: number; reason?: 'insufficient'; balance?: number }> {
  try {
    await ensureCreditsSchema()
    // Ensure the account row exists so it can be locked inside the transaction.
    await query(`
      INSERT INTO broker_credit_accounts (broker_id, tier, allocated)
      VALUES ($1, 'Starter', 0)
      ON CONFLICT (broker_id) DO NOTHING
    `, [brokerId])

    // Atomic debit: lock the broker's account row, re-derive the balance from the
    // ledger under that lock, and only insert the 'spend' when it stays >= 0. Two
    // concurrent launches for the same broker now serialize on the row lock, so a
    // broker can never overspend by racing (fail-closed on money).
    const result = await withTransaction(async (q) => {
      await q(
        `SELECT broker_id FROM broker_credit_accounts WHERE broker_id = $1 FOR UPDATE`,
        [brokerId],
      )
      const balRows = await q<{ balance: number }>(
        `SELECT COALESCE(SUM(CASE
            WHEN type = 'allocation' THEN  amount
            WHEN type = 'spend'      THEN -amount
            WHEN type = 'refund'     THEN  amount
            WHEN type = 'adjustment' THEN  amount
            WHEN type = 'earn'       THEN  amount
            ELSE 0
          END), 0)::integer AS balance
         FROM credit_ledger WHERE broker_id = $1`,
        [brokerId],
      )
      const bal = balRows[0]?.balance ?? 0
      if (credits > 0 && bal < credits) {
        return { ok: false as const, reason: 'insufficient' as const, balance: bal }
      }
      await q(
        `INSERT INTO credit_ledger (broker_id, type, amount, note, meta)
         VALUES ($1, 'spend', $2, $3, $4)`,
        [brokerId, credits, `Campaign: ${campaignName}`, JSON.stringify({ campaign_id: campaignId })],
      )
      await q(
        `INSERT INTO ad_spend_allocations (broker_id, campaign_id, campaign_name, credits_allocated)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [brokerId, campaignId, campaignName, credits],
      )
      return { ok: true as const, newBalance: bal - credits }
    })

    if (result.ok) {
      // Low-balance warning (threshold 20) — best-effort, never blocks the spend.
      const remaining = result.newBalance
      if (remaining > 0 && remaining <= 20) {
        await notifyBrokerLowCredits(brokerId, remaining).catch(() => {})
      }
    }
    return result
  } catch {
    return { ok: false }
  }
}

/**
 * Attach the real campaign id to a reservation once the launch succeeds. Credits
 * are reserved (debited) BEFORE the Meta launch under a placeholder reference, so
 * on success we rewrite that placeholder to the true campaign id — keeping the
 * ledger note and the allocations list pointing at the live campaign. Best-effort
 * and cosmetic: the balance math never depends on the campaign id.
 */
export async function settleCampaignReservation(
  brokerId: string,
  reservationRef: string,
  realCampaignId: string,
): Promise<void> {
  if (!brokerId || !reservationRef || !realCampaignId || reservationRef === realCampaignId) return
  try {
    await query(
      `UPDATE ad_spend_allocations SET campaign_id = $3, updated_at = now()
       WHERE broker_id = $1 AND campaign_id = $2`,
      [brokerId, reservationRef, realCampaignId],
    )
    await query(
      `UPDATE credit_ledger
       SET meta = jsonb_set(COALESCE(meta, '{}'::jsonb), '{campaign_id}', to_jsonb($3::text))
       WHERE broker_id = $1 AND type = 'spend' AND meta->>'campaign_id' = $2`,
      [brokerId, reservationRef, realCampaignId],
    )
  } catch { /* Non-fatal — reconciliation is cosmetic; the debit already stands. */ }
}

/** Return credits to a broker — reverses a deduction when a campaign launch
 *  fails after the spend was recorded. */
export async function refundCredits(
  brokerId: string,
  campaignId: string,
  credits: number,
  note = 'Refund: campaign launch failed'
): Promise<{ ok: boolean }> {
  if (!brokerId || credits <= 0) return { ok: true }
  try {
    await ensureCreditsSchema()
    await query(`
      INSERT INTO credit_ledger (broker_id, type, amount, note, meta)
      VALUES ($1, 'refund', $2, $3, $4)
    `, [brokerId, credits, note, JSON.stringify({ campaign_id: campaignId })])
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function allocateCredits(
  brokerId: string,
  amount: number,
  note: string,
  allocatedBy: string
): Promise<{ ok: boolean }> {
  try {
    await ensureCreditsSchema()
    await query(`
      INSERT INTO broker_credit_accounts (broker_id, tier, allocated)
      VALUES ($1, 'Starter', $2)
      ON CONFLICT (broker_id) DO UPDATE SET
        allocated = broker_credit_accounts.allocated + $2,
        updated_at = now()
    `, [brokerId, amount])
    await query(`
      INSERT INTO credit_ledger (broker_id, type, amount, note, created_by)
      VALUES ($1, 'allocation', $2, $3, $4)
    `, [brokerId, amount, note, allocatedBy])
    return { ok: true }
  } catch { return { ok: false } }
}

/**
 * Performance earn: credit a broker for a finally-approved/closed deal.
 * Rule: 1 credit per AED 1,000 of broker net commission, minimum 1.
 * Idempotent — the deal id is stored in `reference`, and a second call for the
 * same deal + broker is a no-op.
 */
export async function earnCreditsForDeal(
  brokerId: string,
  dealId: string,
  dealName: string,
  brokerTotalAED: number
): Promise<{ ok: boolean; credits?: number; skipped?: 'already_earned' }> {
  if (!brokerId || !dealId) return { ok: false }
  try {
    await ensureCreditsSchema()
    const existing = await query<{ id: string }>(
      `SELECT id FROM credit_ledger
       WHERE broker_id = $1 AND type = 'earn' AND reference = $2
       LIMIT 1`,
      [brokerId, dealId]
    )
    if (existing[0]) return { ok: true, skipped: 'already_earned' }
    // Ensure the account row exists so the balances view picks the broker up.
    await query(`
      INSERT INTO broker_credit_accounts (broker_id, tier, allocated)
      VALUES ($1, 'Starter', 0)
      ON CONFLICT (broker_id) DO NOTHING
    `, [brokerId])
    const credits = creditsEarnedForCommission(brokerTotalAED)
    await query(`
      INSERT INTO credit_ledger (broker_id, type, amount, note, reference, meta)
      VALUES ($1, 'earn', $2, $3, $4, $5)
    `, [
      brokerId,
      credits,
      `Deal earned: ${dealName}`,
      dealId,
      JSON.stringify({ deal_id: dealId, broker_total_aed: brokerTotalAED }),
    ])
    return { ok: true, credits }
  } catch {
    return { ok: false }
  }
}

/** Persist a broker's tier (creates the account row when missing). */
export async function setBrokerTier(
  brokerId: string,
  tier: CreditTier
): Promise<{ ok: boolean }> {
  if (!brokerId) return { ok: false }
  try {
    await ensureCreditsSchema()
    await query(`
      INSERT INTO broker_credit_accounts (broker_id, tier, allocated)
      VALUES ($1, $2, 0)
      ON CONFLICT (broker_id) DO UPDATE SET
        tier = $2,
        updated_at = now()
    `, [brokerId, tier])
    return { ok: true }
  } catch { return { ok: false } }
}

/**
 * Management view: every broker with their real ledger-derived numbers.
 * Brokers without a credit account yet appear with honest zeros ('Starter').
 */
export async function listBrokerBalances(): Promise<BrokerBalanceRow[]> {
  try {
    await ensureCreditsSchema()
    return await query<BrokerBalanceRow>(
      `SELECT
         u.id,
         COALESCE(u.name, u.email)          AS name,
         u.email,
         COALESCE(b.tier, 'Starter')        AS tier,
         COALESCE(b.allocated, 0)::integer  AS allocated,
         COALESCE(b.total_spent, 0)::integer AS total_spent,
         COALESCE(b.balance, 0)::integer    AS balance,
         COALESCE(e.earned, 0)::integer     AS earned,
         b.cycle_end::text                  AS cycle_end
       FROM freehold_site_users u
       LEFT JOIN broker_credit_balances b
         ON b.broker_id = u.id OR b.broker_id = u.email
       LEFT JOIN (
         SELECT broker_id, SUM(amount) AS earned
         FROM credit_ledger
         WHERE type = 'earn'
         GROUP BY broker_id
       ) e ON e.broker_id = COALESCE(b.broker_id, u.id)
       WHERE u.role = 'broker'
       ORDER BY COALESCE(u.name, u.email) ASC`,
      []
    )
  } catch { return [] }
}
