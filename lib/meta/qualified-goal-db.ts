import { query } from '@/lib/db'
import { listCustomConversions } from '@/lib/meta/client'
import { chooseQualifiedGoal, isPixelOptimised, type QualifiedGoalRead } from '@/lib/meta/qualified-goal'
import { objectiveToOptimizationGoal } from '@/lib/meta/optimization-goal'
import type { MetaCampaignObjective, AdDestination } from '@/lib/meta/types'

/**
 * The account state behind `qualified-goal.ts`.
 *
 * Split from the pure decision the way money-truth-db is split from
 * money-truth: the rule is provable without a database, and the reads that
 * feed it live here where they can fail without taking the rule with them.
 */

/**
 * Twenty-eight days, not seven.
 *
 * The gate asks whether the account can sustain LEARNING_EVENTS a week, and a
 * one-week sample of a brokerage's qualified leads is a handful — the interval
 * on it is so wide that the bound would refuse forever. Four weeks is long
 * enough to have an opinion and short enough to still describe this desk.
 */
export const QUALIFIED_LOOKBACK_DAYS = 28

/** How many QualifiedLead events this account actually reported to Meta. */
export async function qualifiedReported(days = QUALIFIED_LOOKBACK_DAYS): Promise<number> {
  try {
    // meta_reported_stages is what lead-writeback WROTE, not what the CRM
    // believes: the question is how many events Meta received, and a lead that
    // qualified while the integration was down taught it nothing.
    const rows = await query<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM freehold_site_leads
        WHERE meta_reported_stages IS NOT NULL
          AND 'qualified' = ANY(meta_reported_stages)
          AND created_at > now() - ($1 || ' days')::interval`,
      [String(days)],
    )
    return Number(rows[0]?.n ?? 0) || 0
  } catch {
    // No column yet, or no database. Zero reported is the honest read and the
    // gate refuses on it — which is the safe direction.
    return 0
  }
}

/**
 * The custom conversion the CRM's QualifiedLead lands in, if somebody made one.
 *
 * Never CREATED here. A conversion invented mid-launch would be an object on
 * the client's ad account that nobody asked for, on a rule this code guessed —
 * and a launch is the worst possible moment to find out the guess was wrong.
 * Absent means the ad set keeps buying leads and the reason says why.
 */
export async function qualifiedConversionId(pixelId?: string | null): Promise<string | null> {
  try {
    const all = await listCustomConversions()
    const match = all.find((c) =>
      !c.isArchived &&
      (!pixelId || !c.eventSourceId || c.eventSourceId === pixelId) &&
      /QualifiedLead/i.test(`${c.rule ?? ''} ${c.name ?? ''}`))
    return match?.id ?? null
  } catch {
    return null
  }
}

/**
 * The whole decision, for a launch about to happen.
 *
 * `arms` is how many ad sets THIS launch will create, because the learning
 * floor is per ad set: an account clearing it in total across six arms clears
 * it on none of them.
 */
export async function readQualifiedGoal(input: {
  objective: MetaCampaignObjective
  destination?: AdDestination
  pixelId?: string | null
  arms: number
}): Promise<QualifiedGoalRead> {
  const goal = objectiveToOptimizationGoal(input.objective, Boolean(input.pixelId), input.destination)
  // The two reads are skipped entirely when the goal could never carry a
  // conversion id — an instant-form launch must not pay for a Graph call to
  // be told something this function already knows.
  if (!isPixelOptimised(goal)) {
    return chooseQualifiedGoal({
      conversionId: null, optimizationGoal: goal,
      qualifiedInWindow: 0, windowDays: QUALIFIED_LOOKBACK_DAYS, arms: input.arms,
    })
  }
  const [conversionId, reported] = await Promise.all([
    qualifiedConversionId(input.pixelId),
    qualifiedReported(),
  ])
  return chooseQualifiedGoal({
    conversionId, optimizationGoal: goal,
    qualifiedInWindow: reported, windowDays: QUALIFIED_LOOKBACK_DAYS, arms: input.arms,
  })
}
