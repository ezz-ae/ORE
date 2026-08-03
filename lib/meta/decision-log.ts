import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'
import { randomUUID } from 'node:crypto'

// Every autonomous action the intent router takes is recorded here so the admin
// dashboard shows exactly what the AI did with brokers' credits and why —
// accountability is what makes silent auto-acting acceptable. Read-heavy,
// append-only; a failed write must never block an ad action.

export type DecisionAction =
  | 'new_campaign' | 'new_adset' | 'new_ad' | 'increase_budget' | 'hold'
export type DecisionOutcome = 'auto' | 'capped' | 'blocked'

export interface CampaignDecision {
  id: string
  projectSlug: string
  campaignId: string | null
  brokerId: string
  action: DecisionAction
  /** 'auto' = executed autonomously, 'capped'/'blocked' = partial/held for admin. */
  outcome: DecisionOutcome
  reason: string
  /** Budget before/after in AED, when the action moved money. */
  spendBeforeAED: number | null
  spendAfterAED: number | null
  createdAt: string
}

const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_campaign_decisions (
      id            text PRIMARY KEY,
      project_slug  text,
      campaign_id   text,
      broker_id     text,
      action        text NOT NULL,
      outcome       text NOT NULL,
      reason        text,
      spend_before  numeric,
      spend_after   numeric,
      created_at    timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS idx_campaign_decisions_created ON freehold_campaign_decisions (created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_campaign_decisions_project ON freehold_campaign_decisions (project_slug)`)
}
const ensureOnce = () => dbEnsureOnce('freehold_campaign_decisions', ensure)

export async function recordDecision(d: {
  projectSlug: string; campaignId?: string | null; brokerId: string
  action: DecisionAction; outcome: DecisionOutcome; reason: string
  spendBeforeAED?: number | null; spendAfterAED?: number | null
}): Promise<void> {
  try {
    await ensureOnce()
    await query(
      `INSERT INTO freehold_campaign_decisions
        (id, project_slug, campaign_id, broker_id, action, outcome, reason, spend_before, spend_after)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        `dec_${randomUUID().slice(0, 12)}`, d.projectSlug, d.campaignId ?? null, d.brokerId,
        d.action, d.outcome, d.reason.slice(0, 600),
        d.spendBeforeAED ?? null, d.spendAfterAED ?? null,
      ],
    )
  } catch {
    // append-only telemetry — never block the actual ad action on a log write
  }
}

const mapRow = (r: {
  id: string; project_slug: string | null; campaign_id: string | null; broker_id: string | null
  action: string; outcome: string; reason: string | null; spend_before: string | null
  spend_after: string | null; created_at: string
}): CampaignDecision => ({
  id: r.id,
  projectSlug: r.project_slug || '',
  campaignId: r.campaign_id,
  brokerId: r.broker_id || '',
  action: r.action as DecisionAction,
  outcome: r.outcome as DecisionOutcome,
  reason: r.reason || '',
  spendBeforeAED: r.spend_before === null ? null : Number(r.spend_before),
  spendAfterAED: r.spend_after === null ? null : Number(r.spend_after),
  createdAt: r.created_at,
})

/** Recent decisions for the admin dashboard, newest first (optionally by project). */
export async function listDecisions(opts?: { projectSlug?: string; limit?: number }): Promise<CampaignDecision[]> {
  try {
    await ensureOnce()
    const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500)
    const rows = opts?.projectSlug
      ? await query(
          `SELECT id, project_slug, campaign_id, broker_id, action, outcome, reason, spend_before, spend_after, created_at::text
             FROM freehold_campaign_decisions WHERE project_slug = $1 ORDER BY created_at DESC LIMIT $2`,
          [opts.projectSlug, limit],
        )
      : await query(
          `SELECT id, project_slug, campaign_id, broker_id, action, outcome, reason, spend_before, spend_after, created_at::text
             FROM freehold_campaign_decisions ORDER BY created_at DESC LIMIT $1`,
          [limit],
        )
    return (rows as Parameters<typeof mapRow>[0][]).map(mapRow)
  } catch {
    return []
  }
}
