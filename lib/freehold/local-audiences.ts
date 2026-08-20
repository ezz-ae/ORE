/**
 * THE LOCAL AUDIENCES — three, final, and narrow enough to be worth buying.
 *
 * This file exists because of a measured failure. A live campaign for
 * Arabic-speaking UAE investors advertised 2.7M–3.2M and delivered 166 leads at
 * AED 168 each, of which almost none were worth calling. The same ad set,
 * rebuilt by hand with `Penthouse apartment` as its narrowing rule, came out at
 * 728,200–856,800 — and Arabic speakers in the whole country are only about
 * 2.5–3M. A "gate" that leaves 2.2M standing is not narrowing anything; it is
 * the market with a label on it.
 *
 * ── WHY THERE ARE ONLY THREE ─────────────────────────────────────────────
 *
 * The honest axis in this market is the LANGUAGE THE AD IS WRITTEN IN. It is a
 * real Meta field, it decides which creative a person can read, and an Arabic
 * ad shown to somebody who does not read Arabic is wasted money for us and
 * noise for them. Everything else people reach for — nationality, "expat vs
 * local", income band — is either not a field at all or a proxy stack that is
 * wrong at the edges. See lib/freehold/audience-pattern.ts; that rule has
 * history and is not re-litigated here.
 *
 * So: three audiences, one per creative language, all UAE RESIDENTS, all gated
 * on property-shopping signals, all excluding the same time-wasters. Adding a
 * fourth cut would mean inventing a distinction Meta cannot act on.
 *
 * ── THE GATE IS NAMED, NOT NUMBERED ──────────────────────────────────────
 *
 * Every interest here is a NAME, resolved against Meta's live vocabulary at
 * build time and verified before it is used. No interest id is written into
 * this file by hand except the one already proven in the catalog.
 *
 * That is not fussiness. An id typed from memory either fails validation or —
 * worse — resolves to a completely different segment, which is exactly how
 * this product once reported two live interests as renamed to "Beauty". A name
 * that cannot be resolved is DROPPED and said out loud; it is never guessed at.
 *
 * ── AND META ITSELF SAYS WHICH ONES ARE TOO BIG ──────────────────────────
 *
 * The old defence against a mass interest was a hand-written `mass: true` flag
 * on three motives. It was correct, and the product used one of those very
 * interests as its gate anyway, because a flag in a file is not a check.
 *
 * Meta's interest search returns its own audience-size band for every segment.
 * `tooWideForGate` reads that band. A narrowing group is an OR, so one oversized
 * member makes the whole gate as wide as its widest member — which is the
 * single sentence that explains every wasted dirham in this account's history.
 *
 * Pure — no network, no database. The resolving lives in local-audiences-db.ts.
 * Runs in `pnpm guards`.
 */
import type { LeadLanguage } from '@/lib/meta/lead-language'

/** Walkable — the three, in the order they are offered. */
export const LOCAL_AUDIENCE_KEYS = ['localArabic', 'localEnglish', 'localRussian'] as const
export type LocalAudienceKey = (typeof LOCAL_AUDIENCE_KEYS)[number]

/**
 * PROPERTY-SHOPPING SIGNALS, most specific first.
 *
 * The test each one has to pass: would somebody carry this interest if they
 * were NOT shopping for property? `Investment` and `Luxury goods` fail it —
 * they are carried by anybody saving money or liking nice things, and both
 * have already been the sole gate on a campaign that reached the whole market.
 * `Penthouse apartment` passes: nobody browses penthouses idly.
 *
 * Resolved in order and the first few that verify AND come in under the size
 * ceiling are used. More is not better in an OR group — every extra member can
 * only widen it.
 */
export const PROPERTY_SIGNALS: readonly string[] = [
  'Penthouse apartment',
  'Luxury real estate',
  'Real estate investing',
  'Condominium',
  'Villa',
  'Real estate development',
  'Mortgage loan',
]

/**
 * DELIBERATELY ABSENT: the developers' own names.
 *
 * Emaar, DAMAC, Nakheel and the rest are strong property-shopping signals in
 * this market and they are left out of the default gate on purpose. This
 * company sells units from some of them and competes with others, and an
 * audience built quietly on a competitor's name is a decision somebody should
 * take knowingly rather than inherit from a constant in a file. Add them at the
 * point of building an audience, where the choice is visible and attributable.
 */
export const DEVELOPER_SIGNALS_NOT_DEFAULT = true

/**
 * SEGMENTS THAT MAY NEVER BE TARGETED OR EXCLUDED HERE.
 *
 * Every one of these is national origin wearing a marketing word. They get
 * suggested constantly — "exclude Expatriates (All)", "exclude Expats - India",
 * "exclude Away from hometown" — always with a reasonable-sounding aim, usually
 * "we only want locals". The aim is legitimate. The instrument is not.
 *
 * BE PRECISE ABOUT WHY, because the easy reason is not the true one.
 *
 * META ALLOWS IT HERE. Housing is a Special Ad Category in the US and Canada,
 * where these exclusions are blocked outright; in this market they are not, and
 * Meta's own assistant recommends them. So this is a decision this product
 * takes, not a restriction it is passing on, and stating it as a platform rule
 * would be hiding a choice behind somebody else's policy.
 *
 * The two reasons it is taken:
 *
 *   · This is HOUSING, and choosing who may see a property advert by where they
 *     or their family are from is the thing housing-discrimination rules exist
 *     to prevent. That the rule is not enforced in every market is a fact about
 *     enforcement, not about the advert.
 *   · It does not even work. "Expatriate" is Meta's guess from signals like
 *     where somebody's friends are and what language their posts are in. It is
 *     wrong at exactly the edges that matter here — the long-settled resident
 *     with family abroad reads as an expat; the arrival of six months with a
 *     local number does not. The cut lands on real buyers.
 *
 * WHAT TO USE INSTEAD, and it is already in every spec this file builds:
 * `locationTypes: ['home']`. Meta's own field for people who LIVE in the
 * country rather than travel through it. That is the real question — residence,
 * not origin — and unlike the proxy it is a fact Meta actually holds.
 *
 * Matched loosely on purpose. This is a refusal, and a refusal that can be
 * dodged by a spelling is decoration.
 */
export const FORBIDDEN_SEGMENT_PATTERNS: readonly RegExp[] = [
  /\bexpat/i,
  /\bexpatriate/i,
  /away from (home|hometown|family)/i,
  /\bnationality\b/i,
  /\bethnic/i,
  /lives? abroad/i,
  /home country/i,
]

/** True when a segment name is one this product refuses to target or exclude on. */
export const isForbiddenSegment = (name: string): boolean =>
  FORBIDDEN_SEGMENT_PATTERNS.some((re) => re.test(name ?? ''))

/**
 * How many gate members are enough.
 *
 * One is a single point of failure — Meta retires a segment and the audience
 * silently loses its qualifier. Four is already an OR wide enough to stop
 * meaning much. Two or three is the band where the gate still says "shopping
 * for property" and still has a spare.
 */
export const GATE_MIN = 2
export const GATE_MAX = 3

/**
 * The size band an interest must sit in to be allowed into a narrowing group,
 * as Meta itself reports it.
 *
 * Meta's band is GLOBAL, not per-country, so this is a comparison between
 * interests rather than a claim about the UAE. `Real estate investing` sits in
 * the low hundreds of millions worldwide; `Investment` and `Property` are an
 * order of magnitude above that and are the two this account has already been
 * burned by. The ceiling sits between them.
 *
 * An interest Meta reports NO size for is allowed through — an absent number is
 * not evidence of a big one, and refusing everything unmeasured would empty the
 * gate on the day Meta changes a response shape.
 */
export const GATE_SIZE_CEILING = 400_000_000

export interface SizedEntity {
  id: string
  name: string
  audienceLower?: number
  audienceUpper?: number
}

/**
 * Is this interest too wide to narrow with?
 *
 * Reads the UPPER bound, because a narrowing group is an OR and an OR is as
 * large as its largest member. Judging on the lower bound would admit a segment
 * whose realistic size is twice the ceiling.
 */
export function tooWideForGate(e: SizedEntity): boolean {
  const upper = e.audienceUpper ?? e.audienceLower
  if (typeof upper !== 'number' || !Number.isFinite(upper)) return false
  return upper > GATE_SIZE_CEILING
}

/**
 * THE REACH BAND A FINISHED LOCAL AUDIENCE MUST LAND IN.
 *
 * Both ends are evidence, not taste:
 *
 *   ceiling  the hand-built audience that worked measured 728k–857k. The one
 *            that wasted AED 27,873 measured 2.2M+. 1.2M sits above the first
 *            with room to breathe and well below the second.
 *   floor    an audience under this cannot absorb a real daily budget without
 *            showing the same people the same ad until they resent it. Meta
 *            will spend the money either way; frequency is what it buys.
 */
export const REACH_CEILING = 1_200_000
export const REACH_FLOOR = 60_000

/** Walkable — what a measured audience turned out to be. */
export const REACH_VERDICTS = ['good', 'tooWide', 'tooNarrow', 'unknown'] as const
export type ReachVerdict = (typeof REACH_VERDICTS)[number]

/**
 * Judge a finished audience by what Meta says it reaches.
 *
 * `unknown` is a real answer and is never treated as `good`. An audience whose
 * reach could not be measured has not been shown to be narrow — and shipping it
 * as though it had is the whole failure this file answers to.
 */
export function reachVerdict(reach: { lower: number; upper: number } | null): ReachVerdict {
  if (!reach || !(reach.upper > 0)) return 'unknown'
  if (reach.upper > REACH_CEILING) return 'tooWide'
  if (reach.upper < REACH_FLOOR) return 'tooNarrow'
  return 'good'
}

export interface LocalAudienceDef {
  key: LocalAudienceKey
  /** The language the CREATIVE is written in. The only honest axis here. */
  language: LeadLanguage
  ageMin: number
  ageMax: number
}

/**
 * The three.
 *
 * Identical but for the creative language, and that is the point: a difference
 * between them that Meta cannot act on would be theatre. Ages start at 30
 * because every property signal below that is dominated by renters and
 * browsers, and stop at 65 because Meta's own delivery falls off a cliff there.
 */
export const LOCAL_AUDIENCES: readonly LocalAudienceDef[] = [
  { key: 'localArabic',  language: 'ar', ageMin: 30, ageMax: 65 },
  { key: 'localEnglish', language: 'en', ageMin: 30, ageMax: 65 },
  { key: 'localRussian', language: 'ru', ageMin: 30, ageMax: 65 },
]

/** Walkable — why a build refused. Each renders its own sentence. */
export const BUILD_REFUSALS = ['noGate', 'thinGate', 'tooWide', 'tooNarrow', 'noReach', 'metaDown'] as const
export type BuildRefusal = (typeof BUILD_REFUSALS)[number]

/**
 * Choose the gate from what actually resolved.
 *
 * Oversized segments are dropped BEFORE the count, so a gate of three that is
 * really one usable signal plus two market-wide ones is refused as thin rather
 * than shipped as narrow. That ordering is the fix for the original bug: the
 * old code counted members and never asked how big any of them was.
 */
export function chooseGate(resolved: readonly SizedEntity[]): {
  gate: SizedEntity[]
  dropped: SizedEntity[]
  refusal: BuildRefusal | null
} {
  const dropped = resolved.filter(tooWideForGate)
  const usable = resolved.filter((e) => !tooWideForGate(e))
  if (usable.length === 0) return { gate: [], dropped, refusal: 'noGate' }
  if (usable.length < GATE_MIN) return { gate: usable, dropped, refusal: 'thinGate' }
  return { gate: usable.slice(0, GATE_MAX), dropped, refusal: null }
}
