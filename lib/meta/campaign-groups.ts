import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'
import { randomUUID } from 'node:crypto'

// A Campaign Group folders 2+ campaigns that run the SAME offer under DIFFERENT
// objectives (e.g. a Meta lead-form campaign + a landing-page/traffic campaign)
// so they can be compared, A/B-read, and acted on together. Campaigns live in
// Meta (or the local fallback store); a group is a thin side-table keyed by
// campaign id — the same pattern as meta_campaign_prefs / meta_campaign_brokers.

export interface CampaignGroupMember {
  campaignId: string
  /** Meta objective or the wizard product key it was launched with. */
  objective: string
  /** Human label for the arm — e.g. "Lead form", "Landing page". */
  label: string
  addedAt: string
}

export interface CampaignGroup {
  id: string
  name: string
  /** The project the A/B is for (links back to inventory / the landing page). */
  projectSlug: string | null
  createdBy: string
  createdAt: string
  members: CampaignGroupMember[]
}

const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS meta_campaign_groups (
      id           text PRIMARY KEY,
      name         text NOT NULL,
      project_slug text,
      created_by   text NOT NULL,
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS meta_campaign_group_members (
      group_id     text NOT NULL,
      campaign_id  text NOT NULL,
      objective    text,
      label        text,
      created_at   timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (group_id, campaign_id)
    )
  `)
  // A campaign belongs to at most one group — the newest assignment wins.
  await query(`CREATE INDEX IF NOT EXISTS idx_group_members_campaign ON meta_campaign_group_members (campaign_id)`)
}
const ensureOnce = () => dbEnsureOnce('meta_campaign_groups', ensure)

const mapMember = (r: { campaign_id: string; objective: string | null; label: string | null; created_at: string }): CampaignGroupMember => ({
  campaignId: r.campaign_id,
  objective: r.objective || '',
  label: r.label || '',
  addedAt: r.created_at,
})

async function loadMembers(groupIds: string[]): Promise<Map<string, CampaignGroupMember[]>> {
  const byGroup = new Map<string, CampaignGroupMember[]>()
  if (!groupIds.length) return byGroup
  const rows = await query<{ group_id: string; campaign_id: string; objective: string | null; label: string | null; created_at: string }>(
    `SELECT group_id, campaign_id, objective, label, created_at::text
       FROM meta_campaign_group_members
      WHERE group_id = ANY($1)
      ORDER BY created_at ASC`,
    [groupIds],
  )
  for (const r of rows) {
    const list = byGroup.get(r.group_id) ?? []
    list.push(mapMember(r))
    byGroup.set(r.group_id, list)
  }
  return byGroup
}

/** Groups owned by this user, newest first, each with its members. */
export async function listCampaignGroups(email: string): Promise<CampaignGroup[]> {
  try {
    await ensureOnce()
    const groups = await query<{ id: string; name: string; project_slug: string | null; created_by: string; created_at: string }>(
      `SELECT id, name, project_slug, created_by, created_at::text
         FROM meta_campaign_groups
        WHERE created_by = $1
        ORDER BY created_at DESC`,
      [email],
    )
    const members = await loadMembers(groups.map((g) => g.id))
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      projectSlug: g.project_slug,
      createdBy: g.created_by,
      createdAt: g.created_at,
      members: members.get(g.id) ?? [],
    }))
  } catch {
    return []
  }
}

/** A single group by id (no ownership filter — the API enforces ownership). */
export async function getCampaignGroup(id: string): Promise<CampaignGroup | null> {
  try {
    await ensureOnce()
    const rows = await query<{ id: string; name: string; project_slug: string | null; created_by: string; created_at: string }>(
      `SELECT id, name, project_slug, created_by, created_at::text FROM meta_campaign_groups WHERE id = $1 LIMIT 1`,
      [id],
    )
    const g = rows[0]
    if (!g) return null
    const members = await loadMembers([id])
    return {
      id: g.id, name: g.name, projectSlug: g.project_slug, createdBy: g.created_by, createdAt: g.created_at,
      members: members.get(id) ?? [],
    }
  } catch {
    return null
  }
}

export async function createCampaignGroup(
  email: string,
  input: { name: string; projectSlug?: string | null; members?: Array<{ campaignId: string; objective?: string; label?: string }> },
): Promise<CampaignGroup | null> {
  try {
    await ensureOnce()
    const id = `grp_${randomUUID().slice(0, 12)}`
    await query(
      `INSERT INTO meta_campaign_groups (id, name, project_slug, created_by) VALUES ($1, $2, $3, $4)`,
      [id, input.name.slice(0, 160), input.projectSlug?.trim() || null, email],
    )
    for (const m of input.members ?? []) {
      if (!m.campaignId) continue
      await addGroupMember(id, m.campaignId, m.objective ?? '', m.label ?? '')
    }
    return getCampaignGroup(id)
  } catch {
    return null
  }
}

/** Assign a campaign to a group. A campaign lives in ONE group — moving it
 *  removes it from any previous group first. */
export async function addGroupMember(groupId: string, campaignId: string, objective: string, label: string): Promise<void> {
  await ensureOnce()
  await query(`DELETE FROM meta_campaign_group_members WHERE campaign_id = $1`, [campaignId])
  await query(
    `INSERT INTO meta_campaign_group_members (group_id, campaign_id, objective, label)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (group_id, campaign_id) DO UPDATE SET objective = $3, label = $4`,
    [groupId, campaignId, objective.slice(0, 60) || null, label.slice(0, 80) || null],
  )
}

export async function removeGroupMember(groupId: string, campaignId: string): Promise<void> {
  await ensureOnce()
  await query(`DELETE FROM meta_campaign_group_members WHERE group_id = $1 AND campaign_id = $2`, [groupId, campaignId])
}

export async function renameCampaignGroup(id: string, name: string): Promise<void> {
  await ensureOnce()
  await query(`UPDATE meta_campaign_groups SET name = $2 WHERE id = $1`, [id, name.slice(0, 160)])
}

export async function deleteCampaignGroup(id: string): Promise<void> {
  await ensureOnce()
  await query(`DELETE FROM meta_campaign_group_members WHERE group_id = $1`, [id])
  await query(`DELETE FROM meta_campaign_groups WHERE id = $1`, [id])
}

/** Of the given campaign ids, the subset attributed to this broker (via
 *  meta_campaign_brokers). Used to stop a broker foldering another broker's
 *  campaign into their group (which would leak that campaign's metrics and
 *  unlink it from its owner). Managers bypass this and may fold any campaign. */
export async function filterOwnedCampaigns(brokerId: string, campaignIds: string[]): Promise<Set<string>> {
  const owned = new Set<string>()
  if (!brokerId || !campaignIds.length) return owned
  try {
    const rows = await query<{ campaign_id: string }>(
      `SELECT campaign_id FROM meta_campaign_brokers WHERE broker_id = $1 AND campaign_id = ANY($2)`,
      [brokerId, campaignIds],
    )
    for (const r of rows) owned.add(r.campaign_id)
  } catch {
    // table missing / DB error → broker owns nothing here (fail closed)
  }
  return owned
}

/** Map campaignId → its group's { id, name } for the given ids (for list badges). */
export async function getGroupsForCampaigns(campaignIds: string[]): Promise<Map<string, { id: string; name: string }>> {
  const map = new Map<string, { id: string; name: string }>()
  if (!campaignIds.length) return map
  try {
    await ensureOnce()
    const rows = await query<{ campaign_id: string; group_id: string; name: string }>(
      `SELECT m.campaign_id, m.group_id, g.name
         FROM meta_campaign_group_members m
         JOIN meta_campaign_groups g ON g.id = m.group_id
        WHERE m.campaign_id = ANY($1)`,
      [campaignIds],
    )
    for (const r of rows) map.set(r.campaign_id, { id: r.group_id, name: r.name })
  } catch {
    // best-effort
  }
  return map
}
