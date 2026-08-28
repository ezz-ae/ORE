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
  return entityClaims(answer).filter((c) => c.kind === 'campaign').map((c) => c.name)
}

/**
 * THE KINDS OF RECORD AN ANSWER CAN INVENT.
 *
 * Campaigns were checked from the day the Zada Tower transcript arrived, and
 * nothing else was. Then this came in from a live workspace, on the inventory
 * screen, with three buttons under it:
 *
 *   "Saad Aldbsaoy shows high intent… He submitted his details via a Meta ad
 *    for a specific property, Volta Towers, just 3 hours ago… Originated from
 *    'Volta_Towers_DXB_Leads_2024' campaign… Assigned to Aya Al-Masri."
 *
 * There is no Saad Aldbsaoy, no Volta Towers, no such campaign and no Aya
 * Al-Masri. A guard that only knew about campaigns caught none of it — and the
 * campaign half, the one it did understand, went unchecked too, for a separate
 * reason recorded at `unknownEntities`.
 *
 * A person and a property are worse to invent than a campaign, not better. A
 * fabricated figure wastes an afternoon; a fabricated LEAD with a "Draft
 * WhatsApp Message" button under it is an assistant asking somebody to go and
 * contact a person who does not exist, about a building that does not exist.
 */
export const ENTITY_KINDS = ['campaign', 'project', 'person'] as const
export type EntityKind = (typeof ENTITY_KINDS)[number]

export interface EntityClaim { kind: EntityKind; name: string }

/**
 * The claim patterns, one per kind.
 *
 * STILL DELIBERATELY NARROW, for the reason the campaign pattern was narrow: a
 * general proper-noun detector would flag every area, developer and building
 * in Dubai, and a guard that cries wolf is switched off inside a week — and
 * then the real lie ships. Each pattern below matches the SENTENCE SHAPE a
 * model writes when it is being helpful about a record it has not looked up,
 * not merely the presence of a capitalised word.
 *
 * `person` is the narrowest of the three on purpose. "Assigned to X" and
 * "handled by X" are statements about who owes work — the kind of claim that
 * sends somebody to a colleague's desk — while a name appearing anywhere else
 * in a sentence is far more likely to be the user's own words quoted back.
 */
const CLAIM_PATTERNS: Record<EntityKind, RegExp[]> = {
  campaign: [
    // "the Zada Tower campaign", "Zada Tower campaign is…"
    /\b((?:[A-Z][\w'’-]*\s+){1,4})campaign\b/g,
    // "'Volta_Towers_DXB_Leads_2024' campaign" — the quoted shape, which the
    // original pattern captured with the closing quote glued to the name.
    /["'“‘]([^"'“”‘’]{2,80})["'”’]\s+campaign\b/g,
    // "campaign 'X'", "campaign named X"
    /\bcampaign\s+(?:named\s+|called\s+)?["'“‘]([^"'“”‘’]{2,80})["'”’]/g,
  ],
  project: [
    // "the Volta Towers project", "Volta Towers development".
    //
    // NOT tower/towers/residences/heights. Those are ordinary Dubai nouns and
    // the pattern would fire on "the Marina towers" in generic advice, which
    // is the cried-wolf failure this file exists to avoid. Only the words that
    // mean "this is a record in your inventory".
    /\b((?:[A-Z][\w'’-]*\s+){1,4})(?:project|development|listing)\b/g,
    // "property, Volta Towers," — the shape in the transcript above, where the
    // noun comes FIRST and the name follows it. Bounded by punctuation or a
    // verb so it cannot run on into the rest of the sentence.
    /\b(?:property|project|listing|development)[,:]?\s+["'“‘]?((?:[A-Z][\w'’-]*\s*){1,4})["'”’]?(?=[,.;)]|\s+(?:just|which|that|is|was|has))/g,
  ],
  person: [
    // "Assigned to Aya Al-Masri", "handled by X", "reassigned to X".
    //
    // The trigger words are spelled with explicit case classes rather than an
    // /i flag: the flag would also loosen [A-Z] in the NAME, and a pattern that
    // accepts a lowercase name matches ordinary prose ("assigned to someone
    // else") and starts accusing the assistant of inventing the word "someone".
    /\b(?:[Aa]ssigned\s+to|[Hh]andled\s+by|[Oo]wned\s+by|[Rr]eassigned\s+to)\s+((?:[A-Z][\w'’-]*\s*){1,3})(?=[,.;)]|\s+(?:and|who|is|was|has|will))/g,
  ],
}

/** Every record this answer asserts by name, with the kind it asserted it as. */
export function entityClaims(answer: string): EntityClaim[] {
  const src = String(answer ?? '')
  const out: EntityClaim[] = []
  const seen = new Set<string>()
  for (const kind of ENTITY_KINDS) {
    for (const re of CLAIM_PATTERNS[kind]) {
      for (const m of src.matchAll(re)) {
        // Leading articles and possessives are not part of a name.
        const cleaned = (m[1] ?? '').trim()
          .replace(/^(The|This|That|Your|Our|A|An)\s+/i, '')
          .replace(/^["'“‘]+|["'”’]+$/g, '')
          .trim()
        if (!cleaned) continue
        const key = `${kind}:${cleaned.toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push({ kind, name: cleaned })
      }
    }
  }
  return out
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
  return unknownEntities(answer, { campaign: knownNames }).map((e) => e.name)
}

/**
 * Records the answer names that the workspace does not hold.
 *
 * SILENT WITHOUT A LIST, PER KIND. An accusation with nothing behind it is its
 * own kind of lie, so a kind whose list did not load is not checked — the
 * answer keeps its words rather than being replaced by a denial the server
 * cannot support.
 *
 * That rule is right and it is also how the Volta Towers answer escaped the
 * one guard that existed. The known-campaign list was read from
 * `context.campaigns`, which the CALLING PAGE supplies — and the inventory
 * screen supplies none. So on every screen but the ads screens the campaign
 * check silently returned "nothing to check against", which reads in the log
 * exactly like a clean answer. A guard whose reach depends on which page the
 * user happens to be standing on is not a guard; the lists are gathered
 * server-side now, and this comment is here so nobody moves them back.
 */
export function unknownEntities(
  answer: string,
  known: Partial<Record<EntityKind, readonly string[]>>,
): EntityClaim[] {
  return entityClaims(answer).filter((claim) => {
    const list = (known[claim.kind] ?? []).map(loose).filter(Boolean)
    if (list.length === 0) return false
    const c = loose(claim.name)
    if (!c) return false
    // Either direction counts as a match: a model naming "Sea Legend" for a
    // campaign called "Sea Legend One — Quick" is abbreviating, not inventing.
    return !list.some((k) => k.includes(c) || c.includes(k))
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
