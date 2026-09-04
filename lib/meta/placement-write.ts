/**
 * CHANGING PLACEMENTS ON A LIVE AD SET WITHOUT DESTROYING EVERYTHING ELSE.
 *
 * This module exists because the obvious way to do it is catastrophic.
 *
 * `updateAdSet` builds a targeting object from a CampaignTargeting shape:
 * geo, ages, publisher_platforms and interests. Meta REPLACES the whole
 * targeting object on write, so anything absent from that shape is deleted —
 * and absent from it are `flexible_spec` (the narrowing groups that carry the
 * property qualifier), `exclusions` (the do-not-target audience), `locales`
 * (the Arabic targeting doing the real narrowing), the position lists, and
 * `targeting_automation` (the Advantage opt-out, whose absence Meta reads as
 * opt-IN).
 *
 * One call would therefore take a carefully bounded property audience and turn
 * it into everybody, with Advantage back on — the precise failure this system
 * has spent weeks chasing. That is fine while nothing calls it with targeting
 * on a live ad set. It stops being fine the moment a person can press Accept.
 *
 * ── SO: READ, MODIFY, WRITE, AND READ BACK ───────────────────────────────
 *
 * The live spec is fetched and used as the base. Only the placement fields are
 * touched. Everything else travels through untouched because it is the same
 * object, not a reconstruction of one.
 *
 * Then it is read back, because a 200 from Meta means "request accepted", not
 * "field changed" — this product has already been caught by that once, with
 * location_types. Nothing is reported as done until Meta says it is done, and
 * a write that did not land is reported as FAILED rather than assumed.
 */
/**
 * PURE. The decisions live here; the two HTTP calls live in client.ts beside
 * the private apiFetch/apiPost, and call straight into these functions. Split
 * that way so the rules — never empty the placements, never lose the
 * qualifier — are testable without a network, which is the only way they get
 * asserted at all.
 */

/** What a placement change may not quietly break. Checked after the write. */
export interface PreservedInvariants {
  flexibleGroups: number
  hasExclusions: boolean
  locales: number
  advantageAudienceOff: boolean
}

export type PlacementWriteOutcome =
  | { ok: true; placements: string[] }
  | { ok: false; reason: PlacementWriteRefusal; detail: string }

/** Why a placement write was refused or judged failed. Walkable. */
export const PLACEMENT_WRITE_REFUSALS = [
  'unreadable',        // could not fetch the live spec — never write blind
  'would_empty',       // the change would leave no placements at all
  'write_rejected',    // Meta refused the request
  'not_applied',       // Meta accepted it and the read-back disagrees
  'collateral_damage', // it applied, but something else moved with it
] as const
export type PlacementWriteRefusal = (typeof PLACEMENT_WRITE_REFUSALS)[number]

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** The invariants as they stand in a targeting spec. */
export function readInvariants(t: Record<string, unknown>): PreservedInvariants {
  const auto = (t.targeting_automation ?? {}) as Record<string, unknown>
  const ex = (t.exclusions ?? {}) as Record<string, unknown>
  return {
    flexibleGroups: arr(t.flexible_spec).length,
    hasExclusions: arr(ex.interests).length + arr(ex.behaviors).length > 0
      || arr(t.excluded_custom_audiences).length > 0,
    locales: arr(t.locales).length,
    // ABSENT IS NOT OFF. Meta reads a missing advantage_audience as opt-in, so
    // a write that drops the field silently switches expansion back on.
    advantageAudienceOff: Number(auto.advantage_audience) === 0,
  }
}

/** Every placement in a spec, as "platform:position" keys. */
export function placementKeys(t: Record<string, unknown>): string[] {
  const out: string[] = []
  for (const p of arr(t.publisher_platforms).map(String)) {
    const positions = p === 'facebook' ? arr(t.facebook_positions)
      : p === 'instagram' ? arr(t.instagram_positions)
      : []
    if (positions.length === 0) { out.push(p); continue }
    for (const pos of positions.map(String)) out.push(`${p}:${pos}`)
  }
  return out
}

/**
 * The placement fields with `drop` removed — nothing else in the spec touched.
 *
 * Returns null when the change would leave no placements. An empty
 * publisher_platforms is not "no placements", it is Meta's own signal to pick
 * for you: the request would enrol the ad set in Advantage+ placements and buy
 * Audience Network, which this product never buys. Removing the last placement
 * is therefore refused rather than obeyed.
 */
export function withoutPlacement(
  t: Record<string, unknown>, drop: string,
): Record<string, unknown> | null {
  const [dropPlatform, dropPosition] = drop.split(':')
  const next: Record<string, unknown> = { ...t }

  if (dropPosition) {
    const field = dropPlatform === 'facebook' ? 'facebook_positions' : 'instagram_positions'
    const kept = arr(t[field]).map(String).filter((p) => p !== dropPosition)
    if (kept.length > 0) {
      next[field] = kept
    } else {
      // The platform's last position went, so the platform goes with it —
      // leaving a platform with no positions named is the other way into
      // Advantage+ placements.
      next[field] = undefined
      delete next[field]
      next.publisher_platforms = arr(t.publisher_platforms).map(String).filter((p) => p !== dropPlatform)
    }
  } else {
    next.publisher_platforms = arr(t.publisher_platforms).map(String).filter((p) => p !== dropPlatform)
    delete next[dropPlatform === 'facebook' ? 'facebook_positions' : 'instagram_positions']
  }

  if (arr(next.publisher_platforms).length === 0) return null
  if (placementKeys(next).length === 0) return null
  return next
}


// ─────────────────────────────────────────────────────────────────────────────
// TWO MORE IN-PLACE EDITS OF A LIVE SPEC
//
// Same rule as withoutPlacement and for the same reason: Meta REPLACES the
// whole targeting object on write, so anything not carried forward is deleted
// — the property qualifier, the exclusions, the language narrowing, and the
// Advantage opt-out whose ABSENCE Meta reads as opt-IN.
//
// So these take the live spec and return it with one thing changed. They never
// build a spec from a CampaignTargeting shape, which is the mistake that would
// switch Advantage back on while purporting to turn it off.
// ─────────────────────────────────────────────────────────────────────────────

/** The same spec with audience expansion explicitly OFF.
 *
 *  Written as an explicit 0, never by deleting the field: Meta reads a missing
 *  `advantage_audience` as opt-in, so removing it is the opposite of the
 *  intended change. */
export function withAdvantageOff(t: Record<string, unknown>): Record<string, unknown> {
  const auto = { ...((t.targeting_automation ?? {}) as Record<string, unknown>) }
  auto.advantage_audience = 0
  return { ...t, targeting_automation: auto }
}

/**
 * The same spec targeting the given radii instead of whatever geography it had.
 *
 * `geo_locations` is REPLACED rather than merged, and that is the point: its
 * entries are ORed, so leaving the old `countries` beside a new circle means
 * "the whole country OR this circle", which is the whole country. An ad set
 * edited that way would look narrowed on screen and buy nationally — the exact
 * failure this account already paid for.
 *
 * Returns null when there are no locations to set. An empty geo_locations is
 * not "everywhere", it is a spec Meta rejects, and refusing here gives a
 * better message than Meta's.
 */
export function withCustomLocations(
  t: Record<string, unknown>,
  locations: ReadonlyArray<Record<string, unknown>>,
  locationTypes: readonly string[],
): Record<string, unknown> | null {
  if (locations.length === 0) return null
  return {
    ...t,
    geo_locations: {
      custom_locations: locations.map((l) => ({ ...l })),
      location_types: [...locationTypes],
    },
  }
}

/** Radius targets on a spec, as read back. Used to confirm a geo write landed
 *  rather than trusting Meta's 200 — this product has been caught by that
 *  before, with location_types. */
export function customLocationCount(t: Record<string, unknown>): number {
  const geo = (t.geo_locations ?? {}) as Record<string, unknown>
  return arr(geo.custom_locations).length
}

/** Does this spec still target a whole country? After a radius edit it must
 *  not: geo_locations ORs its entries. */
export function targetsWholeCountry(t: Record<string, unknown>): boolean {
  const geo = (t.geo_locations ?? {}) as Record<string, unknown>
  return arr(geo.countries).length > 0
}
