/**
 * WHO COUNTS AS BEING IN DUBAI — second edition, corrected by Meta itself.
 *
 * THE HISTORY THIS MODULE CARRIES, because both halves cost real money:
 *
 * First: this codebase sent no `location_types` at all, so Meta's default —
 * residents PLUS everyone recently seen there — bought tourists for every
 * campaign this product ever launched. The first edition of this module
 * fixed that by pinning `['home']`, residents only.
 *
 * Then Meta answered: `['home']` alone is a DEPRECATED targeting option. A
 * live ad set created with it was flagged with a draft validation error —
 * "uses a deprecated location targeting option" — which did not stop
 * delivery but silently BLOCKED EVERY SUBSEQUENT EDIT to the ad set:
 * budget moves, audience changes, all refused until the location type was
 * republished by hand. The residents-only knob no longer exists on Meta's
 * side; the only supported value for new ad sets is "people living in or
 * recently in this location" — `['home', 'recent']`, together.
 *
 * THE HONEST POSITION NOW: send the one value Meta still accepts, and get
 * residence precision where it actually lives — language targeting and
 * behavioural signals, which this product already uses as its primary
 * levers. A deprecated field is worse than a blunt one: it looks like
 * control and costs the ability to edit.
 *
 * ONE BUILDER, THREE CALLERS, unchanged: ad-set create, ad-set update and
 * the reach estimate all build geo through here, so the estimate describes
 * the audience the ad actually buys.
 */

export type LocationType = 'home' | 'recent'

/**
 * The ONLY location_types Meta accepts on new ad sets: living in, or
 * recently in. Sent explicitly rather than omitted — an absent field means
 * "whatever Meta's default is this year", and this module exists because
 * that answer changed under us once already.
 */
export const STANDARD_LOCATION_TYPES: LocationType[] = ['home', 'recent']

/**
 * Whatever was stored or posted, the wire gets the one supported value.
 * A saved audience from the residents-only era normalises forward instead
 * of poisoning a new ad set with a deprecated option.
 */
export const normalizeLocationTypes = (_v: unknown): LocationType[] => [...STANDARD_LOCATION_TYPES]

/** The `geo_locations` block, built once. */
export function geoLocationsSpec(input: {
  countries: string[]
  cityKeys?: string[]
  locationTypes?: LocationType[] | null
}): Record<string, unknown> {
  const cities = (input.cityKeys ?? []).filter(Boolean)
  return {
    countries: input.countries,
    ...(cities.length > 0 ? { cities: cities.map((key) => ({ key })) } : {}),
    location_types: normalizeLocationTypes(input.locationTypes),
  }
}

/**
 * Reading a LIVE ad set back. Legacy values (home-only, travel_in) can
 * still exist on ad sets created before the deprecation — reported as
 * found, because a reader must not modernise history.
 */
export function liveLocationTypes(geo: unknown): string[] {
  const raw = (geo as { location_types?: unknown } | null | undefined)?.location_types
  if (!Array.isArray(raw) || raw.length === 0) return [...STANDARD_LOCATION_TYPES]
  return raw.map(String)
}

/** True when a live spec carries a value Meta has deprecated — the state
 *  that blocks every edit until the location type is republished. */
export function usesDeprecatedLocationTypes(geo: unknown): boolean {
  const raw = (geo as { location_types?: unknown } | null | undefined)?.location_types
  if (!Array.isArray(raw) || raw.length === 0) return false
  const set = raw.map(String).sort().join(',')
  return set !== 'home,recent'
}
