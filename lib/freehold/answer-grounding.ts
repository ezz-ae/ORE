/**
 * THE ANSWER IS CHECKED BEFORE IT IS SHOWN.
 *
 * A live transcript, in a product a business runs money through:
 *
 *   "Show me the automation rules for the Zada Tower campaign"
 *   "There are currently no automation rules for the Zada Tower campaign.
 *    This is why it's continued to spend despite the low lead quality score
 *    of 45… 50 leads this month… Starting from AED 699,999."
 *
 * There is no Zada Tower. Not in the ad account, not in the inventory, not
 * anywhere in this codebase. The campaign, the quality score, the lead count,
 * the ad copy and the price were all produced by the model, in confident
 * business prose, with buttons under them.
 *
 * The system prompt already forbade every one of those, in capital letters,
 * as "the single worst failure you can commit". IT WAS IGNORED. That is the
 * lesson this codebase keeps relearning in other forms: a rule whose only
 * enforcement is a sentence is a rule that gets broken. Prompts are a
 * request. This module is a check.
 *
 * WHAT IT VERIFIES, and deliberately nothing more:
 *
 *  1. NUMBERS. Every figure of two digits or more in the user-visible answer
 *     must appear in the grounding corpus — the live context, the results of
 *     the tools called this turn, and the user's own message. A number the
 *     model produced from nowhere is the money lie, and it is the one thing
 *     that is both exactly checkable and exactly catastrophic.
 *
 *  2. NAMED CAMPAIGNS. A phrase of the shape "<Name> campaign" must match a
 *     campaign this workspace actually has. Narrow on purpose: it is the
 *     exact shape of the failure above, and a narrow pattern that never
 *     misfires is worth more than a broad one nobody trusts.
 *
 * WHAT IT DOES NOT VERIFY, stated so nobody mistakes this for a truth oracle:
 * single-digit numbers (a model may legitimately say "two ad sets", and
 * enforcing those produces false alarms that train people to ignore the real
 * ones), prose claims with no figure in them, and names of anything other
 * than a campaign. This catches the expensive lie, not every lie.
 *
 * Pure — no I/O, no model. Runs in `pnpm guards`.
 */

/**
 * Below this, a number is not worth checking. "Two ad sets", "3 designs" and
 * "the first one" are reasoning a model may do out loud, and flagging them
 * would bury the figure that actually matters. Every fabricated number in the
 * transcript above — 45, 50, 699,999 — is two digits or more.
 */
export const MIN_CHECKED_DIGITS = 2

/** A year is a date, not a metric, and appears constantly in property copy
 *  ("handover 2027"). Checked separately or not at all — never as evidence of
 *  a fabricated figure. */
const YEAR = /^(19|20)\d{2}$/

/**
 * Every number a reader could act on, normalised so that "AED 699,999",
 * "699999" and "699,999" are one thing.
 *
 * Thousands separators and currency symbols are stripped; decimals are kept,
 * because 4.2 and 42 are different claims. Percent signs are dropped — "45%"
 * and "45" are the same figure wearing a unit, and a corpus that stores one
 * must match the other.
 */
export function numbersIn(text: string): string[] {
  const out: string[] = []
  const src = String(text ?? '')
  // Digits with optional thousands separators and an optional decimal tail.
  for (const m of src.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const raw = m[0].replace(/,/g, '')
    if (!raw) continue
    const digits = raw.replace(/\D/g, '')
    if (digits.length < MIN_CHECKED_DIGITS) continue
    if (YEAR.test(raw)) continue
    // Trailing zeros after a decimal point are the same number: 45.0 is 45.
    const norm = raw.includes('.') ? String(Number(raw)) : raw.replace(/^0+(?=\d)/, '')
    if (norm) out.push(norm)
  }
  return [...new Set(out)]
}

/**
 * The haystack an answer's figures must be found in.
 *
 * Everything the model was legitimately given: the live context, whatever the
 * tools returned this turn, and the USER'S OWN MESSAGE — a user who asks
 * "leads in the last 3 hours" has put 3 into the conversation, and quoting it
 * back is not a fabrication.
 */
export function groundingCorpus(parts: {
  context?: unknown
  toolResults?: unknown[]
  userMessage?: string
}): Set<string> {
  const text = [
    typeof parts.context === 'string' ? parts.context : JSON.stringify(parts.context ?? {}),
    ...(parts.toolResults ?? []).map((r) => (typeof r === 'string' ? r : JSON.stringify(r ?? {}))),
    String(parts.userMessage ?? ''),
  ].join(' ')
  return new Set(numbersIn(text))
}

/** Figures in the answer that appear nowhere the model was allowed to look. */
export function ungroundedNumbers(answer: string, corpus: Set<string>): string[] {
  return numbersIn(answer).filter((n) => !corpus.has(n))
}

/**
 * Campaign names the answer asserts, in the one shape that produced the live
 * failure: a capitalised phrase immediately followed by the word "campaign".
 *
 * Deliberately narrow. A general proper-noun detector would flag every area,
 * developer and building in Dubai and be switched off within a week; this
 * pattern matches the sentence a model writes when it is inventing a campaign
 * to be helpful about.
 */
export function campaignNamesClaimed(answer: string): string[] {
  const out: string[] = []
  const src = String(answer ?? '')
  // "the Zada Tower campaign", "Zada Tower campaign is…" — one to four
  // capitalised words directly before the word campaign.
  for (const m of src.matchAll(/\b((?:[A-Z][\w'’-]*\s+){1,4})campaign\b/g)) {
    const name = m[1].trim()
    // Leading articles and possessives are not part of a name.
    const cleaned = name.replace(/^(The|This|That|Your|Our|A|An)\s+/i, '').trim()
    if (cleaned) out.push(cleaned)
  }
  return [...new Set(out)]
}

const loose = (s: string) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * Names the answer claims that the workspace does not have.
 *
 * Matched loosely — punctuation and spacing differ constantly between a
 * campaign called "cash offer | new audiences" and how anyone writes it — and
 * either direction counts as a match, because a model naming "Sea Legend" for
 * a campaign called "Sea Legend One — Quick" is abbreviating, not inventing.
 */
export function unknownCampaigns(answer: string, knownNames: string[]): string[] {
  const known = knownNames.map(loose).filter(Boolean)
  if (known.length === 0) return []   // nothing to check against; claim nothing
  return campaignNamesClaimed(answer).filter((claim) => {
    const c = loose(claim)
    return !known.some((k) => k.includes(c) || c.includes(k))
  })
}

/** Walkable — each renders a sentence in the replacement answer. */
export const GROUNDING_FAULTS = ['number', 'campaign'] as const
export type GroundingFault = (typeof GROUNDING_FAULTS)[number]

export interface GroundingVerdict {
  ok: boolean
  faults: GroundingFault[]
  /** The offending figures and names, for the server log — never for the user,
   *  who is owed an answer rather than a diagnostic. */
  numbers: string[]
  campaigns: string[]
}

/**
 * The check itself.
 *
 * A verdict, not a rewrite: what to DO about a failed answer is the route's
 * decision, and it is a different question in a chat panel than in an MCP
 * bridge. This says only whether the answer can be stood behind.
 */
export function verifyAnswer(params: {
  answer: string
  corpus: Set<string>
  knownCampaigns: string[]
}): GroundingVerdict {
  const numbers = ungroundedNumbers(params.answer, params.corpus)
  const campaigns = unknownCampaigns(params.answer, params.knownCampaigns)
  const faults: GroundingFault[] = []
  if (numbers.length > 0) faults.push('number')
  if (campaigns.length > 0) faults.push('campaign')
  return { ok: faults.length === 0, faults, numbers, campaigns }
}
