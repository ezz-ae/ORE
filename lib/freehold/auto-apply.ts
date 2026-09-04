/**
 * WHICH FIXES THE GUARD MAY MAKE ON ITS OWN.
 *
 * "wire it to the morning guard with the verdicts deciding."
 *
 * This is a deliberate change to a stated policy. The guard's own header says
 * "Nothing is paused automatically: pausing somebody's campaign without them
 * is a bigger mistake than the one being fixed." That rule stands for pausing
 * and for budget. What changes is that ONE class of targeting fix may now be
 * applied without waiting to be asked.
 *
 * ── ONLY WHERE THERE IS NO SECOND QUESTION ───────────────────────────────
 *
 * `worthApplying` decides WHETHER a fix is worth its learning reset. It does
 * not decide WHAT to change, and most gaps have no unambiguous answer:
 *
 *   countryWide   — narrow it to WHERE? Only a person knows the event is in
 *                   Al Ain. A guess here spends a budget in the wrong emirate.
 *   noPropertyGate — which gate? The engine has one, but replacing a live
 *   wideGate        audience wholesale is a different act from removing an
 *                   override, and it deserves a person.
 *   noExclusions  — safe in principle, but it is never `worthApplying` on a
 *                   producing ad set, and on a non-producing one the operator
 *                   is better served by rebuilding it.
 *
 * `advantageOn` is the exception and the only one: the fix is to set
 * `advantage_audience: 0`, there is no second question, and Meta Advantage is
 * already this product's hardest rule — off at every level, no exceptions.
 * An ad set running with it on is running an audience nobody chose.
 *
 * ── AND NEVER THE SAME FIX TWICE ─────────────────────────────────────────
 *
 * The failure that would cost the most is not a wrong edit; it is a RIGHT one
 * repeated. A targeting edit re-enters learning, so a guard that reapplies the
 * same fix every morning — because a read-back was imperfect, or Meta
 * reverted it, or the diff is computed from a stale spec — would hold an ad
 * set in the learning phase permanently while reporting success every day.
 *
 * So an applied fix is recorded per (ad set, gap) and never attempted again.
 * If it comes back, that is a finding for a person, not a retry.
 *
 * Pure — the history is passed in. Runs in `pnpm guards`.
 */
import type { GapFinding, TargetingGap } from '@/lib/freehold/targeting-diff'

/**
 * The gaps the guard may fix unattended.
 *
 * Deliberately one. Widening this list is a policy decision about spending
 * somebody's money without asking, and each addition needs its own reason
 * written here.
 */
export const AUTO_APPLICABLE: readonly TargetingGap[] = ['advantageOn']

/**
 * How many ad sets one run may edit.
 *
 * Not a rate limit — a blast radius. If the diff is wrong, this is the number
 * of ad sets it is wrong about before a person sees the notification.
 */
export const MAX_AUTO_EDITS = 3

export interface AppliedFix {
  adSetId: string
  gap: TargetingGap
}

export interface AutoPlanItem {
  adSetId: string
  gap: TargetingGap
}

/**
 * What this run may apply: worth the reset, unambiguous, and not already done.
 *
 * `already` is every fix ever applied, not just today's — the point is that a
 * fix is attempted ONCE. A gap that reappears after being fixed is a fact
 * about Meta or about somebody editing in Ads Manager, and it needs a person
 * rather than a second write.
 */
export function autoApplyPlan(
  adSets: ReadonlyArray<{ adSetId: string; findings: readonly GapFinding[] }>,
  already: readonly AppliedFix[],
  cap: number = MAX_AUTO_EDITS,
): AutoPlanItem[] {
  // CHECKED BEFORE THE PUSH, NOT AFTER. Testing the cap after appending meant
  // a cap of 0 still edited one ad set — the kill switch would have spent a
  // change before switching anything off. A safety limit that is off by one
  // in the permissive direction is not a safety limit.
  const limit = Math.max(0, cap)
  const done = new Set(already.map((a) => `${a.adSetId}:${a.gap}`))
  const out: AutoPlanItem[] = []
  for (const set of adSets) {
    for (const f of set.findings) {
      if (out.length >= limit) return out
      if (!f.worthApplying) continue
      if (!AUTO_APPLICABLE.includes(f.gap)) continue
      if (done.has(`${set.adSetId}:${f.gap}`)) continue
      out.push({ adSetId: set.adSetId, gap: f.gap })
    }
  }
  return out
}

/**
 * Fixes that are worth making and that a person has to make.
 *
 * Reported rather than silently skipped: the whole reason `advantageOn` is
 * the only automatic one is that the others need a decision, and an operator
 * who is never told about them cannot make it.
 */
export function needsAPerson(
  adSets: ReadonlyArray<{ adSetId: string; findings: readonly GapFinding[] }>,
): AutoPlanItem[] {
  const out: AutoPlanItem[] = []
  for (const set of adSets) {
    for (const f of set.findings) {
      if (f.worthApplying && !AUTO_APPLICABLE.includes(f.gap)) {
        out.push({ adSetId: set.adSetId, gap: f.gap })
      }
    }
  }
  return out
}
