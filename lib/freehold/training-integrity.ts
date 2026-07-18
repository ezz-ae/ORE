import { query } from '@/lib/db'

/**
 * Layer 10 — training-data integrity.
 *
 * The CRM funnel outcome of a lead (lost / blocked) feeds two places that
 * "learn" from it: campaign quality scoring (lib/freehold/campaign-quality.ts,
 * which can drive auto-pause/budget rules) and the closed-deal Lookalike
 * audience builder. Both assume every terminal status reflects a genuine,
 * one-at-a-time judgment call about that specific lead.
 *
 * That assumption breaks during a "queue purge": one agent clearing a backlog
 * marks many leads lost/blocked in a short burst, often for reasons that have
 * nothing to do with lead quality (end of shift, inbox cleanup, a bad day).
 * If those outcomes count the same as considered judgments, the funnel signal
 * gets poisoned and the machine "learns" the wrong thing.
 *
 * This module only detects and reports bursts — it assigns no blame and
 * changes no lead. getUntrustedLeadIds() is the read side other modules
 * subtract from before treating an outcome as a training signal.
 */

export interface TrainingIntegrityBurst {
  actor: string
  leadIds: string[]
  count: number
  windowStart: string
  windowEnd: string
}

export interface TrainingIntegrityReport {
  bursts: TrainingIntegrityBurst[]
  excludedLeadIds: string[]
}

const BURST_THRESHOLD = 5
const BURST_WINDOW_MINUTES = 15
const LOOKBACK_DAYS = 90

type ActivityRow = { lead_id: string; created_by: string; created_at: string }

export async function getTrainingIntegrityReport(): Promise<TrainingIntegrityReport> {
  let rows: ActivityRow[] = []
  try {
    rows = await query<ActivityRow>(
      `SELECT lead_id, created_by, created_at
         FROM freehold_site_lead_activity
        WHERE created_at > now() - interval '${LOOKBACK_DAYS} days'
          AND created_by IS NOT NULL AND created_by <> ''
          AND (
            (activity_type = 'stage' AND description = 'Stage changed to lost')
            OR (activity_type = 'note' AND description = 'Contact blocked')
          )
        ORDER BY created_by ASC, created_at ASC`,
    )
  } catch {
    // Never let a schema/DB hiccup break a caller that depends on this.
    return { bursts: [], excludedLeadIds: [] }
  }

  const byActor = new Map<string, ActivityRow[]>()
  for (const r of rows) {
    const list = byActor.get(r.created_by)
    if (list) list.push(r)
    else byActor.set(r.created_by, [r])
  }

  const bursts: TrainingIntegrityBurst[] = []
  const excluded = new Set<string>()
  const windowMs = BURST_WINDOW_MINUTES * 60_000

  for (const [actor, events] of byActor) {
    let start = 0
    for (let end = 0; end < events.length; end++) {
      while (new Date(events[end].created_at).getTime() - new Date(events[start].created_at).getTime() > windowMs) {
        start++
      }
      const slice = events.slice(start, end + 1)
      const distinctLeads = new Set(slice.map((e) => e.lead_id))
      if (distinctLeads.size >= BURST_THRESHOLD) {
        bursts.push({
          actor,
          leadIds: Array.from(distinctLeads),
          count: distinctLeads.size,
          windowStart: slice[0].created_at,
          windowEnd: slice[slice.length - 1].created_at,
        })
        distinctLeads.forEach((id) => excluded.add(id))
        // Jump past this burst's own events so the same cluster of leads
        // doesn't get reported again as an overlapping sliding-window match.
        start = end + 1
      }
    }
  }

  return { bursts, excludedLeadIds: Array.from(excluded) }
}

export async function getUntrustedLeadIds(): Promise<Set<string>> {
  const { excludedLeadIds } = await getTrainingIntegrityReport()
  return new Set(excludedLeadIds)
}
