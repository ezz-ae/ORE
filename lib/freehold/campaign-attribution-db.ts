/**
 * Writing the attribution, and seeding the mark that decides what it costs.
 *
 * Rules live in campaign-attribution.ts (pure). This module gathers the facts
 * they need and performs what they allow.
 *
 * The two writes belong together and are done in that order for a reason: the
 * settlements row carries the high-water mark, and if the brokers row landed
 * first, an hourly settlement firing in the gap would find an owner with no
 * mark and bill the campaign's entire history — the exact outcome the default
 * exists to prevent. Seeding the mark first makes the gap harmless.
 */
import { query } from '@/lib/db'
import { logAuthority } from './authority-db'
import { walletFor, ensureBankWallets } from './bank-db'
import { ensureSettlementSchema } from './ad-settlement-db'
import {
  mayAttach, seedMark, immediateCharge,
  type BillingStart, type AttributionFacts, type AttributionVerdict,
} from './campaign-attribution'
import type { Role } from './session-types'

export interface Actor { email: string; role: Role }

/** Campaigns on the account with no wallet behind them, worst spender first. */
export interface UnattributedCampaign {
  campaignId: string
  name: string
  status: string
  spendAed: number
}

/** Who currently pays for this campaign, if anyone. */
export async function ownerOf(campaignId: string): Promise<string | null> {
  try {
    const rows = await query<{ broker_id: string }>(
      `SELECT broker_id FROM meta_campaign_brokers WHERE campaign_id = $1 LIMIT 1`,
      [campaignId],
    )
    return rows[0]?.broker_id ?? null
  } catch {
    // The table is created lazily by the launch route. Absent means nothing has
    // ever been attributed, which is genuinely "no owner".
    return null
  }
}

async function brokerExists(brokerId: string): Promise<boolean> {
  try {
    const rows = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM freehold_site_users WHERE lower(email) = lower($1)`,
      [brokerId],
    )
    return Number(rows[0]?.n ?? 0) > 0
  } catch {
    return false
  }
}

export interface AttachResult {
  ok: boolean
  verdict: AttributionVerdict
  /** What the broker will be charged on the next run. Zero on the default. */
  charge?: number
  mark?: number
}

/**
 * Attach a wallet to a campaign that has been spending without one.
 *
 * `start` defaults to 'now' at every caller: the broker was not asked when the
 * money was spent, so they are not billed for it on the strength of a
 * dropdown. 'beginning' is a deliberate choice and is recorded as one.
 */
export async function attachWallet(
  campaignId: string,
  brokerId: string,
  spendAed: number | null,
  start: BillingStart,
  actor: Actor,
): Promise<AttachResult> {
  const facts: AttributionFacts = {
    campaignExists: true,
    brokerExists: await brokerExists(brokerId),
    currentOwnerId: await ownerOf(campaignId),
    spendAed,
  }
  const verdict = mayAttach(actor.role, facts)

  const charge = immediateCharge(start, spendAed ?? 0)
  await logAuthority({
    actorEmail: actor.email,
    actorRole: actor.role,
    action: 'campaign.edit',
    targetType: 'campaign',
    targetId: campaignId,
    decision: {
      allowed: verdict.allowed,
      reason: verdict.allowed ? 'management' : 'insufficient_role',
    },
    detail: verdict.allowed
      ? `attributed to ${brokerId}; billing starts ${start}; spend so far AED ${Math.round(spendAed ?? 0)}`
        + (charge > 0 ? `; WILL CHARGE AED ${charge} on the next settlement` : '; nothing historic charged')
      : `refused: ${verdict.refusal}`,
  })

  if (!verdict.allowed) return { ok: false, verdict }

  const mark = seedMark(start, spendAed ?? 0)

  // THE MARK GOES FIRST. An hourly settlement firing between these two writes
  // would otherwise find an owner and no mark, and bill the whole history.
  await ensureSettlementSchema()
  await ensureBankWallets()
  const walletId = await walletFor(brokerId, brokerId)
  await query(
    `INSERT INTO freehold_ad_settlements
       (campaign_id, platform, owner_id, wallet_id, campaign_name, settled_aed, spend_aed)
     VALUES ($1, 'meta', $2, $3, '', $4, $5)
     ON CONFLICT (campaign_id) DO UPDATE
       SET owner_id = EXCLUDED.owner_id,
           wallet_id = EXCLUDED.wallet_id,
           settled_aed = EXCLUDED.settled_aed,
           updated_at = now()`,
    [campaignId, brokerId, walletId, mark, Math.round(spendAed ?? 0)],
  )

  // Created lazily by the launch route, so a system that has never launched
  // through this product has no table to insert into — which is exactly the
  // account this feature exists for.
  await query(
    `CREATE TABLE IF NOT EXISTS meta_campaign_brokers (
       campaign_id  TEXT PRIMARY KEY,
       broker_id    TEXT NOT NULL,
       campaign_name TEXT,
       created_at   TIMESTAMPTZ DEFAULT NOW()
     )`,
  )
  await query(
    `INSERT INTO meta_campaign_brokers (campaign_id, broker_id)
     VALUES ($1, $2)
     ON CONFLICT (campaign_id) DO UPDATE SET broker_id = EXCLUDED.broker_id`,
    [campaignId, brokerId],
  )

  return { ok: true, verdict, charge, mark }
}
