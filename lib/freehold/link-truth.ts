/**
 * A LINK THE ASSISTANT OFFERS HAS TO GO SOMEWHERE REAL.
 *
 * The failure, from a live workspace: the Expert described a lead called Saad
 * Aldbsaoy who had come in from a campaign called Volta_Towers_DXB_Leads_2024
 * for a property called Volta Towers, and put three buttons underneath it. None
 * of the three existed. Pressing "View Volta Towers Details" landed on
 * "404 — Property not found".
 *
 * There WAS a link guard. It let this through, and the reason is worth stating
 * because it is the shape this kind of guard usually fails in:
 *
 *   · it held a LIST of record collections — leads, forms, projects,
 *     properties, campaigns, deals, audiences — and required a tool-sourced id
 *     only inside those. The property route on this product is
 *     /freehold-intelligence/inventory/[id], and "inventory" was not on the
 *     list. A list of the places to be careful is a list of the places somebody
 *     remembered.
 *   · outside that list it fell back to guessing whether a segment LOOKED like
 *     an id — 8+ hex characters, 6+ digits, a uuid. A slug does not look like
 *     that, so "volta-towers" was never checked at all. The heuristic was
 *     asking "is this an id?" when the answerable question was "did this come
 *     from anywhere?"
 *
 * ── THE RULE ─────────────────────────────────────────────────────────────
 *
 * A link is allowed when some real route pattern matches it AND every segment
 * that filled a WILDCARD in that pattern appeared in this turn's tool results.
 *
 * The route table already knows which segments are dynamic — that is what the
 * `*` in `/freehold-intelligence/inventory/*` means. A dynamic segment is by
 * definition a record id or slug, whatever it looks like, so it is the exact
 * thing that has to have been fetched rather than composed. Nothing is
 * guessed, nothing is listed, and a route added tomorrow is covered the day it
 * is generated into app-routes.
 *
 * A static route matches with no wildcards to ground, so it passes freely —
 * /freehold-intelligence/inventory/new is a page, not a record.
 *
 * ── WHY THE MATCH AGAINST TOOL RESULTS IS EXACT, NOT FUZZY ───────────────
 *
 * An id is COPIED out of a tool result, never transformed, so it appears in
 * that text character for character. Matching loosely — ignoring case is fine,
 * ignoring punctuation is not — would let "volta-towers" be justified by a
 * tool result that merely mentioned the words "Volta Towers", which is the
 * fabrication dressed as a citation.
 *
 * Pure — no I/O. The route table is injected. Runs in `pnpm guards`.
 */

/**
 * THE ONLY LINKS THAT MAY LEAVE THIS APP, AND ONLY WHEN A TOOL PRODUCED THEM.
 *
 * Everything above is about internal paths. But the one thing a person most
 * wants to do from a lead — message them, call them — is inherently off-site:
 * there is no WhatsApp API on this deployment, so `crm_message_link` builds a
 * wa.me link that opens the USER'S OWN WhatsApp with the text pre-filled.
 * Nothing is sent on anybody's behalf.
 *
 * That link would be refused as `offsite` by the rule above, which is why this
 * exists — and why it is an allowlist of four contact schemes rather than a
 * relaxation. The grounding requirement is IDENTICAL and it is the whole
 * safety of it: the exact URL must appear in this turn's tool results, and the
 * tool built it from the phone number in the database. A model that composes
 * `wa.me/9715…` from its own head is composing a message to a stranger, and
 * that is a worse outcome than a 404.
 */
const CONTACT_LINKS = [
  /^https:\/\/wa\.me\/\d{7,20}(?:\?|$)/i,
  /^https:\/\/web\.whatsapp\.com\/send\?phone=\d{7,20}(?:&|$)/i,
  /^tel:\+?[\d\s().-]{7,25}$/i,
  /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i,
] as const

/** Is this one of the four, AND did a tool actually produce this exact link? */
export const isGroundedContactLink = (href: string, seen: string): boolean =>
  CONTACT_LINKS.some((re) => re.test(href)) && seen.toLowerCase().includes(href.toLowerCase())

/** Why a link was refused. Walkable — each is a different bug upstream. */
export const LINK_REFUSALS = [
  'offsite',      // not an internal path at all
  'no_route',     // no page in this app answers that path
  'ungrounded',   // a record id nothing fetched this turn
] as const
export type LinkRefusal = (typeof LINK_REFUSALS)[number]

export type LinkVerdict =
  | { ok: true }
  | { ok: false; refusal: LinkRefusal; segment?: string }

/** The path with its query and hash removed, split into segments. */
export const pathSegments = (href: string): string[] =>
  href.split('?')[0].split('#')[0].split('/').filter(Boolean)

/**
 * The segments a pattern treats as dynamic, or null when it does not match.
 *
 * `*` consumes exactly one segment; `**` consumes the rest — and every segment
 * it swallows is dynamic too, because a catch-all route is the widest place an
 * invented path can hide.
 */
export function wildcardSegments(path: readonly string[], pattern: string): string[] | null {
  const pp = pattern.split('/').filter(Boolean)
  const dynamic: string[] = []
  let i = 0
  for (; i < pp.length; i++) {
    if (pp[i] === '**') return [...dynamic, ...path.slice(i)]
    if (i >= path.length) return null
    if (pp[i] === '*') { dynamic.push(path[i]); continue }
    if (pp[i].toLowerCase() !== path[i].toLowerCase()) return null
  }
  return i === path.length ? dynamic : null
}

/**
 * Can this link be offered?
 *
 * `seen` is the raw text of everything the tools returned this turn. A link is
 * judged against the BEST matching pattern: a path that matches both a literal
 * route and a wildcard one — /inventory/new against /inventory/new and
 * /inventory/* — is the literal page, and grounding "new" would be a refusal
 * with nothing behind it.
 */
export function linkVerdict(href: unknown, seen: string, routes: readonly string[]): LinkVerdict {
  if (typeof href !== 'string') return { ok: false, refusal: 'offsite' }
  const h = href.trim()
  // The four contact schemes, and only when a tool built this exact link.
  if (isGroundedContactLink(h, seen)) return { ok: true }
  // Otherwise internal paths only. An off-site link an assistant composed is a
  // different and larger question than a 404, and this is not the place to
  // answer it.
  if (!h.startsWith('/')) return { ok: false, refusal: 'offsite' }

  const path = pathSegments(h)
  const matches = routes
    .map((p) => wildcardSegments(path, p))
    .filter((d): d is string[] => d !== null)
  if (matches.length === 0) return { ok: false, refusal: 'no_route' }

  const haystack = seen.toLowerCase()
  const grounded = (seg: string) => haystack.includes(decodeURIComponent(seg).toLowerCase())

  // Fewest wildcards first: the most specific route that answers this path is
  // the one it would actually render.
  matches.sort((a, b) => a.length - b.length)
  for (const dynamic of matches) {
    if (dynamic.every(grounded)) return { ok: true }
  }
  const ungrounded = matches[0].find((s) => !grounded(s))
  return { ok: false, refusal: 'ungrounded', segment: ungrounded }
}

export const linkAllowed = (href: unknown, seen: string, routes: readonly string[]): boolean =>
  linkVerdict(href, seen, routes).ok
