/**
 * PERSONA AUDIENCES — behaviours that do not exist on Meta, built anyway.
 *
 * "Doctors in the UAE" is not a Meta audience. There is no checkbox for it and
 * there never will be — which is exactly why it belongs in our list. Each
 * persona here is OUR word for a person, and the kitchen translates it into
 * SEVERAL Meta interests and behaviours at once: a persona is a recipe, never
 * a single entity wearing a nicer name.
 *
 * Two promises this module keeps:
 *
 *  · LIVE RESOLUTION, HONEST REFUSAL. The recipes are search terms, resolved
 *    against Meta's live vocabulary at build time — never hardcoded entity ids
 *    that rot silently. A persona whose terms resolve to nothing REFUSES to
 *    build (the same rule that stopped the silent-locale launch): selling an
 *    audience that quietly matched nobody is the one thing this system never
 *    does.
 *
 *  · THE ONE HARD RULE. Every persona audience carries the real-estate MUST
 *    group. A doctor who has never shown Meta a property signal is a doctor,
 *    not a buyer — the persona narrows WHO, the anchor guarantees WHY.
 *
 * The recipe (terms, entities, group shapes) never crosses to the browser —
 * same chokepoint discipline as the pattern kitchen. The client knows the
 * persona's name, its reach and its language. Never its ingredients.
 */
import type { CampaignTargeting, TargetingEntity } from '@/lib/meta/types'
import {
  hardenRealEstate, standardExclusions, speakerLocales,
  RESIDENCY_COUNTRIES, type Residency, type SpeakerBundle,
} from '@/lib/freehold/audience-pattern'
import { searchInterests, searchBehaviors } from '@/lib/meta/client'

// ─────────────────────────────────────────────────────────────────────────────
// THE LIBRARY. Our names. Meta never sees them; the operator never sees past
// them. Each recipe is several search terms per class, because one interest is
// a guess and five agreeing ones are a person.
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonaRecipe {
  id: string
  /** Search terms against Meta's interest vocabulary. */
  interests: string[]
  /** Search terms against Meta's behaviour vocabulary. */
  behaviors?: string[]
  /** Persona-specific age narrowing, intersected inside the 30–65 base. */
  ageMin?: number
  ageMax?: number
}

export const PERSONAS: PersonaRecipe[] = [
  // ── Professions ──
  { id: 'doctors',           interests: ['Medicine', 'Physician', 'Health care', 'Hospital'] },
  { id: 'engineers',         interests: ['Engineering', 'Civil engineering', 'Architecture'] },
  { id: 'lawyers',           interests: ['Law', 'Lawyer', 'Legal advice'] },
  { id: 'techPros',          interests: ['Information technology', 'Software development', 'Computer engineering'] },
  { id: 'aviationPeople',    interests: ['Aviation', 'Airline', 'Aircraft pilot'] },
  { id: 'educators',         interests: ['Education', 'Teacher', 'Higher education'] },
  { id: 'actorsCreatives',   interests: ['Actor', 'Film industry', 'Television'] },
  { id: 'governmentSector',  interests: ['Government', 'Public administration', 'Civil service'] },
  { id: 'policeSecurity',    interests: ['Dubai Police', 'Police', 'Law enforcement'] },
  // Government + energy + police as ONE layer, because the ask is "works in
  // any of these", and stacking them as separate personas would demand a
  // person interested in ALL of them — an intersection of nearly nobody.
  // Meta sells INTEREST in these employers, not employment at them (employer
  // targeting was removed platform-wide in 2022); stacked with a seniority
  // persona and the real-estate MUST, interest is a usable proxy — alone it
  // would mostly find fans of Dubai Police's supercars.
  { id: 'publicSectorEnergy', interests: ['Government', 'Public administration', 'Civil service', 'ADNOC', 'Petroleum industry', 'Oil and gas', 'Energy industry', 'Dubai Police'] },
  // ── Seniority and money ──
  { id: 'ceosExecutives',    interests: ['Chief executive officer', 'Management', 'Leadership', 'Executive director'] },
  { id: 'topProfessionals',  interests: ['LinkedIn', 'Professional development', 'Business networking'] },
  { id: 'businessOwners',    interests: ['Entrepreneurship', 'Small business', 'Business'], behaviors: ['Small business owners'] },
  { id: 'financePros',       interests: ['Banking', 'Investment banking', 'Financial services'] },
  { id: 'traders',           interests: ['Financial market', 'Stock trader', 'Foreign exchange market'] },
  { id: 'luxuryLife',        interests: ['Luxury goods', 'Luxury travel'], behaviors: ['Frequent international travel'] },
  { id: 'propertyOwners',    interests: ['Property management', 'Landlord', 'Home improvement'], behaviors: ['Homeowners'] },
  // ── Communities (reached in their language, wherever the market selector says) ──
  { id: 'egyptianCommunity', interests: ['Egypt', 'Cairo', 'Egyptian cuisine'] },
  { id: 'lebaneseCommunity', interests: ['Lebanon', 'Beirut', 'Lebanese cuisine'] },
  // ── Intent ──
  { id: 'goldenVisaSeekers', interests: ['Golden Visa', 'Permanent residency', 'Immigration'] },
  { id: 'uaeVisitors',       interests: ['Dubai', 'Visit Dubai', 'United Arab Emirates'], behaviors: ['Frequent international travel'] },
]

/** How many personas can stack into one audience. Each selected persona is
 *  its own AND layer — three layers is a sharp knife, five is an empty room. */
export const MAX_STACK = 3

export const personaIds = (): string[] => PERSONAS.map((p) => p.id)
export const getPersona = (id: string): PersonaRecipe | undefined => PERSONAS.find((p) => p.id === id)

/** A persona that cannot be expressed in Meta's current vocabulary. Callers
 *  turn this into a refusal the operator can read — never a silent shrink. */
export class PersonaUnresolvableError extends Error {}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

/** How many entities a persona may carry. Enough to be a recipe, few enough
 *  that every ingredient still pulls weight. */
const MAX_ENTITIES = 12
/** A term match is accepted when either string contains the other — Meta's
 *  vocabulary names rarely equal our terms exactly ("Physicians" vs
 *  "Physician") and an unrelated top hit must not slip in as a match. */
const related = (a: string, b: string) => {
  const x = a.toLowerCase(), y = b.toLowerCase()
  return x.includes(y) || y.includes(x)
}

export interface ResolvedPersona {
  interests: TargetingEntity[]
  behaviors: TargetingEntity[]
  /** Which terms found nothing — reported, because a recipe quietly running on
   *  half its ingredients is how audiences drift from their names. */
  unresolvedTerms: string[]
}

/** Resolve a recipe against Meta's live vocabulary. Throws
 *  PersonaUnresolvableError when NOTHING resolves — a persona is its
 *  ingredients, and zero ingredients is not an audience. */
export async function resolvePersona(recipe: PersonaRecipe): Promise<ResolvedPersona> {
  const interests = new Map<string, TargetingEntity>()
  const behaviors = new Map<string, TargetingEntity>()
  const unresolved: string[] = []

  for (const term of recipe.interests) {
    try {
      const hits = await searchInterests(term, 6)
      const matched = hits.filter((h) => related(h.name, term)).slice(0, 2)
      if (matched.length === 0) { unresolved.push(term); continue }
      for (const m of matched) interests.set(m.id, { id: m.id, name: m.name })
    } catch { unresolved.push(term) }
  }
  for (const term of recipe.behaviors ?? []) {
    try {
      const hits = await searchBehaviors(term, 'behaviors', 6)
      const matched = hits.filter((h) => related(h.name, term)).slice(0, 2)
      if (matched.length === 0) { unresolved.push(term); continue }
      for (const m of matched) behaviors.set(m.id, { id: m.id, name: m.name })
    } catch { unresolved.push(term) }
  }

  const i = [...interests.values()].slice(0, MAX_ENTITIES)
  const b = [...behaviors.values()].slice(0, Math.max(0, MAX_ENTITIES - i.length))
  if (i.length + b.length === 0) {
    throw new PersonaUnresolvableError(
      `Meta's vocabulary cannot express this persona right now — none of its ingredients resolved. Refusing to build an audience that matches nobody.`,
    )
  }
  return { interests: i, behaviors: b, unresolvedTerms: unresolved }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE PLAN — pure, testable, and where the hard rule lives
// ─────────────────────────────────────────────────────────────────────────────

export interface PersonaPlanInput {
  /** One resolved group per SELECTED persona — stacking is intersection:
   *  "doctors" + "golden-visa seekers" is doctors WHO seek the visa, which is
   *  the whole point of letting the operator combine our words. */
  stack: Array<Pick<ResolvedPersona, 'interests' | 'behaviors'>>
  speaker: SpeakerBundle
  residency: Residency
  ageMin?: number
  ageMax?: number
  /** Meta gender codes: 2 = women, 1 = men. Omitted/empty = everyone. A real
   *  Meta field — unlike "local", which is served honestly by language +
   *  residency and never by anything else. */
  genders?: number[]
}

/**
 * Compose the targeting: one language, one market, each stacked persona its
 * own AND group, and the real-estate MUST on top. Pure — resolution happened
 * before, refusal happened before; this is arithmetic.
 */
export function planPersona(input: PersonaPlanInput): CampaignTargeting {
  // 30–65 is the market rule learned the expensive way — under 30 barely buys
  // here (stated on the ready-buyers card, enforced in this kitchen). Persona
  // ages can narrow inside the band, never widen it.
  const ageMin = Math.max(30, input.ageMin ?? 30)
  const ageMax = Math.min(65, input.ageMax ?? 65)
  const groups = input.stack
    .slice(0, MAX_STACK)
    .map((r) => ({ interests: r.interests, behaviors: r.behaviors }))
    .filter((g) => g.interests.length + g.behaviors.length > 0)
  return hardenRealEstate({
    countries: RESIDENCY_COUNTRIES[input.residency] ?? ['AE'],
    cityKeys: [],
    ageMin,
    ageMax: ageMax > ageMin ? ageMax : Math.min(65, ageMin + 10),
    // Facebook and Instagram ONLY, stated explicitly: Audience Network and
    // Messenger are overflow inventory whose cheap impressions do not convert,
    // and an omitted/empty platform list is not "no preference" — Meta reads
    // it as permission to place anywhere (see ALLOWED_PLATFORMS in
    // lib/meta/no-advantage.ts, where the doctrine lives).
    publisherPlatforms: ['facebook', 'instagram'],
    interests: [],
    behaviors: [],
    ...(input.genders && input.genders.length > 0 ? { genders: input.genders.filter((g) => g === 1 || g === 2) } : {}),
    narrowing: groups,
    exclusions: { interests: standardExclusions(), behaviors: [] },
    customAudienceIds: [],
    leadLanguages: speakerLocales([input.speaker]),
  })
}
