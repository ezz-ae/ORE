/**
 * NO ADVANTAGE. Anywhere. At any level.
 *
 * Meta's "Advantage" family hands delivery decisions back to Meta, and every
 * one of them is opt-OUT rather than opt-in — several are the default when a
 * field is simply omitted. That is what makes this a module instead of a
 * convention: the failure mode is silence. Leave `publisher_platforms` off and
 * you have enrolled in Advantage+ placements; leave `advantage_audience`
 * unset on a broad ad set and Meta expands past your targeting; leave
 * `degrees_of_freedom_spec` off and the account's default creative
 * enhancements reword your headline and recolour your image.
 *
 * The reason to refuse all of it is not that Meta's algorithm is bad. It is
 * that an expanded audience is no longer the audience you tested. Advantage
 * audience expansion delivers outside your definition whenever it predicts a
 * cheaper result, so the ad set that "won" was measured on a population you
 * never chose and cannot reproduce. Advantage+ placements silently bundle in
 * overflow inventory, which shows up as cheap impressions that do not convert.
 * Advantage+ creative edits the ad after you approved it. Each one severs the
 * link between what you decided and what ran — and the whole point of this
 * system is that a verdict traces back to a decision.
 *
 * Everything Meta needs in order NOT to do this lives here, as explicit
 * payload fragments plus a detector that reads a finished request body and
 * names anything that slipped through. One place to read, one place to audit.
 *
 * Pure — no I/O.
 */

/**
 * The platforms we will buy on. Explicit by definition: an EMPTY
 * publisher_platforms list is exactly how a request enrols in Advantage+
 * placements, so "no platforms specified" can never be allowed to mean
 * "whatever Meta likes".
 *
 * Audience Network is deliberately absent. It is off-platform third-party
 * inventory, it is where overflow impressions land, and it is the single
 * largest source of cheap non-converting delivery in a Dubai lead account.
 * Anyone who wants it can name it; nothing will opt them in.
 */
export const ALLOWED_PLATFORMS = ['facebook', 'instagram'] as const

/** Placement positions we run when a platform is included. Named in full so
 *  the request is a complete instruction and never a partial one Meta gets to
 *  finish. */
// THE FOUR SURFACES THIS PRODUCT BUYS, by owner decision: Instagram Feed
// first, then Stories and Reels, then Facebook Feed. Nothing else — no
// marketplace, no search, no explore, no Facebook stories. "Automatic"
// placement mode means THIS set, never Meta's everything.
export const FACEBOOK_POSITIONS = ['feed', 'facebook_reels'] as const
export const INSTAGRAM_POSITIONS = ['stream', 'story', 'reels'] as const

/**
 * `targeting_automation.advantage_audience` — 0 means "deliver to the audience
 * I defined, and only that audience". Always 0. There is no case in this
 * system where expansion is correct, because every ad set here exists to
 * measure a specific audience.
 */
export const ADVANTAGE_AUDIENCE_OFF = { advantage_audience: 0 } as const

/**
 * The individual Advantage+ creative features, opted out one by one.
 *
 * Meta REMOVED the umbrella. `standard_enhancements` — even nested under
 * `creative_features_spec`, which was the accepted shape until now — is
 * rejected outright:
 *
 *   "Including standard enhancements field in creative has been deprecated.
 *    Please choose to set individual features instead." (subcode 3858504)
 *
 * So the switch that turned all of this off in one line no longer exists, and
 * every feature has to be named. That is worse for us in exactly the way that
 * matters: a feature Meta adds later is ON by default and absent from this
 * list, so this is a list to revisit rather than a fence that holds forever.
 *
 * Omitting the block does NOT mean "off" — it means the ad account's default
 * applies, and on most accounts that default rewords the headline, recolours
 * the image and adds music to a creative someone already approved. That is
 * precisely the silence this module exists to break.
 */
export const CREATIVE_FEATURES = [
  'image_touchups',
  'video_auto_crop',
  'image_brightness_and_contrast',
  'enhance_cta',
  'text_optimizations',
  'image_templates',
  'adapt_to_placement',
  'media_type_automation',
  'product_extensions',
  'description_automation',
  'add_text_overlay',
  'site_extensions',
  'inline_comment',
] as const

export const CREATIVE_ENHANCEMENTS_OFF = {
  creative_features_spec: Object.fromEntries(
    CREATIVE_FEATURES.map((f) => [f, { enroll_status: 'OPT_OUT' }]),
  ) as Record<(typeof CREATIVE_FEATURES)[number], { enroll_status: 'OPT_OUT' }>,
} as const

/**
 * The complete placement spec for a set of platforms.
 *
 * Never returns `{}`. An unknown or empty platform list falls back to the
 * allowed set rather than to Meta's discretion — the failure mode of a typo
 * must be "ran on Facebook and Instagram", not "ran everywhere including
 * Audience Network".
 */
export function placementSpecFor(platforms: readonly string[]): Record<string, unknown> {
  const allowed = new Set<string>(ALLOWED_PLATFORMS)
  const picked = platforms.filter((p) => allowed.has(p))
  const final = picked.length > 0 ? picked : [...ALLOWED_PLATFORMS]
  return {
    publisher_platforms: final,
    ...(final.includes('facebook') ? { facebook_positions: [...FACEBOOK_POSITIONS] } : {}),
    ...(final.includes('instagram') ? { instagram_positions: [...INSTAGRAM_POSITIONS] } : {}),
  }
}

export interface AdvantageViolation {
  /** Dotted path into the payload, e.g. 'targeting.publisher_platforms'. */
  path: string
  /** What is wrong, in the words someone debugging a live launch needs. */
  problem: string
}

const has = (o: unknown, k: string): o is Record<string, unknown> =>
  !!o && typeof o === 'object' && k in (o as Record<string, unknown>)
const get = (o: unknown, k: string): unknown =>
  o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined

/**
 * Read a finished ad-set request body and name every way Meta would be handed
 * a decision.
 *
 * Checks presence, not just value — an ABSENT field is the enrolment, so
 * "advantage_audience is missing" is a violation exactly like
 * "advantage_audience is 1". This is the check that makes the doctrine
 * survive someone later adding a field and forgetting the opt-out.
 */
export function findAdvantageInAdSet(body: Record<string, unknown>): AdvantageViolation[] {
  const out: AdvantageViolation[] = []
  const targeting = get(body, 'targeting')

  if (!targeting || typeof targeting !== 'object') {
    return [{ path: 'targeting', problem: 'no targeting at all — Meta would choose the entire audience' }]
  }

  // 1 — Placements. Absent or empty publisher_platforms IS Advantage+ placements.
  const platforms = get(targeting, 'publisher_platforms')
  if (!Array.isArray(platforms) || platforms.length === 0) {
    out.push({
      path: 'targeting.publisher_platforms',
      problem: 'absent or empty — that is Advantage+ placements, which includes Audience Network',
    })
  } else {
    const stray = platforms.filter((p) => !(ALLOWED_PLATFORMS as readonly string[]).includes(String(p)))
    if (stray.length > 0) {
      out.push({
        path: 'targeting.publisher_platforms',
        problem: `off-platform inventory requested: ${stray.join(', ')}`,
      })
    }
    // A platform named without its positions lets Meta pick the surfaces.
    if (platforms.includes('facebook') && !Array.isArray(get(targeting, 'facebook_positions'))) {
      out.push({ path: 'targeting.facebook_positions', problem: 'facebook included without an explicit position list' })
    }
    if (platforms.includes('instagram') && !Array.isArray(get(targeting, 'instagram_positions'))) {
      out.push({ path: 'targeting.instagram_positions', problem: 'instagram included without an explicit position list' })
    }
  }

  // 2 — Audience expansion. Absent is the same as enrolled.
  const automation = get(targeting, 'targeting_automation')
  if (!has(targeting, 'targeting_automation') || !has(automation, 'advantage_audience')) {
    out.push({
      path: 'targeting.targeting_automation.advantage_audience',
      problem: 'not set — Meta expands past the defined audience by default',
    })
  } else if (Number(get(automation, 'advantage_audience')) !== 0) {
    out.push({
      path: 'targeting.targeting_automation.advantage_audience',
      problem: 'enabled — delivery would go outside the audience being measured',
    })
  }

  // 3 — Any other targeting_automation key Meta adds later. Unknown automation
  // is refused rather than assumed harmless; this is the check that catches
  // the Advantage feature that does not exist yet.
  if (automation && typeof automation === 'object') {
    for (const [key, value] of Object.entries(automation as Record<string, unknown>)) {
      if (key === 'advantage_audience') continue
      if (value !== 0 && value !== false) {
        out.push({ path: `targeting.targeting_automation.${key}`, problem: 'unrecognised targeting automation is enabled' })
      }
    }
  }

  // 4 — Campaign-level budget sharing (Advantage campaign budget / CBO) if it
  // ever rides along on an ad-set payload.
  if (get(body, 'is_adset_budget_sharing_enabled') === true) {
    out.push({ path: 'is_adset_budget_sharing_enabled', problem: 'Advantage campaign budget — Meta reallocates spend between ad sets' })
  }

  return out
}

/** The same read for a creative payload: Advantage+ creative must be opted out
 *  explicitly, because omitting the block means "use the account default". */
export function findAdvantageInCreative(body: Record<string, unknown>): AdvantageViolation[] {
  const dof = get(body, 'degrees_of_freedom_spec')
  const features = get(dof, 'creative_features_spec')

  // The umbrella is gone, so EVERY feature is checked on its own. A single
  // one left un-opted-out is a real hole: that is the feature that rewrites
  // the headline someone approved.
  const missed = CREATIVE_FEATURES.filter(
    (f) => get(get(features, f), 'enroll_status') !== 'OPT_OUT',
  )
  // Sending the deprecated umbrella is now itself a defect — Meta rejects the
  // whole creative on it, so an ad carrying it cannot launch at all.
  const deprecated = get(features, 'standard_enhancements') !== undefined

  const out: AdvantageViolation[] = []
  if (deprecated) {
    out.push({
      path: 'degrees_of_freedom_spec.creative_features_spec.standard_enhancements',
      problem: 'Meta deprecated this field and rejects any creative carrying it (subcode 3858504) — the individual features must be named instead',
    })
  }
  for (const f of missed) {
    out.push({
      path: `degrees_of_freedom_spec.creative_features_spec.${f}.enroll_status`,
      problem: 'not opted out — the account default applies, and it alters the approved creative',
    })
  }
  return out
}

/** Campaign-level read: budget must stay on the ad sets. */
export function findAdvantageInCampaign(body: Record<string, unknown>): AdvantageViolation[] {
  if (get(body, 'is_adset_budget_sharing_enabled') !== false) {
    return [{
      path: 'is_adset_budget_sharing_enabled',
      problem: 'must be explicitly false — otherwise Meta may move budget between ad sets and no ad set means what it says',
    }]
  }
  return []
}

/** Every violation as one readable line, for a launch log or an error. */
export const describeViolations = (v: AdvantageViolation[]): string =>
  v.map((x) => `${x.path}: ${x.problem}`).join('; ')
