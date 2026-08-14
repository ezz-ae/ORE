/**
 * Billing ads against delivered spend, on Postgres.
 *
 * The rules are pure and live in ad-settlement.ts. This is where the mark is
 * kept and the money actually moves — through `spendCash`, which goes through
 * `postTransfer`, which is still the only function in the system that writes to
 * the ledger.
 *
 * ── ONE ROW PER CAMPAIGN, HOLDING A TOTAL ────────────────────────────────
 *
 * `freehold_ad_settlements.settled_aed` is a HIGH-WATER MARK, not a running
 * sum. Nothing here ever adds to it blindly: each tick reads the platform's
 * all-time spend, asks what should be settled by now, and writes the answer.
 * That is what makes the whole thing safe to run on a timer nobody watches — a
 * missed tick catches up, a repeated tick moves nothing.
 *
 * ── THE MARK MOVES AFTER THE MONEY, NEVER BEFORE ─────────────────────────
 *
 * `spendCash` is idempotent on its reference, and the reference is derived from
 * the mark being reached. So the failure that matters — a crash after the
 * transfer and before the UPDATE — is repaired by the next tick: it recomputes
 * the same target, builds the same reference, and `postTransfer` answers
 * "already done" without moving anything a second time. The opposite order
 * would record a payment that never happened.
 *
 * ── AND THE PAUSE IS PART OF THE BILLING, NOT A SEPARATE JOB ─────────────
 *
 * Nothing is reserved at launch any more, so a wallet running dry is the only
 * thing that stops real money leaving the company. Discovering that here and
 * leaving the pause to some other process would put a gap between the two
 * exactly where it costs money, so the pauser is passed in and called on the
 * same tick.
 */
import { query, ensureOnce } from '@/lib/db'
import {
  settle, walletVerdict, settlementReference,
  type SettleVerdict, type WalletVerdict,
} from '@/lib/freehold/ad-settlement'
import { spendCash, walletFor, ensureBankWallets } from '@/lib/freehold/bank-db'
import { listWallets } from '@/lib/freehold/wallet-db'
import type { Actor } from '@/lib/freehold/bank'
import type { Role } from '@/lib/freehold/session-types'

async function ensure(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_ad_settlements (
      campaign_id   text PRIMARY KEY,
      platform      text NOT NULL,
      owner_id      text NOT NULL,
      wallet_id     text NOT NULL,
      ad_account_id text,
      campaign_name text NOT NULL DEFAULT '',
      settled_aed   bigint NOT NULL DEFAULT 0 CHECK (settled_aed >= 0),
      spend_aed     bigint NOT NULL DEFAULT 0,
      shortfall_aed bigint NOT NULL DEFAULT 0,
      paused_at     timestamptz,
      updated_at    timestamptz NOT NULL DEFAULT now()
    )
  `)
  // The campaigns that owe money the wallet could not cover — the list the
  // pause loop reads, and the one a finance screen should open on.
  await query(`CREATE INDEX IF NOT EXISTS freehold_ad_settlements_short_idx
               ON freehold_ad_settlements (shortfall_aed DESC) WHERE shortfall_aed > 0`)
  await query(`CREATE INDEX IF NOT EXISTS freehold_ad_settlements_owner_idx
               ON freehold_ad_settlements (owner_id)`)
}

export const ensureSettlementSchema = () => ensureOnce('freehold_ad_settlements', ensure)

export interface SpendReport {
  campaignId: string
  platform: 'meta' | 'google'
  campaignName: string
  adAccountId: string | null
  /** All-time spend the platform reports, in dirhams. */
  spendAed: number
  /** Whoever launched it. Their wallet pays. */
  ownerId: string
  ownerRole: Role
}

export interface SettlementOutcome {
  campaignId: string
  verdict: SettleVerdict
  wallet: WalletVerdict
  movedAed: number
  markAed: number
  shortfallAed: number
  /** True when the pauser was called and said it worked. */
  paused: boolean
}

/**
 * Bill one campaign for what it has delivered.
 *
 * `pause` is passed in rather than imported so this module stays testable and,
 * more importantly, so the two platforms can each supply their own — pausing a
 * Meta campaign and a Google one are different API calls and neither belongs in
 * a billing module.
 */
export async function settleCampaign(
  report: SpendReport,
  pause?: (r: SpendReport) => Promise<boolean>,
): Promise<SettlementOutcome> {
  await ensureSettlementSchema()
  await ensureBankWallets()

  const walletId = await walletFor(report.ownerId, report.ownerId)
  const wallets = await listWallets()
  const wallet = wallets.find((w) => w.id === walletId)

  const prior = await query<{ settled_aed: string }>(
    `SELECT settled_aed FROM freehold_ad_settlements WHERE campaign_id = $1`,
    [report.campaignId],
  )
  const settledAed = Number(prior[0]?.settled_aed ?? 0)

  const decision = settle({
    spendAed: report.spendAed,
    settledAed,
    walletBalance: wallet?.balance ?? 0,
  })
  const wallet_verdict = walletVerdict(decision)

  let moved = 0
  if (decision.moveAed > 0) {
    const actor: Actor = { userId: report.ownerId, role: report.ownerRole, walletId }
    const charged = await spendCash({
      actor,
      amount: decision.moveAed,
      // ADS PROVE THEMSELVES. The campaign id is the receipt and it reconciles
      // against the platform's own invoice with nobody re-typing an id.
      proof: {
        kind: 'ads',
        campaignId: report.campaignId,
        adAccountId: report.adAccountId,
      },
      note: `${report.platform} · ${report.campaignName}`,
      // Derived from the MARK, not the attempt — see the header.
      reference: settlementReference(report.campaignId, decision.markAed),
    })
    // A refused charge leaves the mark where it was. The next tick will try the
    // same movement again, which is the right behaviour: the spend is real and
    // still unbilled.
    if (charged.ok) moved = decision.moveAed
  }

  const markAed = moved > 0 ? decision.markAed : settledAed
  const shortfall = decision.shortfallAed + (moved > 0 ? 0 : decision.moveAed)

  await query(
    `INSERT INTO freehold_ad_settlements
       (campaign_id, platform, owner_id, wallet_id, ad_account_id, campaign_name,
        settled_aed, spend_aed, shortfall_aed, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
     ON CONFLICT (campaign_id) DO UPDATE SET
       platform      = EXCLUDED.platform,
       owner_id      = EXCLUDED.owner_id,
       wallet_id     = EXCLUDED.wallet_id,
       ad_account_id = EXCLUDED.ad_account_id,
       campaign_name = EXCLUDED.campaign_name,
       -- GREATEST, never assignment. A restatement must not rewind the mark,
       -- and two ticks racing must not let the slower one undo the faster.
       settled_aed   = GREATEST(freehold_ad_settlements.settled_aed, EXCLUDED.settled_aed),
       spend_aed     = EXCLUDED.spend_aed,
       shortfall_aed = EXCLUDED.shortfall_aed,
       updated_at    = now()`,
    [report.campaignId, report.platform, report.ownerId, walletId, report.adAccountId,
     report.campaignName, markAed, Math.round(report.spendAed), shortfall],
  )

  let paused = false
  if (wallet_verdict === 'pause' && pause) {
    paused = await pause(report).catch(() => false)
    if (paused) {
      await query(
        `UPDATE freehold_ad_settlements SET paused_at = now() WHERE campaign_id = $1`,
        [report.campaignId],
      )
    }
  }

  return {
    campaignId: report.campaignId,
    verdict: decision.verdict,
    wallet: wallet_verdict,
    movedAed: moved,
    markAed,
    shortfallAed: shortfall,
    paused,
  }
}

export interface UnbilledRow {
  campaignId: string
  platform: string
  campaignName: string
  ownerId: string
  spendAed: number
  settledAed: number
  shortfallAed: number
  pausedAt: string | null
}

/**
 * Spend the company paid for and could not bill.
 *
 * The number a finance screen has to open on. Without a reservation, this is
 * the entire exposure of the model, and a system that runs this way and does
 * not show it is hiding its own loss.
 */
export async function unbilled(): Promise<UnbilledRow[]> {
  await ensureSettlementSchema()
  const rows = await query(
    `SELECT * FROM freehold_ad_settlements WHERE shortfall_aed > 0
      ORDER BY shortfall_aed DESC LIMIT 200`,
  )
  return rows.map((r) => ({
    campaignId: String(r.campaign_id),
    platform: String(r.platform),
    campaignName: String(r.campaign_name ?? ''),
    ownerId: String(r.owner_id),
    spendAed: Number(r.spend_aed ?? 0),
    settledAed: Number(r.settled_aed ?? 0),
    shortfallAed: Number(r.shortfall_aed ?? 0),
    pausedAt: r.paused_at == null ? null : String(r.paused_at),
  }))
}
