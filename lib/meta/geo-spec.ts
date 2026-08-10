/**
 * WHO COUNTS AS BEING IN DUBAI.
 *
 * `geo_locations: { countries: ['AE'] }` does not mean "people in the UAE". It
 * means whatever Meta's default `location_types` says it means, and that
 * default is `['home', 'recent']` — everyone who LIVES there plus everyone
 * Meta has recently SEEN there. A tourist on a five-day holiday, a business
 * visitor, a phone that connected from the airport: all of them are inside the
 * audience, all of them can be shown a property ad, and all of them can fill in
 * a form.
 *
 * This codebase never sent `location_types` at all, from any of the three
 * places that build a targeting spec. So every campaign this product has ever
 * launched has been buying visitors alongside residents, and nothing on any
 * screen said so.
 *
 * WHAT THIS IS. A statement about WHERE SOMEONE LIVES — the same kind of fact
 * as the country targeting it qualifies, and the standard setting for a
 * property campaign, because a mortgage and a tenancy are things residents do.
 *
 * WHAT THIS IS NOT, and the line does not move: it is not a nationality, not an
 * origin, and not a proxy for either. A resident is a resident. Everyone who
 * lives in the UAE is inside `home` — that is the entire meaning of the word.
 * If the intent were ever to exclude people by where they are from, this
 * setting would not achieve it and would not be the tool for it.
 *
 * ONE BUILDER, THREE CALLERS. The geo block was being constructed separately
 * in the ad-set create, the ad-set update, and the reach estimate — so a reach
 * number described a different audience than the ad actually bought. They all
 * come through here now.
 */

/**
 * Meta's location types.
 *  - `home`      people who live there
 *  - `recent`    people recently seen there (visitors, travellers)
 *  - `travel_in` people whose home is elsewhere and are there now
 */
export type LocationType = 'home' | 'recent' | 'travel_in'

export const ALL_LOCATION_TYPES: LocationType[] = ['home', 'recent', 'travel_in']

/**
 * The default for every campaign this product launches: people who LIVE in the
 * targeted place.
 *
 * Explicit rather than assumed. Sending nothing hands the decision to Meta,
 * and Meta's answer includes visitors — which is the wrong audience for a
 * purchase that takes months and requires being here to make it.
 */
export const RESIDENTS_ONLY: LocationType[] = ['home']

export const normalizeLocationTypes = (v: unknown): LocationType[] => {
  const list = (Array.isArray(v) ? v : [])
    .map((x) => String(x))
    .filter((x): x is LocationType => (ALL_LOCATION_TYPES as string[]).includes(x))
  // An empty or unrecognised value is not "all locations" — it is "nobody said",
  // and the safe reading of nobody-said is the residents this product sells to.
  return list.length > 0 ? [...new Set(list)] : RESIDENTS_ONLY
}

/** True when the spec buys people who do not live in the targeted place. */
export const includesVisitors = (types: LocationType[]): boolean =>
  types.some((t) => t !== 'home')

/**
 * The `geo_locations` block, built once.
 *
 * `location_types` is always present. An absent field is not a neutral choice
 * here — it is Meta's choice, and Meta's choice includes tourists.
 */
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

/** What a LIVE ad set's spec says, read back from Meta. Absent means Meta's
 *  own default was in force, which is home + recent — visitors included. */
export function liveLocationTypes(geo: unknown): LocationType[] {
  const raw = (geo as { location_types?: unknown } | null | undefined)?.location_types
  if (!Array.isArray(raw) || raw.length === 0) return ['home', 'recent']
  return raw.map(String).filter((x): x is LocationType => (ALL_LOCATION_TYPES as string[]).includes(x))
}
