import { query } from '@/lib/db'
import { getTrainingIntegrityReport } from './training-integrity'

export interface AgentDataQuality {
  /** Distinct leads this agent marked terminal (lost/blocked) in the last 90 days. */
  marks: number
  /** How many of those fell inside a flagged mass-purge burst. */
  burstMarks: number
  /** 0–100, or null when the agent has no terminal marks yet (no signal). */
  score: number | null
}

/**
 * Per-agent data-quality (contribution) score, keyed by the activity actor
 * (`created_by` — the agent's email). LOGICAL, not statistical: the share of an
 * agent's terminal lead-marks (lost/blocked, 90-day window) that were logged in
 * the normal flow vs. inside a flagged mass-purge burst. 100 = every terminal
 * mark was logged cleanly; lower = more of them came in bursts.
 *
 * Display + coaching only — it does NOT gate lead assignment (a deliberate later
 * step). Reuses the Layer-10 training-integrity burst detector, so there is one
 * source of truth for "what counts as a burst".
 */
export async function gatherDataQualityScores(): Promise<Map<string, AgentDataQuality>> {
  const map = new Map<string, AgentDataQuality>()
  try {
    const [marksRows, report] = await Promise.all([
      query<{ created_by: string; marks: number }>(
        `SELECT created_by, COUNT(DISTINCT lead_id)::int AS marks
           FROM freehold_site_lead_activity
          WHERE created_at > now() - interval '90 days'
            AND created_by IS NOT NULL AND created_by <> ''
            AND ((activity_type = 'stage' AND description = 'Stage changed to lost')
              OR (activity_type = 'note' AND description = 'Contact blocked'))
          GROUP BY created_by`,
      ).catch(() => [] as { created_by: string; marks: number }[]),
      getTrainingIntegrityReport().catch(() => ({ bursts: [] as { actor: string; leadIds: string[] }[], excludedLeadIds: [] as string[] })),
    ])

    const burstByActor = new Map<string, Set<string>>()
    for (const b of report.bursts) {
      const set = burstByActor.get(b.actor) ?? new Set<string>()
      b.leadIds.forEach((id) => set.add(id))
      burstByActor.set(b.actor, set)
    }

    for (const r of marksRows) {
      const marks = Number(r.marks) || 0
      const burstMarks = burstByActor.get(r.created_by)?.size ?? 0
      const score = marks > 0 ? Math.max(0, Math.min(100, Math.round((1 - burstMarks / marks) * 100))) : null
      map.set(r.created_by, { marks, burstMarks, score })
    }
    // Any actor with bursts but no marks row (edge) still reads as fully burst.
    for (const [actor, set] of burstByActor) {
      if (!map.has(actor)) map.set(actor, { marks: set.size, burstMarks: set.size, score: 0 })
    }
  } catch {
    /* no signal — leave the map empty; callers show a neutral "—" */
  }
  return map
}
