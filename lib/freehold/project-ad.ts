/**
 * COMPOSE A REAL AD FROM A PROJECT'S OWN FACTS — one composer, two callers.
 *
 * Rocket used to hand Meta the project's hero RENDER with a generic sentence
 * over it. That is a stock photo and a caption, not an ad: no headline band,
 * no price block, no terms, none of what makes a Dubai property ad stop a
 * thumb. The engine for exactly this already existed and nothing called it.
 *
 * It lives here rather than inside the lite launcher because the creative pool
 * needs the same thing — turn a photograph the account already owns into a
 * designed ad — and two copies of a composition rule is how they drift until
 * two screens produce different ads from the same project.
 *
 * TWO RULES:
 *
 *  1. EVERY NUMBER COMES FROM THE PROJECT ROW. The layout is chosen by what
 *     the project can actually support: a project with no price cannot carry a
 *     price-led layout, so it gets the one that leads on the name and the
 *     place. Nothing is invented to fill a slot — the same rule as every other
 *     number this product prints. `missingPayFields` is asked rather than
 *     assumed, so a payment layout with a blank where a figure belongs is
 *     refused by the engine rather than shipped.
 *
 *  2. VARIANTS MUST DIFFER. Three new ads in one ad set exist to give Meta
 *     something to choose between. Three renders of the same photo in the same
 *     palette is one ad entered three times — it splits the budget and tests
 *     nothing. `variant` rotates the palette and, where the facts allow, the
 *     layout family, so a batch is a real set.
 *
 * Client-only: it draws on a canvas. Not importable from a route.
 */
import {
  composeVariant, ensureAdFonts, loadImage, missingPayFields, PALETTES,
  type FormatKey, type LayoutKey, type Overlay,
} from '@/lib/freehold/ad-compose'

export interface ProjectAdFacts {
  projectName: string
  area?: string | null
  developer?: string | null
  /** The photograph to design over. Falls back to a typographic ad with no
   *  picture rather than a placeholder image of a building that isn't this one. */
  heroImage?: string | null
  startingPriceAED?: number | null
  paymentPlan?: string | null
  handoverYear?: number | null
}

/** Words the render prints. Passed in rather than read from a dictionary here,
 *  because the AD's language is the buyer's, never the dashboard's. */
export interface ProjectAdLabels {
  /** Sits under the price: "from". */
  from: string
  /** Labels the total in the payment layouts. */
  total: string
  /** Given a year, the handover line. */
  handover: (year: number) => string
}

/**
 * Layout families in the order they are preferred when the facts allow them.
 * A batch walks this list so the second design is not the first one recoloured.
 */
const PRICE_LAYOUTS: LayoutKey[] = ['heroPrice', 'statFooter', 'splitCard']
const PLAIN_LAYOUTS: LayoutKey[] = ['frame', 'badge', 'splitCard']

export async function composeProjectAd(
  p: ProjectAdFacts,
  labels: ProjectAdLabels,
  opts: {
    /** Override the photograph — the pool passes the tile the operator picked. */
    image?: string | null
    /** The shape to render at. The creative pool passes the one the target ad
     *  set's own surfaces can actually use — never a 9:16 for a feed-only ad
     *  set, which would be letterboxed everywhere it ran. */
    format?: FormatKey
    /** Which design in a batch this is. See rule 2. */
    variant?: number
  } = {},
): Promise<string | null> {
  try {
    await ensureAdFonts()
    const src = opts.image ?? p.heroImage ?? null
    const img = src ? await loadImage(src, true).catch(() => null) : null
    const price = p.startingPriceAED && p.startingPriceAED > 0
      ? Math.round(p.startingPriceAED).toLocaleString()
      : ''

    const overlay: Overlay = {
      eyebrow: [p.area, p.developer].filter(Boolean).join(' · '),
      headline: p.projectName,
      price: price ? `AED ${price}` : '',
      priceUnit: price ? labels.from : '',
      footnote: p.handoverYear ? labels.handover(p.handoverYear) : '',
      // The payment family's fields, filled only where the project has them.
      financeHook: p.paymentPlan || '',
      totalPrice: price,
      totalLabel: labels.total,
      terms: p.paymentPlan || '',
    }

    const variant = Math.max(0, Math.floor(opts.variant ?? 0))
    // Price + a payment plan earns the terms-led layout; a price alone earns
    // a price-led one; neither earns the name-led family. The engine refuses a
    // pay layout with a blank where a number belongs, so the choice is checked
    // rather than hoped.
    const wantsPay = !!(price && p.paymentPlan)
      && missingPayFields('payBands', { ...overlay, downPct: '' }).length === 0

    // The first design in a batch leads with the strongest fact the project
    // has; later ones walk to a different family so the set is a real set.
    const layout: LayoutKey = wantsPay && variant === 0
      ? 'payBands'
      : price
        ? PRICE_LAYOUTS[variant % PRICE_LAYOUTS.length]
        : PLAIN_LAYOUTS[variant % PLAIN_LAYOUTS.length]

    // Palette walks alongside, offset so two designs never land on the same
    // pair. The payment family keeps its own darker palette on the first.
    const palette = wantsPay && variant === 0
      ? PALETTES[6]
      : PALETTES[(3 + variant) % PALETTES.length]

    return composeVariant(img, layout, palette, overlay, opts.format ?? 'square')
  } catch {
    return null
  }
}
