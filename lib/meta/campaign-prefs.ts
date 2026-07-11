import { query } from '@/lib/db'

// Per-campaign automation preferences — the wizard's "AI auto-enhancement"
// choice, persisted at launch and ENFORCED by the autopilot pass:
//   on       → rules apply and actions execute
//   approval → rule matches are recorded for a manager, nothing mutates
//   off      → the campaign is skipped entirely
export type AutoEnhanceMode = 'on' | 'approval' | 'off'

let ensured: Promise<void> | null = null
const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS meta_campaign_prefs (
      campaign_id  text PRIMARY KEY,
      auto_enhance text NOT NULL DEFAULT 'approval',
      updated_at   timestamptz NOT NULL DEFAULT now()
    )
  `)
}
const ensureOnce = async () => { if (!ensured) ensured = ensure().catch((e) => { ensured = null; throw e }); await ensured }

export async function setCampaignAutoEnhance(campaignId: string, mode: AutoEnhanceMode): Promise<void> {
  try {
    await ensureOnce()
    await query(
      `INSERT INTO meta_campaign_prefs (campaign_id, auto_enhance) VALUES ($1, $2)
       ON CONFLICT (campaign_id) DO UPDATE SET auto_enhance = $2, updated_at = now()`,
      [campaignId, mode],
    )
  } catch {
    // Preference persistence is best-effort — a failed write must not fail a launch.
  }
}

/** Map campaignId → mode for the given ids. Missing rows default to 'approval'. */
export async function getAutoEnhanceModes(campaignIds: string[]): Promise<Map<string, AutoEnhanceMode>> {
  const map = new Map<string, AutoEnhanceMode>()
  if (campaignIds.length === 0) return map
  try {
    await ensureOnce()
    const rows = await query<{ campaign_id: string; auto_enhance: string }>(
      `SELECT campaign_id, auto_enhance FROM meta_campaign_prefs WHERE campaign_id = ANY($1)`,
      [campaignIds],
    )
    for (const r of rows) {
      const m = r.auto_enhance === 'on' || r.auto_enhance === 'off' ? r.auto_enhance : 'approval'
      map.set(r.campaign_id, m)
    }
  } catch {
    // fall through — callers treat missing entries as 'approval' (safe default)
  }
  return map
}
