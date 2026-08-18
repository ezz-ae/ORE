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
import type { PositiveLevel } from '@/lib/freehold/level-arms'

// ─────────────────────────────────────────────────────────────────────────────
// THE VOCABULARY. Real-estate words, not platform words.
// ─────────────────────────────────────────────────────────────────────────────

/** Where the BUYER lives — the property is always in the UAE, the buyer is
 *  anywhere. The single most important trait: it decides the geo, the
 *  language and whether they can view in person. Each named market is its own
 *  campaign with its own creative and its own price talk; 'gcc' is the
 *  deliberate whole-Gulf choice, never a default. */
export type Residency =
  | 'resident' | 'expat'
  | 'saudi' | 'qatar' | 'kuwait' | 'bahrain' | 'oman' | 'gcc'
  | 'egypt' | 'france' | 'europe' | 'overseas'

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
 * Each bundle is ONE language: the language the ad is written in and the
 * accounts it is shown to, nothing more. Wider pairings used to live here and
 * were removed — a bundle that reaches more than its label says is the
 * machine widening someone's buy behind their back.
 *
 * They are INCLUSION only. Nothing here excludes anyone by origin or language:
 * the exclusion axis is behavioural (see `Disqualifier`), which is both the
 * honest way to exclude and the only one that predicts anything.
 */
export type SpeakerBundle = 'arabic' | 'english' | 'russian'

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

const RESIDENCIES: Residency[] = [
  'resident', 'expat',
  'saudi', 'qatar', 'kuwait', 'bahrain', 'oman', 'gcc',
  'egypt', 'france', 'europe', 'overseas',
]
const SPEAKERS: SpeakerBundle[] = ['arabic', 'english', 'russian']
const LIFE_STAGES: LifeStage[] = ['single', 'couple', 'young_family', 'established_family', 'downsizing']
const MOTIVES: Motive[] = ['first_home', 'upgrade', 'investment', 'holiday_home', 'golden_visa', 'relocation']
const MONEYS: Money[] = ['cash', 'mortgage', 'payment_plan', 'unknown']
const READINESSES: Readiness[] = ['browsing', 'comparing', 'ready']
const DISQUALIFIERS: Disqualifier[] = ['renters_only', 'job_seekers', 'agents_and_brokers', 'bargain_hunters']

/**
 * Read an untrusted pattern off the wire.
 *
 * Unknown values are DROPPED, never coerced to a neighbour. A pattern that
 * silently became a different person than the one described would produce an
 * audience nobody asked for, and the describing sentence would still read
 * correctly — the worst possible failure for a system whose whole promise is
 * that the words mean something.
 */
export function parsePattern(raw: unknown): AudiencePattern {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const pick = <T extends string>(v: unknown, allowed: T[]): T[] =>
    Array.isArray(v) ? [...new Set(v.filter((x): x is T => allowed.includes(x as T)))] : []
  const one = <T extends string>(v: unknown, allowed: T[], dflt: T): T =>
    allowed.includes(v as T) ? (v as T) : dflt
  const strictness = Number(r.strictness)
  return {
    name: typeof r.name === 'string' ? r.name.trim().slice(0, 120) : '',
    residency: pick(r.residency, RESIDENCIES),
    speakers: pick(
      Array.isArray(r.speakers) ? r.speakers.map((x) => (x === 'european' ? 'russian' : x)) : r.speakers,
      SPEAKERS,
    ),
    lifeStage: pick(r.lifeStage, LIFE_STAGES),
    motive: pick(r.motive, MOTIVES),
    money: one(r.money, MONEYS, 'unknown'),
    readiness: one(r.readiness, READINESSES, 'browsing'),
    exclude: pick(r.exclude, DISQUALIFIERS),
    strictness: Number.isFinite(strictness) ? clamp(Math.round(strictness), 0, 100) : 50,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE TRANSLATION. Every entry carries WHY, because a mapping nobody can
// argue with is a mapping nobody can improve.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * THE LEVEL SCHEMA, as the pattern traits map onto it.
 *
 *   1 persona   — who they are. Life stage, where they live, what they read.
 *   2 money     — what they can pay with. Filtered before product interest
 *                 because it is the cheaper cut: there is no point paying to
 *                 find people interested in a villa who cannot buy one.
 *   3 product   — why they are buying.
 *   4 decision  — how close they are. Carried as temperature, not as targeting.
 *   5           — experimental. Nothing maps here yet, and inventing something
 *                 to fill it would be worse than leaving it empty.
 */
export const LEVEL_PERSONA: PositiveLevel = 1
export const LEVEL_MONEY: PositiveLevel = 2
export const LEVEL_PRODUCT: PositiveLevel = 3
export const LEVEL_DECISION: PositiveLevel = 4

interface Mapped {
  /** Meta behaviour/interest entities this trait implies. */
  entities: TargetingEntity[]
  /**
   * TRUE WHEN THESE ENTITIES ARE A POND, NOT A BUYER.
   *
   * "Property" in this market is close to everyone — Meta counts anyone who
   * ever looked at a listing, a home tour, a mortgage ad. It is a fine place
   * to FISH, and a disastrous thing to buy on its own: a group is an OR, so
   * one mass interest sitting beside a narrow one IS the mass interest, and
   * the campaign quietly becomes "anyone who likes houses".
   *
   * Marked so a plan can refuse to hand someone that audience while calling
   * it a described buyer.
   */
  mass?: boolean
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
  // A BUNDLE REACHES EXACTLY ITS LANGUAGE — nothing rides along behind the
  // label. Urdu used to ride with Arabic, Spanish with English, and German,
  // French and Italian with Russian, all on market theories the person
  // choosing the audience never asked for and could not see. A live campaign
  // showed where that ends. No professional here runs Russians and Italians
  // as one audience; each language is its own market with its own creative.
  arabic:   { creative: 'ar', alsoReach: [], label: 'Arabic speakers' },
  english:  { creative: 'en', alsoReach: [], label: 'English speakers' },
  russian:  { creative: 'ru', alsoReach: [], label: 'Russian speakers' },
}

const MOTIVE: Record<Motive, Mapped> = {
  // Investment intent is the one motive Meta models directly and well.
  investment:   { entities: [{ id: '6003051380892', name: 'Real estate investing' }, { id: '6004132891184', name: 'Investment' }], defining: true },
  first_home:   { entities: [{ id: '6003105898571', name: 'Property' }], ageMin: 25, ageMax: 45, mass: true },
  upgrade:      { entities: [{ id: '6003105898571', name: 'Property' }], ageMin: 30, mass: true },
  holiday_home: { entities: [{ id: '6003193636887', name: 'Luxury goods' }], ageMin: 35 },
  // A visa motive is a residency question, not a property one — it binds.
  golden_visa:  { entities: [{ id: '6004132891184', name: 'Investment' }], ageMin: 30, defining: true },
  relocation:   { entities: [{ id: '6003105898571', name: 'Property' }], mass: true },
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

/** The standard time-waster exclusions, for builders outside the pattern path
 *  (personas, lookalikes) that carry the same hygiene. */
export const standardExclusions = (): TargetingEntity[] =>
  [...EXCLUDE.agents_and_brokers, ...EXCLUDE.job_seekers, ...EXCLUDE.bargain_hunters]

/** The creative locale for speaker bundles — one language per audience is a
 *  promise every builder keeps, not just this one. */
export const speakerLocales = (speakers: SpeakerBundle[]): string[] =>
  [...new Set(speakers.map((s) => BUNDLE[s].creative))]

/**
 * THE ONE HARD RULE: real-estate interest is a MUST in every audience.
 *
 * This company sells property. An audience member who has never shown Meta a
 * property signal is a browser whatever else is true of them — a doctor, a
 * cash buyer, a lookalike of our best client. So every audience this system
 * builds, whatever surface built it, carries this group as an AND requirement:
 * the person must match at least one of these on top of everything else.
 */
/**
 * THE NAME IS THE CONTRACT; THE ID IS A SEED.
 *
 * Every id in this file is re-resolved by NAME against Meta's live
 * vocabulary at launch and at reach-estimate time (see
 * repairTargetingInterests in lib/meta/client.ts). Meta retires and merges
 * targeting nodes on its own schedule, so a literal id here goes stale on
 * Meta's timetable, not ours — three consecutive live launches failed that
 * way, each on a different id, before the repair covered this group. What
 * survives is the name: whatever id is live today is what ships, and a name
 * Meta no longer knows drops out quietly rather than failing the launch.
 */
export const REAL_ESTATE_MUST: TargetingEntity[] = [
  { id: '6003051380892', name: 'Real estate investing' },
]

/**
 * `Property` CAME OUT FOR THE SAME REASON `Investment` DID, ONE LEVEL DOWN.
 *
 * With Investment removed the gate finally existed — and barely narrowed. The
 * ready-buyer card for Arabic-speaking UAE cash investors moved 2.7M–3.2M to
 * 1.8M–2.2M. Arabic speakers in the UAE are roughly 2.5–3M in total, so a gate
 * that leaves 2M standing is removing almost nobody.
 *
 * Because a narrowing group is an OR, and an OR is as large as its LARGEST
 * member. `Property` was in it — and this file already says what `Property` is:
 *
 *     first_home:  { entities: [Property], mass: true }
 *     upgrade:     { entities: [Property], mass: true }
 *     relocation:  { entities: [Property], mass: true }
 *
 * `mass: true` is this module's own word for an interest so wide it does not
 * narrow. The product knew, flagged it in three places, and then used it as
 * the gate. `[Property OR Real estate investing]` is `Property`.
 *
 * The same ad set rebuilt by hand with `Penthouse apartment` as its MUST came
 * out at 728k. A gate has to be made of signals somebody only carries if they
 * are actually shopping for property.
 *
 * THE RULE, now enforced rather than assumed: no entity marked `mass` may
 * appear in this list. A gate containing a mass interest is not a gate.
 */
export const MASS_ENTITY_IDS: ReadonlySet<string> = new Set(
  Object.values(MOTIVE).filter((m) => m.mass).flatMap((m) => m.entities.map((e) => e.id)),
)
for (const e of REAL_ESTATE_MUST) {
  if (MASS_ENTITY_IDS.has(e.id)) {
    throw new Error(
      `REAL_ESTATE_MUST contains "${e.name}", which this module marks as a mass interest. ` +
      `A narrowing group is an OR, so one mass member makes the whole gate as wide as the market.`,
    )
  }
}

/**
 * `Investment` USED TO BE IN THAT LIST, AND IT DISSOLVED THE GATE.
 *
 * A live campaign went out reaching 2.2–2.5M with `Luxury goods` as its only
 * MUST rule. The chain that produced it:
 *
 *   · the `investment` motive binds and becomes a group,
 *     [Real estate investing, Investment]
 *   · hardenRealEstate then asks "is a real-estate group already here?" and
 *     tests `ids.every(id => RE_MUST_IDS.has(id))`
 *   · with `Investment` in the set, BOTH ids matched, the answer was yes, and
 *     no property gate was added
 *
 * But a narrowing group is an OR. "Real estate investing OR Investment" is
 * satisfied by plain `Investment` — millions of people who have never looked
 * at a property. So the check meant to guarantee the gate accepted a group
 * that had none, and the only rule left binding was a money proxy.
 *
 * Rebuilt by hand with a real property interest as the MUST, the same ad set
 * fell to 728k–857k. Two thirds of that audience was never the audience.
 *
 * This is the third time the same word has done this. `Investment` and
 * `investor` were removed from PROPERTY_WORDS in campaign-setup-check.ts for
 * exactly this reason, and the setup check still reported "Property buyers" on
 * the broken ad set because it looks for the word anywhere rather than asking
 * whether it BINDS. A finance interest is not a property interest, in any list,
 * at any layer.
 */
const RE_MUST_IDS = new Set(REAL_ESTATE_MUST.map((e) => e.id))

/**
 * Every hardcoded Meta entity id this kitchen ships with, flattened and
 * deduplicated — the id someone copied down once for MOTIVE, MONEY, EXCLUDE
 * and the real-estate anchor. This is what "is our targeting still valid"
 * has to check: nothing here is resolved live, so nothing here notices on
 * its own when Meta deprecates or merges a node.
 */
export function allCatalogEntities(): TargetingEntity[] {
  const all: TargetingEntity[] = [
    ...REAL_ESTATE_MUST,
    ...Object.values(MOTIVE).flatMap((m) => m.entities),
    ...Object.values(MONEY).flatMap((m) => m.entities),
    ...Object.values(EXCLUDE).flat(),
  ]
  const seen = new Map<string, TargetingEntity>()
  for (const e of all) if (e?.id && !seen.has(e.id)) seen.set(e.id, e)
  return [...seen.values()]
}

/** Add the real-estate MUST group to a targeting spec — unless a narrowing
 *  group made purely of real-estate signals is already there (that group is
 *  the same requirement or a stricter one, and doubling it is noise).
 *
 *  PREPENDED, deliberately: storage caps narrowing at MAX_NARROWING_GROUPS,
 *  and a rule that sits last in the list is a rule that quietly falls off a
 *  five-group pattern. First in can never be the one the cap eats. */
export function hardenRealEstate(t: CampaignTargeting): CampaignTargeting {
  const groups = t.narrowing ?? []
  const alreadyHard = groups.some((g) => {
    const ids = [...(g.interests ?? []), ...(g.behaviors ?? [])].map((e) => e.id)
    return ids.length > 0 && ids.every((id) => RE_MUST_IDS.has(id))
  })
  if (alreadyHard) return t
  return { ...t, narrowing: [{ interests: REAL_ESTATE_MUST, behaviors: [] }, ...groups] }
}

/** Residency decides geography, and geography is never a preference.
 *  Every Gulf country stands alone — its own way of buying, its own creative,
 *  its own campaign. 'gcc' exists for the operator who deliberately wants the
 *  whole Gulf in one audience, and for old saved patterns. */
export const RESIDENCY_COUNTRIES: Record<Residency, string[]> = {
  resident: ['AE'],
  expat:    ['AE'],
  saudi:    ['SA'],
  qatar:    ['QA'],
  kuwait:   ['KW'],
  bahrain:  ['BH'],
  oman:     ['OM'],
  gcc:      ['AE', 'SA', 'KW', 'QA', 'BH', 'OM'],
  egypt:    ['EG'],
  france:   ['FR'],
  europe:   ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'DK', 'NO', 'IE', 'PT', 'GR', 'PL', 'CZ', 'RO', 'HU', 'FI'],
  // The buyer markets the client actually flies people in from — their list,
  // not a list of big countries. Every market here has its own way of buying.
  overseas: ['GB', 'DE', 'FR', 'IT', 'ES', 'CH', 'RU', 'CN', 'EG', 'TR'],
}

// ─────────────────────────────────────────────────────────────────────────────
// STRICTNESS
// ─────────────────────────────────────────────────────────────────────────────

/** Above this, EVERY stated trait becomes a hard requirement. */
export const STRICT_ALL = 75
/** Above this, defining traits bind. Below it, nothing does — the pattern is
 *  a set of hints and Meta is left to find them. */
export const STRICT_DEFINING = 30

/**
 * READINESS IS NOT AN INTEREST — it is a temperature.
 *
 * Nothing in Meta's catalog knows whether someone is ready to buy. Every
 * product that claims to target "in-market" buyers is selling an interest
 * stack that means "looked at a property page once", and the honest version of
 * that signal is one we hold ourselves: who visited, who watched, who started
 * a form. So readiness does not add entities. It says which ARM this pattern
 * belongs in — and warm and hot arms need a real retargeting source, which a
 * description of a person cannot invent.
 *
 * Reported rather than silently applied, because "we cannot build this until
 * 300 people have visited" is information the operator needs before launch,
 * not a surprise at it.
 */
export type Temperature = 'cold' | 'warm' | 'hot'

const TEMPERATURE: Record<Readiness, Temperature> = {
  browsing: 'cold', comparing: 'warm', ready: 'hot',
}

export interface PatternPlan {
  targeting: CampaignTargeting
  /** How many traits ended up binding. Shown as a shape, never as the list. */
  boundTraits: number
  /** How many were carried as preference only. */
  hintedTraits: number
  /** Plain sentence describing the PERSON, for the operator. Never the spec. */
  describes: string
  /** Which arm this pattern is. Prospecting, or built on people we have
   *  already touched. */
  temperature: Temperature
  /** True when the pattern cannot be launched from targeting alone — it needs
   *  a retargeting audience behind it. Warm and hot always do. */
  needsRetargetingSource: boolean
  /** Speaker groups asked for but not reachable, because no landing page is
   *  written in the language their ad would be. Named, never dropped quietly:
   *  the operator chose them and is entitled to know they did not survive. */
  unreachable: string[]
  /** Which level every segment sits at — the input the arm planner has always
   *  asked for and nothing could produce. Derived from the trait that put the
   *  segment there, never inferred from the segment itself. */
  entityLevels: Array<{ id: string; kind: 'interest'; level: PositiveLevel }>
  /**
   * TRUE WHEN THIS AUDIENCE IS EVERYONE.
   *
   * The described buyer produced only mass interests and nothing narrowing
   * them, so the ad set would reach anyone who has ever looked at property.
   * The words still describe a person; the buy does not. Reported rather than
   * silently corrected — changing someone's targeting on their behalf is the
   * same sin as dropping it.
   */
  reachesEveryone: boolean
  /** Segments claimed by more than one level, by name. Each one is a place the
   *  translation is using a single Meta interest to stand for two different
   *  things, which weakens any arm built on the boundary between them. */
  sharedSegments: string[]
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

  // Each trait carries the LEVEL it belongs to. This is the input the arm
  // planner has always asked for and never had: nothing in the product could
  // say which level a segment sat at, so `level-arms.ts` sat complete and
  // unreachable. A pattern already knows — the operator chose "cash" under
  // money and "investing" under why-they-are-buying, and that IS the schema.
  const traits: Array<{ m: Mapped; label: string; level: PositiveLevel }> = []
  for (const m of p.motive) traits.push({ m: MOTIVE[m], label: m, level: LEVEL_PRODUCT })
  for (const l of p.lifeStage) traits.push({ m: LIFE_STAGE[l], label: l, level: LEVEL_PERSONA })
  traits.push({ m: MONEY[p.money], label: p.money, level: LEVEL_MONEY })

  const binding: TargetingEntity[][] = []
  const hinting: TargetingEntity[] = []
  let bound = 0, hinted = 0

  for (const { m } of traits) {
    const isBinding = bindEverything || (bindDefining && m.defining === true)
    // A trait with no Meta entities still BINDS — it narrows the age band, the
    // geo or the locales instead. Skipping the count for those reported
    // "0 traits bound" for a pattern that had narrowed hard on every one of
    // them, which reads as a dial that does nothing.
    if (m.entities.length === 0) {
      if (isBinding) bound++
      else hinted++
      continue
    }
    if (isBinding) { binding.push(m.entities); bound++ }
    else { hinting.push(...m.entities); hinted++ }
  }

  // Age: intersect. Every trait narrows, none widens.
  let ageMin = 30, ageMax = 65
  for (const { m } of traits) {
    if (typeof m.ageMin === 'number') ageMin = Math.max(ageMin, m.ageMin)
    if (typeof m.ageMax === 'number') ageMax = Math.min(ageMax, m.ageMax)
  }
  // An impossible intersection means the traits contradict. Widen to the
  // stated floor rather than emit an inverted band Meta would reject.
  if (ageMin >= ageMax) ageMax = Math.min(65, ageMin + 10)

  // Language. A bundle is only usable if the ad can be WRITTEN in its creative
  // language — there has to be a landing page in it. When the caller says
  // which pages exist, a bundle without one is dropped whole rather than
  // reaching people we would then send to a page they cannot read.
  //
  // What it reaches is wider than what it is written in: the creative language
  // plus the speaker groups who read that creative. Both halves are locales,
  // a real Meta field, so none of it is inferred.
  const usable = landingLanguages.length > 0
    ? p.speakers.filter((b) => landingLanguages.includes(BUNDLE[b].creative))
    : p.speakers
  const droppedBundles = p.speakers.filter((b) => !usable.includes(b)).map((b) => BUNDLE[b].label)

  const langs = new Set<string>()
  for (const b of usable) {
    langs.add(BUNDLE[b].creative)
    for (const l of BUNDLE[b].alsoReach) langs.add(l)
  }
  const leadLanguages = [...langs]

  const excludeEntities = uniqEntities(p.exclude.flatMap((d) => EXCLUDE[d]))

  // The one hard rule, applied at the end where nothing can undo it: whatever
  // else this pattern asked for, the person must carry a real-estate signal.
  const targeting: CampaignTargeting = hardenRealEstate({
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
  })
  if (targeting.countries.length === 0) targeting.countries = ['AE']

  // ── Which level each segment ended up at ────────────────────────────────
  //
  // SOME SEGMENTS ARE CLAIMED BY TWO LEVELS, and that is a fact about the
  // mapping rather than a bug to hide. "Luxury goods" stands in for paying
  // cash (level 2) AND for wanting a holiday home (level 3); "Investment"
  // stands in for investing and for a golden visa (both level 3, so harmless).
  // Meta has no income field in this market, so money is a proxy — and a proxy
  // shared with a product interest is a weak one.
  //
  // The planner's premise is that levels are SEPARABLE: an arm adding level 3
  // must buy different people than the arm that stopped at level 2. A segment
  // in both cannot do that. It is assigned to the LOWER level — the cheaper
  // cut, applied first — and reported, because a plan built on a collision
  // nobody mentioned would read as precision it does not have.
  const claimedBy = new Map<string, { entity: TargetingEntity; levels: Set<PositiveLevel> }>()
  for (const { m, level } of traits) {
    for (const e of m.entities) {
      const seen = claimedBy.get(e.id)
      if (seen) seen.levels.add(level)
      else claimedBy.set(e.id, { entity: e, levels: new Set([level]) })
    }
  }
  const entityLevels = Array.from(claimedBy.values()).map(({ entity, levels }) => ({
    id: entity.id,
    kind: 'interest' as const,
    level: Math.min(...levels) as PositiveLevel,
  }))
  const sharedSegments = Array.from(claimedBy.values())
    .filter((c) => c.levels.size > 1)
    .map((c) => c.entity.name)

  // ── IS THIS AUDIENCE ACTUALLY ANYONE? ────────────────────────────────────
  //
  // A group is an OR. Put "Property" — which in this market Meta counts as
  // close to everybody who ever looked at a listing — beside a narrow intent
  // segment and the group IS "Property". The narrow one is still listed, still
  // visible in Ads Manager, still discussed in the meeting, and contributing
  // nothing.
  //
  // That is the difference between fishing in a pond and buying the pond. It
  // is the single most expensive mistake this product can make on someone's
  // behalf, because the campaign looks precise and delivers to everyone, and
  // the leads that come back are browsers.
  //
  // So it is measured and reported: a mass interest with nothing narrowing it
  // means the described buyer was not bought.
  const massEntityIds = new Set(
    traits.filter((x) => x.m.mass).flatMap((x) => x.m.entities.map((e) => e.id)),
  )
  const baseIsAllMass =
    hinting.length > 0 && hinting.every((e) => massEntityIds.has(e.id))
  const reachesEveryone = baseIsAllMass && binding.length === 0

  const temperature = TEMPERATURE[p.readiness] ?? 'cold'

  return {
    targeting,
    boundTraits: bound,
    hintedTraits: hinted,
    describes: describePattern(p),
    temperature,
    needsRetargetingSource: temperature !== 'cold',
    unreachable: droppedBundles,
    entityLevels,
    sharedSegments,
    reachesEveryone,
  }
}

const uniqStrings = (xs: string[]) => [...new Set(xs.filter(Boolean))]

const WORD: Record<string, string> = {
  resident: 'living in the UAE', expat: 'an expat in the UAE',
  saudi: 'in Saudi Arabia', qatar: 'in Qatar', kuwait: 'in Kuwait',
  bahrain: 'in Bahrain', oman: 'in Oman', gcc: 'across the Gulf',
  egypt: 'in Egypt', france: 'in France', europe: 'in Europe',
  overseas: 'buying from abroad',
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

/**
 * DOES THIS SAVED AUDIENCE STILL CARRY THE GATE THAT DID NOT NARROW?
 *
 * The fix above changed how new audiences are BUILT. It changed nothing about
 * the ones already sitting in the database, and those are the dangerous half:
 * a saved audience is a spec frozen at the moment it was created, and the whole
 * point of saving one is that somebody reuses it without re-reading it.
 *
 * Three of this account's saved audiences were built while `Property` and
 * `Investment` were still in `REAL_ESTATE_MUST`. Attach one and the campaign
 * runs with the same gate that reached 2.2M — the code is fixed, the money
 * still goes.
 *
 * So the check is a READ, not a migration. Nothing is rewritten: an audience is
 * somebody's saved decision and silently editing it would be worse than the
 * fault, because then nobody would know which of their audiences had changed
 * under them. The screens mark it, name the interest responsible, and the
 * operator rebuilds or deletes it.
 *
 * Structural rather than typed against CampaignTargeting so this module stays
 * free of the Meta types — it is imported by pure guards and by the browser.
 */
export interface MassGateRead {
  /** True when a narrowing group contains an interest this module calls mass. */
  stale: boolean
  /** The offending interests, by name, so the screen can say which. */
  names: string[]
}

export function massGateRead(spec: {
  narrowing?: Array<{ interests?: Array<{ id?: string; name?: string }> | null }> | null
} | null | undefined): MassGateRead {
  const names: string[] = []
  for (const group of spec?.narrowing ?? []) {
    for (const e of group?.interests ?? []) {
      const id = String(e?.id ?? '')
      // Matched on ID, never on name. Meta relabels interests — `Job seeking`
      // came back as `Beauty` once — and a name match would both miss renamed
      // entities and flag innocent ones that happen to share a word.
      if (id && MASS_ENTITY_IDS.has(id)) {
        const label = String(e?.name ?? '').trim() || id
        if (!names.includes(label)) names.push(label)
      }
    }
  }
  return { stale: names.length > 0, names }
}
