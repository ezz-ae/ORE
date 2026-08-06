/**
 * Meta's targeting_spec, read back into our shape.
 *
 * We write targeting on launch and Meta stores its own version of it. To
 * snapshot what a lead actually arrived through we have to read that version
 * back — not the plan we think we launched, because an ad set can be edited in
 * Ads Manager by a human at any time and the plan would then be a record of
 * our intention rather than of what ran.
 *
 * Meta's shape has two ways of expressing the same thing, and both appear in
 * real accounts:
 *
 *   flat:     { interests: [...], behaviors: [...] }
 *   flexible: { flexible_spec: [ {interests, behaviors}, {interests}, ... ] }
 *
 * The first entry of `flexible_spec` is the base group; the rest are the
 * AND-narrowing layers. An ad set built by us uses the flexible form whenever
 * it has narrowing, and the flat form otherwise — but one edited by hand can
 * come back either way, so both are parsed.
 *
 * Pure — no I/O. Everything it cannot find is absent, never guessed.
 */
import type { CampaignTargeting, TargetingEntity } from './types'

const entities = (v: unknown): TargetingEntity[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
        .map((x) => ({ id: String(x.id ?? ''), name: String(x.name ?? '') }))
        .filter((x) => x.id)
    : []

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String).filter(Boolean) : []

const numbers = (v: unknown): number[] =>
  Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n)) : []

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {}

/**
 * Read a Meta targeting_spec into `CampaignTargeting`.
 *
 * `leadLanguages` is deliberately NOT reconstructed: Meta stores numeric
 * locale ids, and mapping them back to 'ar' would need the live adlocale
 * vocabulary. The raw `locales` are kept instead — the honest record of what
 * ran, rather than a language code we inferred.
 */
export function targetingFromMeta(raw: Record<string, unknown> | undefined | null): CampaignTargeting | null {
  if (!raw || typeof raw !== 'object') return null
  const geo = obj(raw.geo_locations)

  // Base interests/behaviours can live flat or in the first flexible group.
  const flexible = Array.isArray(raw.flexible_spec) ? raw.flexible_spec.map(obj) : []
  const flatInterests = entities(raw.interests)
  const flatBehaviors = entities(raw.behaviors)
  const base = flexible[0] ?? {}
  const interests = flatInterests.length > 0 ? flatInterests : entities(base.interests)
  const behaviors = flatBehaviors.length > 0 ? flatBehaviors : entities(base.behaviors)

  // Everything after the base group is a narrowing layer. When the base came
  // from the FLAT fields, every flexible group is a narrowing layer instead —
  // otherwise the first one would be silently dropped.
  const narrowingGroups = (flatInterests.length > 0 || flatBehaviors.length > 0)
    ? flexible
    : flexible.slice(1)
  const narrowing = narrowingGroups
    .map((g) => ({ interests: entities(g.interests), behaviors: entities(g.behaviors) }))
    .filter((g) => g.interests.length + g.behaviors.length > 0)

  const ex = obj(raw.exclusions)
  const exInterests = entities(ex.interests)
  const exBehaviors = entities(ex.behaviors)

  const cities = Array.isArray(geo.cities)
    ? geo.cities.map((c) => String(obj(c).key ?? '')).filter(Boolean)
    : []

  return {
    countries: strings(geo.countries),
    cityKeys: cities,
    ageMin: Number(raw.age_min) || 0,
    ageMax: Number(raw.age_max) || 0,
    publisherPlatforms: strings(raw.publisher_platforms),
    interests,
    behaviors,
    genders: numbers(raw.genders).filter((n) => n === 1 || n === 2),
    locales: numbers(raw.locales),
    narrowing,
    exclusions: exInterests.length + exBehaviors.length > 0
      ? { interests: exInterests, behaviors: exBehaviors }
      : undefined,
    customAudienceIds: Array.isArray(raw.custom_audiences)
      ? raw.custom_audiences.map((c) => String(obj(c).id ?? '')).filter(Boolean)
      : [],
  }
}
