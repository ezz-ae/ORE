/**
 * BUILDING THE THREE LOCAL AUDIENCES, against the live Meta vocabulary.
 *
 * The rules are pure and live in lib/freehold/local-audiences.ts. This file
 * does the four things that need the network, in the order that makes each one
 * able to refuse:
 *
 *   1. RESOLVE every property signal by NAME. Nothing is trusted from memory.
 *   2. DROP the ones Meta's own size band says are too wide to narrow with.
 *   3. ASSEMBLE the spec — UAE residents, the creative's language, the gate as
 *      a narrowing group, the standard exclusions.
 *   4. MEASURE it, and refuse to save one that comes back wider than the
 *      ceiling.
 *
 * Step 4 is the one that matters. Every earlier defence in this product was a
 * rule about how an audience is BUILT, and each was correct and each was
 * bypassed — by a stale saved spec, by a flag nobody read, by an id that meant
 * something else. Measuring the finished thing is the only check that cannot be
 * routed around, because it asks Meta about the audience that will actually
 * run.
 *
 * NOTHING IS SAVED THAT WAS NOT MEASURED. An audience whose reach could not be
 * read is refused rather than stored hopefully: "we could not check" and "it is
 * narrow" are different facts, and this account has already paid AED 27,873 for
 * the difference.
 */
import { searchInterests, getReachEstimate, isMetaConfigured } from '@/lib/meta/client'
import { createAudience, listAudiences, normalizeSpec } from '@/lib/freehold/audiences'
import { standardExclusions, RESIDENCY_COUNTRIES } from '@/lib/freehold/audience-pattern'
import type { CampaignTargeting, TargetingEntity } from '@/lib/meta/types'
import {
  LOCAL_AUDIENCES, PROPERTY_SIGNALS, chooseGate, reachVerdict, isForbiddenSegment,
  type LocalAudienceDef, type SizedEntity, type BuildRefusal, type ReachVerdict,
} from '@/lib/freehold/local-audiences'

/**
 * Resolve the property signals against Meta, once for all three audiences.
 *
 * One search per name rather than one per audience: the three differ only by
 * creative language and the gate is identical, so resolving it three times
 * would spend the rate limit proving the same thing.
 *
 * A name Meta does not recognise is DROPPED and reported. It is never guessed
 * at and never matched loosely — a fuzzy match is how a gate ends up made of
 * something nobody chose.
 */
export async function resolveGateSignals(names: readonly string[] = PROPERTY_SIGNALS): Promise<{
  resolved: SizedEntity[]
  missing: string[]
  /** Names dropped because they target or exclude on origin. Reported, never silent. */
  refused: string[]
}> {
  const resolved: SizedEntity[] = []
  const missing: string[] = []
  const refused: string[] = []
  for (const name of names) {
    try {
      const hits = await searchInterests(name, 10)
      // EXACT, case-insensitive. Meta's search is fuzzy and will happily return
      // "Real estate" for "Real estate investing" — a near miss here is a
      // different audience wearing the name we asked for.
      const hit = hits.find((h) => h.name.trim().toLowerCase() === name.trim().toLowerCase())
      if (!hit?.id) { missing.push(name); continue }
      // THE REFUSAL, ENFORCED WHERE THE SEGMENT ENTERS. An origin-based
      // segment is dropped here even if somebody passed it in deliberately —
      // this is housing, and the check has to sit at the door rather than in
      // whoever is reviewing the list. See FORBIDDEN_SEGMENT_PATTERNS.
      if (isForbiddenSegment(hit.name)) { refused.push(hit.name); continue }
      resolved.push({
        id: String(hit.id),
        name: hit.name,
        audienceLower: hit.audienceLower,
        audienceUpper: hit.audienceUpper,
      })
    } catch {
      missing.push(name)
    }
  }
  return { resolved, missing, refused }
}

/**
 * The spec for one local audience, given a gate that has already been checked.
 *
 * `locationTypes: ['home']` is the whole meaning of "local" — people who LIVE
 * in the UAE, not people passing through it. It is a statement about residence
 * and never about origin; see lib/meta/geo-spec.ts, where that distinction has
 * its own history.
 */
export function specFor(def: LocalAudienceDef, gate: SizedEntity[]): CampaignTargeting {
  const asEntity = (e: SizedEntity): TargetingEntity => ({ id: e.id, name: e.name })
  return normalizeSpec({
    // Read from the residency table rather than a second copy of 'AE' — one
    // country list, so this and the pattern path cannot drift apart.
    countries: [...RESIDENCY_COUNTRIES.resident],
    cityKeys: [],
    locationTypes: ['home'],
    ageMin: def.ageMin,
    ageMax: def.ageMax,
    publisherPlatforms: [],
    // The BASE is the gate too. A base of everybody, narrowed by the gate,
    // reaches the same people — but a base Meta can widen at will is a base
    // that drifts, and Advantage expansion works on the base.
    interests: gate.map(asEntity),
    // …AND the same signals as an explicit narrowing group, so the qualifier
    // survives every path that rebuilds a spec from its parts.
    narrowing: [{ interests: gate.map(asEntity) }],
    exclusions: { interests: standardExclusions() },
    leadLanguages: [def.language],
  }) as CampaignTargeting
}

export interface BuiltAudience {
  key: string
  name: string
  language: string
  gate: string[]
  droppedTooWide: string[]
  reach: { lower: number; upper: number } | null
  verdict: ReachVerdict
  /** Set only when it was actually stored. */
  audienceId: string | null
  refusal: BuildRefusal | null
}

/**
 * Build all three, measure each, and save only what passes.
 *
 * `dryRun` measures and reports without storing — the default, because an
 * audience that appears in somebody's list without them pressing anything is
 * an audience nobody feels responsible for.
 */
export async function buildLocalAudiences(input: {
  createdBy: string
  dryRun?: boolean
  /** Extra signal names the operator chose deliberately — developer names, say. */
  extraSignals?: readonly string[]
  nameFor: (key: string) => string
}): Promise<{ connected: boolean; built: BuiltAudience[]; missing: string[]; refused: string[] }> {
  if (!(await isMetaConfigured())) return { connected: false, built: [], missing: [], refused: [] }

  const names = [...PROPERTY_SIGNALS, ...(input.extraSignals ?? [])]
  const { resolved, missing, refused } = await resolveGateSignals(names)
  const { gate, dropped, refusal: gateRefusal } = chooseGate(resolved)

  const existing = await listAudiences().catch(() => [])
  const built: BuiltAudience[] = []

  for (const def of LOCAL_AUDIENCES) {
    const name = input.nameFor(def.key)
    const base: BuiltAudience = {
      key: def.key,
      name,
      language: def.language,
      gate: gate.map((g) => g.name),
      droppedTooWide: dropped.map((d) => d.name),
      reach: null,
      verdict: 'unknown',
      audienceId: null,
      refusal: gateRefusal,
    }
    // NO GATE, NO AUDIENCE. An audience with no qualifier is not a narrower
    // audience, it is the market — which is the exact thing being fixed.
    if (gateRefusal) { built.push(base); continue }

    const spec = specFor(def, gate)
    const reach = await getReachEstimate(spec).catch(() => null)
    const verdict = reachVerdict(reach)
    base.reach = reach
    base.verdict = verdict

    if (verdict !== 'good') {
      base.refusal = verdict === 'tooWide' ? 'tooWide'
        : verdict === 'tooNarrow' ? 'tooNarrow'
        : 'noReach'
      built.push(base)
      continue
    }
    if (input.dryRun !== false) { built.push(base); continue }

    // Opening the same audience twice would split which one gets attached and
    // make two campaigns look like they ran different targeting.
    const already = existing.find((a) => a.name === name)
    if (already) { base.audienceId = already.id; built.push(base); continue }

    const saved = await createAudience({
      name,
      description: '',
      kind: 'narrow',
      spec,
      createdBy: input.createdBy,
    }).catch(() => null)
    base.audienceId = saved?.id ?? null
    if (!saved) base.refusal = 'metaDown'
    built.push(base)
  }

  return { connected: true, built, missing, refused }
}
