/**
 * THE LEADS, WITH THE HOUR THEY ARRIVED AND HOW LONG THEY WAITED.
 *
 * hour-truth.ts is pure and needs three things per lead: when it came in,
 * whether it qualified, and how many minutes until somebody answered it. This
 * is that read.
 *
 * Deliberately NOT `getLeadResponseClocks` from response-time.ts. That one
 * exists for the follow-up queue, so it excludes closed, converted and lost
 * leads — exactly the leads an hour report is about, since a qualified lead is
 * usually one of them by the time you look. Same definition of a response,
 * different population.
 *
 * WHAT COUNTS AS A RESPONSE, kept identical to response-time.ts on purpose: the
 * first activity on the lead that is not an assignment, a creation record, a
 * repeat enquiry or an inbound WhatsApp — i.e. the first time a human did
 * something. If those two definitions drift, one screen will say the desk is
 * slow and the other will say it is fine.
 *
 * Fail-soft: an unreadable CRM returns an empty list and the panel says there
 * is nothing to read yet, which is true.
 */
import { query } from '@/lib/db'
import { QUALIFIED_STATUSES } from '@/lib/freehold/lead-stages'
import type { HourLead } from '@/lib/freehold/hour-truth'

/**
 * How far back the hour report looks.
 *
 * Ninety days, not thirty. Four blocks need MIN_LEADS_PER_BLOCK each before
 * any of them can be judged, and a month of a single brokerage's leads does not
 * reliably fill four buckets. Long enough to answer, short enough that it is
 * still about how the desk works now.
 */
export const HOUR_LOOKBACK_DAYS = 90

/** Activity types that are not somebody responding. Mirrors response-time.ts. */
const NON_RESPONSE_TYPES = ['assignment', 'created', 'repeat_inquiry', 'whatsapp_received']

export async function hourLeads(): Promise<HourLead[]> {
  try {
    const rows = await query<{
      created_at: string
      status: string | null
      response_minutes: number | null
    }>(
      `SELECT l.created_at::text AS created_at,
              l.status,
              CASE WHEN r.first_response_at IS NOT NULL
                THEN GREATEST(0, ROUND(EXTRACT(EPOCH FROM (r.first_response_at - l.created_at)) / 60))::int
              END AS response_minutes
         FROM freehold_site_leads l
         LEFT JOIN LATERAL (
           SELECT MIN(a.created_at) AS first_response_at
             FROM freehold_site_lead_activity a
            WHERE a.lead_id = l.id
              AND a.created_by IS NOT NULL
              AND a.activity_type <> ALL($2)
              AND a.created_at >= l.created_at
         ) r ON TRUE
        WHERE l.archived IS NOT TRUE
          AND l.created_at > now() - ($1 || ' days')::interval
        LIMIT 5000`,
      [String(HOUR_LOOKBACK_DAYS), NON_RESPONSE_TYPES],
    )
    return rows.map((r) => ({
      createdAt: r.created_at,
      qualified: QUALIFIED_STATUSES.has(r.status ?? ''),
      // The wait is measured from ARRIVAL, not from assignment. A lead that sat
      // unassigned for six hours was still a lead going cold for six hours, and
      // measuring from assignment would hide exactly the failure this report is
      // looking for.
      responseMinutes: r.response_minutes === null ? null : Number(r.response_minutes),
    }))
  } catch {
    return []
  }
}
