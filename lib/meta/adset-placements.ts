/**
 * WHAT THIS AD SET ACTUALLY BUYS — read back from Meta, never assumed.
 *
 * The trap this exists for, in the operator's own words: "we can reinvent the
 * way Meta uses things or displays it, but we can't bypass the settings and
 * rules — show always what satisfies the situation, not generic."
 *
 * A placement picker that offers Instagram Story on an ad set whose targeting
 * names only Facebook Feed is not a picker. It is a form that collects a value
 * Meta will reject, at the far end, after the operator has done the work. The
 * whole class of Marketing-API failure is that shape: the API lets you ASK for
 * something the parent object forbids, and tells you at publish time.
 *
 * PLACEMENT IS AN AD-SET PROPERTY. Meta fixes it in `targeting`; an ad cannot
 * narrow it, widen it, or opt out of it. So an "add an ad" screen has exactly
 * two honest jobs, and this module serves both:
 *
 *   1. STATE where the ad will run — the ad set's real surfaces, read from its
 *      own spec, as facts rather than choices.
 *   2. Offer only the design shapes those surfaces can use, and name the ones
 *      that will crop a given shape. A 1:1 image in a Story is not "an ad in
 *      Stories"; it is a square with grey bars, and it is a different ad from
 *      the one that tested well in feed.
 *
 * TWO META TRAPS ENCODED HERE, both of the "absent means everything" kind:
 *
 *   · publisher_platforms absent or empty is NOT "no placements". It is
 *     Advantage+ automatic placements — every surface Meta owns, including
 *     Audience Network. Reading it as an empty list would make this module
 *     report an ad set that runs everywhere as one that runs nowhere.
 *
 *   · A platform named WITHOUT its positions (`publisher_platforms:
 *     ['instagram']` and no `instagram_positions`) means every Instagram
 *     position. Same rule, one level down, and the same wrong answer if
 *     missed.
 *
 * Pure — no network. Runs in `pnpm guards`.
 */
import { shapeOf, fits, type CreativeAspect } from '@/lib/freehold/placement-audit'
import { LAUNCHABLE_PLACEMENTS, type LaunchablePlacement } from '@/lib/freehold/placement-memory'

/**
 * The design shapes the studio can render. Mirrors `FormatKey` in
 * lib/freehold/ad-compose — declared here rather than imported so this module
 * stays free of the canvas layer; the guard asserts the two stay identical.
 */
export type AdFormat = 'feed' | 'square' | 'story'
export const AD_FORMATS: AdFormat[] = ['feed', 'square', 'story']

/** What each rendered shape actually is, for the crop question. */
export const FORMAT_ASPECT: Record<AdFormat, CreativeAspect> = {
  feed:   '4:5',
  square: '1:1',
  story:  '9:16',
}

/** The buying vocabulary of each surface this product runs — the inverse of
 *  PLACEMENT_TARGETING in the client, kept here because reading an ad set back
 *  is a different job from building one. */
const SURFACE_OF: Record<LaunchablePlacement, { platform: string; position: string }> = {
  fbFeed:  { platform: 'facebook',  position: 'feed' },
  igFeed:  { platform: 'instagram', position: 'stream' },
  igStory: { platform: 'instagram', position: 'story' },
  reels:   { platform: 'instagram', position: 'reels' },
}

/** Meta position name → our key, per platform. Both spellings of a surface are
 *  mapped: the buying API and the insights breakdown disagree on names. */
const POSITION_KEY: Record<string, LaunchablePlacement> = {
  'facebook:feed': 'fbFeed',
  'facebook:facebook_reels': 'reels',
  'instagram:stream': 'igFeed',
  'instagram:feed': 'igFeed',
  'instagram:story': 'igStory',
  'instagram:stories': 'igStory',
  'instagram:reels': 'reels',
}

/** Every position we recognise on a platform — what "the platform with no
 *  positions named" expands to. See trap 2 in the header. */
const ALL_POSITIONS: Record<string, string[]> = {
  facebook: ['feed', 'facebook_reels'],
  instagram: ['stream', 'story', 'reels'],
}

export interface AdSetPlacements {
  /** The surfaces this product recognises, in the product's own vocabulary. */
  keys: LaunchablePlacement[]
  /**
   * TRUE when Meta is choosing, not us — an absent or empty
   * publisher_platforms. The keys then describe what we can DESIGN for, not
   * the full set Meta will actually buy, which includes surfaces this product
   * never opts into. Screens must say so rather than presenting our four as
   * the whole truth.
   */
  automatic: boolean
  /** Platforms named in the spec that this product has no design for — most
   *  often audience_network. Named rather than silently dropped. */
  unsupported: string[]
}

const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? '').trim().toLowerCase()).filter(Boolean) : []

/**
 * Read an ad set's real placements out of its targeting.
 *
 * Never throws and never guesses: unreadable targeting reads as `automatic`,
 * because an ad set whose spec we cannot parse is one whose delivery we cannot
 * claim to have narrowed.
 */
export function placementsOfAdSet(targeting: unknown): AdSetPlacements {
  const t = (targeting && typeof targeting === 'object' ? targeting : {}) as Record<string, unknown>
  const platforms = arr(t.publisher_platforms)

  // TRAP 1 — absent or empty is Advantage+ placements, i.e. everything.
  if (platforms.length === 0) {
    return { keys: [...LAUNCHABLE_PLACEMENTS], automatic: true, unsupported: [] }
  }

  const keys = new Set<LaunchablePlacement>()
  const unsupported: string[] = []

  for (const platform of platforms) {
    const known = ALL_POSITIONS[platform]
    if (!known) { unsupported.push(platform); continue }
    // TRAP 2 — a platform named without its positions means ALL its positions.
    const named = arr(t[`${platform}_positions`])
    const positions = named.length > 0 ? named : known
    for (const position of positions) {
      const key = POSITION_KEY[`${platform}:${position}`]
      if (key) keys.add(key)
    }
  }

  // Order is the product's own preference (Instagram feed first), not Meta's
  // — so two ad sets with the same surfaces always read the same way.
  return {
    keys: LAUNCHABLE_PLACEMENTS.filter((k) => keys.has(k)),
    automatic: false,
    unsupported: [...new Set(unsupported)],
  }
}

/**
 * THE SHAPES WORTH RENDERING FOR THESE SURFACES — and only these.
 *
 * The point of the module: an ad set with no vertical surface is never offered
 * a 9:16 design, because that design would be letterboxed in every place the
 * ad set actually runs.
 *
 * Returns [] when the ad set buys nothing this studio designs for (an
 * audience-network-only ad set, say). An empty list is a real answer and the
 * screen says so — it is not a reason to fall back to a default shape that
 * fits nothing.
 */
export function formatsFor(keys: LaunchablePlacement[]): AdFormat[] {
  const out: AdFormat[] = []
  const shapes = new Set(keys.map((k) => shapeOf(SURFACE_OF[k].platform, SURFACE_OF[k].position)))
  // Feed surfaces: 4:5 fills more of the screen than 1:1 and is the better
  // default, but both survive intact, so both are offered.
  if (shapes.has('feed')) out.push('feed', 'square')
  if (shapes.has('vertical')) out.push('story')
  return AD_FORMATS.filter((f) => out.includes(f))
}

/**
 * Which of this ad set's surfaces will CROP a design of the given shape.
 *
 * Not a blocker — a square ad in Stories still runs, and sometimes that is the
 * right trade. It is a statement made before the press rather than a surprise
 * read off a placement report three days later.
 */
export function croppedBy(keys: LaunchablePlacement[], format: AdFormat): LaunchablePlacement[] {
  const aspect = FORMAT_ASPECT[format]
  return keys.filter((k) => {
    const s = shapeOf(SURFACE_OF[k].platform, SURFACE_OF[k].position)
    return fits(s, aspect) === false
  })
}

/** The best default shape for these surfaces: the one that survives the most
 *  of them intact, ties broken toward feed, which is where the money is. */
export function bestFormatFor(keys: LaunchablePlacement[]): AdFormat | null {
  const options = formatsFor(keys)
  if (options.length === 0) return null
  return options.reduce((best, f) =>
    croppedBy(keys, f).length < croppedBy(keys, best).length ? f : best)
}
