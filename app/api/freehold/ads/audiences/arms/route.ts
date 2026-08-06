/**
 * THE ARM PLAN — the first thing that can actually reach the planner.
 *
 * `level-arms.ts` has been complete and tested for a while and had ZERO
 * production callers. Nothing built the `LevelEvidence` it asks for, because
 * that evidence lives in three places that could not talk to each other: the
 * relevance engine reports per SEGMENT, the layer audit measures per LAYER,
 * and the planner reasons in LEVELS. This route is the assembly point.
 *
 * What it does, in order, and what each step costs:
 *
 *  1. Reads the registration snapshots and ranks every segment. Free — it is
 *     the funnel's own history.
 *  2. Probes Meta for how much of the audience each LEVEL actually removes.
 *     Free, read-only, and the reason the planner can refuse an arm that would
 *     buy the same people as the arm above it.
 *  3. Translates both into per-level evidence, then plans the budget split.
 *
 * NOTHING LAUNCHES HERE. This returns a plan and its reasoning; creating ad
 * sets is a separate, deliberate act. A planner that spends money the moment
 * someone opens a screen is not a planner.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { getAudience, normalizeSpec } from '@/lib/freehold/audiences'
import { snapshotOutcomes } from '@/lib/freehold/audience-snapshot'
import { assessEvents } from '@/lib/freehold/relevance'
import { levelEvidenceFrom, narrowingByLevel, type EntityLevel } from '@/lib/freehold/level-evidence'
import { selectColdArms, planArms, MIN_ARM_DAILY_AED, type PositiveLevel } from '@/lib/freehold/level-arms'
import { getReachEstimate, isMetaConfigured } from '@/lib/meta/client'
import type { CampaignTargeting, TargetingEntity } from '@/lib/meta/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

const isLevel = (n: unknown): n is PositiveLevel =>
  n === 1 || n === 2 || n === 3 || n === 4 || n === 5

/** Midpoint of Meta's band. A band is not a number, and taking the lower bound
 *  would systematically overstate how much every level removes. */
const mid = (e: { lower: number; upper: number } | null): number =>
  e ? Math.round((e.lower + e.upper) / 2) : 0

export async function POST(req: NextRequest) {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // The spec comes from a saved audience or straight from a draft.
  let spec: CampaignTargeting
  if (typeof body.audienceId === 'string' && body.audienceId) {
    const saved = await getAudience(body.audienceId)
    if (!saved) return NextResponse.json({ error: 'Audience not found' }, { status: 404 })
    spec = saved.spec
  } else {
    spec = normalizeSpec(body.spec)
  }

  const dailyBudgetAed = Math.max(0, Math.round(Number(body.dailyBudgetAed) || 0))
  if (dailyBudgetAed <= 0) {
    return NextResponse.json({ error: 'A daily budget is required to plan arms' }, { status: 400 })
  }

  // Which level each segment sits at. THE OPERATOR'S OWN assignment — never
  // inferred from the segment's name or size. A stack whose levels were
  // guessed would produce a plan that reads as a finding about their audience
  // and is really a finding about our guess.
  const raw = (body.levelsByEntityId && typeof body.levelsByEntityId === 'object'
    ? body.levelsByEntityId : {}) as Record<string, unknown>

  const everyEntity: Array<TargetingEntity & { kind: 'interest' | 'behavior' }> = [
    ...spec.interests.map((e) => ({ ...e, kind: 'interest' as const })),
    ...(spec.behaviors ?? []).map((e) => ({ ...e, kind: 'behavior' as const })),
    ...(spec.narrowing ?? []).flatMap((g) => [
      ...(g.interests ?? []).map((e) => ({ ...e, kind: 'interest' as const })),
      ...(g.behaviors ?? []).map((e) => ({ ...e, kind: 'behavior' as const })),
    ]),
  ]

  const assignment: EntityLevel[] = everyEntity
    .map((e) => ({ id: e.id, kind: e.kind, level: Number(raw[e.id]) }))
    .filter((e): e is EntityLevel => isLevel(e.level))

  const unassigned = everyEntity.length - assignment.length
  const levels = Array.from(new Set<PositiveLevel>([1, ...assignment.map((a) => a.level)])).sort()

  // ── 1. What the funnel already proved, per segment ──────────────────────
  // Fail-soft: no snapshots yet is a real and common state (a new account),
  // and it must produce a plan in schema order rather than an error.
  const rows = await snapshotOutcomes().catch(() => [])
  const reports = assessEvents(rows)

  // ── 2. What each level actually removes, per Meta ────────────────────────
  // One probe per level: the full stack MINUS every segment at that level. A
  // level's share is measured against the stack, so a level that removes
  // people earlier levels already removed reads near zero — which is the whole
  // point, and the reason two near-identical ad sets never get built.
  const connected = await isMetaConfigured()
  let narrowing: Partial<Record<PositiveLevel, number>> = {}
  let narrowingMeasured = false

  if (connected && assignment.length > 0) {
    const withoutLevel = (level: PositiveLevel): CampaignTargeting => {
      const drop = new Set(assignment.filter((a) => a.level === level).map((a) => a.id))
      const keep = (xs: TargetingEntity[] = []) => xs.filter((e) => !drop.has(e.id))
      return {
        ...spec,
        interests: keep(spec.interests),
        behaviors: keep(spec.behaviors),
        narrowing: (spec.narrowing ?? [])
          .map((g) => ({ interests: keep(g.interests), behaviors: keep(g.behaviors) }))
          .filter((g) => g.interests.length + g.behaviors.length > 0),
      }
    }

    const probeLevels = levels.filter((l) => l !== 1)
    const [full, ...withouts] = await Promise.all([
      getReachEstimate(spec).catch(() => null),
      ...probeLevels.map((l) => getReachEstimate(withoutLevel(l)).catch(() => null)),
    ])
    const fullSize = mid(full)

    if (fullSize > 0) {
      narrowingMeasured = true
      narrowing = narrowingByLevel(
        probeLevels.map((l, i) => {
          const without = mid(withouts[i])
          // Removing a level can only widen the audience. The share it removes
          // is how much smaller the stack is WITH it than without it.
          return { id: String(l), share: without > 0 ? (without - fullSize) / without : 0 }
        }),
        (id) => (isLevel(Number(id)) ? (Number(id) as PositiveLevel) : null),
      )
    }
  }

  // ── 3. Evidence, arms, budget ────────────────────────────────────────────
  const evidence = levelEvidenceFrom(reports, assignment, narrowing)
  const selection = selectColdArms(levels, evidence)
  const plan = planArms(selection.arms, dailyBudgetAed)

  // Everything the plan could NOT establish, said out loud. A plan that hides
  // what it did not know reads as confidence and is a guess.
  const caveats: string[] = []
  if (rows.length === 0) {
    caveats.push('No registration history yet, so no level has been proven — this is schema order, not a finding.')
  }
  if (!connected) {
    caveats.push('Meta is not connected, so no level was measured for how much of the audience it actually removes. Two arms here may end up buying the same people.')
  } else if (!narrowingMeasured) {
    caveats.push('Meta returned no audience size, so how much each level narrows is unknown for this plan.')
  }
  if (unassigned > 0) {
    caveats.push(`${unassigned} segment${unassigned === 1 ? '' : 's'} in this audience have no level, so nothing was planned around ${unassigned === 1 ? 'it' : 'them'}.`)
  }
  if (plan.unallocatedAed > 0) {
    caveats.push(`AED ${plan.unallocatedAed} could not be allocated — an ad set under AED ${MIN_ARM_DAILY_AED}/day cannot leave the learning phase, so it was not created rather than being funded to fail.`)
  }

  return NextResponse.json({
    headline: selection.headline,
    arms: plan.arms.map((a) => ({
      id: a.arm.id,
      label: a.arm.label,
      kind: a.arm.kind,
      rationale: a.arm.rationale,
      share: a.share,
      dailyBudgetAed: a.dailyBudgetAed,
    })),
    skipped: selection.skipped,
    excludeCandidates: selection.excludeCandidates,
    evidence: evidence.map((e) => ({
      level: e.level,
      verdict: e.verdict ?? null,
      lift: e.lift,
      narrowingPower: e.narrowingPower,
      judged: e.judged,
      tooRare: e.tooRare,
      sentence: e.sentence,
    })),
    budget: {
      dailyAed: dailyBudgetAed,
      unallocatedAed: plan.unallocatedAed,
      minPerArmAed: MIN_ARM_DAILY_AED,
    },
    learning: plan.learning,
    notes: plan.notes,
    caveats,
  })
}
