/**
 * Which languages a launch narrows to.
 *
 * Language can arrive from two independent places — the wizard's choice for
 * this launch, and the language a SAVED audience carries in its spec — and a
 * saved audience exists precisely so its definition survives being reused.
 * Reading only one source is the failure that matters here: the audience card
 * would still read "Arabic", the ad set would deliver unnarrowed, and nothing
 * in either screen would say so.
 *
 * Pure, so the guard suite can prove the union rather than assume it.
 */

/** The only languages the /lp landing pages actually serve. Narrowing to a
 *  language we cannot then show a page in buys a worse experience than no
 *  narrowing at all. */
export const SUPPORTED_LEAD_LANGUAGES = ['en', 'ar', 'ru'] as const
export type LeadLanguage = (typeof SUPPORTED_LEAD_LANGUAGES)[number]

const isSupported = (c: unknown): c is LeadLanguage =>
  typeof c === 'string' && (SUPPORTED_LEAD_LANGUAGES as readonly string[]).includes(c)

/**
 * The union of every language source, deduped and validated.
 *
 * A UNION, not an intersection: if the wizard says Arabic and the attached
 * audience says English, the honest reading is that this launch should reach
 * both, because the operator asked for both. An intersection would silently
 * produce an empty set — and empty means "no narrowing at all", the exact
 * opposite of what either instruction meant.
 *
 * Returns [] when nothing valid is supplied, which the caller treats as
 * "narrow nothing" — today's default and the safe one.
 */
export function mergeLeadLanguages(...sources: (readonly unknown[] | undefined | null)[]): LeadLanguage[] {
  const out = new Set<LeadLanguage>()
  for (const src of sources) {
    if (!Array.isArray(src)) continue
    for (const code of src) if (isSupported(code)) out.add(code)
  }
  // Stable order so a launch's targeting is byte-identical across runs with
  // the same intent — an ad set diff should reflect a change, not a Set.
  return SUPPORTED_LEAD_LANGUAGES.filter((c) => out.has(c))
}
