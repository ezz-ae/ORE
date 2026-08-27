/**
 * WHICH ANSWER BRINGS THE BUYER.
 *
 * An operator designs a segmentation form so that every option filters a
 * different person — five doors, one per segment, each routed to its own
 * follow-up question. `form-answers.ts` made each lead's answers readable on
 * that lead's card; nothing ever folded them. So the only way to learn which
 * door the serious buyers walk through was to open leads one at a time and
 * keep a tally on paper — which nobody does, so the form's whole design was
 * teaching nobody anything.
 *
 * This module folds the stored answers by QUESTION and ranks each answer
 * against the rest of that question — the same field-versus-rest, bound-faced
 * comparison `audience-weight.ts` makes, LITERALLY: each answer is handed to
 * `weighAudiences` as if it were an audience, because "which door converts"
 * and "which audience converts" are the same statistical question and two
 * implementations of it would eventually disagree. The verdict vocabulary
 * (better / worse / tied / unknown / unanswered) rides along unchanged —
 * including `unanswered`, so a door whose leads nobody called is never read
 * as a door of tire-kickers.
 *
 * WHAT IS NOT RANKED. A free-text question produces one answer per person;
 * folding it would rank sentences. The distinction is not the question's Meta
 * type (the stored record outlives the form) but the shape of what came back:
 *
 *   · an answer one person gave is a person, not a segment — it is counted in
 *     the question's total and never shown as a row (SHARED_MIN);
 *   · a segmentation needs at least two doors with traffic before "which
 *     door" is a question at all (MIN_SEGMENTS);
 *   · more distinct shared answers than a choice question could plausibly
 *     offer means free text that happens to repeat — skipped whole
 *     (MAX_SEGMENT_OPTIONS).
 *
 * Questions fold by their exact text. The same question duplicated onto a
 * successor form (forms are immutable once published — duplication is the
 * only edit) keeps accumulating one record, which is exactly what the
 * operator means by "this question".
 *
 * The rollup is pure and runs in `pnpm guards`; the read lives at the bottom.
 */
import { query } from '@/lib/db'
import { QUALIFIED_STATUSES, WON_STATUSES } from '@/lib/freehold/lead-stages'
import { medianMinutes } from '@/lib/freehold/audience-outcomes'
import {
  weighAudiences, type WeightRung, type WeightVerdict,
} from '@/lib/freehold/audience-weight'
import type { FormAnswer } from '@/lib/freehold/form-answers'

/** Activity types that are not somebody responding. Mirrors response-time.ts,
 *  hour-truth-db.ts and audience-outcomes.ts — one list, four readers, no
 *  drift. */
const NON_RESPONSE_TYPES = ['assignment', 'created', 'repeat_inquiry', 'whatsapp_received']

/** An answer given by fewer people than this is a person, not a segment. */
export const SHARED_MIN = 2

/** "Which door brings buyers" needs at least this many doors with traffic. */
export const MIN_SEGMENTS = 2

/**
 * More distinct shared answers than this and the question is free text that
 * happens to repeat — a choice question does not offer this many options.
 */
export const MAX_SEGMENT_OPTIONS = 15

export interface AnswerOutcome {
  /** The answer as the person gave it — form-answers.ts stored words. */
  answer: string
  leads: number
  qualified: number
  won: number
  medianResponseMinutes: number | null
  /** From weighAudiences — the same vocabulary the budget panel speaks. */
  verdict: WeightVerdict
  rung: WeightRung
}

export interface QuestionOutcome {
  /** The question as the person saw it. */
  question: string
  /** Everyone who answered it — including answers too rare to show as rows. */
  leads: number
  /** Shared answers only, best outcomes first. */
  answers: AnswerOutcome[]
}

/** One lead as the rollup needs it — the DB read below produces these. */
export interface AnsweredLead {
  answers: FormAnswer[] | null
  status: string | null
  responseMinutes?: number | null
}

/** jsonb comes back as whatever was stored — trust nothing about its shape. */
export function parseStoredAnswers(raw: unknown): FormAnswer[] {
  const arr = typeof raw === 'string'
    ? (() => { try { return JSON.parse(raw) } catch { return null } })()
    : raw
  if (!Array.isArray(arr)) return []
  return arr.filter((a): a is FormAnswer =>
    !!a && typeof a === 'object' &&
    typeof (a as FormAnswer).question === 'string' && (a as FormAnswer).question.trim() !== '' &&
    typeof (a as FormAnswer).answer === 'string' && (a as FormAnswer).answer.trim() !== '')
}

interface Tally { leads: number; qualified: number; won: number; waits: Array<number | null | undefined> }

/**
 * Fold answered leads into one card per segmenting question.
 *
 * The counting rules are the system's counting rules — QUALIFIED_STATUSES and
 * WON_STATUSES, the same sets the campaign page and the optimiser read — so a
 * lead that is "qualified" on this card is qualified everywhere else too.
 */
export function rollupAnswerLeads(leads: AnsweredLead[]): QuestionOutcome[] {
  const byQuestion = new Map<string, Map<string, Tally>>()
  const answeredBy = new Map<string, number>()

  for (const lead of leads) {
    const status = String(lead.status ?? '').toLowerCase()
    const q = QUALIFIED_STATUSES.has(status) ? 1 : 0
    const w = WON_STATUSES.has(status) ? 1 : 0
    // One lead counts once per question even if a duplicate key answered it
    // twice in the same payload — the person exists once.
    const seen = new Set<string>()
    for (const a of lead.answers ?? []) {
      const question = a.question.trim()
      const answer = a.answer.trim()
      if (!question || !answer || seen.has(question)) continue
      seen.add(question)
      answeredBy.set(question, (answeredBy.get(question) ?? 0) + 1)
      const answers = byQuestion.get(question) ?? new Map<string, Tally>()
      const tally = answers.get(answer) ?? { leads: 0, qualified: 0, won: 0, waits: [] }
      tally.leads += 1
      tally.qualified += q
      tally.won += w
      tally.waits.push(lead.responseMinutes)
      answers.set(answer, tally)
      byQuestion.set(question, answers)
    }
  }

  const out: QuestionOutcome[] = []
  for (const [question, answers] of byQuestion) {
    const shared = [...answers.entries()].filter(([, t]) => t.leads >= SHARED_MIN)
    // A segmentation needs two doors with traffic; more shared answers than a
    // choice question could offer is free text that happens to repeat.
    if (shared.length < MIN_SEGMENTS || shared.length > MAX_SEGMENT_OPTIONS) continue

    // Each door weighed as if it were an audience — one implementation of
    // "does this arm separate from the rest", not two.
    const records = shared.map(([answer, t]) => ({
      key: answer,
      leads: t.leads,
      qualified: t.qualified,
      won: t.won,
      medianResponseMinutes: medianMinutes(t.waits),
    }))
    const weights = new Map(weighAudiences(records).map((w) => [w.key, w]))

    const rows: AnswerOutcome[] = records.map((r) => ({
      answer: r.key,
      leads: r.leads,
      qualified: r.qualified,
      won: r.won,
      medianResponseMinutes: r.medianResponseMinutes,
      verdict: weights.get(r.key)?.verdict ?? 'unknown',
      rung: weights.get(r.key)?.rung ?? 'none',
    })).sort((a, b) => b.won - a.won || b.qualified - a.qualified || b.leads - a.leads)

    out.push({ question, leads: answeredBy.get(question) ?? 0, answers: rows })
  }
  // The questions people actually answer first — the operator's main door.
  return out.sort((a, b) => b.leads - a.leads)
}

/**
 * Every segmenting question across every synced form, with what each answer's
 * people became. Best-effort like every outcome read: an account with no
 * stored answers yet — or a schema from before the column existed — returns
 * an empty list, and the card simply does not render.
 */
export async function answerOutcomes(): Promise<QuestionOutcome[]> {
  try {
    // The response clock is the identical lateral join hour-truth-db.ts and
    // audience-outcomes.ts use, measured from ARRIVAL — a lead that sat
    // unassigned was still going cold — so `unanswered` here and "slow" on
    // the hours page can never disagree.
    const rows = await query<{ meta_answers: unknown; status: string | null; response_minutes: number | null }>(
      `SELECT l.meta_answers, l.status,
              CASE WHEN r.first_response_at IS NOT NULL
                THEN GREATEST(0, ROUND(EXTRACT(EPOCH FROM (r.first_response_at - l.created_at)) / 60))::int
              END AS response_minutes
         FROM freehold_site_leads l
         LEFT JOIN LATERAL (
           SELECT MIN(a.created_at) AS first_response_at
             FROM freehold_site_lead_activity a
            WHERE a.lead_id = l.id
              AND a.created_by IS NOT NULL
              AND a.activity_type <> ALL($1)
              AND a.created_at >= l.created_at
         ) r ON TRUE
        WHERE l.meta_answers IS NOT NULL
          AND l.archived IS NOT TRUE`,
      [NON_RESPONSE_TYPES],
    )
    return rollupAnswerLeads(rows.map((r) => ({
      answers: parseStoredAnswers(r.meta_answers),
      status: r.status,
      responseMinutes: r.response_minutes === null ? null : Number(r.response_minutes),
    })))
  } catch {
    return []
  }
}
