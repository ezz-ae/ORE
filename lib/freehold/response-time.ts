import { query } from '@/lib/db'
import { getWorkspaceConfig } from '@/lib/automation/db'

/**
 * The response-time clock (Layer 10).
 *
 * First response = the first activity on a lead authored by its assigned
 * broker (call / whatsapp / note / stage move / viewing / offer) AFTER the
 * lead was assigned. Assignment time is the earliest 'assignment' activity;
 * leads created already assigned (broker adds their own lead, auto-routing at
 * creation) start the clock at lead creation.
 *
 * Honesty rules:
 *  - never assigned            → no clock (the lead is excluded)
 *  - assigned, never responded → responseMinutes = null (not zero, not made up)
 *  - the SLA target is a single admin-set number; when none is set, nothing is
 *    ever flagged as a breach.
 */

export type LeadResponseClock = {
  leadId: string
  assignedAt: string
  firstResponseAt: string | null
  responseMinutes: number | null
}

/** Activity types that do NOT count as broker outreach. */
const NON_RESPONSE_TYPES = ['assignment', 'created', 'repeat_inquiry', 'whatsapp_received']

/** The admin-set first-response target in minutes, or null when none is set. */
export async function getResponseSlaMinutes(): Promise<number | null> {
  try {
    const cfg = await getWorkspaceConfig()
    const v = cfg.responseSlaMinutes
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : null
  } catch {
    return null
  }
}

/**
 * Per-lead response clocks for open, assigned leads. Pass brokerId to scope to
 * one broker's leads (broker view); omit for all (management view).
 */
export async function getLeadResponseClocks(brokerId?: string | null): Promise<LeadResponseClock[]> {
  const params: unknown[] = []
  let ownerFilter = ''
  if (brokerId) {
    params.push(brokerId)
    ownerFilter = ` AND l.assigned_broker_id = $${params.length}`
  }
  try {
    const rows = await query<{
      lead_id: string
      assigned_at: string
      first_response_at: string | null
      response_minutes: number | null
    }>(
      `SELECT x.id AS lead_id,
              x.assigned_at::text AS assigned_at,
              r.first_response_at::text AS first_response_at,
              CASE WHEN r.first_response_at IS NOT NULL
                THEN GREATEST(0, ROUND(EXTRACT(EPOCH FROM (r.first_response_at - x.assigned_at)) / 60))::int
              END AS response_minutes
       FROM (
         SELECT l.id, l.assigned_broker_id, u.uid AS broker_uid, u.email AS broker_email,
                COALESCE(asg.assigned_at, l.created_at) AS assigned_at
         FROM freehold_site_leads l
         LEFT JOIN LATERAL (
           SELECT id::text AS uid, email FROM freehold_site_users
           WHERE id::text = l.assigned_broker_id OR email = l.assigned_broker_id
           LIMIT 1
         ) u ON TRUE
         LEFT JOIN LATERAL (
           SELECT MIN(created_at) AS assigned_at FROM freehold_site_lead_activity
           WHERE lead_id = l.id AND activity_type = 'assignment'
         ) asg ON TRUE
         WHERE l.assigned_broker_id IS NOT NULL
           AND l.status NOT IN ('closed', 'converted', 'lost')${ownerFilter}
       ) x
       LEFT JOIN LATERAL (
         SELECT MIN(a.created_at) AS first_response_at
         FROM freehold_site_lead_activity a
         WHERE a.lead_id = x.id
           AND a.created_by IS NOT NULL
           AND a.created_by IN (x.assigned_broker_id, COALESCE(x.broker_uid, x.assigned_broker_id), COALESCE(x.broker_email, x.assigned_broker_id))
           AND a.activity_type <> ALL($${params.length + 1})
           AND a.created_at >= x.assigned_at
       ) r ON TRUE
       LIMIT 500`,
      [...params, NON_RESPONSE_TYPES],
    )
    return rows.map((r) => ({
      leadId: r.lead_id,
      assignedAt: r.assigned_at,
      firstResponseAt: r.first_response_at,
      responseMinutes: r.response_minutes === null ? null : Number(r.response_minutes),
    }))
  } catch (error) {
    console.error('[response-time] clock query failed', error)
    return []
  }
}

export type AgentResponseStats = {
  /** leads.assigned_broker_id value this row aggregates */
  brokerKey: string
  /** assigned leads that have a measured first response */
  respondedLeads: number
  /** median minutes to first response over responded leads — null when none */
  medianResponseMinutes: number | null
}

/**
 * Per-agent median first-response time over ALL their assigned leads
 * (including closed ones — history counts). Agents with no responded leads
 * simply have no row: the metric is absent, not zero.
 */
export async function gatherAgentResponseStats(): Promise<AgentResponseStats[]> {
  try {
    const rows = await query<{ broker: string; responded: string; median_minutes: string }>(
      `SELECT x.assigned_broker_id AS broker,
              COUNT(r.first_response_at)::text AS responded,
              ROUND(percentile_cont(0.5) WITHIN GROUP (
                ORDER BY EXTRACT(EPOCH FROM (r.first_response_at - x.assigned_at)) / 60
              )::numeric)::text AS median_minutes
       FROM (
         SELECT l.id, l.assigned_broker_id, u.uid AS broker_uid, u.email AS broker_email,
                COALESCE(asg.assigned_at, l.created_at) AS assigned_at
         FROM freehold_site_leads l
         LEFT JOIN LATERAL (
           SELECT id::text AS uid, email FROM freehold_site_users
           WHERE id::text = l.assigned_broker_id OR email = l.assigned_broker_id
           LIMIT 1
         ) u ON TRUE
         LEFT JOIN LATERAL (
           SELECT MIN(created_at) AS assigned_at FROM freehold_site_lead_activity
           WHERE lead_id = l.id AND activity_type = 'assignment'
         ) asg ON TRUE
         WHERE l.assigned_broker_id IS NOT NULL
       ) x
       JOIN LATERAL (
         SELECT MIN(a.created_at) AS first_response_at
         FROM freehold_site_lead_activity a
         WHERE a.lead_id = x.id
           AND a.created_by IS NOT NULL
           AND a.created_by IN (x.assigned_broker_id, COALESCE(x.broker_uid, x.assigned_broker_id), COALESCE(x.broker_email, x.assigned_broker_id))
           AND a.activity_type <> ALL($1)
           AND a.created_at >= x.assigned_at
       ) r ON r.first_response_at IS NOT NULL
       GROUP BY x.assigned_broker_id`,
      [NON_RESPONSE_TYPES],
    )
    return rows.map((r) => {
      const median = Number(r.median_minutes)
      return {
        brokerKey: r.broker,
        respondedLeads: Number(r.responded) || 0,
        medianResponseMinutes: Number.isFinite(median) ? median : null,
      }
    })
  } catch (error) {
    console.error('[response-time] agent stats failed', error)
    return []
  }
}
