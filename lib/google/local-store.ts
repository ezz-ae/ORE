/**
 * Local persistence fallback for the Google Ads flow.
 *
 * When Google Ads credentials are not configured, the API routes use this store
 * instead of returning 503, so create / launch / pause / resume work end to end
 * in-app (mirroring how the Meta flow persists). The table is seeded once from
 * the demo campaigns so the unconfigured experience is fully interactive.
 *
 * Every call fails soft: if the DB is also unavailable, list/get fall back to the
 * static demo campaigns and create/update return a synthesized object so the UI
 * still behaves, just without persistence.
 */
import { query } from '@/lib/db'
import { demoCampaigns } from '@/lib/google/demo-data'
import type { GoogleCampaign, LaunchGoogleCampaignPayload } from '@/lib/google/types'

const M = 1_000_000

let ensured: Promise<void> | null = null
async function ensure(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS freehold_site_google_campaigns (
          id          text PRIMARY KEY,
          status      text NOT NULL,
          data        jsonb NOT NULL,
          created_by  text,
          created_at  timestamptz NOT NULL DEFAULT now()
        )`)
      // Seed demo campaigns once so the unconfigured view is interactive.
      for (const c of demoCampaigns) {
        await query(
          `INSERT INTO freehold_site_google_campaigns (id, status, data, created_at)
           VALUES ($1, $2, $3, now() - INTERVAL '7 days') ON CONFLICT (id) DO NOTHING`,
          [c.id, c.status, JSON.stringify(c)],
        )
      }
    })().catch((e) => { ensured = null; throw e })
  }
  await ensured
}

const withStatus = (row: { status: string; data: GoogleCampaign }): GoogleCampaign => ({
  ...row.data,
  status: row.status as GoogleCampaign['status'],
})

export async function listLocalCampaigns(): Promise<GoogleCampaign[]> {
  try {
    await ensure()
    const rows = await query<{ status: string; data: GoogleCampaign }>(
      `SELECT status, data FROM freehold_site_google_campaigns ORDER BY created_at DESC`,
    )
    return rows.map(withStatus)
  } catch {
    return demoCampaigns
  }
}

export async function getLocalCampaign(id: string): Promise<GoogleCampaign | null> {
  try {
    await ensure()
    const [row] = await query<{ status: string; data: GoogleCampaign }>(
      `SELECT status, data FROM freehold_site_google_campaigns WHERE id = $1 LIMIT 1`, [id],
    )
    return row ? withStatus(row) : null
  } catch {
    return demoCampaigns.find((c) => c.id === id) ?? null
  }
}

export async function updateLocalCampaignStatus(id: string, status: GoogleCampaign['status']): Promise<GoogleCampaign | null> {
  try {
    await ensure()
    await query(
      `UPDATE freehold_site_google_campaigns
       SET status = $2, data = jsonb_set(data, '{status}', to_jsonb($2::text))
       WHERE id = $1`, [id, status],
    )
  } catch { /* fail soft */ }
  return getLocalCampaign(id)
}

export async function createLocalCampaign(p: LaunchGoogleCampaignPayload, createdBy?: string): Promise<GoogleCampaign> {
  const id = `local-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, '').slice(0, 12)}`
  const campaign: GoogleCampaign = {
    id,
    resourceName: `customers/local/campaigns/${id}`,
    name: p.campaignName,
    status: 'PAUSED',
    type: p.type,
    biddingStrategyType: p.biddingStrategy,
    dailyBudgetMicros: Math.round((p.dailyBudgetAED || 0) * M),
    targetCpaMicros: p.targetCpaAED ? Math.round(p.targetCpaAED * M) : undefined,
    targetRoas: p.targetRoas,
    startDate: p.startDate || new Date().toISOString().slice(0, 10),
    endDate: p.endDate,
    metrics: { impressions: 0, clicks: 0, costMicros: 0, conversions: 0, conversionsValue: 0, ctr: 0, averageCpcMicros: 0 },
  }
  try {
    await ensure()
    await query(
      `INSERT INTO freehold_site_google_campaigns (id, status, data, created_by)
       VALUES ($1, $2, $3, $4)`,
      [id, campaign.status, JSON.stringify(campaign), createdBy ?? null],
    )
  } catch { /* fail soft — return the synthesized campaign even without persistence */ }
  return campaign
}
