/**
 * Audience-overlap estimator — "which ad sets are competing with each other?".
 *
 * Meta's exact auction-overlap tool is not openly available via the Graph API,
 * so we do the honest thing: estimate overlap from the targeting specs we already
 * fetch (geo, age, gender, interests). It is clearly an ESTIMATE — surfaced as
 * such — never presented as Meta's own number. High overlap means two ad sets in
 * the same campaign likely bid against each other and split delivery.
 *
 * Pure + client-safe (no Meta/DB imports) so it runs in the browser from the
 * campaign detail already on the page.
 */

export interface AdSetLite {
  id: string
  name: string
  targeting?: Record<string, unknown> | null
}

export interface OverlapPair {
  aId: string; aName: string
  bId: string; bName: string
  score: number                 // 0–100 estimated similarity
  countries: string[]           // shared countries (codes)
  interests: string[]           // shared interest names
  ageOverlap: boolean
}

type Geo = { countries?: unknown; cities?: unknown }

function countriesOf(t?: Record<string, unknown> | null): string[] {
  const g = t?.geo_locations as Geo | undefined
  return Array.isArray(g?.countries) ? (g!.countries as unknown[]).map(String) : []
}
function cityKeysOf(t?: Record<string, unknown> | null): string[] {
  const g = t?.geo_locations as Geo | undefined
  const cities = Array.isArray(g?.cities) ? (g!.cities as { key?: unknown }[]) : []
  return cities.map((c) => String(c?.key ?? '')).filter(Boolean)
}
function interestsOf(t?: Record<string, unknown> | null): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = []
  const push = (arr: unknown) => {
    if (Array.isArray(arr)) for (const i of arr) {
      const o = i as { id?: unknown; name?: unknown }
      const id = String(o?.id ?? o?.name ?? '')
      if (id) out.push({ id, name: String(o?.name ?? o?.id ?? id) })
    }
  }
  push(t?.interests)
  const flex = t?.flexible_spec
  if (Array.isArray(flex)) for (const g of flex) push((g as { interests?: unknown })?.interests)
  return out
}
function ageOf(t?: Record<string, unknown> | null): [number, number] {
  return [Number(t?.age_min) || 18, Number(t?.age_max) || 65]
}
function gendersOf(t?: Record<string, unknown> | null): number[] {
  return Array.isArray(t?.genders) ? (t!.genders as unknown[]).map(Number) : []
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}
function ageFrac([a1, a2]: [number, number], [b1, b2]: [number, number]): number {
  const lo = Math.max(a1, b1), hi = Math.min(a2, b2)
  const overlap = Math.max(0, hi - lo + 1)
  const span = Math.max(a2, b2) - Math.min(a1, b1) + 1
  return span <= 0 ? 0 : overlap / span
}
function genderSim(a: number[], b: number[]): number {
  if (a.length === 0 && b.length === 0) return 1            // both "all"
  const sa = new Set(a.map(String)), sb = new Set(b.map(String))
  return jaccard(sa, sb)
}

/** All ad-set pairs with a notable estimated overlap, most-overlapping first. */
export function computeOverlaps(adSets: AdSetLite[], floor = 40): OverlapPair[] {
  const sets = adSets.filter((a) => a.targeting)
  const pairs: OverlapPair[] = []
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const A = sets[i], B = sets[j]
      const geoA = new Set([...countriesOf(A.targeting), ...cityKeysOf(A.targeting).map((c) => `c:${c}`)])
      const geoB = new Set([...countriesOf(B.targeting), ...cityKeysOf(B.targeting).map((c) => `c:${c}`)])
      const intA = interestsOf(A.targeting), intB = interestsOf(B.targeting)
      const intSetA = new Set(intA.map((x) => x.id)), intSetB = new Set(intB.map((x) => x.id))
      const geoJ = jaccard(geoA, geoB)
      const intJ = jaccard(intSetA, intSetB)
      const ageF = ageFrac(ageOf(A.targeting), ageOf(B.targeting))
      const genS = genderSim(gendersOf(A.targeting), gendersOf(B.targeting))
      const score = Math.round(100 * (0.35 * geoJ + 0.35 * intJ + 0.2 * ageF + 0.1 * genS))
      if (score < floor) continue
      const sharedCountries = countriesOf(A.targeting).filter((c) => countriesOf(B.targeting).includes(c))
      const sharedInterests = intA.filter((x) => intSetB.has(x.id)).map((x) => x.name).slice(0, 6)
      pairs.push({
        aId: A.id, aName: A.name, bId: B.id, bName: B.name, score,
        countries: sharedCountries, interests: sharedInterests, ageOverlap: ageF > 0.5,
      })
    }
  }
  return pairs.sort((x, y) => y.score - x.score).slice(0, 6)
}
