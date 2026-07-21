/**
 * Ads Machine — plan editing (pure). Applies an operator's review-step edits to
 * a persisted, viable plan BEFORE anything launches, then hands the engine the
 * same plan-as-DATA it always executes verbatim.
 *
 * Only three levers are exposed, because they are the only ones that can be
 * validated without inventing anything: which trials to include, each trial's
 * daily budget, and the ad copy (Meta headline/body/CTA; Google RSA
 * headlines/descriptions). Targeting, source and audience stay exactly as the
 * planner built them from real inputs — editing those would mean the operator
 * hand-typing Meta interest ids, which is out of scope here.
 *
 * Every edit is validated against the SAME honest rules the planner enforces:
 * the AED 50/day Meta floor, the machine's hard daily cap, Google RSA's minimum
 * of 3 headlines + 2 descriptions, and Meta's length limits. A project left
 * with no included trial is dropped; a plan left with no project is rejected
 * (nothing to launch) rather than silently emptied.
 */
import { META_MIN_TRIAL_BUDGET_AED } from '@/lib/freehold/ads-machine-planner'
import type { MachinePlan, MachineProjectPlan } from '@/lib/freehold/ads-machine-planner'
import type { MetaCta } from '@/lib/meta/types'

const META_CTAS: readonly MetaCta[] = [
  'LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'BOOK_NOW',
  'APPLY_NOW', 'DOWNLOAD', 'WHATSAPP_MESSAGE', 'CALL_NOW',
]

export interface TrialEdit {
  trialId: string
  /** false removes the trial from the launch entirely. Default (undefined) keeps it. */
  include?: boolean
  dailyBudgetAed?: number
  // Meta creative edits (ignored on Google trials)
  headline?: string
  primaryText?: string
  description?: string
  cta?: MetaCta
  // Google RSA edits (ignored on Meta trials)
  googleHeadlines?: string[]
  googleDescriptions?: string[]
}

export type PlanEditResult =
  | { ok: true; plan: Extract<MachinePlan, { viable: true }> }
  | { ok: false; error: string }

const clean = (s: unknown, max: number): string =>
  typeof s === 'string' ? s.trim().slice(0, max) : ''

const dedupeNonEmpty = (arr: string[]): string[] =>
  arr.filter((x, i, a) => x && a.indexOf(x) === i)

/**
 * Apply `edits` to `plan` under the live daily `capAed`. Pure: returns a NEW
 * plan object (or an error), never mutates the input.
 */
export function applyPlanEdits(
  plan: MachinePlan | null,
  edits: TrialEdit[],
  capAed: number,
): PlanEditResult {
  if (!plan || !plan.viable) {
    return { ok: false, error: 'This machine has no viable plan to edit.' }
  }
  const cap = Math.floor(Number(capAed))
  if (!Number.isFinite(cap) || cap <= 0) {
    return { ok: false, error: 'The daily cap must be a positive amount in AED.' }
  }

  const editById = new Map<string, TrialEdit>()
  for (const e of edits) {
    if (e && typeof e.trialId === 'string') editById.set(e.trialId, e)
  }

  const projects: MachineProjectPlan[] = []
  let total = 0

  for (const project of plan.projects) {
    const keptTrials: MachineProjectPlan['trials'] = []

    for (const trial of project.trials) {
      const edit = editById.get(trial.id)
      if (edit?.include === false) continue // operator excluded this trial

      // ── Budget ──
      let budget = trial.dailyBudgetAed
      if (edit?.dailyBudgetAed !== undefined) {
        budget = Math.floor(Number(edit.dailyBudgetAed))
        if (!Number.isFinite(budget) || budget < META_MIN_TRIAL_BUDGET_AED) {
          return { ok: false, error: `"${trial.label}" (${trial.listingName}): each trial must be at least AED ${META_MIN_TRIAL_BUDGET_AED}/day.` }
        }
      }
      total += budget

      // ── Copy — channel-specific ──
      const next = { ...trial, dailyBudgetAed: budget }

      if (trial.channel === 'google' && trial.google) {
        const g = { ...trial.google, dailyBudgetAED: budget }
        if (edit?.googleHeadlines) {
          const hs = dedupeNonEmpty(edit.googleHeadlines.map((h) => clean(h, 30)))
          if (hs.length < 3) {
            return { ok: false, error: `"${trial.label}" (${trial.listingName}): a Google Search ad needs at least 3 headlines (each up to 30 characters).` }
          }
          g.headlines = hs.slice(0, 15)
        }
        if (edit?.googleDescriptions) {
          const ds = dedupeNonEmpty(edit.googleDescriptions.map((d) => clean(d, 90)))
          if (ds.length < 2) {
            return { ok: false, error: `"${trial.label}" (${trial.listingName}): a Google Search ad needs at least 2 descriptions (each up to 90 characters).` }
          }
          g.descriptions = ds.slice(0, 4)
        }
        next.google = g
      } else if (trial.creative) {
        const creative = { ...trial.creative }
        if (edit?.headline !== undefined) {
          const h = clean(edit.headline, 40)
          if (!h) return { ok: false, error: `"${trial.label}" (${trial.listingName}): the headline cannot be empty.` }
          creative.headline = h
        }
        if (edit?.primaryText !== undefined) {
          const p = clean(edit.primaryText, 600)
          if (!p) return { ok: false, error: `"${trial.label}" (${trial.listingName}): the primary text cannot be empty.` }
          creative.primaryText = p
        }
        if (edit?.description !== undefined) {
          creative.description = clean(edit.description, 30)
        }
        if (edit?.cta !== undefined) {
          if (!META_CTAS.includes(edit.cta)) {
            return { ok: false, error: `"${trial.label}" (${trial.listingName}): unknown call-to-action.` }
          }
          creative.cta = edit.cta
        }
        next.creative = creative
      }

      keptTrials.push(next)
    }

    // A project with no included trial is simply not launched — drop it rather
    // than launch an empty project.
    if (keptTrials.length === 0) continue

    projects.push({
      ...project,
      trials: keptTrials,
      dailyBudgetAed: keptTrials.reduce((n, tr) => n + tr.dailyBudgetAed, 0),
    })
  }

  if (projects.length === 0) {
    return { ok: false, error: 'Every trial was excluded — keep at least one trial to launch.' }
  }
  if (total > cap) {
    return { ok: false, error: `The included trials total AED ${total.toLocaleString()}/day, above the AED ${cap.toLocaleString()}/day cap. Lower a budget or exclude a trial.` }
  }

  return {
    ok: true,
    plan: { viable: true, builtAt: plan.builtAt, dailyCapAed: cap, projects },
  }
}
