import { query } from '@/lib/db'
import { gatherAgentResponseStats } from '@/lib/freehold/response-time'

/**
 * Live per-agent performance snapshot used by the (single) Freehold Expert
 * conversation to answer team questions — best performer, who deserves more ad
 * budget, retention / flight risk, neglected leads, etc.
 *
 * Effort = activity counts (calls / messages / notes) over the last 30 days.
 * Experience = account tenure. Results = wins in the last 30 days. Every query
 * fails soft so a missing slice never breaks the caller.
 */
export type AgentMetric = {
  id: string
  name: string
  tenureDays: number | null
  totalLeads: number
  hotLeads: number
  wins30d: number
  overdueFollowups: number
  activity30d: number
  calls: number
  messages: number
  notes: number
  /** median minutes from assignment to first broker response — null when no lead of theirs has a measured response (honest, not zero) */
  medianResponseMinutes: number | null
  /** assigned leads with a measured first response (evidence for the median) */
  respondedLeads: number
  /** viewings actually held (recorded outcomes, all-time) */
  viewingsHeld: number
  /** viewings booked (all-time) */
  viewingsScheduled: number
  /** offers made (all-time) */
  offersMade: number
}

export async function gatherTeamMetrics(): Promise<AgentMetric[]> {
  const [agents, activity, responseStats, viewingOffer] = await Promise.all([
    query<{
      id: string; name: string; email: string; created_at: string | null
      total_leads: string; hot_leads: string; recent_wins: string; overdue_followups: string
    }>(
      `SELECT u.id, u.name, u.email, u.created_at::text,
         COALESCE(l.total_leads, 0)::text      AS total_leads,
         COALESCE(l.hot_leads, 0)::text         AS hot_leads,
         COALESCE(l.recent_wins, 0)::text       AS recent_wins,
         COALESCE(l.overdue_followups, 0)::text AS overdue_followups
       FROM freehold_site_users u
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*) AS total_leads,
           COUNT(*) FILTER (WHERE priority = 'hot') AS hot_leads,
           COUNT(*) FILTER (WHERE status IN ('closed','converted') AND updated_at > now() - INTERVAL '30 days') AS recent_wins,
           COUNT(*) FILTER (WHERE last_contact_at < now() - INTERVAL '72 hours' AND status NOT IN ('closed','converted','lost')) AS overdue_followups
         FROM freehold_site_leads WHERE assigned_broker_id = u.id::text
       ) l ON TRUE
       WHERE u.role = 'broker'
       ORDER BY l.total_leads DESC NULLS LAST
       LIMIT 50`,
      [],
    ).catch(() => []),
    query<{ created_by: string; total: string; calls: string; messages: string; notes: string }>(
      `SELECT created_by,
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE activity_type IN ('call','meeting','viewing'))::text AS calls,
         COUNT(*) FILTER (WHERE activity_type IN ('whatsapp','email','sms','message'))::text AS messages,
         COUNT(*) FILTER (WHERE activity_type IN ('note','status_change'))::text AS notes
       FROM freehold_site_lead_activity
       WHERE created_at > now() - INTERVAL '30 days' AND created_by IS NOT NULL
       GROUP BY created_by`,
      [],
    ).catch(() => []),
    // Layer 10 — the response-time clock (median first response per agent).
    gatherAgentResponseStats().catch(() => []),
    // Layer 10 — viewings + offers, counted on the agent's assigned leads
    // (all-time; these activity types only exist once viewings/offers are
    // logged, so absence means "not tracked yet", never zero-by-default).
    query<{ broker: string; viewings_held: string; viewings_scheduled: string; offers_made: string }>(
      `SELECT l.assigned_broker_id AS broker,
         COUNT(*) FILTER (WHERE a.activity_type = 'viewing_held')::text      AS viewings_held,
         COUNT(*) FILTER (WHERE a.activity_type = 'viewing_scheduled')::text AS viewings_scheduled,
         COUNT(*) FILTER (WHERE a.activity_type = 'offer_made')::text        AS offers_made
       FROM freehold_site_lead_activity a
       JOIN freehold_site_leads l ON l.id = a.lead_id
       WHERE l.assigned_broker_id IS NOT NULL
         AND a.activity_type IN ('viewing_held', 'viewing_scheduled', 'offer_made')
       GROUP BY l.assigned_broker_id`,
      [],
    ).catch(() => []),
  ])

  const act = new Map(activity.map((a) => [a.created_by, a]))
  // Response stats and viewing/offer counts are keyed by leads.assigned_broker_id,
  // which holds either the user's id or their email depending on the assigner.
  const resp = new Map(responseStats.map((r) => [r.brokerKey, r]))
  const vo = new Map(viewingOffer.map((v) => [v.broker, v]))
  const now = Date.now()
  return agents.map((a) => {
    const ax = act.get(a.email)
    const rx = resp.get(a.id) ?? resp.get(a.email)
    const vx = vo.get(a.id) ?? vo.get(a.email)
    const tenureDays = a.created_at ? Math.max(0, Math.round((now - new Date(a.created_at).getTime()) / 86400000)) : null
    return {
      id: a.id,
      name: a.name,
      tenureDays,
      totalLeads: parseInt(a.total_leads, 10),
      hotLeads: parseInt(a.hot_leads, 10),
      wins30d: parseInt(a.recent_wins, 10),
      overdueFollowups: parseInt(a.overdue_followups, 10),
      activity30d: ax ? parseInt(ax.total, 10) : 0,
      calls: ax ? parseInt(ax.calls, 10) : 0,
      messages: ax ? parseInt(ax.messages, 10) : 0,
      notes: ax ? parseInt(ax.notes, 10) : 0,
      medianResponseMinutes: rx?.medianResponseMinutes ?? null,
      respondedLeads: rx?.respondedLeads ?? 0,
      viewingsHeld: vx ? parseInt(vx.viewings_held, 10) : 0,
      viewingsScheduled: vx ? parseInt(vx.viewings_scheduled, 10) : 0,
      offersMade: vx ? parseInt(vx.offers_made, 10) : 0,
    }
  })
}
