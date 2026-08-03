// lib/freehold/machine-log.ts
//
// The Ads Machine's memory: every action it actually applied to a live campaign
// (who, what, when). Real, append-only — the Machine page reads this back so its
// "what I did" history is genuine, never fabricated.

import { randomUUID } from 'node:crypto'
import { query, ensureOnce } from '@/lib/db'

export interface MachineAction {
  id: string
  action: string
  platform: string
  campaignId: string
  campaignName: string
  detail: string
  by: string
  createdAt: string
}

async function ensure() {
  await ensureOnce('freehold_machine_actions', async () => {
    await query(`
    CREATE TABLE IF NOT EXISTS freehold_machine_actions (
      id            text PRIMARY KEY,
      action        text NOT NULL,
      platform      text NOT NULL,
      campaign_id   text NOT NULL,
      campaign_name text NOT NULL,
      detail        text NOT NULL DEFAULT '',
      applied_by    text NOT NULL,
      created_at    timestamptz NOT NULL DEFAULT now()
    )
  `)
  })
}

export async function recordMachineAction(a: {
  action: string; platform: string; campaignId: string; campaignName: string; detail?: string; by: string
}): Promise<void> {
  await ensure()
  await query(
    `INSERT INTO freehold_machine_actions (id, action, platform, campaign_id, campaign_name, detail, applied_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [randomUUID(), a.action, a.platform, a.campaignId, a.campaignName, a.detail ?? '', a.by],
  )
}

export async function listMachineActions(limit = 20): Promise<MachineAction[]> {
  await ensure()
  const rows = await query<{
    id: string; action: string; platform: string; campaign_id: string;
    campaign_name: string; detail: string; applied_by: string; created_at: string
  }>(
    `SELECT id, action, platform, campaign_id, campaign_name, detail, applied_by, created_at
       FROM freehold_machine_actions ORDER BY created_at DESC LIMIT $1`,
    [Math.min(limit, 100)],
  )
  return rows.map((r) => ({
    id: r.id, action: r.action, platform: r.platform, campaignId: r.campaign_id,
    campaignName: r.campaign_name, detail: r.detail, by: r.applied_by, createdAt: r.created_at,
  }))
}
