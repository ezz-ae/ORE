/**
 * THE BUYER'S OWN ANSWER, KEPT.
 *
 * `buildEligibilityPreset` (lib/meta/form-templates.ts) asks the one question
 * that settles who can complete a purchase on restricted stock — "UAE or GCC
 * national / other nationality / not sure" — and its header explains at length
 * why ASKING beats every platform inference. The person answered.
 *
 * And the sync threw the answer away. `syncLeadsToCrm` extracted name, phone
 * and email from `field_data` and nothing else, so the self-declaration
 * existed on the form and died at the door of the CRM. A broker opening the
 * lead asked the question again on the phone; the seed builders and the
 * qualification loop never saw it at all. Collected, read by nothing — the
 * failure this repo keeps finding in itself.
 *
 * WHAT THE ANSWER LOOKS LIKE ON THE WIRE, and why classification is fiddly:
 * Meta returns a choice answer as the option VALUE, which `optionValue()`
 * derives by slugging the label — and the slugger strips everything outside
 * [a-z0-9]. An English form yields real slugs (`uae_or_gcc_national`); an
 * Arabic or Russian form yields NOTHING from the label, so the options fall
 * back to positional `opt_1 / opt_2 / opt_3`. Some Graph paths return the
 * display label instead. So the classifier accepts all three shapes: the
 * English slugs, the display labels in every locale the form builder can
 * write, and the positional values — which are trustworthy ONLY because
 * `buildEligibilityPreset` fixes the option order (gcc, other, unsure) and a
 * guard asserts that order.
 *
 * WHAT THIS FIELD IS FOR — AND POINTEDLY NOT FOR. It routes and it informs:
 * the broker sees the answer before the first call, and the qualification
 * verdict it leads to feeds the QualifiedLead loop the auction now optimises
 * toward. It is NEVER a targeting input. Nationality does not narrow an
 * audience in this product (CLAUDE.md, with history), and a self-declared
 * answer does not soften that rule: deciding who may SEE a housing advert on
 * an answer about citizenship is the same instrument with better paperwork.
 * The guard scans the targeting layer for this module's symbols and fails if
 * one ever appears there.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */

/** Walkable — the three answers the form offers, in the order it offers them. */
export const BUYER_ELIGIBILITIES = ['gcc', 'other', 'unsure'] as const
export type BuyerEligibility = (typeof BUYER_ELIGIBILITIES)[number]

/** The Meta question key `buildEligibilityPreset` stamps on the question. */
export const ELIGIBILITY_FIELD_KEY = 'ownership_eligibility'

/**
 * Everything one answer can look like on the wire, lowercased.
 *
 * The label texts are the three locales' dictionary values VERBATIM
 * (pforms.eligibility.*) — the guard cross-checks them against the live
 * dictionaries so a reworded label cannot silently stop classifying.
 */
const SHAPES: Record<BuyerEligibility, readonly string[]> = {
  gcc: [
    'uae_or_gcc_national', 'opt_1',
    'uae or gcc national',
    'مواطن إماراتي أو خليجي',
    'гражданин оаэ или страны gcc',
  ],
  other: [
    'other_nationality', 'opt_2',
    'other nationality',
    'جنسية أخرى',
    'другое гражданство',
  ],
  unsure: [
    'not_sure_please_advise_me', 'opt_3',
    'not sure — please advise me',
    'لست متأكداً — أرجو إفادتي',
    'не уверен — подскажите, пожалуйста',
  ],
}

/**
 * Classify one raw field value.
 *
 * Null means "this is not an answer to the eligibility question" — never
 * 'other'. An unreadable answer is an unknown, and an unknown must not put a
 * person in the bucket a broker reads as "cannot buy": misfiling the unknown
 * as ineligible is exactly the platform-inference failure the question was
 * added to replace.
 */
export function classifyEligibility(raw: string | null | undefined): BuyerEligibility | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase()
  if (!v) return null
  for (const kind of BUYER_ELIGIBILITIES) {
    if (SHAPES[kind].includes(v)) return kind
  }
  // The slugged English labels survive partial rewording ("uae_gcc_national",
  // "other_nationality_2"): match on the stable stem, tightest first.
  if (/gcc/.test(v) && !/other/.test(v)) return 'gcc'
  if (/other[_ ]?nationality/.test(v)) return 'other'
  if (/not[_ ]?sure|unsure/.test(v)) return 'unsure'
  return null
}

/**
 * Pull the eligibility answer out of a Meta lead's field_data.
 *
 * Matched by the QUESTION KEY first — exact, then normalized — and only a
 * field so matched is classified. Classifying every field would let a free-
 * text answer that happens to contain "gcc" stamp a citizenship answer the
 * person never gave.
 */
export function eligibilityFromFields(
  fields: Array<{ name?: string; values?: string[] }> | null | undefined,
): BuyerEligibility | null {
  for (const f of fields ?? []) {
    const key = (f.name ?? '').trim().toLowerCase()
    if (key !== ELIGIBILITY_FIELD_KEY && key.replace(/[^a-z]/g, '') !== 'ownershipeligibility') continue
    return classifyEligibility(f.values?.[0])
  }
  return null
}
