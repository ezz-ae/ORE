/**
 * A LIST OF RECORDS IS A LIST OF THINGS THAT EXIST.
 *
 * The transcript, after every other guard in this product had passed:
 *
 *   Show me unrated leads
 *   [ACTIONS TAKEN · crm unrated leads]
 *   "Here are the top 5 leads that have been advanced to 'Qualified' but
 *    haven't been rated yet…
 *      - Aisha Al-Futtaim (Emaar Beachfront)
 *      - Fatima Al-Mansoori (Damac Lagoons)
 *      - Omar bin Rashid (Dubai Hills Estate)
 *      - Layla El-Sayed (Arabian Ranches III)
 *      - Khalid Al-Jaber (Tilal Al Ghaf)"
 *
 * with a "Rate Aisha Al-Futtaim" button under each. None of those people
 * exist. The tool had run and — almost certainly — come back with nothing,
 * because after the rating backfill "qualified AND unrated" is close to empty.
 * An empty result became five confident names and five buttons.
 *
 * ── WHY THE EXISTING GUARDS ALL MISSED IT ────────────────────────────────
 *
 * `unknownEntities` matches sentence shapes: "<Name> campaign", "the <Name>
 * project", "assigned to <Name>". A bullet reading `- Aisha Al-Futtaim (Emaar
 * Beachfront)` is none of those. The patterns were kept narrow on purpose —
 * a general proper-noun detector would flag every area and building in Dubai
 * and be switched off in a week — and this is the exact cost of that choice.
 *
 * And the PROJECTS in that list are real. They came from the context the model
 * was handed, which is what makes the invented names beside them credible.
 * Checking names against the workspace's records would have cleared every
 * line.
 *
 * ── SO THIS ASKS A DIFFERENT QUESTION ────────────────────────────────────
 *
 * Not "is this a record we have" but "did this string come from ANYWHERE the
 * model was given" — the same test `ungroundedNumbers` has always applied to
 * figures, which is the mechanism this product already trusts most. A name
 * present in no tool result, no context and nothing the user typed was
 * produced by the model alone. For a figure that is a wrong number; for a
 * person in a list with a button beside it, it is somebody being asked to go
 * and phone a stranger.
 *
 * NARROW BY SHAPE, not by vocabulary. Only list lines, and only where the name
 * is followed by the punctuation that makes it a record entry — a bracketed
 * project, a dash, a comma, or the end of the line. So:
 *
 *   "- Aisha Al-Futtaim (Emaar Beachfront)"   ← checked
 *   "- Dubai Marina is worth targeting"       ← not a record entry, ignored
 *   "- Raise the budget to AED 1,143"         ← no capitalised name, ignored
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */

/** Bullets and numbered items, in the shapes a model actually emits. */
const LIST_LINE = /^\s*(?:[-*•·–—]|\d{1,2}[.)])\s+(.{2,200})$/

/**
 * A name at the head of a list item, followed by something that marks the line
 * as a RECORD rather than a sentence.
 *
 * Two or more capitalised words: one is far too loose ("Meta", "Rate",
 * "Qualified" all lead lines legitimately), and a person or a project in this
 * product is written with at least two.
 */
const LEADING_NAME =
  /^((?:[A-Z][\p{L}'’.-]*(?:\s+(?:bin|bint|al|el|Al|El|Bin|Bint|van|de|du))?\s+){1,3}[A-Z][\p{L}'’.-]*)\s*(?=[(\[—–,:|]|$)/u

/** Every name presented as a record entry in a list. */
export function listedNames(text: string): string[] {
  const out: string[] = []
  for (const raw of String(text ?? '').split('\n')) {
    const item = raw.match(LIST_LINE)?.[1]
    if (!item) continue
    const name = item.match(LEADING_NAME)?.[1]?.trim()
    if (name) out.push(name)
  }
  return [...new Set(out)]
}

/** Punctuation and spacing differ between a record and how it is written. */
const loose = (s: string) => String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')

/**
 * Listed names that appear nowhere the model was allowed to look.
 *
 * `corpus` is everything it was given this turn: tool results, the fetched
 * context, and the user's own message — a user who types a name is entitled to
 * have it repeated back.
 *
 * Returns [] when the corpus is empty rather than condemning everything: a
 * turn with no grounding at all is a different fault, reported elsewhere, and
 * an accusation with nothing behind it is its own kind of lie.
 */
export function unsourcedListedNames(text: string, corpus: string): string[] {
  const hay = loose(corpus)
  if (!hay) return []
  return listedNames(text).filter((n) => {
    const needle = loose(n)
    return needle.length >= 4 && !hay.includes(needle)
  })
}
