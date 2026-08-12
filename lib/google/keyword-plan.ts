/**
 * THE KEYWORDS THIS ACCOUNT SHOULD ACTUALLY BUY — built from its own records.
 *
 * `keyword-themes.ts` is a hand-written list of UAE real-estate phrases. It is
 * a decent starting library and it is completely blind: it does not know which
 * projects this company sells, which of them are worth money this week, which
 * have a landing page to send a click to, or which have a permit that lets
 * them be advertised at all. Every account that installed this product got the
 * same forty phrases.
 *
 * This module builds the plan from the project record instead — and only from
 * the project record.
 *
 * THE GROUNDING RULE. Every keyword interpolates STORED FIELDS ONLY: name,
 * area, developer, type, price, payment plan, handover year. A group whose
 * fields are absent is not written from a guess; it is WITHHELD with a reason
 * the screen can print. This is the same rule the AI answers live under, for
 * the same reason — an invented area name is a real bid on a real auction with
 * real money, and it is worse than a gap because it looks like work.
 *
 * WHY ONE AD GROUP PER INTENT, AND NOT ONE LIST. Google prices every keyword by
 * how well the AD and the LANDING PAGE answer it. Sixty keywords in one ad
 * group with one ad means most of them are answered badly, and the account
 * pays for that in CPC forever. Tight groups are the whole difference between
 * a cheap Search account and an expensive one, and they are the part nobody
 * does by hand because it is tedious rather than difficult — which is exactly
 * the work a machine should be doing.
 *
 * WHY EVERY GROUP CARRIES ITS OWN LANDING URL. The company holds a landing page
 * per project. Sending "azizi venice payment plan" to a generic homepage
 * discards the largest asset in the account and Google charges more for the
 * click. A group with no page to send to is withheld rather than pointed at
 * something that does not answer it.
 *
 * WHAT THIS WILL NOT DO. It never builds a keyword from a competitor's name or
 * a rival brokerage's brand — only from inventory this company actually sells.
 * That is a trademark exposure and an ethics line, not a tuning choice.
 *
 * Pure — no I/O, no clock (today is passed in). Runs in `pnpm guards`.
 */

/** Walkable — one ad group per buying intent, each rendering its own name. */
export const AD_GROUP_KINDS = [
  'projectName', 'areaType', 'developer', 'paymentPlan', 'handover', 'budget', 'goldenVisa',
] as const
export type AdGroupKind = (typeof AD_GROUP_KINDS)[number]

/** Walkable — why a group or a whole plan was not built. Printed, never
 *  silently dropped: a missing group is a gap in the buy and the operator is
 *  owed the reason, which is usually a field somebody can go and fill in. */
export const PLAN_WITHHELD = [
  'noName', 'noArea', 'noDeveloper', 'noPaymentPlan', 'noHandover',
  'noPrice', 'belowVisaThreshold', 'noLandingPage', 'noPermit', 'permitExpired',
] as const
export type PlanWithheld = (typeof PLAN_WITHHELD)[number]

export type MatchType = 'EXACT' | 'PHRASE' | 'BROAD'

/**
 * The Golden Visa property threshold, in AED. A real government rule, not a
 * tuning constant: below it the keyword would promise something the property
 * cannot deliver, which is both a wasted click and a false claim in an ad.
 */
export const GOLDEN_VISA_AED = 2_000_000

/**
 * Below this opportunity score a project is not planned for Search.
 *
 * Not a quality judgement about the building — it is that Search budget is
 * finite and buying keywords for the weakest project in the portfolio takes
 * impressions from the strongest. A project with NO score (too little data) is
 * treated as unplanned rather than as low: an unknown is not a low number.
 */
export const MIN_OPPORTUNITY_TO_PLAN = 45

export interface PlanProject {
  slug: string
  name: string
  area: string | null
  developer: string | null
  /** apartment / villa / townhouse / penthouse / duplex / commercial. */
  type: string | null
  startingPriceAED: number | null
  paymentPlan: string | null
  handoverYear: number | null
  /** The project's own page. Without one there is nowhere honest to send a
   *  click, so the whole plan is withheld. */
  landingUrl: string | null
  permitNumber?: string | null
  /** YYYY-MM-DD. */
  permitExpiry?: string | null
}

export interface PlannedKeyword {
  text: string
  matchType: MatchType
}

export interface PlannedAdGroup {
  kind: AdGroupKind
  /** The ad group name as it will exist in Google — readable in their UI too,
   *  because somebody will eventually open it there. */
  name: string
  keywords: PlannedKeyword[]
  /** Where this group's clicks go. Always the page that answers THIS intent. */
  landingUrl: string
}

export interface WithheldGroup {
  kind: AdGroupKind
  why: PlanWithheld
}

export interface KeywordPlan {
  slug: string
  groups: PlannedAdGroup[]
  withheld: WithheldGroup[]
  /** Set when nothing could be planned at all — permit or landing page. */
  blocked: PlanWithheld | null
}

// ─── Text helpers ────────────────────────────────────────────────────────────

/** Google keywords are matched case-insensitively; lowercase keeps the plan
 *  readable and stops "Dubai" and "dubai" reading as two different bids. */
const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** The plural a searcher actually types: "apartments for sale", not
 *  "apartment for sale". Six known types, so a table beats a pluraliser. */
const PLURAL: Record<string, string> = {
  apartment: 'apartments', villa: 'villas', townhouse: 'townhouses',
  penthouse: 'penthouses', duplex: 'duplexes', commercial: 'commercial property',
}
const plural = (t: string): string => PLURAL[norm(t)] ?? `${norm(t)}s`

/** Google's own limit. A keyword over it is rejected at upload, and a plan
 *  that silently emits one produces a partial upload nobody notices. */
export const MAX_KEYWORD_CHARS = 80

/** Deduplicate, drop anything over Google's limit, keep insertion order. */
function clean(keywords: PlannedKeyword[]): PlannedKeyword[] {
  const seen = new Set<string>()
  const out: PlannedKeyword[] = []
  for (const k of keywords) {
    const text = norm(k.text)
    if (!text || text.length > MAX_KEYWORD_CHARS) continue
    const key = `${text}|${k.matchType}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ text, matchType: k.matchType })
  }
  return out
}

/** AED as a searcher writes it: "under 2m", "under 800k" — never "under
 *  AED 1,850,000", which nobody types into Google. */
export function priceWord(aed: number): string {
  if (aed >= 1_000_000) {
    const m = aed / 1_000_000
    return `${m % 1 === 0 ? m : m.toFixed(1)}m`
  }
  return `${Math.round(aed / 1_000)}k`
}

// ─── The plan ────────────────────────────────────────────────────────────────

/**
 * Build the ad groups for one project.
 *
 * BROAD MATCH IS NEVER EMITTED HERE, and that is deliberate. Broad match is
 * only safe when a smart bidding strategy has real conversion data to steer
 * it; without that it is the fastest way to spend a Search budget on queries
 * nobody meant. The search-terms harvest is how new phrases are meant to enter
 * this account — evidence first, bid second.
 */
export function planKeywords(p: PlanProject, today = new Date()): KeywordPlan {
  const groups: PlannedAdGroup[] = []
  const withheld: WithheldGroup[] = []

  // ── Blockers: nothing at all can be planned ────────────────────────────
  // A permit gate, not a preference. Advertising a Dubai property without a
  // valid Trakheesi permit is a regulatory breach, and the Ads Machine already
  // stops live campaigns on expiry — a plan that proposes keywords for an
  // unpermitted project would be proposing the same breach one step earlier.
  if (!p.permitNumber) return { slug: p.slug, groups, withheld, blocked: 'noPermit' }
  if (p.permitExpiry) {
    const exp = new Date(`${p.permitExpiry}T23:59:59+04:00`)
    if (Number.isFinite(exp.getTime()) && exp.getTime() < today.getTime()) {
      return { slug: p.slug, groups, withheld, blocked: 'permitExpired' }
    }
  }
  // No page means no honest destination. Pointing these keywords at a generic
  // homepage is the single most common reason a real-estate Search account
  // pays double: Google prices the click by how well the page answers the
  // query, and a homepage answers none of them.
  if (!p.landingUrl) return { slug: p.slug, groups, withheld, blocked: 'noLandingPage' }
  if (!p.name?.trim()) return { slug: p.slug, groups, withheld, blocked: 'noName' }

  const url = p.landingUrl
  const name = norm(p.name)
  const area = p.area ? norm(p.area) : null
  const dev = p.developer ? norm(p.developer) : null
  const type = p.type ? plural(p.type) : null

  // ACROSS groups, not only within one. "azizi venice payment plan" belongs to
  // both the name group and the payment-plan group by theme — and putting it in
  // both makes two of this account's own ad groups bid against each other in
  // the same auction. Google picks one arbitrarily, the data splits in half,
  // and neither group ever accumulates enough history to be judged.
  //
  // The FIRST group to claim a keyword keeps it, and the groups below are
  // written in descending intent order, so the tightest match wins the term.
  const claimed = new Set<string>()
  const add = (kind: AdGroupKind, label: string, keywords: PlannedKeyword[]) => {
    const kws = clean(keywords).filter((k) => {
      const key = `${k.text}|${k.matchType}`
      if (claimed.has(key)) return false
      claimed.add(key)
      return true
    })
    if (kws.length > 0) groups.push({ kind, name: label, keywords: kws, landingUrl: url })
  }
  const skip = (kind: AdGroupKind, why: PlanWithheld) => withheld.push({ kind, why })

  // ── 1. THE PROJECT'S OWN NAME ──────────────────────────────────────────
  // The cheapest, highest-intent traffic in any property account: somebody
  // typing the building's name has already been sold the building and is
  // looking for who will sell it to them. EXACT first because it is the term
  // this page genuinely answers best.
  add('projectName', `${p.name} — name`, [
    { text: name, matchType: 'EXACT' },
    { text: name, matchType: 'PHRASE' },
    { text: `${name} price`, matchType: 'PHRASE' },
    { text: `${name} payment plan`, matchType: 'PHRASE' },
    { text: `${name} floor plan`, matchType: 'PHRASE' },
    { text: `${name} for sale`, matchType: 'PHRASE' },
    ...(area ? [{ text: `${name} ${area}`, matchType: 'PHRASE' as MatchType }] : []),
  ])

  // ── 2. AREA + PROPERTY TYPE ────────────────────────────────────────────
  // The category buyer who has chosen a neighbourhood but not a building.
  if (area && type) {
    add('areaType', `${p.area} — ${type}`, [
      { text: `${type} for sale in ${area}`, matchType: 'PHRASE' },
      { text: `buy ${type} ${area}`, matchType: 'PHRASE' },
      { text: `${area} ${type} for sale`, matchType: 'PHRASE' },
      { text: `off plan ${type} ${area}`, matchType: 'PHRASE' },
      { text: `new ${type} in ${area}`, matchType: 'PHRASE' },
    ])
  } else skip('areaType', !area ? 'noArea' : 'noPrice')

  // ── 3. THE DEVELOPER ───────────────────────────────────────────────────
  // Only ever the developer of inventory this company actually sells. Never a
  // rival brokerage's brand — a trademark exposure and an ethics line, not a
  // tuning choice.
  if (dev) {
    add('developer', `${p.developer} — brand`, [
      { text: `${dev} ${name}`, matchType: 'PHRASE' },
      { text: `${dev} projects`, matchType: 'PHRASE' },
      { text: `${dev} new launch`, matchType: 'PHRASE' },
      ...(area ? [{ text: `${dev} ${area}`, matchType: 'PHRASE' as MatchType }] : []),
    ])
  } else skip('developer', 'noDeveloper')

  // ── 4. THE PAYMENT PLAN ────────────────────────────────────────────────
  // The off-plan buyer's real question, and the one the landing page answers
  // best. Only built when a plan is actually stored — "1% monthly" invented
  // for a project that has no such plan is a false claim in a live ad.
  if (p.paymentPlan && area) {
    add('paymentPlan', `${p.name} — payment plan`, [
      { text: `${name} payment plan`, matchType: 'PHRASE' },
      { text: `payment plan ${area}`, matchType: 'PHRASE' },
      { text: `off plan payment plan ${area}`, matchType: 'PHRASE' },
      { text: `installment property ${area}`, matchType: 'PHRASE' },
    ])
  } else skip('paymentPlan', !p.paymentPlan ? 'noPaymentPlan' : 'noArea')

  // ── 5. HANDOVER YEAR ───────────────────────────────────────────────────
  // "ready 2027" is a real and common query from buyers timing a move or a
  // rental start.
  if (p.handoverYear && area) {
    add('handover', `${p.name} — handover ${p.handoverYear}`, [
      { text: `${name} handover`, matchType: 'PHRASE' },
      { text: `${area} handover ${p.handoverYear}`, matchType: 'PHRASE' },
      { text: `property ready ${p.handoverYear} dubai`, matchType: 'PHRASE' },
    ])
  } else skip('handover', !p.handoverYear ? 'noHandover' : 'noArea')

  // ── 6. BUDGET ──────────────────────────────────────────────────────────
  // Priced off the REAL starting price, rounded UP to the round number a
  // searcher types. Rounding down would buy "under 1.5m" for a 1.6m property
  // and pay for a click that cannot convert.
  if (p.startingPriceAED && p.startingPriceAED > 0 && type) {
    const band = p.startingPriceAED >= 1_000_000
      ? Math.ceil(p.startingPriceAED / 500_000) * 500_000
      : Math.ceil(p.startingPriceAED / 100_000) * 100_000
    const w = priceWord(band)
    add('budget', `${p.name} — under ${w}`, [
      { text: `${type} under ${w} dubai`, matchType: 'PHRASE' },
      ...(area ? [{ text: `${type} under ${w} ${area}`, matchType: 'PHRASE' as MatchType }] : []),
      { text: `cheapest ${type} ${area ?? 'dubai'}`, matchType: 'PHRASE' },
    ])
  } else skip('budget', !p.startingPriceAED ? 'noPrice' : 'noArea')

  // ── 7. GOLDEN VISA ─────────────────────────────────────────────────────
  // Gated on the REAL government threshold. Below it the keyword promises
  // something this property cannot deliver — a wasted click and a false claim.
  if (p.startingPriceAED && p.startingPriceAED >= GOLDEN_VISA_AED) {
    add('goldenVisa', `${p.name} — golden visa`, [
      { text: 'golden visa property dubai', matchType: 'PHRASE' },
      { text: 'property for uae residency', matchType: 'PHRASE' },
      ...(area ? [{ text: `golden visa property ${area}`, matchType: 'PHRASE' as MatchType }] : []),
    ])
  } else {
    skip('goldenVisa', p.startingPriceAED ? 'belowVisaThreshold' : 'noPrice')
  }

  return { slug: p.slug, groups, withheld, blocked: null }
}

/**
 * WHAT NOBODY SHOULD EVER PAY FOR — the negatives every plan ships with.
 *
 * Grouped by the money they save, because an operator who understands why a
 * word is here will not delete it in six months. These are not preferences:
 * every one of them is a query that CANNOT become a sale for an off-plan
 * property business, and on a broad or phrase match they all arrive.
 *
 * RENTAL is the big one. "apartments in dubai marina" pulls an enormous rental
 * audience, and rental clicks are the majority of wasted spend in every Dubai
 * property account that has not excluded them.
 */
export const NEGATIVE_GROUPS = [
  {
    id: 'rental',
    terms: ['rent', 'rental', 'for rent', 'monthly rent', 'yearly rent', 'lease', 'tenant', 'short term rental', 'holiday home', 'airbnb'],
  },
  {
    id: 'jobs',
    terms: ['job', 'jobs', 'vacancy', 'career', 'salary', 'hiring', 'recruitment', 'internship'],
  },
  {
    id: 'free',
    terms: ['free', 'cheap', 'cheapest price', 'discount code', 'coupon'],
  },
  {
    id: 'notBuying',
    terms: ['wikipedia', 'news', 'review', 'complaint', 'scam', 'lawsuit', 'course', 'training', 'how to become'],
  },
  {
    id: 'notProperty',
    terms: ['hotel', 'hostel', 'wallpaper', 'game', 'movie', 'song'],
  },
] as const
export type NegativeGroupId = (typeof NEGATIVE_GROUPS)[number]['id']

/** Every negative, flattened, deduplicated. PHRASE match: 'rent' as BROAD
 *  would also block "current", and blocking a real query is a silent loss
 *  that never shows up in any report. */
export function negativeKeywords(): PlannedKeyword[] {
  return clean(NEGATIVE_GROUPS.flatMap((g) => g.terms.map((text) => ({ text, matchType: 'PHRASE' as MatchType }))))
}

/**
 * WHICH PROJECTS TO PLAN AT ALL — the opportunity layer's job.
 *
 * Search budget is finite, so buying keywords for the weakest project in the
 * portfolio takes impressions from the strongest. Ranked by the opportunity
 * score, floored at MIN_OPPORTUNITY_TO_PLAN.
 *
 * A project with NO score is not treated as low: an unknown is not a small
 * number. It is reported separately, because "we have not scored this yet" is
 * answered by scoring it, and "this scored badly" is answered by not buying.
 */
export function selectProjectsToPlan(
  projects: PlanProject[],
  scoreBySlug: Map<string, number | null>,
  limit = 10,
): { plan: PlanProject[]; belowFloor: string[]; unscored: string[] } {
  const plan: Array<{ p: PlanProject; score: number }> = []
  const belowFloor: string[] = []
  const unscored: string[] = []

  for (const p of projects) {
    const s = scoreBySlug.get(p.slug)
    if (typeof s !== 'number') { unscored.push(p.slug); continue }
    if (s < MIN_OPPORTUNITY_TO_PLAN) { belowFloor.push(p.slug); continue }
    plan.push({ p, score: s })
  }
  plan.sort((a, b) => b.score - a.score)
  return { plan: plan.slice(0, limit).map((x) => x.p), belowFloor, unscored }
}

/** Every keyword in a plan, for a count on screen or an upload. */
export const planKeywordCount = (plan: KeywordPlan): number =>
  plan.groups.reduce((n, g) => n + g.keywords.length, 0)
