// The shared Meta targeting vocabulary — the ONLY interests/cities the AI is
// allowed to recommend, so it can never invent an id.
//
// THE NAME IS THE CONTRACT; THE ID IS A SEED. Every id here is re-resolved by
// name against Meta's live vocabulary before it is sent (see
// repairTargetingInterests in lib/meta/client.ts) — Meta retires and merges
// targeting nodes on its own schedule, and three consecutive live launches
// failed on stale ids from this era before that repair covered every place
// interests live. A name Meta no longer knows now drops out quietly instead
// of failing a launch. Integrations → Meta Ads → "Check now" reports which
// of these names Meta still recognises.

export interface CatalogInterest { id: string; name: string }
export interface CatalogCity { key: string; name: string }

export const UAE_INTERESTS: CatalogInterest[] = [
  { id: '6003051380892', name: 'Real estate investing' },
  { id: '6003105898571', name: 'Property' },
  { id: '6003193636887', name: 'Luxury goods' },
  { id: '6004132891184', name: 'Investment' },
  { id: '6003409935589', name: 'Architecture' },
]

export const UAE_CITIES: CatalogCity[] = [
  { key: '297928', name: 'Dubai' },
  { key: '295424', name: 'Abu Dhabi' },
  { key: '297999', name: 'Sharjah' },
  { key: '289274', name: 'Ajman' },
  { key: '290095', name: 'Ras Al Khaimah' },
]

// Algorithm-vs-algorithm: the recommendation is a STRATEGY, not an interest
// list. Meta's delivery algorithm finds the people — our job is to feed it
// the right signals, seeds, exclusions and creative. Naive interest stacks
// ("real estate + Dubai") are only ever a cold-start refinement.
export type TargetingStrategy =
  | 'broad_manual'         // broad but DEFINED: geo/age/language only, no interests, no Advantage expansion
  | 'lookalike_qualified'  // seed a lookalike from QUALIFIED/CLOSED leads (our unfair advantage)
  | 'retargeting_warm'     // re-engage pixel visitors / engaged leads
  | 'interest_refined'     // cold-start only: catalog interests as a starting constraint

export interface TargetingRecommendation {
  strategy: TargetingStrategy
  /** One-paragraph read of what the lead data says. */
  analysis: string
  /** ONLY for interest_refined — empty means broad (the algorithm hunts). */
  interestIds: string[]
  /** Which CRM cohort seeds the lookalike (null when not applicable). */
  lookalikeSeed: 'closed_leads' | 'qualified_leads' | null
  /** Who to EXCLUDE (descriptive — e.g. existing CRM leads, lost leads). */
  exclusions: string[]
  ageMin: number
  ageMax: number
  /** Subset of UAE_CITIES keys. */
  cityKeys: string[]
  dailyBudgetAED: number
  /** How to feed Meta's algorithm: events, qualified-lead feedback, optimization goal. */
  signalPlan: string
  /** Creative IS targeting — the angle that self-selects the right buyer. */
  creativeAngle: string
  /** Learning-phase / budget discipline (avoid resets, when to scale). */
  learningPhase: string
  /** Why this beats the last round. */
  rationale: string
  /** Interest NAMES worth adding to the catalog manually (no ids invented). */
  suggestedNewInterests: string[]
}

export const STRATEGY_LABELS: Record<TargetingStrategy, string> = {
  broad_manual: 'Broad, defined by us — no Advantage expansion',
  lookalike_qualified: 'Lookalike of qualified leads',
  retargeting_warm: 'Warm retargeting',
  interest_refined: 'Refined interests (cold start)',
}
