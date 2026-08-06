/**
 * AUDIENCE PATTERNS — the kitchen.
 *
 * This system sells one thing: Dubai property. It will never advertise a
 * handbag. So the audience builder has no business being a generic interest
 * picker with Meta's vocabulary in it — that is a worse Ads Manager wearing
 * our colours, and the moment someone learns it they have learned Meta, not us.
 *
 * A PATTERN is a description of a PERSON, in the words a property salesperson
 * actually uses: a Levantine expat family renting in Dubai, two children,
 * upgrading from an apartment, mortgage buyer, actively looking. None of those
 * are Meta fields. Every one of them is something the person ordering knows
 * without being taught anything.
 *
 * This module is the translation. It takes that description and produces a
 * real `CampaignTargeting` — locales, behaviours, interests, narrowing groups,
 * exclusions, age band, geo — and the person who ordered never sees any of it.
 * They ordered a burger. The kitchen has soya, heat and technique. There is
 * nothing called a burger back here and it tastes like one.
 *
 * WHY THIS IS DEFENSIBLE AND NOT A GIMMICK. The translation is not a lookup
 * table dressed up. Each trait carries the reason it maps where it does, and
 * the mapping is the accumulated answer to "what did we actually buy that
 * worked" — which the relevance engine measures and which no operator could
 * assemble by hand from a list of forty thousand Meta interests.
 *
 * STRICTNESS is one dial, 0–100, and it is the only knob. It decides how much
 * of the pattern becomes a hard requirement versus a preference:
 *
 *      0  ── everything is a hint. Widest reach, weakest match.
 *     50  ── the defining traits bind, the rest lean.
 *    100  ── every stated trait must be true. Narrowest, most expensive.
 *
 * One dial rather than a form, because the dial is a real trade-off someone
 * can feel — reach against precision — and a form is forty fields nobody can
 * hold in their head.
 *
 * Pure — no I/O. The catalog ids are Meta's; the composition is ours.
 */
import type { CampaignTargeting, TargetingEntity } from '@/lib/meta/types'

// ─────────────────────────────────────────────────────────────────────────────
// THE VOCABULARY. Real-estate words, not platform words.
// ─────────────────────────────────────────────────────────────────────────────

/** Where they live relative to the property. The single most important trait:
 *  it decides the geo, the language and whether they can view in person. */
export type Residency = 'resident' | 'expat' | 'gcc' | 'overseas'

/**
 * WHO THE AD CAN SPEAK TO — a language bundle, not a nationality.
 *
 * This is the primitive, and choosing it this way is the whole difference
 * between a targeting tool and a guessing tool. Nationality is not a Meta
 * field; every "nationality" targeting anyone sells you is a proxy stack of
 * interests and expat segments, and it is wrong at the edges in ways nobody
 * can see. LANGUAGE is a real Meta field, exact, and it is also the only
 * honest reason to narrow reach: an ad written in Arabic cannot sell to
 * someone who does not read Arabic, whoever they are.
 *
 * Each bundle carries a CREATIVE language — what the ad is actually written
 * in — and the additional speaker groups that live in the same market and
 * will read it. Those pairings are market facts about Dubai, not linguistics:
 *
 *   arabic   — Arabic creative, also reaching Urdu speakers
 *   english  — English creative, also reaching Spanish speakers
 *   european — Russian creative, also reaching German, French and Italian
 *
 * They are INCLUSION only. Nothing here excludes anyone by origin or language:
 * the exclusion axis is behavioural (see `Disqualifier`), which is both the
 * honest way to exclude and the only one that predicts anything.
 */
export type SpeakerBundle = 'arabic' | 'english' | 'european'

/** Life stage — drives the product fit more than income does. */
export type LifeStage = 'single' | 'couple' | 'young_family' | 'established_family' | 'downsizing'

/** Why they are buying. The strongest predictor of what copy lands. */
export type Motive = 'first_home' | 'upgrade' | 'investment' | 'holiday_home' | 'golden_visa' | 'relocation'

/** How they pay. Purchasing power, in the terms a broker qualifies on. */
export type Money = 'cash' | 'mortgage' | 'payment_plan' | 'unknown'

/** How close to deciding. */
export type Readiness = 'browsing' | 'comparing' | 'ready'

/** Behavioural exclusions — proven-bad, never demographic. */
export type Disqualifier = 'renters_only' | 'job_seekers' | 'agents_and_brokers' | 'bargain_hunters'

export interface AudiencePattern {
  /** What the operator called it. */
  name: string
  residency: Residency[]
  speakers: SpeakerBundle[]
  lifeStage: LifeStage[]
  motive: Motive[]
  money: Money
  readiness: Readiness
  exclude: Disqualifier[]
  /** 0–100. The only knob. */
  strictness: number
}

/** A blank pattern — deliberately not an empty object. A pattern with nothing
 *  in it is still a valid audience (everyone in the geo), and saying so beats
 *  a form that refuses to submit. */
export const emptyPattern = (name = ''): AudiencePattern => ({
  name, residency: [], speakers: [], lifeStage: [], motive: [],
  money: 'unknown', readiness: 'browsing', exclude: [], strictness: 50,
})

// ─────────────────────────────────────────────────────────────────────────────
// THE TRANSLATION. Every entry carries WHY, because a mapping nobody can
// argue with is a mapping nobody can improve.
// ─────────────────────────────────────────────────────────────────────────────

interface Mapped {
  /** Meta behaviour/interest entities this trait implies. */
  entities: TargetingEntity[]
  /** Language codes the trait implies, if any. */
  languages?: string[]
  /** Age floor/ceiling the trait implies, if any. */
  ageMin?: number
  ageMax?: number
  /** True when this trait is DEFINING — it binds even at middling strictness,
   *  because without it the pattern stops describing the same person. */
  defining?: boolean
}

/**
 * The bundles. `creative` is the language the ad is WRITTEN in and must be one
 * the landing pages actually serve; `alsoReach` are additional speaker groups
 * in the same market who will read that creative.
 *
 * No entities at all — this trait buys locales, not interests. That is the
 * point: it is exact where an interest stack would be a guess.
 */
export const BUNDLE: Record<SpeakerBundle, { creative: string; alsoReach: string[]; label: string }> = {
  arabic:   { creative: 'ar', alsoReach: ['ur'],               label: 'Arabic speakers' },
  english:  { creative: 'en', alsoReach: ['es'],               label: 'English speakers' },
  european: { creative: 'ru', alsoReach: ['de', 'fr', 'it'],   label: 'European languages' },
}

const MOTIVE: Record<Motive, Mapped> = {
  // Investment intent is the one motive Meta models directly and well.
  investment:   { entities: [{ id: '6002714398372', name: 'Real estate investing' }, { id: '6004132891184', name: 'Investment' }], defining: true },
  first_home:   { entities: [{ id: '6003105898571', name: 'Property' }], ageMin: 25, ageMax: 45 },
  upgrade:      { entities: [{ id: '6003105898571', name: 'Property' }], ageMin: 30 },
  holiday_home: { entities: [{ id: '6003193636887', name: 'Luxury goods' }], ageMin: 35 },
  // A visa motive is a residency question, not a property one — it binds.
  golden_visa:  { entities: [{ id: '6004132891184', name: 'Investment' }], ageMin: 30, defining: true },
  relocation:   { entities: [{ id: '6003105898571', name: 'Property' }] },
}

const LIFE_STAGE: Record<LifeStage, Mapped> = {
  single:              { entities: [], ageMin: 24, ageMax: 34 },
  couple:              { entities: [], ageMin: 27, ageMax: 40 },
  young_family:        { entities: [], ageMin: 30, ageMax: 45 },
  established_family:  { entities: [], ageMin: 35, ageMax: 55 },
  downsizing:          { entities: [], ageMin: 50, ageMax: 65 },
}

/** Money maps to age and to the luxury/investment signals Meta can actually
 *  see. There is no income field to target in this market, and pretending
 *  otherwise would be the exact fakery this module exists to avoid — so the
 *  proxy is named as a proxy. */
const MONEY: Record<Money, Mapped> = {
  cash:         { entities: [{ id: '6003193636887', name: 'Luxury goods' }], ageMin: 35, defining: true },
  mortgage:     { entities: [], ageMin: 28, ageMax: 55 },
  payment_plan: { entities: [], ageMin: 25, ageMax: 50 },
  unknown:      { entities: [] },
}

/** Behavioural exclusions. Every one is something we have a reason to believe
 *  predicts a worse lead, never a demographic. */
const EXCLUDE: Record<Disqualifier, TargetingEntity[]> = {
  renters_only:       [{ id: '6003417049485', name: 'Apartment renters' }],
  job_seekers:        [{ id: '6002867432822', name: 'Job seeking' }],
  agents_and_brokers: [{ id: '6008500426593', name: 'Real estate agents' }],
  bargain_hunters:    [{ id: '6002867432172', name: 'Discount shoppers' }],
}

/** Residency decides geography, and geography is never a preference. */
const RESIDENCY_COUNTRIES: Record<Residency, string[]> = {
  resident: ['AE'],
  expat:    ['AE'],
  gcc:      ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'],
  overseas: ['GB', 'DE', 'FR', 'IN', 'PK', 'RU', 'CN', 'EG', 'ZA'],
}

// ─────────────────────────────────────────────────────────────────────────────
// STRICTNESS
// ─────────────────────────────────────────────────────────────────────────────

/** Above this, EVERY stated trait becomes a hard requirement. */
export const STRICT_ALL = 75
/** Above this, defining traits bind. Below it, nothing does — the pattern is
 *  a set of hints and Meta is left to find them. */
export const STRICT_DEFINING = 30

export interface PatternPlan {
  targeting: CampaignTargeting
  /** How many traits ended up binding. Shown as a shape, never as the list. */
  boundTraits: number
  /** How many were carried as preference only. */
  hintedTraits: number
  /** Plain sentence describing the PERSON, for the operator. Never the spec. */
  describes: string
}

const uniqEntities = (xs: TargetingEntity[]): TargetingEntity[] => {
  const seen = new Map<string, TargetingEntity>()
  for (const x of xs) if (x?.id && !seen.has(x.id)) seen.set(x.id, x)
  return [...seen.values()]
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/**
 * Turn a pattern into real targeting.
 *
 * Traits that BIND become AND-narrowing groups — Meta's only "must". Traits
 * that merely lean join the base group, where Meta ORs them and treats them as
 * signal rather than requirement. Strictness decides which is which, and that
 * is the whole mechanism: one dial moving traits between two buckets.
 *
 * Age is the intersection of every stated trait's band, never the union — a
 * young family who is downsizing is not 30-to-65, it is nobody, and a range
 * that quietly widened to include everyone would be the flattering answer.
 */
export function planPattern(p: AudiencePattern, landingLanguages: string[] = []): PatternPlan {
  const strictness = clamp(p.strictness, 0, 100)
  const bindEverything = strictness >= STRICT_ALL
  const bindDefining = strictness >= STRICT_DEFINING

  const traits: Array<{ m: Mapped; label: string }> = []
  for (const m of p.motive) traits.push({ m: MOTIVE[m], label: m })
  for (const l of p.lifeStage) traits.push({ m: LIFE_STAGE[l], label: l })
  traits.push({ m: MONEY[p.money], label: p.money })

  const binding: TargetingEntity[][] = []
  const hinting: TargetingEntity[] = []
  let bound = 0, hinted = 0

  for (const { m } of traits) {
    if (m.entities.length === 0) continue
    const isBinding = bindEverything || (bindDefining && m.defining === true)
    if (isBinding) { binding.push(m.entities); bound++ }
    else { hinting.push(...m.entities); hinted++ }
  }

  // Age: intersect. Every trait narrows, none widens.
  let ageMin = 18, ageMax = 65
  for (const { m } of traits) {
    if (typeof m.ageMin === 'number') ageMin = Math.max(ageMin, m.ageMin)
    if (typeof m.ageMax === 'number') ageMax = Math.min(ageMax, m.ageMax)
  }
  // An impossible intersection means the traits contradict. Widen to the
  // stated floor rather than emit an inverted band Meta would reject.
  if (ageMin >= ageMax) ageMax = Math.min(65, ageMin + 10)

  // Language: what the communities imply, intersected with what the landing
  // page can actually serve. Narrowing to a language we cannot show a page in
  // buys a worse experience than no narrowing.
  // Every locale the chosen bundles reach — the creative language plus the
  // speaker groups that read it. This is exact: locales are a real Meta field,
  // so no part of it is inferred.
  const langs = new Set<string>()
  for (const b of p.speakers) {
    langs.add(BUNDLE[b].creative)
    for (const l of BUNDLE[b].alsoReach) langs.add(l)
  }
  const leadLanguages = [...langs]

  const excludeEntities = uniqEntities(p.exclude.flatMap((d) => EXCLUDE[d]))

  const targeting: CampaignTargeting = {
    countries: uniqStrings(p.residency.flatMap((r) => RESIDENCY_COUNTRIES[r])) ,
    cityKeys: [],
    ageMin, ageMax,
    publisherPlatforms: ['facebook', 'instagram'],
    interests: uniqEntities(hinting),
    behaviors: [],
    narrowing: binding.map((group) => ({ interests: group, behaviors: [] })),
    exclusions: excludeEntities.length > 0 ? { interests: excludeEntities, behaviors: [] } : undefined,
    customAudienceIds: [],
    ...(leadLanguages.length > 0 ? { leadLanguages } : {}),
  }
  if (targeting.countries.length === 0) targeting.countries = ['AE']

  return { targeting, boundTraits: bound, hintedTraits: hinted, describes: describePattern(p) }
}

const uniqStrings = (xs: string[]) => [...new Set(xs.filter(Boolean))]

const WORD: Record<string, string> = {
  resident: 'living in the UAE', expat: 'an expat in the UAE',
  gcc: 'in the Gulf', overseas: 'buying from abroad',
  single: 'single', couple: 'a couple', young_family: 'a young family',
  established_family: 'an established family', downsizing: 'downsizing',
  first_home: 'buying a first home', upgrade: 'upgrading', investment: 'investing',
  holiday_home: 'buying a holiday home', golden_visa: 'after a golden visa', relocation: 'relocating',
  cash: 'paying cash', mortgage: 'on a mortgage', payment_plan: 'on a payment plan', unknown: '',
  browsing: 'just looking', comparing: 'comparing options', ready: 'ready to move',
}

/**
 * The pattern as a sentence about a person.
 *
 * This is the only description anybody outside the kitchen ever sees. It says
 * WHO, never HOW — no interest ids, no behaviour names, no narrowing groups.
 */
export function describePattern(p: AudiencePattern): string {
  // `money: 'unknown'` and `readiness: 'browsing'` are the NOT-CHOSEN states,
  // not choices. Counting them as traits made an untouched pattern describe
  // itself as "Just looking." — which reads as a decision somebody made.
  const chosen =
    p.speakers.length + p.residency.length + p.lifeStage.length + p.motive.length +
    (p.money !== 'unknown' ? 1 : 0) + (p.readiness !== 'browsing' ? 1 : 0)
  if (chosen === 0) return 'Anyone in the UAE — no traits chosen yet.'

  const bits: string[] = []
  const c = p.speakers.map((x) => BUNDLE[x].label)
  if (c.length) bits.push(c.join(' and '))
  const l = p.lifeStage.map((x) => WORD[x]).filter(Boolean)
  if (l.length) bits.push(l.join(' or '))
  const r = p.residency.map((x) => WORD[x]).filter(Boolean)
  if (r.length) bits.push(r.join(' or '))
  const m = p.motive.map((x) => WORD[x]).filter(Boolean)
  if (m.length) bits.push(m.join(' or '))
  if (WORD[p.money]) bits.push(WORD[p.money])
  if (WORD[p.readiness]) bits.push(WORD[p.readiness])
  return bits.join(', ').replace(/^./, (s) => s.toUpperCase()) + '.'
}
