/**
 * Authority, wired to the database: gather the facts, apply the pure rules in
 * `authority.ts`, write down what happened.
 *
 * THE LOG IS THE POINT. "logs are a must on that type of systems — it always
 * has a day when it will be the word between 2." When a broker says a lead was
 * taken from them and a leader says it was abandoned, neither memory decides
 * it. The row does: who acted, on what, whether the system allowed it, and the
 * exact reason code that made the difference.
 *
 * So DENIALS ARE LOGGED TOO, not just successes. A leader repeatedly trying to
 * pull leads out of grace is a fact worth having, and it is invisible in a log
 * that only records what went through.
 *
 * Logging never blocks the action it describes: a failed write is reported to
 * the server console and the request continues. Losing the audit trail would be
 * bad; refusing a legitimate reassignment because the audit table is missing
 * would be worse, and would look to the user exactly like a permissions bug.
 */

import { randomUUID } from 'node:crypto'
import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'
import type { Role } from './session-types'
import {
  decideReassign, decideDelete, CONTACT_ACTIVITY,
  type AuthorityAction, type AuthorityDecision, type ReassignFacts,
} from './authority'
import { teamMemberIds } from './teams'

async function ensure(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_authority_log (
      id           text PRIMARY KEY,
      actor_email  text NOT NULL,
      actor_role   text NOT NULL,
      action       text NOT NULL,
      target_type  text NOT NULL,
      target_id    text NOT NULL,
      decision     text NOT NULL,
      reason       text NOT NULL,
      detail       text,
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS freehold_authority_log_target_idx ON freehold_site_authority_log (target_type, target_id, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS freehold_authority_log_actor_idx  ON freehold_site_authority_log (actor_email, created_at DESC)`)
}
export const ensureAuthorityLog = () => dbEnsureOnce('freehold_site_authority_log', ensure)

export interface AuthorityLogRow {
  id: string
  actorEmail: string
  actorRole: string
  action: string
  targetType: string
  targetId: string
  decision: 'allowed' | 'denied'
  reason: string
  detail: string | null
  createdAt: string
}

/** Write one line of the record. Never throws into the caller's path. */
export async function logAuthority(entry: {
  actorEmail: string
  actorRole: string
  action: AuthorityAction
  targetType: 'lead' | 'campaign' | 'member' | 'project' | 'developer'
  targetId: string
  decision: AuthorityDecision
  detail?: string
}): Promise<void> {
  try {
    await ensureAuthorityLog()
    await query(
      `INSERT INTO freehold_site_authority_log
         (id, actor_email, actor_role, action, target_type, target_id, decision, reason, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        `auth_${randomUUID()}`, entry.actorEmail, entry.actorRole, entry.action,
        entry.targetType, entry.targetId,
        entry.decision.allowed ? 'allowed' : 'denied',
        entry.decision.reason, entry.detail ?? null,
      ],
    )
  } catch (err) {
    console.error('[authority] log write failed — action proceeded unlogged', {
      action: entry.action, target: entry.targetId, actor: entry.actorEmail, err,
    })
  }
}

export async function listAuthorityLog(opts: {
  targetType?: string; targetId?: string; actorEmail?: string
  action?: string; decision?: 'allowed' | 'denied'; limit?: number
} = {}): Promise<AuthorityLogRow[]> {
  await ensureAuthorityLog()
  const where: string[] = []
  const params: unknown[] = []
  if (opts.targetType) { params.push(opts.targetType); where.push(`target_type = $${params.length}`) }
  if (opts.targetId)   { params.push(opts.targetId);   where.push(`target_id = $${params.length}`) }
  if (opts.actorEmail) { params.push(opts.actorEmail); where.push(`actor_email = $${params.length}`) }
  // Action and decision are filtered in SQL, not on the page. Filtering a
  // capped list client-side would answer "were there any refusals?" with the
  // refusals that happen to be in the last N rows — which reads as none.
  if (opts.action)     { params.push(opts.action);     where.push(`action = $${params.length}`) }
  if (opts.decision)   { params.push(opts.decision);   where.push(`decision = $${params.length}`) }
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500)
  const rows = await query<{
    id: string; actor_email: string; actor_role: string; action: string
    target_type: string; target_id: string; decision: string; reason: string
    detail: string | null; created_at: string
  }>(
    `SELECT id, actor_email, actor_role, action, target_type, target_id,
            decision, reason, detail, created_at::text
       FROM freehold_site_authority_log
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY created_at DESC
      LIMIT ${limit}`,
    params,
  )
  return rows.map((r) => ({
    id: r.id,
    actorEmail: r.actor_email,
    actorRole: r.actor_role,
    action: r.action,
    targetType: r.target_type,
    targetId: r.target_id,
    decision: r.decision === 'allowed' ? 'allowed' : 'denied',
    reason: r.reason,
    detail: r.detail,
    createdAt: r.created_at,
  }))
}

/**
 * Read everything a reassignment decision depends on, in one pass.
 *
 * `assigned_at` may be null on rows that predate the column, so it falls back to
 * the most recent `assignment` activity row and finally to the lead's creation
 * time. A null read must not silently become "assigned just now" — that would
 * hand every legacy lead a fresh 24-hour protection it never earned.
 */
export async function gatherReassignFacts(
  leadId: string,
  actor: { role: Role; id?: string | null },
): Promise<ReassignFacts | null> {
  const rows = await query<{
    assigned_broker_id: string | null
    assigned_at: string | null
    last_contact_at: string | null
    status: string | null
    created_at: string | null
    contact_count: string
    last_assignment_at: string | null
  }>(
    `SELECT l.assigned_broker_id,
            l.assigned_at::text,
            l.last_contact_at::text,
            l.status,
            l.created_at::text,
            (SELECT COUNT(*) FROM freehold_site_lead_activity a
              WHERE a.lead_id = l.id AND a.activity_type = ANY($2::text[]))::text AS contact_count,
            (SELECT MAX(a.created_at)::text FROM freehold_site_lead_activity a
              WHERE a.lead_id = l.id AND a.activity_type = 'assignment') AS last_assignment_at
       FROM freehold_site_leads l
      WHERE l.id = $1
      LIMIT 1`,
    [leadId, [...CONTACT_ACTIVITY]],
  )
  const r = rows[0]
  if (!r) return null

  let inActorsTeam = false
  if (actor.role === 'team_leader' && actor.id && r.assigned_broker_id) {
    const members = await teamMemberIds(actor.id)
    inActorsTeam = members.includes(r.assigned_broker_id)
  }

  return {
    assignedTo: r.assigned_broker_id,
    assignedAt: r.assigned_at ?? r.last_assignment_at ?? r.created_at,
    contactCount: Number(r.contact_count) || 0,
    lastContactAt: r.last_contact_at,
    status: r.status,
    inActorsTeam,
    now: Date.now(),
  }
}

/**
 * Authorise a reassignment and record the outcome either way.
 * Returns the decision; the caller enforces it.
 */
export async function authorizeReassign(
  leadId: string,
  actor: { email: string; role: Role; id?: string | null },
  detail?: string,
): Promise<{ decision: AuthorityDecision; facts: ReassignFacts | null }> {
  const facts = await gatherReassignFacts(leadId, actor)
  if (!facts) {
    // No such lead. Not an authority question — let the caller 404.
    return { decision: { allowed: false, reason: 'insufficient_role' }, facts: null }
  }
  const decision = decideReassign(actor.role, facts)
  await logAuthority({
    actorEmail: actor.email, actorRole: actor.role,
    action: 'lead.reassign', targetType: 'lead', targetId: leadId,
    decision, detail,
  })
  return { decision, facts }
}

/** Authorise a delete (lead or campaign) and record it. Owner-only, always. */
export async function authorizeDelete(
  targetType: 'lead' | 'campaign',
  targetId: string,
  actor: { email: string; role: Role },
  detail?: string,
): Promise<AuthorityDecision> {
  const decision = decideDelete(actor.role)
  await logAuthority({
    actorEmail: actor.email, actorRole: actor.role,
    action: targetType === 'lead' ? 'lead.delete' : 'campaign.delete',
    targetType, targetId, decision, detail,
  })
  return decision
}
