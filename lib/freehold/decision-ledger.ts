import { query } from '@/lib/db'

/**
 * DECISION LEDGER — the ONE read surface over every ad decision this system
 * has made, unifying the two memories that never talked to each other:
 *
 *   1. freehold_machine_actions            — operator-applied actions from the
 *      Optimizer / machine route (pause, resume, set_budget), written by
 *      lib/freehold/machine-log.ts.
 *   2. freehold_site_ads_machine_activity  — the autonomous Ads Machine's own
 *      log (trial_paused, budget_shift, launched, cap_enforced …).
 *
 * It is deliberately a READ layer over the existing tables — no migration, no
 * dual-write risk; each source keeps its own writer. What changes is that the
 * ledger is now an INPUT to decisions, not just a display: the planner
 * consults past condemnations before re-proposing an audience family, and the
 * advisor sees recent decisions so it never re-suggests what was just done.
 */

export interface DecisionRecord {
  id: string
  source: 'operator' | 'machine'
  action: string          // pause | resume | set_budget | trial_paused | budget_shift | launched | cap_enforced …
  platform: string        // meta | google | '' when unknown
  campaignId: string
  /** Operator rows carry the real campaign name; machine rows the trial label. */
  campaignName: string
  projectSlug: string | null
  detail: string
  by: string
  createdAt: string
}

export async function listDecisions(opts: { campaignId?: string; projectSlug?: string; limit?: number } = {}): Promise<DecisionRecord[]> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100)

  const operatorQ = (async (): Promise<DecisionRecord[]> => {
    // Operator actions have no project linkage — a projectSlug filter excludes them.
    if (opts.projectSlug) return []
    try {
      const params: unknown[] = []
      let sql = `SELECT id, action, platform, campaign_id, campaign_name, detail, applied_by, created_at::text
                   FROM freehold_machine_actions`
      if (opts.campaignId) { params.push(opts.campaignId); sql += ` WHERE campaign_id = $${params.length}` }
      params.push(limit)
      sql += ` ORDER BY created_at DESC LIMIT $${params.length}`
      const rows = await query<{ id: string; action: string; platform: string; campaign_id: string; campaign_name: string; detail: string; applied_by: string; created_at: string }>(sql, params)
      return rows.map((r) => ({
        id: r.id, source: 'operator' as const, action: r.action, platform: r.platform,
        campaignId: r.campaign_id, campaignName: r.campaign_name, projectSlug: null,
        detail: r.detail, by: r.applied_by, createdAt: r.created_at,
      }))
    } catch { return [] }
  })()

  const machineQ = (async (): Promise<DecisionRecord[]> => {
    try {
      const params: unknown[] = []
      let sql = `SELECT a.id, a.kind, a.detail, a.campaign_id, a.created_at::text,
                        c.channel, c.trial_label, c.project_slug
                   FROM freehold_site_ads_machine_activity a
                   LEFT JOIN freehold_site_ads_machine_campaigns c ON c.campaign_id = a.campaign_id
                  WHERE a.kind IN ('trial_paused','trial_resumed','budget_shift','launched','cap_enforced')`
      if (opts.campaignId) { params.push(opts.campaignId); sql += ` AND a.campaign_id = $${params.length}` }
      if (opts.projectSlug) { params.push(opts.projectSlug); sql += ` AND c.project_slug = $${params.length}` }
      params.push(limit)
      sql += ` ORDER BY a.created_at DESC LIMIT $${params.length}`
      const rows = await query<{ id: string; kind: string; detail: string; campaign_id: string | null; created_at: string; channel: string | null; trial_label: string | null; project_slug: string | null }>(sql, params)
      return rows.map((r) => ({
        id: r.id, source: 'machine' as const, action: r.kind, platform: r.channel ?? '',
        campaignId: r.campaign_id ?? '', campaignName: r.trial_label ?? '', projectSlug: r.project_slug,
        detail: r.detail, by: 'ads-machine', createdAt: r.created_at,
      }))
    } catch { return [] }
  })()

  const [operator, machine] = await Promise.all([operatorQ, machineQ])
  return [...operator, ...machine]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit)
}

export interface PastCondemnation {
  trialLabel: string
  campaignId: string
  qualityScore: number | null
  reasons: string[]
  createdAt: string
}

/** Every trial the machine ever paused for THIS project — across ALL machines.
 *  The planner consults this so a new machine doesn't amnesically re-propose an
 *  audience family that was already condemned on evidence. */
export async function listPastCondemnations(projectSlug: string): Promise<PastCondemnation[]> {
  try {
    const rows = await query<{ trial_label: string | null; campaign_id: string | null; data: unknown; created_at: string }>(
      `SELECT c.trial_label, a.campaign_id, a.data, a.created_at::text
         FROM freehold_site_ads_machine_activity a
         JOIN freehold_site_ads_machine_campaigns c ON c.campaign_id = a.campaign_id
        WHERE a.kind = 'trial_paused' AND c.project_slug = $1
        ORDER BY a.created_at DESC
        LIMIT 50`,
      [projectSlug],
    )
    return rows
      .filter((r) => !!r.trial_label)
      .map((r) => {
        const d = (r.data && typeof r.data === 'object' ? r.data : {}) as { reasons?: unknown; qualityScore?: unknown }
        return {
          trialLabel: String(r.trial_label),
          campaignId: r.campaign_id ?? '',
          qualityScore: typeof d.qualityScore === 'number' ? d.qualityScore : null,
          reasons: Array.isArray(d.reasons) ? d.reasons.map((x) => String(x)) : [],
          createdAt: r.created_at,
        }
      })
  } catch { return [] }
}
