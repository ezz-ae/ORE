import { query, withTransaction, ensureOnce, type TxQuery } from '@/lib/db'
import { notifyBrokerLowCredits } from '@/lib/transactional-email'
import {
  creditsEarnedForCommission,
  isValidCreditAmount,
  isCreditTier,
  CYCLE_REFERENCE_PREFIX,
  TIER_MONTHLY_QUOTA,
  REDENOMINATION_FACTOR,
  REDENOMINATION_REFERENCE,
  type CreditTier,
} from '@/lib/freehold/credits-shared'

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

/**
 * THE balance definition — one string, used by both the `broker_credit_balances`
 * view (what every screen reads) and the locked re-derivation inside the debit
 * transaction (what authorises a spend). Money bugs come from two definitions
 * drifting apart, so there is exactly one, and `$ALIAS` is substituted for the
 * table alias each site needs.
 */
const BALANCE_SUM = (a: string) => `COALESCE(SUM(CASE
  WHEN ${a}type = 'allocation' THEN  ${a}amount
  WHEN ${a}type = 'spend'      THEN -${a}amount
  WHEN ${a}type = 'refund'     THEN  ${a}amount
  WHEN ${a}type = 'adjustment' THEN  ${a}amount
  WHEN ${a}type = 'earn'       THEN  ${a}amount
  ELSE 0
END), 0)::integer`

const SPENT_SUM = (a: string) =>
  `COALESCE(SUM(CASE WHEN ${a}type = 'spend' THEN ${a}amount ELSE 0 END), 0)::integer`

/**
 * Read a balance, distinguishing "this broker has no account yet" (`balance:
 * null`) from "the read failed" (`ok: false`). Collapsing the two is how a
 * database hiccup used to render as a confident "0 credits" — a wrong number on
 * a money screen, and a 402 on a launch the broker could actually afford.
 */
export async function readCreditBalance(
  brokerId: string,
): Promise<{ ok: true; balance: CreditBalance | null } | { ok: false }> {
  try {
    let row = await selectBalanceRow(brokerId)
    // Lazy, self-healing monthly cycle: a broker who has been away for months
    // is topped up the moment anyone looks at their account, no cron required.
    // The grant itself happens under the account row lock (rollMonthlyQuota) —
    // this read only decides whether it is worth opening that transaction, and
    // the locked path re-checks, so a stale "due" here cannot double-grant.
    if (row?.cycle_due) {
      const rolled = await rollMonthlyQuota(brokerId).then(() => true).catch(() => false)
      // A failed rollover must not fail the read: report the balance as it
      // stands (under-granted, never over-granted) rather than a false error.
      if (rolled) row = await selectBalanceRow(brokerId)
    }
    return { ok: true, balance: row ? stripCycleFlag(row) : null }
  } catch { return { ok: false } }
}

/** The balance row every read path uses, plus whether its cycle has rolled into
 *  a new calendar month (evaluated in the operating timezone, in Postgres — the
 *  month boundary must not depend on the Node process's clock or locale). */
async function selectBalanceRow(
  brokerId: string,
): Promise<(CreditBalance & { cycle_due: boolean }) | null> {
  const rows = await query<CreditBalance & { cycle_due: boolean }>(
    `SELECT broker_id, tier, allocated, balance, total_spent,
            cycle_start::text, cycle_end::text,
            (to_char(cycle_start AT TIME ZONE '${CYCLE_TZ}', 'YYYY-MM')
               <> to_char(now() AT TIME ZONE '${CYCLE_TZ}', 'YYYY-MM')) AS cycle_due
     FROM broker_credit_balances
     WHERE broker_id = $1`,
    [brokerId],
  )
  return rows[0] ?? null
}

const stripCycleFlag = (row: CreditBalance & { cycle_due: boolean }): CreditBalance => {
  const { cycle_due: _cycleDue, ...balance } = row
  return balance
}

export async function getCreditBalance(brokerId: string): Promise<CreditBalance | null> {
  const res = await readCreditBalance(brokerId)
  return res.ok ? res.balance : null
}

/** Ledger read that reports a failed query instead of an empty history. */
export async function readCreditLedger(
  brokerId: string,
  limit = 50,
): Promise<{ ok: true; ledger: CreditLedgerEntry[] } | { ok: false }> {
  try {
    const ledger = await query<CreditLedgerEntry>(
      `SELECT id, broker_id, type, amount, note, reference, meta, created_by, created_at::text
       FROM credit_ledger
       WHERE broker_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [brokerId, limit]
    )
    return { ok: true, ledger }
  } catch { return { ok: false } }
}

export async function getCreditLedger(brokerId: string, limit = 50): Promise<CreditLedgerEntry[]> {
  const res = await readCreditLedger(brokerId, limit)
  return res.ok ? res.ledger : []
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

/**
 * Management drill-down: the full ledger + campaign allocations for one broker.
 * Historic rows were written under either the user id or the login email, so a
 * broker's money is looked up under every identity they may have been booked
 * under (the same tolerance `listBrokerBalances` applies).
 */
export async function getBrokerCreditDetail(
  identities: string[],
  limit = 100,
): Promise<{ ledger: CreditLedgerEntry[]; allocations: AdSpendAllocation[] }> {
  const ids = identities.filter((v): v is string => typeof v === 'string' && v.length > 0)
  if (ids.length === 0) return { ledger: [], allocations: [] }
  const [ledger, allocations] = await Promise.all([
    query<CreditLedgerEntry>(
      `SELECT id, broker_id, type, amount, note, reference, meta, created_by, created_at::text
       FROM credit_ledger
       WHERE broker_id = ANY($1)
       ORDER BY created_at DESC
       LIMIT $2`,
      [ids, limit],
    ).catch(() => []),
    query<AdSpendAllocation>(
      `SELECT id, broker_id, campaign_id, campaign_name,
              credits_allocated, credits_spent, daily_cap, status, created_at::text
       FROM ad_spend_allocations
       WHERE broker_id = ANY($1)
       ORDER BY created_at DESC
       LIMIT $2`,
      [ids, limit],
    ).catch(() => []),
  ])
  return { ledger, allocations }
}

/**
 * Lazily create/repair the credit schema.
 *
 * Every statement is guarded INDIVIDUALLY: a single try/catch around the whole
 * block meant that one failing statement (a pre-existing table with a different
 * shape, a permissions hiccup) silently skipped everything after it — including
 * the balances view every screen reads.
 *
 * Self-healing indexes: a table created by an older migration never gains an
 * inline UNIQUE/PRIMARY KEY, and `INSERT … ON CONFLICT (col)` against it fails
 * with 42P10 at runtime. `CREATE UNIQUE INDEX IF NOT EXISTS` gives the ON
 * CONFLICT targets a real index to infer, on old and new databases alike.
 */
async function ensureCreditsSchemaOnce(): Promise<void> {
  const ddl = async (sql: string) => { try { await query(sql, []) } catch { /* per-statement, non-blocking */ } }

  await ddl(`
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
  `)
  // ON CONFLICT (broker_id) needs a real unique index — a table created before
  // the PRIMARY KEY existed would otherwise throw 42P10 on every allocation.
  await ddl(`CREATE UNIQUE INDEX IF NOT EXISTS broker_credit_accounts_broker_id_uidx
             ON broker_credit_accounts (broker_id)`)

  await ddl(`
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
  `)
  await ddl(`ALTER TABLE credit_ledger ADD COLUMN IF NOT EXISTS reference TEXT`)
  await ddl(`CREATE INDEX IF NOT EXISTS idx_credit_ledger_reference ON credit_ledger(reference)`)
  await ddl(`CREATE INDEX IF NOT EXISTS idx_credit_ledger_broker ON credit_ledger(broker_id)`)

  // Idempotency spine. Every referenced movement (a campaign reservation debit,
  // its refund, a deal earn) is unique per (broker, type, reference), so a retry
  // — a double-clicked approval, a webhook firing twice, a client retry after a
  // timeout — can never credit or debit the same event twice.
  //
  // Any duplicate that already slipped through before this index existed is an
  // over-credit (or a double debit) sitting in a money ledger; the oldest row is
  // the real one and the rest are collapsed, otherwise the index cannot be built
  // and every future retry stays unguarded.
  await ddl(`
    DELETE FROM credit_ledger a
    USING credit_ledger b
    WHERE a.reference IS NOT NULL
      AND a.broker_id = b.broker_id
      AND a.type      = b.type
      AND a.reference = b.reference
      AND (a.created_at, a.id) > (b.created_at, b.id)
  `)
  await ddl(`CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_reference_uidx
             ON credit_ledger (broker_id, type, reference)
             WHERE reference IS NOT NULL`)

  await ddl(`
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
  `)
  await ddl(`CREATE INDEX IF NOT EXISTS idx_ad_spend_broker ON ad_spend_allocations(broker_id)`)
  await ddl(`CREATE INDEX IF NOT EXISTS idx_ad_spend_campaign ON ad_spend_allocations(campaign_id)`)

  // The re-denomination's memory. One row, written by the first run and read by
  // every run after it — see `redenominateToCash`. It exists so the migration
  // has a CUTOFF: money that arrived after the scale changed is already in the
  // new scale and must never be multiplied again.
  await ddl(`
    CREATE TABLE IF NOT EXISTS credit_redenominations (
      id      TEXT PRIMARY KEY,
      factor  INTEGER NOT NULL,
      cutoff  TIMESTAMPTZ NOT NULL,
      run_by  TEXT,
      run_at  TIMESTAMPTZ DEFAULT now()
    )
  `)

  await ddl(`
    CREATE OR REPLACE VIEW broker_credit_balances AS
    SELECT
      bca.broker_id, bca.user_id, bca.tier, bca.allocated, bca.cycle_start, bca.cycle_end,
      ${BALANCE_SUM('cl.')} AS balance,
      ${SPENT_SUM('cl.')} AS total_spent
    FROM broker_credit_accounts bca
    LEFT JOIN credit_ledger cl ON cl.broker_id = bca.broker_id
    GROUP BY bca.broker_id, bca.user_id, bca.tier, bca.allocated, bca.cycle_start, bca.cycle_end
  `)
}

export async function ensureCreditsSchema(): Promise<void> {
  // Memoised per tenant schema: the DDL is idempotent but was previously issued
  // on every single credit call (six round trips per campaign launch).
  try { await ensureOnce('credits-schema', ensureCreditsSchemaOnce) } catch { /* non-blocking */ }
}

/** Postgres unique-violation — the concurrent-retry arm of an idempotent write. */
const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505'

/**
 * Insert a ledger row exactly once for (broker_id, type, reference).
 *
 * `WHERE NOT EXISTS` makes it idempotent on ANY schema (including a database
 * that never got the unique index), and the unique index closes the concurrent
 * window — a racing duplicate raises 23505, which is the same answer as "already
 * recorded". Returns false when the movement was already on the ledger.
 */
async function insertLedgerOnce(
  q: TxQuery,
  row: {
    brokerId: string
    type: CreditLedgerEntry['type']
    amount: number
    note: string | null
    reference: string
    meta?: Record<string, unknown>
    createdBy?: string | null
  },
): Promise<boolean> {
  // A unique violation aborts the whole Postgres transaction, so the insert runs
  // inside a savepoint: "already recorded" must be a normal answer, not a
  // poisoned transaction that then fails at COMMIT.
  await q(`SAVEPOINT credit_ledger_once`)
  try {
    const inserted = await q<{ id: string }>(
      `INSERT INTO credit_ledger (broker_id, type, amount, note, reference, meta, created_by)
       SELECT $1, $2, $3, $4, $5, $6::jsonb, $7
       WHERE NOT EXISTS (
         SELECT 1 FROM credit_ledger
         WHERE broker_id = $1 AND type = $2 AND reference = $5
       )
       RETURNING id`,
      [
        row.brokerId, row.type, row.amount, row.note, row.reference,
        JSON.stringify(row.meta ?? {}), row.createdBy ?? null,
      ],
    )
    await q(`RELEASE SAVEPOINT credit_ledger_once`)
    return inserted.length > 0
  } catch (err) {
    await q(`ROLLBACK TO SAVEPOINT credit_ledger_once`).catch(() => {})
    if (isUniqueViolation(err)) return false
    throw err
  }
}

/**
 * Create-if-missing then lock the broker's account row.
 *
 * `locked: false` means the row could not be locked — no lock means no
 * serialisation, so callers fail closed rather than authorise a spend against
 * an unprotected balance. `created` reports whether THIS call brought the
 * account into existence, which is the monthly cycle's "first ever" signal: a
 * brand-new account is already sitting in the current calendar month, so
 * without it a new broker would wait until next month for the quota the UI
 * promises them today.
 */
async function lockAccount(
  q: TxQuery,
  brokerId: string,
): Promise<{ locked: boolean; created: boolean }> {
  const inserted = await q<{ broker_id: string }>(
    `INSERT INTO broker_credit_accounts (broker_id, tier, allocated)
     VALUES ($1, 'Starter', 0)
     ON CONFLICT (broker_id) DO NOTHING
     RETURNING broker_id`,
    [brokerId],
  )
  const locked = await q<{ broker_id: string }>(
    `SELECT broker_id FROM broker_credit_accounts WHERE broker_id = $1 FOR UPDATE`,
    [brokerId],
  )
  return { locked: locked.length > 0, created: inserted.length > 0 }
}

/**
 * The timezone the credit cycle lives in. Credits fund UAE ad spend and the
 * product's month is the Dubai month, so a broker's quota rolls at midnight
 * Dubai — not at whatever the database session or the serverless region says.
 */
const CYCLE_TZ = 'Asia/Dubai'

/**
 * Monthly tier quota — the grant that TIER_MONTHLY_QUOTA has always advertised.
 *
 * Runs INSIDE the caller's transaction, under the account row lock they already
 * hold, so it serialises with every spend/refund/earn for that broker.
 *
 * Semantics (deliberate, and the least surprising reading of the UI's "Resets"):
 *   • the balance is topped up TO the tier quota — 8 credits on a 25 quota → 25;
 *   • a balance already at or above quota is left ALONE (deal bonuses are never
 *     clawed back), and no ledger row is written;
 *   • the grant is therefore max(0, quota − balance).
 *
 * A broker who was inactive for five months lands on the CURRENT month with ONE
 * top-up, not five: the trigger is "the cycle is not in this calendar month",
 * and the ledger reference is the month itself.
 *
 * Impossible to double-grant: the ledger row is written by `insertLedgerOnce`
 * under reference `cycle:<YYYY-MM>`, which the unique index
 * `(broker_id, type, reference)` makes unique per broker per month. Two racing
 * requests, a retry after a timeout, a re-entered rollover — the second insert
 * finds the row (or raises 23505) and grants nothing.
 */
async function rollMonthlyQuotaLocked(
  q: TxQuery,
  brokerId: string,
  isNewAccount: boolean,
): Promise<number> {
  const rows = await q<{ tier: string; cycle_month: string; now_month: string }>(
    `SELECT tier,
            to_char(cycle_start AT TIME ZONE '${CYCLE_TZ}', 'YYYY-MM') AS cycle_month,
            to_char(now()       AT TIME ZONE '${CYCLE_TZ}', 'YYYY-MM') AS now_month
     FROM broker_credit_accounts
     WHERE broker_id = $1`,
    [brokerId],
  )
  const row = rows[0]
  if (!row) return 0
  // Already in this month's cycle → nothing due. A just-created account is the
  // one exception: its first cycle has never been granted.
  if (!isNewAccount && row.cycle_month === row.now_month) return 0

  const tier: CreditTier = isCreditTier(row.tier) ? row.tier : 'Starter'
  const quota = TIER_MONTHLY_QUOTA[tier]
  const balance = await lockedBalance(q, brokerId)
  const grant = Math.max(0, quota - balance)

  let granted = 0
  if (grant > 0 && isValidCreditAmount(grant)) {
    const booked = await insertLedgerOnce(q, {
      brokerId,
      type: 'allocation',
      amount: grant,
      note: `Monthly ${tier} quota (${row.now_month})`,
      reference: `${CYCLE_REFERENCE_PREFIX}${row.now_month}`,
      meta: { cycle: row.now_month, tier, quota, balance_before: balance },
      createdBy: 'system',
    })
    if (booked) {
      granted = grant
      // `allocated` is the cumulative "credits given" the usage bar measures
      // spend against. Granted credits that never landed there would render as
      // "12 of 0 used" — a wrong number on a money screen.
      await q(
        `UPDATE broker_credit_accounts
         SET allocated = allocated + $2, updated_at = now()
         WHERE broker_id = $1`,
        [brokerId, grant],
      )
    }
  }

  // The dates roll whether or not credits moved — a broker already above quota
  // still starts a new cycle, and the UI's "Resets …" finally tells the truth.
  await q(
    `UPDATE broker_credit_accounts
     SET cycle_start = date_trunc('month', now() AT TIME ZONE '${CYCLE_TZ}') AT TIME ZONE '${CYCLE_TZ}',
         cycle_end   = (date_trunc('month', now() AT TIME ZONE '${CYCLE_TZ}') + interval '1 month') AT TIME ZONE '${CYCLE_TZ}',
         updated_at  = now()
     WHERE broker_id = $1`,
    [brokerId],
  )
  return granted
}

/**
 * Standalone rollover for the READ path — same lock, same transaction shape as
 * every mutation. Only ever called for a broker who already HAS an account, so
 * reading a balance still never conjures one.
 */
async function rollMonthlyQuota(brokerId: string): Promise<void> {
  await ensureCreditsSchema()
  await withTransaction(async (q) => {
    const { locked, created } = await lockAccount(q, brokerId)
    if (!locked) return
    await rollMonthlyQuotaLocked(q, brokerId, created)
  })
}

/** Re-derive the authoritative balance from the ledger, under the caller's lock. */
async function lockedBalance(q: TxQuery, brokerId: string): Promise<number> {
  const rows = await q<{ balance: number }>(
    `SELECT ${BALANCE_SUM('')} AS balance FROM credit_ledger WHERE broker_id = $1`,
    [brokerId],
  )
  return rows[0]?.balance ?? 0
}

export type DeductFailure = 'insufficient' | 'invalid' | 'error'

export async function deductCreditsForCampaign(
  brokerId: string,
  campaignId: string,
  campaignName: string,
  credits: number
): Promise<{ ok: boolean; newBalance?: number; reason?: DeductFailure; balance?: number; alreadyCharged?: boolean }> {
  // A non-integer, negative, NaN or absurd amount never reaches the ledger. A
  // negative "spend" would ADD credits (the balance formula negates spends), and
  // a float would be silently rounded by the INTEGER column.
  if (!brokerId || !campaignId) return { ok: false, reason: 'invalid' }
  if (!isValidCreditAmount(credits)) return { ok: false, reason: 'invalid' }
  try {
    await ensureCreditsSchema()

    // Atomic debit: create+lock the broker's account row, re-derive the balance
    // from the ledger under that lock, and only insert the 'spend' when it stays
    // >= 0. Two concurrent launches for the same broker serialise on the row
    // lock, so a broker can never overspend by racing (fail-closed on money).
    // The account upsert is INSIDE the transaction — done outside it, a missing
    // row made `FOR UPDATE` match zero rows and take no lock at all.
    const result = await withTransaction(async (q) => {
      const account = await lockAccount(q, brokerId)
      if (!account.locked) {
        return { ok: false as const, reason: 'error' as const }
      }
      // Settle the monthly quota BEFORE authorising the spend, in this same
      // transaction and under this same lock: a broker returning after a month
      // away can afford the launch their tier already entitles them to, and the
      // balance the debit checks is the post-grant one.
      await rollMonthlyQuotaLocked(q, brokerId, account.created)
      const bal = await lockedBalance(q, brokerId)
      if (bal < credits) {
        return { ok: false as const, reason: 'insufficient' as const, balance: bal }
      }
      // Idempotent per reservation reference: a retried launch with the same
      // reference re-uses the debit already booked instead of charging twice.
      const booked = await insertLedgerOnce(q, {
        brokerId,
        type: 'spend',
        amount: credits,
        note: `Campaign: ${campaignName}`,
        reference: campaignId,
        meta: { campaign_id: campaignId },
      })
      if (!booked) {
        return { ok: true as const, newBalance: bal, alreadyCharged: true as const }
      }
      // The credits left the balance at launch, so the allocation row records
      // them as spent — not merely allocated. Finance and agent analytics read
      // `credits_spent`, which stayed 0 forever and reported AED 0 of ad spend.
      await q(
        `INSERT INTO ad_spend_allocations
           (broker_id, campaign_id, campaign_name, credits_allocated, credits_spent)
         VALUES ($1, $2, $3, $4, $4)
         ON CONFLICT DO NOTHING`,
        [brokerId, campaignId, campaignName, credits],
      )
      return { ok: true as const, newBalance: bal - credits }
    })

    if (result.ok && !result.alreadyCharged) {
      // Low-balance warning (threshold 20) — best-effort, never blocks the spend.
      const remaining = result.newBalance ?? 0
      if (remaining > 0 && remaining <= 20) {
        await notifyBrokerLowCredits(brokerId, remaining).catch(() => {})
      }
    }
    return result
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/**
 * Attach the real campaign id to a reservation once the launch succeeds. Credits
 * are reserved (debited) BEFORE the Meta launch under a placeholder reference, so
 * on success we rewrite that placeholder to the true campaign id — keeping the
 * ledger note and the allocations list pointing at the live campaign. Best-effort
 * and cosmetic: the balance math never depends on the campaign id.
 *
 * `credit_ledger.reference` deliberately keeps the reservation id — it is the
 * idempotency key of the debit, and rewriting it would let a retry charge again.
 * Re-running this is a no-op (the second pass matches nothing).
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

/**
 * Return credits to a broker — reverses a deduction when a campaign launch fails
 * after the spend was recorded.
 *
 * Idempotent per (broker, campaign reference): a retried release, or a webhook
 * firing twice, credits exactly once. The refunded campaign's allocation row is
 * cancelled in the same breath, otherwise Finance keeps reporting AED of ad
 * spend for a campaign that never served.
 */
export async function refundCredits(
  brokerId: string,
  campaignId: string,
  credits: number,
  note = 'Refund: campaign launch failed'
): Promise<{ ok: boolean; reason?: 'invalid' | 'error'; alreadyRefunded?: boolean }> {
  if (!brokerId || !campaignId) return { ok: false, reason: 'invalid' }
  if (!isValidCreditAmount(credits)) return { ok: false, reason: 'invalid' }
  try {
    await ensureCreditsSchema()
    return await withTransaction(async (q) => {
      // Same row lock as the debit path: every ledger mutation for a broker
      // serialises on their account row, so the idempotency check cannot race.
      const account = await lockAccount(q, brokerId)
      if (!account.locked) return { ok: false as const, reason: 'error' as const }
      const credited = await insertLedgerOnce(q, {
        brokerId,
        type: 'refund',
        amount: credits,
        note,
        reference: campaignId,
        meta: { campaign_id: campaignId },
      })
      await q(
        `UPDATE ad_spend_allocations
         SET status = 'cancelled', credits_spent = 0, updated_at = now()
         WHERE broker_id = $1 AND campaign_id = $2 AND status <> 'cancelled'`,
        [brokerId, campaignId],
      )
      // The monthly cycle settles AFTER the reversal, unlike every other path.
      // A refund undoes a spend that happened before the roll, so the balance
      // the top-up measures must already include it — rolling first would top a
      // drained broker up to quota and THEN hand back last month's spend on top,
      // paying twice for a campaign that never served.
      await rollMonthlyQuotaLocked(q, brokerId, account.created)
      return credited ? { ok: true } : { ok: true, alreadyRefunded: true }
    })
  } catch {
    return { ok: false, reason: 'error' }
  }
}

export async function allocateCredits(
  brokerId: string,
  amount: number,
  note: string,
  allocatedBy: string
): Promise<{ ok: boolean; reason?: 'invalid' | 'error' }> {
  if (!brokerId) return { ok: false, reason: 'invalid' }
  if (!isValidCreditAmount(amount)) return { ok: false, reason: 'invalid' }
  try {
    await ensureCreditsSchema()
    // One transaction: the quota bump and the ledger row are the same fact. Run
    // as two statements, a failed ledger insert left `allocated` inflated while
    // the balance never moved — the UI then showed "0 of 25 used" forever.
    await withTransaction(async (q) => {
      // Lock first, then settle any due monthly quota — a Finance bonus stacks
      // on top of the tier grant, and every ledger write for this broker
      // serialises on the same row lock as a spend.
      const account = await lockAccount(q, brokerId)
      if (account.locked) await rollMonthlyQuotaLocked(q, brokerId, account.created)
      await q(
        `INSERT INTO broker_credit_accounts (broker_id, tier, allocated)
         VALUES ($1, 'Starter', $2)
         ON CONFLICT (broker_id) DO UPDATE SET
           allocated = broker_credit_accounts.allocated + $2,
           updated_at = now()`,
        [brokerId, amount],
      )
      await q(
        `INSERT INTO credit_ledger (broker_id, type, amount, note, created_by)
         VALUES ($1, 'allocation', $2, $3, $4)`,
        [brokerId, amount, note, allocatedBy],
      )
    })
    return { ok: true }
  } catch { return { ok: false, reason: 'error' } }
}

/**
 * Performance earn: credit a broker for a finally-approved/closed deal.
 * Rule: 1 credit per AED 1,000 of broker net commission, minimum 1.
 *
 * Idempotent at the DATABASE, not just in application logic: the deal id is the
 * ledger `reference`, and the insert is a single conditional statement guarded
 * by a unique index. The previous read-then-insert could double-earn — approve
 * and close firing together, or a double-clicked approval, both saw "no row yet".
 */
export async function earnCreditsForDeal(
  brokerId: string,
  dealId: string,
  dealName: string,
  brokerTotalAED: number
): Promise<{ ok: boolean; credits?: number; skipped?: 'already_earned'; reason?: 'error' }> {
  if (!brokerId || !dealId) return { ok: false, reason: 'error' }
  try {
    await ensureCreditsSchema()
    const credits = creditsEarnedForCommission(brokerTotalAED)
    if (!isValidCreditAmount(credits)) return { ok: false, reason: 'error' }
    return await withTransaction(async (q) => {
      // Creates the account row (so the balances view picks the broker up) AND
      // locks it, so two approvals landing together cannot both pass the
      // "already earned?" check.
      const account = await lockAccount(q, brokerId)
      if (!account.locked) return { ok: false as const, reason: 'error' as const }
      // Quota first, bonus second: a deal reward stacks ON TOP of the monthly
      // grant. Rolling after the earn would absorb the reward into the top-up
      // and the broker would be paid nothing for closing the deal.
      await rollMonthlyQuotaLocked(q, brokerId, account.created)
      const earned = await insertLedgerOnce(q, {
        brokerId,
        type: 'earn',
        amount: credits,
        note: `Deal earned: ${dealName}`,
        reference: dealId,
        meta: { deal_id: dealId, broker_total_aed: brokerTotalAED },
      })
      return earned
        ? { ok: true as const, credits }
        : { ok: true as const, skipped: 'already_earned' as const }
    })
  } catch {
    return { ok: false, reason: 'error' }
  }
}

// ─── The re-denomination to Cash ─────────────────────────────────────────────

export interface RedenominationResult {
  ok: boolean
  /** Accounts that had already been scaled before this run. */
  alreadyDone: number
  /** Accounts scaled by THIS run. */
  scaled: number
  /** Cash added across all accounts. */
  addedCash: number
  reason?: 'error'
}

/**
 * SCALE EVERY EXISTING BALANCE INTO THE NEW UNIT.
 *
 * A unit is a tenth of what it was, so a stored balance means a tenth of what it
 * meant. Shipping the rate change without this would have quietly taken 90% of
 * every broker's ad budget — the number on their screen would not even move,
 * which is why it would have gone unnoticed until somebody could not launch a
 * campaign they had paid for.
 *
 * ── IT IS AN ENTRY, NOT A REWRITE ────────────────────────────────────────
 *
 * The obvious implementation is `UPDATE credit_ledger SET amount = amount * 10`.
 * That is the wrong shape for a money ledger: it rewrites history, so afterwards
 * nobody can tell what a broker was actually granted last March, and a half-run
 * migration leaves rows in two scales with no way to tell them apart.
 *
 * Instead each account gets ONE adjustment entry worth (factor − 1) × its old
 * balance. The ledger stays append-only, the entry is visible in the broker's
 * own history with a note saying what happened, and the arithmetic is auditable
 * forever. The unique index on (broker_id, type, reference) makes running it
 * twice a no-op at the DATABASE, not merely in this function.
 *
 * ── THE CUTOFF IS WHY IT IS SAFE TO RE-RUN ───────────────────────────────
 *
 * The first run stamps a cutoff and every run reads it back. Only ledger rows
 * written BEFORE the cutoff are scaled, so a broker who joined after the switch
 * — whose money is already in the new unit — is never touched, and a run that
 * dies halfway can simply be run again.
 *
 * DELIBERATELY MANUAL. It is triggered by an admin from the bank screen and not
 * by a deploy hook or a lazy read, because it moves real money and the person
 * who owns the books should be the person who decides when the books move.
 */
export async function redenominateToCash(runBy: string): Promise<RedenominationResult> {
  const empty: RedenominationResult = { ok: false, alreadyDone: 0, scaled: 0, addedCash: 0 }
  try {
    await ensureCreditsSchema()

    // Claim (or read back) the cutoff. INSERT … ON CONFLICT DO NOTHING then
    // SELECT: two admins pressing the button together agree on one cutoff
    // rather than each stamping their own.
    await query(
      `INSERT INTO credit_redenominations (id, factor, cutoff, run_by)
       VALUES ($1, $2, now(), $3)
       ON CONFLICT (id) DO NOTHING`,
      [REDENOMINATION_REFERENCE, REDENOMINATION_FACTOR, runBy],
    )
    const stamp = await query<{ cutoff: string; factor: number }>(
      `SELECT cutoff::text, factor FROM credit_redenominations WHERE id = $1`,
      [REDENOMINATION_REFERENCE],
    )
    const cutoff = stamp[0]?.cutoff
    const factor = stamp[0]?.factor ?? REDENOMINATION_FACTOR
    if (!cutoff) return { ...empty, reason: 'error' }

    const accounts = await query<{ broker_id: string }>(
      `SELECT broker_id FROM broker_credit_accounts ORDER BY broker_id`,
      [],
    )

    let alreadyDone = 0
    let scaled = 0
    let addedCash = 0

    for (const { broker_id: brokerId } of accounts) {
      // One account per transaction, under the same row lock every spend takes,
      // so a broker launching a campaign mid-migration cannot interleave with
      // their own scaling. One big transaction would hold every account locked
      // for the length of the run.
      const moved = await withTransaction(async (q) => {
        const account = await lockAccount(q, brokerId)
        if (!account.locked) return 0

        const rows = await q<{ balance: number; allocated: number }>(
          `SELECT ${BALANCE_SUM('')} AS balance,
                  (SELECT COALESCE(allocated, 0)::integer
                     FROM broker_credit_accounts WHERE broker_id = $1) AS allocated
           FROM credit_ledger
           WHERE broker_id = $1 AND created_at < $2::timestamptz`,
          [brokerId, cutoff],
        )
        const oldBalance = rows[0]?.balance ?? 0
        const oldAllocated = rows[0]?.allocated ?? 0
        const top = (factor - 1) * oldBalance

        // A zero or negative balance gets no entry — there is nothing to scale,
        // and writing a 0 row would fail isValidCreditAmount anyway. An overdrawn
        // account is left for a human: multiplying a debt by ten silently is not
        // a migration, it is a decision.
        if (top <= 0 || !isValidCreditAmount(top)) return 0

        const booked = await insertLedgerOnce(q, {
          brokerId,
          type: 'adjustment',
          amount: top,
          note: `Re-denominated to Cash — 1 Cash = AED 1 (was ${oldBalance} × AED ${factor})`,
          reference: REDENOMINATION_REFERENCE,
          meta: {
            factor,
            balance_before: oldBalance,
            balance_after: oldBalance * factor,
            cutoff,
          },
          createdBy: runBy,
        })
        if (!booked) return 0

        // `allocated` is a stored column (the usage bar's denominator), unlike
        // total_spent which the view re-derives from the ledger and which
        // therefore scales itself. Left alone it would read "1,200 of 40 used".
        await q(
          `UPDATE broker_credit_accounts
           SET allocated = $2, updated_at = now()
           WHERE broker_id = $1`,
          [brokerId, oldAllocated * factor],
        )
        return top
      })

      if (moved > 0) { scaled++; addedCash += moved } else { alreadyDone++ }
    }

    return { ok: true, alreadyDone, scaled, addedCash }
  } catch {
    return { ...empty, reason: 'error' }
  }
}

/** Has the re-denomination already run? The bank screen asks before offering
 *  the button, so nobody is invited to press something that will do nothing. */
export async function redenominationStatus(): Promise<
  { ran: false } | { ran: true; at: string; by: string | null }
> {
  try {
    await ensureCreditsSchema()
    const rows = await query<{ run_at: string; run_by: string | null }>(
      `SELECT run_at::text, run_by FROM credit_redenominations WHERE id = $1`,
      [REDENOMINATION_REFERENCE],
    )
    const row = rows[0]
    return row ? { ran: true, at: row.run_at, by: row.run_by } : { ran: false }
  } catch { return { ran: false } }
}

/** Persist a broker's tier (creates the account row when missing). */
export async function setBrokerTier(
  brokerId: string,
  tier: CreditTier
): Promise<{ ok: boolean; reason?: 'invalid' | 'error' }> {
  if (!brokerId) return { ok: false, reason: 'invalid' }
  try {
    await ensureCreditsSchema()
    await withTransaction(async (q) => {
      // Same lock as every other account mutation. The tier is written FIRST so
      // a due cycle is granted at the tier the broker now holds — and because a
      // tier assignment is how many accounts come into existence, the rollover
      // right after it is what gives a brand-new broker the quota their tier
      // advertises instead of an empty first month.
      const account = await lockAccount(q, brokerId)
      if (!account.locked) throw new Error('could not lock credit account')
      await q(
        `UPDATE broker_credit_accounts SET tier = $2, updated_at = now() WHERE broker_id = $1`,
        [brokerId, tier],
      )
      await rollMonthlyQuotaLocked(q, brokerId, account.created)
    })
    return { ok: true }
  } catch { return { ok: false, reason: 'error' } }
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
         -- The real next reset. The cycle is calendar-month based and rolls
         -- lazily the next time each account is touched, so the stored
         -- cycle_end of a broker nobody has touched yet is history; the date
         -- their quota actually tops up on is the start of next month.
         CASE WHEN b.broker_id IS NOT NULL THEN
           ((date_trunc('month', now() AT TIME ZONE '${CYCLE_TZ}') + interval '1 month')
              AT TIME ZONE '${CYCLE_TZ}')::text
         END                                AS cycle_end
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
