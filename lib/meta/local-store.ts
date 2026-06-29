/**
 * Local persistence fallback for the Meta Ads flow — the mirror of
 * lib/google/local-store.ts.
 *
 * When Meta credentials are not configured, the API routes use this store
 * instead of returning 503, so launch / pause / resume / delete and the
 * campaign-detail view work end to end in-app. The table is seeded once from
 * the demo campaigns so the unconfigured experience is fully interactive.
 *
 * Every call fails soft: if the DB is also unavailable, list/get fall back to
 * the static demo campaigns and create returns a synthesized object so the UI
 * still behaves, just without persistence.
 */
import { query } from '@/lib/db'
import { demoCampaigns, type MetaCampaignWithInsights } from '@/lib/meta/demo-data'
import type { LaunchCampaignPayload, MetaCampaignStatus } from '@/lib/meta/types'

let ensured: Promise<void> | null = null
async function ensure(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS freehold_site_meta_campaigns (
          id          text PRIMARY KEY,
          status      text NOT NULL,
          data        jsonb NOT NULL,
          created_by  text,
          created_at  timestamptz NOT NULL DEFAULT now()
        )`)
      // Seed demo campaigns once so the unconfigured view is interactive.
      for (const c of demoCampaigns) {
        await query(
          `INSERT INTO freehold_site_meta_campaigns (id, status, data, created_at)
           VALUES ($1, $2, $3, now() - INTERVAL '7 days') ON CONFLICT (id) DO NOTHING`,
          [c.id, c.status, JSON.stringify(c)],
        )
      }
    })().catch((e) => { ensured = null; throw e })
  }
  await ensured
}

const withStatus = (row: { status: string; data: MetaCampaignWithInsights }): MetaCampaignWithInsights => ({
  ...row.data,
  status: row.status as MetaCampaignWithInsights['status'],
})

export async function listLocalCampaigns(): Promise<MetaCampaignWithInsights[]> {
  try {
    await ensure()
    const rows = await query<{ status: string; data: MetaCampaignWithInsights }>(
      `SELECT status, data FROM freehold_site_meta_campaigns WHERE status <> 'DELETED' ORDER BY created_at DESC`,
    )
    return rows.map(withStatus)
  } catch {
    return demoCampaigns
  }
}

export async function getLocalCampaign(id: string): Promise<MetaCampaignWithInsights | null> {
  try {
    await ensure()
    const [row] = await query<{ status: string; data: MetaCampaignWithInsights }>(
      `SELECT status, data FROM freehold_site_meta_campaigns WHERE id = $1 LIMIT 1`, [id],
    )
    return row ? withStatus(row) : null
  } catch {
    return demoCampaigns.find((c) => c.id === id) ?? null
  }
}

export async function updateLocalCampaignStatus(id: string, status: MetaCampaignStatus): Promise<boolean> {
  try {
    await ensure()
    await query(
      `UPDATE freehold_site_meta_campaigns
       SET status = $2, data = jsonb_set(data, '{status}', to_jsonb($2::text))
       WHERE id = $1`, [id, status],
    )
    return true
  } catch {
    return false
  }
}

export async function createLocalCampaign(
  p: LaunchCampaignPayload,
  createdBy?: string,
): Promise<{ campaignId: string; status: MetaCampaignStatus }> {
  const id = `local-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 14)}`
  const status: MetaCampaignStatus = p.launchStatus ?? 'PAUSED'
  const campaign: MetaCampaignWithInsights = {
    id,
    name: p.campaignName,
    status,
    objective: p.objective,
    daily_budget: String(Math.round((p.dailyBudgetAED || 0) * 100)), // fils
    created_time: new Date().toISOString(),
    start_time: new Date().toISOString(),
    insights: null,
  }
  try {
    await ensure()
    await query(
      `INSERT INTO freehold_site_meta_campaigns (id, status, data, created_by)
       VALUES ($1, $2, $3, $4)`,
      [id, status, JSON.stringify(campaign), createdBy ?? null],
    )
  } catch { /* fail soft — return the synthesized campaign even without persistence */ }
  return { campaignId: id, status }
}
