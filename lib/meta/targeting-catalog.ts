// The shared Meta targeting vocabulary — the ONLY interests/cities the AI is
// allowed to recommend. Every id here is a real Meta targeting id already
// proven by launched campaigns; the AI picks FROM this list (never invents
// ids, which would fail at launch time).

export interface CatalogInterest { id: string; name: string }
export interface CatalogCity { key: string; name: string }

export const UAE_INTERESTS: CatalogInterest[] = [
  { id: '6002714398372', name: 'Real estate investing' },
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

export interface TargetingRecommendation {
  /** One-paragraph read of what the lead data says. */
  analysis: string
  /** Subset of UAE_INTERESTS the next campaign should target. */
  interestIds: string[]
  ageMin: number
  ageMax: number
  /** Subset of UAE_CITIES keys. */
  cityKeys: string[]
  dailyBudgetAED: number
  /** Why this targeting beats the last round. */
  rationale: string
  /** Interest NAMES worth adding to the catalog manually (no ids invented). */
  suggestedNewInterests: string[]
}
