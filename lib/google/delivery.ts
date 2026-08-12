/**
 * WHAT A GOOGLE CAMPAIGN IS ACTUALLY DOING — and where to fix it.
 *
 * Every Google screen in this product painted its badge from
 * `status === 'ENABLED'`. That is the switch somebody flipped, not what
 * Google is doing with it. The same defect was found and closed on four Meta
 * screens; the guard that catches it there carries the line "Google has no
 * effective_status and must not be made to fake one", and that line is wrong.
 * Google's equivalent is BETTER than Meta's: `campaign.primary_status` says
 * whether it is serving, and `primary_status_reasons` says exactly why not.
 *
 * The gap this leaves open is worse on Search than on Meta, because the most
 * common real state in a live Search account is ENABLED AND LIMITED — running,
 * spending its whole budget by noon, and losing the rest of the day's auctions.
 * A green dot is the one thing that state must not show.
 *
 * REASONS ARE NOT DECORATION. Google names the blocker: no keywords, every ad
 * disapproved, budget-constrained, landing page below quality. Each one has a
 * screen in this product where it is fixed, so the reason carries that route.
 * An error that is only reported is a task handed back to the operator; an
 * error that carries its own fix path is the tool doing the work.
 *
 * Pure — no network, no clock. Runs in `pnpm guards`.
 */

/** Walkable — each renders its own word. */
export const GOOGLE_DELIVERY_STATES = [
  'delivering', 'limited', 'learning', 'inReview',
  'misconfigured', 'notDelivering', 'paused', 'ended', 'unknown',
] as const
export type GoogleDeliveryState = (typeof GOOGLE_DELIVERY_STATES)[number]

/**
 * The blockers worth naming, out of Google's much longer reason enum.
 *
 * Bounded on purpose: a screen that prints every enum value Google can return
 * is a screen nobody reads. These are the ones that actually stop a Search
 * lead-gen campaign in this account, and each has somewhere to go.
 */
export const GOOGLE_BLOCKERS = [
  'budget', 'bidding', 'noKeywords', 'keywordsPaused',
  'noAds', 'adsPaused', 'adsDisapproved', 'adsInReview',
  'landingPage', 'searchVolume',
] as const
export type GoogleBlocker = (typeof GOOGLE_BLOCKERS)[number]

/** Where each blocker is fixed. Routes are real screens in this product —
 *  `{id}` is replaced with the campaign id by the caller. */
export const BLOCKER_FIX: Record<GoogleBlocker, string> = {
  budget:         '/freehold-intelligence/lead-machine/google/campaigns/{id}',
  bidding:        '/freehold-intelligence/lead-machine/google/campaigns/{id}',
  noKeywords:     '/freehold-intelligence/lead-machine/google/keywords',
  keywordsPaused: '/freehold-intelligence/lead-machine/google/keywords',
  noAds:          '/freehold-intelligence/lead-machine/google/ads',
  adsPaused:      '/freehold-intelligence/lead-machine/google/ads',
  adsDisapproved: '/freehold-intelligence/lead-machine/google/ads',
  adsInReview:    '/freehold-intelligence/lead-machine/google/ads',
  landingPage:    '/freehold-intelligence/lead-machine/google/ads',
  searchVolume:   '/freehold-intelligence/lead-machine/google/keywords',
}

/**
 * Google's reason enum → our bounded vocabulary.
 *
 * Matched by SUBSTRING against the enum name rather than by exact value:
 * Google adds reasons between API versions, and a switch over exact strings
 * silently drops the new ones — which reads on screen as "no reason given"
 * for a campaign that is very clearly stopped.
 */
const REASON_PATTERNS: Array<[RegExp, GoogleBlocker]> = [
  [/BUDGET_CONSTRAINED|BUDGET_MISCONFIGURED/, 'budget'],
  [/BIDDING_STRATEGY/, 'bidding'],
  [/NO_KEYWORDS/, 'noKeywords'],
  [/KEYWORDS_PAUSED/, 'keywordsPaused'],
  [/NO_AD_GROUP_ADS|NO_AD_GROUPS/, 'noAds'],
  [/AD_GROUP_ADS_PAUSED|AD_GROUPS_PAUSED/, 'adsPaused'],
  [/DISAPPROVED|LIMITED_BY_POLICY/, 'adsDisapproved'],
  [/UNDER_REVIEW/, 'adsInReview'],
  [/LANDING_PAGE/, 'landingPage'],
  [/SEARCH_VOLUME/, 'searchVolume'],
]

export interface GoogleDelivery {
  state: GoogleDeliveryState
  /** The named blockers, in the order Google gave them. Possibly empty — a
   *  LIMITED campaign with no recognised reason still reads LIMITED. */
  blockers: GoogleBlocker[]
  /** Google's own raw reason strings, kept so nothing is silently lost when a
   *  new enum value appears that REASON_PATTERNS does not know yet. */
  rawReasons: string[]
}

export interface GoogleDeliveryInput {
  /** campaign.status — the switch. Only used when primary_status is absent. */
  status?: string | null
  /** campaign.primary_status — what Google is actually doing. */
  primaryStatus?: string | null
  /** campaign.primary_status_reasons. */
  reasons?: readonly string[] | null
}

/** Google's reason list → our blockers, deduplicated, order preserved. */
export function blockersFrom(reasons: readonly string[] | null | undefined): GoogleBlocker[] {
  const out: GoogleBlocker[] = []
  for (const raw of reasons ?? []) {
    const up = String(raw).toUpperCase()
    for (const [re, blocker] of REASON_PATTERNS) {
      if (re.test(up) && !out.includes(blocker)) out.push(blocker)
    }
  }
  return out
}

/**
 * The one reading of a Google campaign's delivery.
 *
 * A campaign that is LEARNING is reported as learning rather than delivering,
 * because a bid strategy still learning is not yet buying at the price it will
 * settle on — the same distinction the Meta side draws, and the reason a
 * three-day-old Search campaign's CPL must not be judged.
 */
export function googleDeliveryOf(input: GoogleDeliveryInput): GoogleDelivery {
  const rawReasons = (input.reasons ?? []).map(String)
  const blockers = blockersFrom(rawReasons)
  const primary = String(input.primaryStatus ?? '').toUpperCase()

  const state = ((): GoogleDeliveryState => {
    switch (primary) {
      case 'ELIGIBLE':
        // Google reports learning as a REASON on an otherwise eligible
        // campaign, not as a status of its own.
        return rawReasons.some((r) => /LEARNING/i.test(r)) ? 'learning' : 'delivering'
      case 'LIMITED':       return 'limited'
      case 'PENDING':       return 'inReview'
      case 'MISCONFIGURED': return 'misconfigured'
      case 'NOT_ELIGIBLE':  return 'notDelivering'
      case 'PAUSED':        return 'paused'
      case 'ENDED':
      case 'REMOVED':       return 'ended'
      default: break
    }
    // No primary_status — an older API surface, or a locally-drafted campaign.
    // Fall back to the switch, which is all that is known. It is reported as
    // 'unknown' rather than 'delivering' when the switch is on: "the control
    // is set to on" is not the same claim as "it is serving", and this module
    // exists because those two were being printed in the same typeface.
    const s = String(input.status ?? '').toUpperCase()
    if (s === 'PAUSED') return 'paused'
    if (s === 'REMOVED') return 'ended'
    return s === 'ENABLED' ? 'unknown' : 'unknown'
  })()

  return { state, blockers, rawReasons }
}

/** States in which the campaign is supposed to be serving and spending. */
const SERVING: ReadonlySet<GoogleDeliveryState> = new Set<GoogleDeliveryState>([
  'delivering', 'limited', 'learning',
])
export const isServing = (s: GoogleDeliveryState): boolean => SERVING.has(s)

/** The fix route for a blocker on a given campaign. */
export const fixRouteFor = (b: GoogleBlocker, campaignId: string): string =>
  BLOCKER_FIX[b].replace('{id}', encodeURIComponent(campaignId))
