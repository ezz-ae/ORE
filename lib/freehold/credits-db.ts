import { query } from '@/lib/db'

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
  type: 'allocation' | 'spend' | 'refund' | 'adjustment'
  amount: number
  note: string | null
  meta: Record<string, unknown>
  created_by: string | null
  created_at: string
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
      `SELECT id, broker_id, type, amount, note, meta, created_by, created_at::text
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
): Promise<{ ok: boolean; newBalance?: number }> {
  try {
    await ensureCreditsSchema()
    // Ensure account exists
    await query(`
      INSERT INTO broker_credit_accounts (broker_id, tier, allocated)
      VALUES ($1, 'Starter', 0)
      ON CONFLICT (broker_id) DO NOTHING
    `, [brokerId])
    // Record spend in ledger
    await query(`
      INSERT INTO credit_ledger (broker_id, type, amount, note, meta)
      VALUES ($1, 'spend', $2, $3, $4)
    `, [brokerId, credits, `Campaign: ${campaignName}`, JSON.stringify({ campaign_id: campaignId })])
    // Record allocation
    await query(`
      INSERT INTO ad_spend_allocations (broker_id, campaign_id, campaign_name, credits_allocated)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, [brokerId, campaignId, campaignName, credits])
    const balance = await getCreditBalance(brokerId)
    return { ok: true, newBalance: balance?.balance }
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
