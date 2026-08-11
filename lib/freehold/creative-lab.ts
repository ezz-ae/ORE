/**
 * THE CREATIVE LAB — a project's uniform, and a recipe that learns.
 *
 * The page this replaces listed every ad creative in the account, newest
 * first, with no project, no result and no memory. Fifty cards, most of them
 * blank grey squares, and nothing on the screen answered the only two
 * questions a creative screen exists for: what should THIS project's ads look
 * like, and which of the ones we already ran actually worked.
 *
 * A lab is those two questions, joined by a loop:
 *
 *   UNIFORM   what every ad for this project may look like and may claim.
 *   HISTORY   every creative it has ever run, with what that creative did.
 *   NEXT      the recipe to make now, chosen from the history.
 *
 * ── THE UNIFORM ──────────────────────────────────────────────────────────
 *
 * A project's ads should be recognisably its own — the same palette, the same
 * layout family, week after week, so a buyer who scrolled past on Tuesday
 * knows it on Thursday. That is not a style preference; repeated exposure to a
 * CONSISTENT mark is how a development becomes a name people recognise, and
 * randomising it throws that away every time.
 *
 * So the palette is derived from the project's own slug — deterministic, never
 * random, identical on every machine and every render. The project keeps its
 * colours for as long as it exists.
 *
 * WHAT IT MAY CLAIM is the harder half, and it is a truth rule rather than a
 * design one. A price-led layout on a project with no published price prints a
 * blank where a number belongs. A yield angle on a project with no rental
 * yield is an argument nobody can stand behind. Every layout and every angle
 * this module allows is one the project's OWN ROW can fill, and the ones it
 * withholds carry the reason they were withheld — so the answer to "why can't
 * I make that ad" is on screen rather than in someone's head.
 *
 * ── THE LOOP ─────────────────────────────────────────────────────────────
 *
 * Learning here means exactly one thing, and it is deliberately not a model:
 * a recipe that has been PROVEN by real delivery is repeated, a recipe proven
 * BAD is never offered again, and when nothing is proven yet the least-tested
 * option is tried next. Evidence-gated, so a recipe with two hundred
 * impressions is never called a winner — it is called undecided, which is the
 * honest word and the one this codebase already uses everywhere a number faces
 * a threshold.
 *
 * When a winner does exist, the uniform HOLDS and only the argument moves: the
 * next recipe keeps the winning layout and palette and rotates the angle to
 * its opposite. That is the same doctrine as creative-explore — one variable
 * moves, or the result is attributable to nothing.
 *
 * Pure — no I/O, no model, no clock. Runs in `pnpm guards`.
 */
import type { CreativeAngle } from '@/lib/meta/types'

/** Layout families the studio can render, in the order a project prefers them
 *  when its facts allow. Mirrors ad-compose's LayoutKey for the families this
 *  lab composes with; the guard asserts every one is renderable. */
export type LabLayout = 'payBands' | 'heroPrice' | 'statFooter' | 'splitCard' | 'frame' | 'badge'
export const LAB_LAYOUTS: LabLayout[] = ['payBands', 'heroPrice', 'statFooter', 'splitCard', 'frame', 'badge']

/** Every argument an ad can make. Same vocabulary the machine's creative arms
 *  use, so a lab recipe and a machine arm mean the same thing by 'yield'. */
export const LAB_ANGLES: CreativeAngle[] = ['investor', 'end_user', 'golden_visa', 'urgency', 'yield', 'lifestyle']

/** The facts a project's row can supply. Anything absent is a claim the
 *  project cannot make — never a blank to fill in. */
export interface ProjectFacts {
  slug: string
  name: string
  startingPriceAED?: number | null
  paymentPlan?: string | null
  handoverYear?: number | null
  rentalYieldPct?: number | null
  goldenVisaEligible?: boolean | null
  area?: string | null
  bedrooms?: string | null
}

/** A layout or angle the project cannot honestly use, and why. */
export interface Withheld<T> { key: T; reason: WithheldReason }
/** Walkable — each renders a sentence saying what the project row is missing. */
export const WITHHELD_REASONS = ['noPrice', 'noPlan', 'noYield', 'noVisa', 'noDate', 'noPlace'] as const
export type WithheldReason = (typeof WITHHELD_REASONS)[number]

export interface ProjectUniform {
  slug: string
  /** Index into ad-compose's PALETTES. Fixed for the life of the project. */
  palette: number
  layouts: LabLayout[]
  withheldLayouts: Withheld<LabLayout>[]
  angles: CreativeAngle[]
  withheldAngles: Withheld<CreativeAngle>[]
}

/**
 * A stable number from a string. FNV-1a, chosen because it is four lines, has
 * no dependency, and — the only property that matters here — gives the same
 * answer on every machine forever. A project's colours must not change because
 * a different server rendered the page.
 */
export function slugHash(slug: string): number {
  let h = 0x811c9dc5
  const s = String(slug ?? '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** How many palettes ad-compose ships. Kept as a constant the guard checks
 *  against the real array, so adding a palette cannot silently make a
 *  project's colours unreachable. */
export const PALETTE_COUNT = 8

export function uniformFor(p: ProjectFacts, paletteCount = PALETTE_COUNT): ProjectUniform {
  const hasPrice = !!(p.startingPriceAED && p.startingPriceAED > 0)
  const hasPlan = !!(p.paymentPlan && String(p.paymentPlan).trim())
  const hasYield = !!(p.rentalYieldPct && p.rentalYieldPct > 0)
  const hasVisa = p.goldenVisaEligible === true
  const hasDate = !!(p.handoverYear && p.handoverYear > 0)
  const hasPlace = !!(p.area && String(p.area).trim())

  const layouts: LabLayout[] = []
  const withheldLayouts: Withheld<LabLayout>[] = []
  // A payment layout needs BOTH a price and a plan — it prints the total and
  // the terms side by side, and half of that pair is a blank on the render.
  if (hasPrice && hasPlan) layouts.push('payBands')
  else withheldLayouts.push({ key: 'payBands', reason: hasPrice ? 'noPlan' : 'noPrice' })
  // Price-led families need the number they lead with.
  for (const k of ['heroPrice', 'statFooter'] as LabLayout[]) {
    if (hasPrice) layouts.push(k)
    else withheldLayouts.push({ key: k, reason: 'noPrice' })
  }
  // The name-led families need only a name, which every project has. They are
  // the floor: a project can ALWAYS make an ad, whatever its row is missing.
  layouts.push('splitCard', 'frame', 'badge')

  const angles: CreativeAngle[] = []
  const withheldAngles: Withheld<CreativeAngle>[] = []
  const angleRule: Array<[CreativeAngle, boolean, WithheldReason]> = [
    // An investor pitch rests on a price to invest AT.
    ['investor', hasPrice, 'noPrice'],
    // A yield argument that cannot state the yield is a claim with no number.
    ['yield', hasYield, 'noYield'],
    // Golden visa is a legal threshold, not a mood — only where it is true.
    ['golden_visa', hasVisa, 'noVisa'],
    // Urgency needs a date the buyer can miss.
    ['urgency', hasDate, 'noDate'],
    // A home pitch needs somewhere to be.
    ['end_user', hasPlace, 'noPlace'],
    ['lifestyle', hasPlace, 'noPlace'],
  ]
  for (const [key, ok, reason] of angleRule) {
    if (ok) angles.push(key)
    else withheldAngles.push({ key, reason })
  }

  return {
    slug: p.slug,
    palette: slugHash(p.slug) % Math.max(1, paletteCount),
    layouts,
    withheldLayouts,
    angles,
    withheldAngles,
  }
}

// ── The loop ────────────────────────────────────────────────────────────────

export interface Recipe { layout: LabLayout; angle: CreativeAngle }

/** One creative that ran, and what it did. */
export interface RecipeResult extends Recipe {
  adId: string
  impressions: number
  clicks: number
  leads: number
  spendAed: number
}

/** Below this there is not enough delivery to call a creative anything. The
 *  same floor the recommendations and live modules use — one number, so three
 *  screens cannot disagree about when a claim becomes sayable. */
export const MIN_IMPRESSIONS_TO_JUDGE = 2000

/** Walkable — each renders a word on the card. */
export const RECIPE_VERDICTS = ['proven', 'poor', 'undecided'] as const
export type RecipeVerdict = (typeof RECIPE_VERDICTS)[number]

export interface RankedRecipe extends Recipe {
  verdict: RecipeVerdict
  impressions: number
  leads: number
  spendAed: number
  /** Cost per lead, or null when there are no leads to divide by. */
  cplAed: number | null
  /** How many ads have run this exact recipe. */
  runs: number
}

const key = (r: Recipe) => `${r.layout}|${r.angle}`

/**
 * Group a project's history by recipe and judge each one.
 *
 * PROVEN means it produced leads with enough delivery behind it to believe.
 * POOR means it had that delivery and produced NOTHING — the only claim strong
 * enough to stop offering a recipe. Everything else is undecided, which is not
 * a hedge: it is the difference between "we tried this and it failed" and "we
 * have not really tried this", and confusing the two is how a lab stops
 * exploring.
 */
export function rankRecipes(history: RecipeResult[]): RankedRecipe[] {
  const acc = new Map<string, RankedRecipe>()
  for (const h of Array.isArray(history) ? history : []) {
    const k = key(h)
    const prev = acc.get(k)
    if (prev) {
      prev.impressions += h.impressions
      prev.leads += h.leads
      prev.spendAed += h.spendAed
      prev.runs += 1
    } else {
      acc.set(k, {
        layout: h.layout, angle: h.angle, verdict: 'undecided',
        impressions: h.impressions, leads: h.leads, spendAed: h.spendAed,
        cplAed: null, runs: 1,
      })
    }
  }
  const out = [...acc.values()]
  for (const r of out) {
    r.cplAed = r.leads > 0 && r.spendAed > 0 ? r.spendAed / r.leads : null
    if (r.impressions < MIN_IMPRESSIONS_TO_JUDGE) r.verdict = 'undecided'
    else if (r.leads > 0) r.verdict = 'proven'
    else r.verdict = 'poor'
  }
  // Proven first and cheapest-per-lead among them; then undecided; then poor.
  const rank = (v: RecipeVerdict) => (v === 'proven' ? 0 : v === 'undecided' ? 1 : 2)
  return out.sort((a, b) => {
    const d = rank(a.verdict) - rank(b.verdict)
    if (d !== 0) return d
    if (a.verdict === 'proven') return (a.cplAed ?? Infinity) - (b.cplAed ?? Infinity)
    return b.impressions - a.impressions
  })
}

/**
 * WHAT TO MAKE NEXT.
 *
 * Three rules, in order, and the order is the whole design:
 *
 *  1. NEVER RE-OFFER A PROVEN LOSER. A recipe with real delivery and no leads
 *     is the one thing this history can say with confidence.
 *  2. IF SOMETHING IS PROVEN, THE UNIFORM HOLDS AND THE ARGUMENT MOVES. Keep
 *     the winning layout; rotate to an angle the project is allowed to make
 *     and has not tried. One variable moves, or the result is attributable to
 *     nothing — the same rule the machine's creative arms follow.
 *  3. OTHERWISE, EXPLORE. The first allowed pairing nobody has run, walked in
 *     the uniform's own fixed order, so the same history always produces the
 *     same suggestion and two screens never disagree about what to test.
 *
 * Returns null only when the project's uniform allows nothing new at all —
 * every allowed pairing has been tried, and every one that was judged failed.
 * That is a real state and the screen says so rather than inventing a recipe
 * the evidence argues against.
 */
export function nextRecipe(uniform: ProjectUniform, ranked: RankedRecipe[]): Recipe | null {
  if (uniform.layouts.length === 0 || uniform.angles.length === 0) return null
  const seen = new Map(ranked.map((r) => [key(r), r]))
  const allowed = (r: Recipe) => uniform.layouts.includes(r.layout) && uniform.angles.includes(r.angle)
  const usable = (r: Recipe) => allowed(r) && seen.get(key(r))?.verdict !== 'poor'

  // 2 — a proven winner: hold the layout, move the argument.
  const winner = ranked.find((r) => r.verdict === 'proven' && allowed(r))
  if (winner) {
    const untried = uniform.angles.find((a) => !seen.has(key({ layout: winner.layout, angle: a })))
    if (untried) return { layout: winner.layout, angle: untried }
    // Every angle tried on the winning layout — carry the winning ANGLE to the
    // next allowed layout instead, so the set keeps growing without repeating.
    const nextLayout = uniform.layouts.find((l) => usable({ layout: l, angle: winner.angle }) && !seen.has(key({ layout: l, angle: winner.angle })))
    if (nextLayout) return { layout: nextLayout, angle: winner.angle }
  }

  // 3 — explore: the first allowed pairing nobody has run.
  for (const layout of uniform.layouts) {
    for (const angle of uniform.angles) {
      const r = { layout, angle }
      if (!seen.has(key(r))) return r
    }
  }

  // Everything allowed has been run. Offer the best surviving one again rather
  // than nothing — repeating a proven recipe is a real answer — but never a
  // loser.
  const survivor = ranked.find((r) => allowed(r) && r.verdict !== 'poor')
  return survivor ? { layout: survivor.layout, angle: survivor.angle } : null
}
