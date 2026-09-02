/**
 * HOW MANY PEOPLE OPENED THE FORM, AND HOW MANY FINISHED IT.
 *
 * "analysis open rate vs registration which will get you lead form conversion
 *  rate — this can result on recommendation of avoiding questions, adding
 *  another, rearranging."
 *
 * The forms page counted submissions and nothing else, so a form could be
 * quietly losing four out of five people who opened it and read exactly like
 * one that converted everybody. Those two forms need opposite decisions and
 * looked identical.
 *
 * ── THE ACTION TYPE IS NOT GUESSED, AND ABSENCE IS NOT ZERO ──────────────
 *
 * Meta reports form opens as an action on the ad, and has spelled it several
 * ways across API versions. Rather than hard-code one string and silently
 * report 0% for every account whose version says it differently, this tries
 * the known flavours — the same approach lib/meta/lead-count.ts already takes
 * for leads, and for the same reason.
 *
 * When none of them is present the answer is NULL, not zero. A form whose
 * opens Meta did not report is a form we cannot judge, and "0% completion"
 * printed over a form that is working perfectly well would get it rewritten
 * for nothing.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */

/**
 * Every spelling Meta has used for "somebody opened the lead form".
 *
 * Ordered most-specific first. `metaLeadCount` keeps the same kind of list for
 * the submission side; a single hard-coded string is how an integration
 * reports a confident zero on an account that is working.
 */
export const FORM_OPEN_ACTIONS = [
  'onsite_conversion.lead_form_open',
  'onsite_conversion.lead_form_opened',
  'lead_form_open',
  'leadgen_form_open',
] as const

export interface MetaAction { action_type: string; value?: string | number }

/** Opens reported for an ad, or null when Meta reported none of the flavours. */
export function formOpens(actions: readonly MetaAction[] | undefined | null): number | null {
  if (!Array.isArray(actions) || actions.length === 0) return null
  for (const type of FORM_OPEN_ACTIONS) {
    const hit = actions.find((a) => a.action_type === type)
    if (hit) return Math.max(0, Number(hit.value) || 0)
  }
  return null
}

/** Walkable — what a form's completion rate says to do about it. */
export const FUNNEL_VERDICTS = ['leaking', 'healthy', 'tooEarly', 'notReported'] as const
export type FunnelVerdict = (typeof FUNNEL_VERDICTS)[number]

/**
 * Opens a form needs before its completion rate means anything.
 *
 * Twenty, because below that a single person changing their mind moves the
 * rate by five points and the recommendation would flip week to week.
 */
export const MIN_OPENS_TO_JUDGE = 20

/**
 * The rate below which a form is losing people it should be keeping.
 *
 * A Meta instant form is pre-filled from the profile — name, email, phone are
 * already there — so completion is normally high. Half is generous as a floor
 * and still catches the real failure: extra qualifying questions that read as
 * an interrogation.
 */
export const LEAKING_BELOW = 0.5

export interface FormFunnel {
  opens: number | null
  submissions: number
  /** 0–1, or null when opens were not reported. */
  completion: number | null
  verdict: FunnelVerdict
  /** Roughly how many people the leak costs, at the current rate. */
  lostToLeak: number | null
}

export function readFunnel(opens: number | null, submissions: number): FormFunnel {
  const subs = Math.max(0, Math.round(submissions) || 0)
  if (opens === null) {
    return { opens: null, submissions: subs, completion: null, verdict: 'notReported', lostToLeak: null }
  }
  if (opens <= 0) {
    // No opens but submissions exist means the two numbers came from different
    // windows — reporting a rate over that would be arithmetic, not a fact.
    return { opens, submissions: subs, completion: null, verdict: 'notReported', lostToLeak: null }
  }
  const completion = Math.min(1, subs / opens)
  if (opens < MIN_OPENS_TO_JUDGE) {
    return { opens, submissions: subs, completion, verdict: 'tooEarly', lostToLeak: null }
  }
  const leaking = completion < LEAKING_BELOW
  return {
    opens, submissions: subs, completion,
    verdict: leaking ? 'leaking' : 'healthy',
    lostToLeak: leaking ? Math.round(opens - subs) : null,
  }
}

/** Walkable — what to change about a leaking form. */
export const FORM_ADVICE = ['dropQuestion', 'reorder', 'shorten', 'none'] as const
export type FormAdvice = (typeof FORM_ADVICE)[number]

/**
 * What to do about a leaking form, from its own shape.
 *
 * Deliberately conservative and deliberately NOT a model call: the advice is
 * a function of how many questions the form asks and where the answered ones
 * sit, both of which are facts. Advice is only ever offered for a form that is
 * measurably leaking on a real sample — a healthy form gets 'none', because
 * rewriting a working form is a way to break it.
 *
 * `answeredPerQuestion` is the share of submitters who answered each question,
 * in the form's own order. A question far down the list that far fewer people
 * answered is where the form is losing them.
 */
export function adviseForm(
  funnel: FormFunnel,
  answeredPerQuestion: readonly number[],
): { advice: FormAdvice; questionIndex: number | null } {
  if (funnel.verdict !== 'leaking') return { advice: 'none', questionIndex: null }

  const qs = answeredPerQuestion.filter((n) => Number.isFinite(n))
  // A long form is a long form; the fix is fewer questions, not a better order.
  if (qs.length >= 5) return { advice: 'shorten', questionIndex: null }
  if (qs.length === 0) return { advice: 'shorten', questionIndex: null }

  // The weakest question, and whether moving it would plausibly help. A weak
  // question that is already first cannot be reordered out of the way — it can
  // only be dropped.
  let worst = 0
  for (let i = 1; i < qs.length; i++) if (qs[i] < qs[worst]) worst = i
  const best = Math.max(...qs)
  // Only call something weak when it is clearly behind the strongest.
  if (best - qs[worst] < 0.2) return { advice: 'shorten', questionIndex: null }
  return worst === 0
    ? { advice: 'dropQuestion', questionIndex: worst }
    : { advice: 'reorder', questionIndex: worst }
}
