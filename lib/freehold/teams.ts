/**
 * Teams and the person behind each account.
 *
 * Two things live here, because they are the same idea seen from two ends:
 *
 * 1. THE PROFILE SPINE. "Everyone is a profile with all his belongs — take it
 *    from offer letter and go deeper in every aspect." An account row knew an
 *    email and a role; a person has a start date, a licence number, a title, a
 *    commission rate, targets they are measured against and someone they report
 *    to. Those facts start on the offer letter and then every number in the
 *    system hangs off them — a target is what makes "12 deals" good or bad.
 *
 * 2. THE REPORTING LINE. A team is a leader plus the people who report to them.
 *    That line is what scopes a leader's authority: `inActorsTeam` in the
 *    fairness rules is answered from here, so "you may not touch that lead"
 *    traces back to an actual org chart and not a guess.
 *
 * Everything is additive — columns via ALTER, tables via CREATE IF NOT EXISTS —
 * so an existing workspace keeps working with the fields simply empty.
 */

import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'
import { ensureUsersTable } from '@/lib/data'

// ── Schema ────────────────────────────────────────────────────────────────────

async function ensure(): Promise<void> {
  await ensureUsersTable()
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_teams (
      id             text PRIMARY KEY,
      name           text NOT NULL,
      leader_user_id text,
      created_at     timestamptz NOT NULL DEFAULT now()
    )
  `)
  // The offer-letter spine. Nullable throughout: an existing roster is not
  // retroactively wrong for lacking a BRN, it is simply incomplete, and the UI
  // says so rather than inventing values.
  await query(`
    ALTER TABLE freehold_site_users
      ADD COLUMN IF NOT EXISTS team_id           text,
      ADD COLUMN IF NOT EXISTS reports_to        text,
      ADD COLUMN IF NOT EXISTS start_date        date,
      ADD COLUMN IF NOT EXISTS employment_type   text,
      ADD COLUMN IF NOT EXISTS probation_end     date,
      ADD COLUMN IF NOT EXISTS rera_brn          text,
      ADD COLUMN IF NOT EXISTS offer_ref         text,
      ADD COLUMN IF NOT EXISTS target_deals_monthly   int,
      ADD COLUMN IF NOT EXISTS target_revenue_monthly numeric,
      ADD COLUMN IF NOT EXISTS notes             text
  `)
  await query(`CREATE INDEX IF NOT EXISTS freehold_site_users_team_idx ON freehold_site_users (team_id)`)
  await query(`CREATE INDEX IF NOT EXISTS freehold_site_teams_leader_idx ON freehold_site_teams (leader_user_id)`)
}

export const ensureTeamsSchema = () => dbEnsureOnce('freehold_site_teams', ensure)

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TeamRow {
  id: string
  name: string
  leaderUserId: string | null
  leaderName: string | null
  memberCount: number
}

export interface ProfileSpine {
  teamId: string | null
  teamName: string | null
  reportsTo: string | null
  reportsToName: string | null
  startDate: string | null
  employmentType: string | null
  probationEnd: string | null
  reraBrn: string | null
  offerRef: string | null
  orgTitle: string | null
  commissionRate: number | null
  targetDealsMonthly: number | null
  targetRevenueMonthly: number | null
  notes: string | null
}

/** Fields a manager may write on a profile. Anything else is ignored. */
export const EDITABLE_PROFILE_FIELDS = [
  'team_id', 'reports_to', 'start_date', 'employment_type', 'probation_end',
  'rera_brn', 'offer_ref', 'org_title', 'commission_rate',
  'target_deals_monthly', 'target_revenue_monthly', 'notes',
] as const
export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number]

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function listTeams(): Promise<TeamRow[]> {
  await ensureTeamsSchema()
  const rows = await query<{
    id: string; name: string; leader_user_id: string | null
    leader_name: string | null; member_count: string
  }>(
    `SELECT t.id, t.name, t.leader_user_id,
            l.name AS leader_name,
            (SELECT COUNT(*) FROM freehold_site_users u WHERE u.team_id = t.id)::text AS member_count
       FROM freehold_site_teams t
       LEFT JOIN freehold_site_users l ON l.id = t.leader_user_id
      ORDER BY t.name`,
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    leaderUserId: r.leader_user_id,
    leaderName: r.leader_name,
    memberCount: Number(r.member_count) || 0,
  }))
}

export async function getProfileSpine(userId: string): Promise<ProfileSpine | null> {
  await ensureTeamsSchema()
  const rows = await query<{
    team_id: string | null; team_name: string | null
    reports_to: string | null; reports_to_name: string | null
    start_date: string | null; employment_type: string | null; probation_end: string | null
    rera_brn: string | null; offer_ref: string | null; org_title: string | null
    commission_rate: string | null
    target_deals_monthly: number | null; target_revenue_monthly: string | null
    notes: string | null
  }>(
    `SELECT u.team_id, t.name AS team_name,
            u.reports_to, m.name AS reports_to_name,
            u.start_date::text, u.employment_type, u.probation_end::text,
            u.rera_brn, u.offer_ref, u.org_title, u.commission_rate::text,
            u.target_deals_monthly, u.target_revenue_monthly::text, u.notes
       FROM freehold_site_users u
       LEFT JOIN freehold_site_teams t ON t.id = u.team_id
       LEFT JOIN freehold_site_users m ON m.id = u.reports_to
      WHERE u.id = $1 LIMIT 1`,
    [userId],
  )
  const r = rows[0]
  if (!r) return null
  return {
    teamId: r.team_id,
    teamName: r.team_name,
    reportsTo: r.reports_to,
    reportsToName: r.reports_to_name,
    startDate: r.start_date,
    employmentType: r.employment_type,
    probationEnd: r.probation_end,
    reraBrn: r.rera_brn,
    offerRef: r.offer_ref,
    orgTitle: r.org_title,
    commissionRate: r.commission_rate == null ? null : Number(r.commission_rate),
    targetDealsMonthly: r.target_deals_monthly,
    targetRevenueMonthly: r.target_revenue_monthly == null ? null : Number(r.target_revenue_monthly),
    notes: r.notes,
  }
}

/**
 * The user ids a leader is responsible for: everyone in the team they lead,
 * plus anyone reporting directly to them. Returns an EMPTY array for a leader
 * with no team — which correctly denies every team-scoped action rather than
 * silently widening to the whole company.
 */
export async function teamMemberIds(leaderUserId: string): Promise<string[]> {
  await ensureTeamsSchema()
  const rows = await query<{ id: string; email: string | null }>(
    `SELECT u.id, u.email
       FROM freehold_site_users u
      WHERE u.reports_to = $1
         OR u.team_id IN (SELECT id FROM freehold_site_teams WHERE leader_user_id = $1)`,
    [leaderUserId],
  )
  // Leads store ownership as an id OR an email (see lead-access.ts), so a
  // membership check has to carry both spellings or it produces false denials.
  return rows.flatMap((r) => [r.id, r.email].filter((v): v is string => !!v))
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function createTeam(id: string, name: string, leaderUserId: string | null): Promise<TeamRow> {
  await ensureTeamsSchema()
  await query(
    `INSERT INTO freehold_site_teams (id, name, leader_user_id) VALUES ($1, $2, $3)`,
    [id, name.trim(), leaderUserId],
  )
  const teams = await listTeams()
  const created = teams.find((t) => t.id === id)
  if (!created) throw new Error('Team was created but could not be read back')
  return created
}

export async function setTeamLeader(teamId: string, leaderUserId: string | null): Promise<void> {
  await ensureTeamsSchema()
  await query(`UPDATE freehold_site_teams SET leader_user_id = $2 WHERE id = $1`, [teamId, leaderUserId])
}

/**
 * Patch a profile. Only whitelisted columns are written, and the column name is
 * taken from that whitelist rather than from the request — the identifier can
 * never come from user input.
 */
export async function updateProfileSpine(
  userId: string,
  patch: Partial<Record<EditableProfileField, unknown>>,
): Promise<number> {
  await ensureTeamsSchema()
  const sets: string[] = []
  const params: unknown[] = [userId]
  for (const field of EDITABLE_PROFILE_FIELDS) {
    if (!(field in patch)) continue
    const raw = patch[field]
    params.push(raw === '' ? null : raw)
    sets.push(`${field} = $${params.length}`)
  }
  if (!sets.length) return 0
  const rows = await query<{ id: string }>(
    `UPDATE freehold_site_users SET ${sets.join(', ')} WHERE id = $1 RETURNING id`,
    params,
  )
  return rows.length
}
