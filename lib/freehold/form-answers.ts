/**
 * WHAT THE PERSON ANSWERED, IN WORDS A BROKER CAN READ.
 *
 * The eligibility fix (buyer-eligibility.ts) rescued ONE question's answer.
 * Every other answer on an instant form — budget band, timeline, the motive
 * question an operator designed so each option filters a segment — still died
 * at the sync. An operator can build a five-question segmentation instrument
 * and the broker opening the lead sees name, phone, email.
 *
 * THE VALUE IS NOT THE ANSWER. Meta returns a choice answer as the option
 * VALUE, and `optionValue()` slugs labels through [a-z0-9] — so an English
 * form yields `under_750k` while an Arabic form yields `opt_1`, `opt_2`,
 * `opt_3`. Stored raw, the CRM would show a broker "opt_2", which is the same
 * as showing nothing. So answers are resolved against the FORM'S OWN question
 * definitions at sync time — value → option label, key → question label — and
 * stored resolved, for the same reason the sync stores ad NAMES not ad ids:
 * the record has to outlive the form, and a screen must never render a slug.
 *
 * Contact fields are excluded here — name, phone, email already have columns,
 * and repeating them inside an answers card would bury the answers the
 * operator designed the form to collect.
 *
 * Pure — no I/O. The form read that feeds `questions` lives in the sync.
 * Runs in `pnpm guards`.
 */

export interface FormAnswer {
  /** The Meta question key, kept for machine consumers (eligibility, dedupe). */
  key: string
  /** The question as the person saw it — the form's own label. */
  question: string
  /** The answer as the person gave it — option label, or free text verbatim. */
  answer: string
}

/** The question shape as Graph returns it on a lead form. */
export interface FormQuestionDef {
  key?: string
  label?: string
  type?: string
  options?: Array<{ value?: string; label?: string }>
}

/** Same intent as the sync's contact classifier: fields that already have
 *  their own CRM columns. An answers card repeating the phone number is noise
 *  wearing a label. */
const CONTACT_KEY = /(phone|mobile|whatsapp|tel|mail|name)/

const norm = (s: string): string => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '')

/** `budget_range` → `budget range` — the fallback when the form definition
 *  could not be read. Ugly next to a real label, but an answer whose question
 *  is missing is still an answer, and dropping it would repeat the original
 *  failure with better manners. */
const prettifyKey = (key: string): string => key.replace(/[_-]+/g, ' ').trim()

/**
 * Resolve one lead's field_data against its form's questions.
 *
 * Order is the form's order — the operator sequenced the questions on purpose
 * and the card should read the way the person answered.
 */
export function resolveFormAnswers(
  fields: Array<{ name?: string; values?: string[] }> | null | undefined,
  questions: FormQuestionDef[] | null | undefined,
): FormAnswer[] {
  const defs = (questions ?? []).filter((q) => q && (q.key || q.label))
  const byKey = new Map<string, FormQuestionDef>()
  for (const q of defs) {
    if (q.key) byKey.set(norm(q.key), q)
  }

  const out: FormAnswer[] = []
  for (const f of fields ?? []) {
    const rawKey = (f.name ?? '').trim()
    if (!rawKey) continue
    const nk = norm(rawKey)
    if (CONTACT_KEY.test(nk)) continue

    const raw = (f.values?.[0] ?? '').trim()
    // An empty answer is a question the person skipped, not a fact about them.
    if (!raw) continue

    const def = byKey.get(nk)
    const option = def?.options?.find((o) =>
      (o.value ?? '').trim().toLowerCase() === raw.toLowerCase() ||
      (o.label ?? '').trim() === raw)
    out.push({
      key: rawKey,
      question: (def?.label ?? '').trim() || prettifyKey(rawKey),
      answer: (option?.label ?? '').trim() || raw,
    })
  }
  return out
}

/** The one key the lead page renders separately, classified — see
 *  buyer-eligibility.ts. Kept in storage (the verbatim record), skipped in the
 *  generic card so the same answer is never shown twice. */
export const RENDERED_ELSEWHERE = new Set(['ownershipeligibility'])

export function answersForCard(answers: FormAnswer[]): FormAnswer[] {
  return answers.filter((a) => !RENDERED_ELSEWHERE.has(norm(a.key)))
}
