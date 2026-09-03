/**
 * WHERE IN THE UAE, WHEN META WILL NOT TAKE A CITY.
 *
 * "the only way is you fix a real targeting on the api for alain/abudhabi for
 *  this event ad, and fix the other all uae target."
 *
 * The obvious move — put "Al Ain" in `geo_locations.cities` — cannot work.
 * Meta refuses city-level targeting in the UAE (error subcode 1487479, "City
 * Targeting Not Supported"), and lib/meta/client.ts already carries the
 * self-heal for it: on that error it DELETES the cities and retries at
 * country level. Which is honest, and means every "Al Ain" ad set this
 * product could build would silently have become an all-UAE ad set.
 *
 * That is very likely what happened to the Al Ain event ad sets in the
 * account: AED 2,541 spent for 6 leads, on an audience that was never
 * actually Al Ain.
 *
 * ── SO: CUSTOM LOCATIONS, WHICH IS COORDINATES AND A RADIUS ──────────────
 *
 * `geo_locations.custom_locations` takes a latitude, a longitude and a
 * radius. Meta accepts it in the UAE, and — the reason it is the right answer
 * here rather than a workaround — IT NEEDS NO META VOCABULARY AT ALL. A city
 * key is an id in Meta's graph that we would have to look up and could get
 * wrong; a coordinate is public geography. Nothing here is invented, nothing
 * here can go stale on Meta's schedule, and no id is guessed.
 *
 * ── RADIUS IS A JUDGMENT, SO EACH ONE STATES ITS REASON ──────────────────
 *
 * Too small and an event ad misses the suburbs the attendees drive in from;
 * too large and an "Al Ain event" ad set is buying Dubai. The numbers below
 * are the metro plus its commuting edge, and nothing beyond it.
 *
 * Pure — no I/O. Runs in `pnpm guards`.
 */

/** Meta's accepted radius range for a custom location, in kilometres. Sending
 *  outside it is rejected at ad-set create, which is a launch failure rather
 *  than a bad audience — so it is clamped and the clamp is asserted. */
export const MIN_RADIUS_KM = 1
export const MAX_RADIUS_KM = 80

export interface UaePlace {
  key: string
  /** What a person calls it. Shown on screen; never sent to Meta. */
  label: string
  latitude: number
  longitude: number
  radiusKm: number
}

/**
 * Walkable — the places this product can target inside the UAE.
 *
 * Coordinates are city centres. Radii cover the built-up area and the ring
 * people commute from, which is the population an event in that city can
 * actually draw.
 */
export const UAE_PLACES: readonly UaePlace[] = [
  // Al Ain sprawls — the city, Al Jimi, Al Muwaiji and the outlying districts
  // sit well apart, and an event downtown draws from all of them.
  { key: 'al_ain', label: 'Al Ain', latitude: 24.2075, longitude: 55.7447, radiusKm: 35 },
  // Abu Dhabi island plus the mainland suburbs (Khalifa City, Mohammed bin
  // Zayed City, Yas) where most of the buying population actually lives.
  { key: 'abu_dhabi', label: 'Abu Dhabi', latitude: 24.4539, longitude: 54.3773, radiusKm: 45 },
  { key: 'dubai', label: 'Dubai', latitude: 25.2048, longitude: 55.2708, radiusKm: 40 },
  { key: 'sharjah', label: 'Sharjah', latitude: 25.3463, longitude: 55.4209, radiusKm: 25 },
  { key: 'ajman', label: 'Ajman', latitude: 25.4052, longitude: 55.5136, radiusKm: 20 },
  { key: 'ras_al_khaimah', label: 'Ras Al Khaimah', latitude: 25.7895, longitude: 55.9432, radiusKm: 30 },
  { key: 'fujairah', label: 'Fujairah', latitude: 25.1288, longitude: 56.3265, radiusKm: 25 },
  { key: 'umm_al_quwain', label: 'Umm Al Quwain', latitude: 25.5647, longitude: 55.5552, radiusKm: 20 },
] as const

export type UaePlaceKey = (typeof UAE_PLACES)[number]['key']

/** The event catchment: the city holding the event and the emirate capital
 *  its residents treat as their second city. Named rather than assembled at
 *  the call site so two screens cannot mean different things by it. */
export const AL_AIN_CATCHMENT: readonly string[] = ['al_ain', 'abu_dhabi']

export const placeByKey = (key: string): UaePlace | null =>
  UAE_PLACES.find((p) => p.key === key) ?? null

/** The Meta `custom_locations` entries for these places.
 *
 *  Unknown keys are DROPPED rather than guessed at — a typo must not quietly
 *  become "the whole country", which is exactly the failure the city path had.
 *  An empty result is a real answer and the caller must treat it as one. */
export function customLocationsFor(keys: readonly string[]): Array<{
  latitude: number
  longitude: number
  radius: number
  distance_unit: 'kilometer'
}> {
  const out: Array<{ latitude: number; longitude: number; radius: number; distance_unit: 'kilometer' }> = []
  for (const key of keys) {
    const p = placeByKey(key)
    if (!p) continue
    out.push({
      latitude: p.latitude,
      longitude: p.longitude,
      radius: Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, p.radiusKm)),
      distance_unit: 'kilometer',
    })
  }
  return out
}

/**
 * Does this set of places mean "the whole UAE"?
 *
 * Eight radii covering every emirate is the country with extra steps and a
 * worse reach estimate. When somebody asks for all of them, the honest spec is
 * `countries: ['AE']` — and a caller that cannot tell the difference will
 * happily ship the expensive version.
 */
export const isWholeCountry = (keys: readonly string[]): boolean =>
  UAE_PLACES.every((p) => keys.includes(p.key))
