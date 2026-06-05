// Full property inventory for the intelligence platform

export type PropertyStatus =
  | 'active'
  | 'off_plan'
  | 'under_construction'
  | 'ready'
  | 'sold_out'
  | 'coming_soon'

export type LandingStatus =
  | 'live'
  | 'draft'
  | 'pending_review'
  | 'missing'

export interface InventoryProperty {
  id: string
  slug: string
  name: string
  area: string
  developer: string
  type: 'apartment' | 'villa' | 'townhouse' | 'penthouse' | 'duplex' | 'commercial'
  status: PropertyStatus
  startingPriceAED: number | null
  maxPriceAED: number | null
  handoverYear: number | null
  paymentPlan: string | null
  bedrooms: string // e.g. "1-4" or "Studio-3"
  totalUnits: number | null
  availableUnits: number | null
  sizeRange: string // e.g. "650–2,400 sqft"
  roi: number | null // percent
  landingStatus: LandingStatus
  landingUrl: string | null
  hasImages: boolean
  imageCount: number
  dataQuality: number // 0–100
  adReadiness: number // 0–100
  linkedCampaigns: number
  leads30d: number
  views30d: number
  lastUpdated: string
  tags: string[]
}

export const inventoryProperties: InventoryProperty[] = [
  {
    id: 'prop_palm_001',
    slug: 'palm-jumeirah-investor-pack',
    name: 'Palm Jumeirah Investor Pack',
    area: 'Palm Jumeirah',
    developer: 'Nakheel',
    type: 'apartment',
    status: 'ready',
    startingPriceAED: 3_200_000,
    maxPriceAED: 12_500_000,
    handoverYear: 2025,
    paymentPlan: '60/40 post-handover',
    bedrooms: '1–4',
    totalUnits: 240,
    availableUnits: 28,
    sizeRange: '950–4,200 sqft',
    roi: 5.8,
    landingStatus: 'pending_review',
    landingUrl: '/lp/palm-investor-preview',
    hasImages: true,
    imageCount: 18,
    dataQuality: 91,
    adReadiness: 62,
    linkedCampaigns: 2,
    leads30d: 94,
    views30d: 3_640,
    lastUpdated: '2026-05-22',
    tags: ['golden_visa', 'investor', 'beachfront', 'nakheel'],
  },
  {
    id: 'prop_hills_002',
    slug: 'dubai-hills-yield-campaign',
    name: 'Dubai Hills Yield Campaign',
    area: 'Dubai Hills Estate',
    developer: 'Emaar',
    type: 'apartment',
    status: 'off_plan',
    startingPriceAED: 1_850_000,
    maxPriceAED: 5_200_000,
    handoverYear: 2027,
    paymentPlan: '70/30 construction-linked',
    bedrooms: '1–3',
    totalUnits: 420,
    availableUnits: 87,
    sizeRange: '650–2,100 sqft',
    roi: 6.4,
    landingStatus: 'live',
    landingUrl: '/lp/hills-yield',
    hasImages: true,
    imageCount: 24,
    dataQuality: 86,
    adReadiness: 81,
    linkedCampaigns: 3,
    leads30d: 88,
    views30d: 2_980,
    lastUpdated: '2026-05-20',
    tags: ['investor', 'yield', 'emaar', 'park_views'],
  },
  {
    id: 'prop_bay_003',
    slug: 'business-bay-entry-project',
    name: 'Business Bay Entry Project',
    area: 'Business Bay',
    developer: 'Binghatti',
    type: 'apartment',
    status: 'under_construction',
    startingPriceAED: 950_000,
    maxPriceAED: 2_800_000,
    handoverYear: 2026,
    paymentPlan: '1% monthly, 50/50',
    bedrooms: 'Studio–2',
    totalUnits: 180,
    availableUnits: 112,
    sizeRange: '420–1,200 sqft',
    roi: 7.2,
    landingStatus: 'draft',
    landingUrl: '/lp/business-bay-entry-preview',
    hasImages: true,
    imageCount: 8,
    dataQuality: 64,
    adReadiness: 18,
    linkedCampaigns: 0,
    leads30d: 12,
    views30d: 420,
    lastUpdated: '2026-05-18',
    tags: ['entry_level', 'binghatti', 'canal_views'],
  },
  {
    id: 'prop_marina_004',
    slug: 'dubai-marina-luxury-residences',
    name: 'Marina Luxury Residences',
    area: 'Dubai Marina',
    developer: 'Select Group',
    type: 'penthouse',
    status: 'ready',
    startingPriceAED: 4_800_000,
    maxPriceAED: 22_000_000,
    handoverYear: 2024,
    paymentPlan: 'Full payment',
    bedrooms: '2–5',
    totalUnits: 80,
    availableUnits: 11,
    sizeRange: '1,800–7,500 sqft',
    roi: 5.1,
    landingStatus: 'missing',
    landingUrl: null,
    hasImages: false,
    imageCount: 0,
    dataQuality: 48,
    adReadiness: 12,
    linkedCampaigns: 0,
    leads30d: 4,
    views30d: 180,
    lastUpdated: '2026-04-10',
    tags: ['luxury', 'penthouse', 'ready'],
  },
  {
    id: 'prop_jvc_005',
    slug: 'jvc-investor-apartments',
    name: 'JVC Investor Apartments',
    area: 'Jumeirah Village Circle',
    developer: 'DAMAC',
    type: 'apartment',
    status: 'off_plan',
    startingPriceAED: 680_000,
    maxPriceAED: 1_400_000,
    handoverYear: 2026,
    paymentPlan: '80/20 post-handover',
    bedrooms: 'Studio–2',
    totalUnits: 350,
    availableUnits: 198,
    sizeRange: '380–920 sqft',
    roi: 8.1,
    landingStatus: 'live',
    landingUrl: '/lp/jvc-investor',
    hasImages: true,
    imageCount: 12,
    dataQuality: 78,
    adReadiness: 74,
    linkedCampaigns: 1,
    leads30d: 56,
    views30d: 1_820,
    lastUpdated: '2026-05-15',
    tags: ['high_yield', 'damac', 'affordable', 'off_plan'],
  },
  {
    id: 'prop_creek_006',
    slug: 'dubai-creek-harbour-tower',
    name: 'Creek Harbour Tower',
    area: 'Dubai Creek Harbour',
    developer: 'Emaar',
    type: 'apartment',
    status: 'off_plan',
    startingPriceAED: 1_200_000,
    maxPriceAED: 4_100_000,
    handoverYear: 2028,
    paymentPlan: '60/40 post-handover',
    bedrooms: '1–3',
    totalUnits: 520,
    availableUnits: 314,
    sizeRange: '580–2,200 sqft',
    roi: 6.8,
    landingStatus: 'missing',
    landingUrl: null,
    hasImages: true,
    imageCount: 6,
    dataQuality: 62,
    adReadiness: 35,
    linkedCampaigns: 0,
    leads30d: 22,
    views30d: 640,
    lastUpdated: '2026-05-10',
    tags: ['creek_views', 'emaar', 'golden_visa'],
  },
  {
    id: 'prop_sobha_007',
    slug: 'sobha-hartland-villas',
    name: 'Sobha Hartland II Villas',
    area: 'Mohammed Bin Rashid City',
    developer: 'Sobha Realty',
    type: 'villa',
    status: 'off_plan',
    startingPriceAED: 5_200_000,
    maxPriceAED: 18_000_000,
    handoverYear: 2027,
    paymentPlan: '70/30 construction',
    bedrooms: '3–6',
    totalUnits: 120,
    availableUnits: 54,
    sizeRange: '2,800–9,200 sqft',
    roi: 4.8,
    landingStatus: 'live',
    landingUrl: '/lp/sobha-hartland',
    hasImages: true,
    imageCount: 28,
    dataQuality: 92,
    adReadiness: 88,
    linkedCampaigns: 2,
    leads30d: 67,
    views30d: 2_140,
    lastUpdated: '2026-05-21',
    tags: ['villa', 'luxury', 'golden_visa', 'end_user', 'sobha'],
  },
  {
    id: 'prop_rak_008',
    slug: 'rak-waterfront-project',
    name: 'RAK Waterfront Residences',
    area: 'Ras Al Khaimah',
    developer: 'RAK Properties',
    type: 'apartment',
    status: 'coming_soon',
    startingPriceAED: 550_000,
    maxPriceAED: 1_800_000,
    handoverYear: 2028,
    paymentPlan: null,
    bedrooms: '1–3',
    totalUnits: 280,
    availableUnits: null,
    sizeRange: '520–1,600 sqft',
    roi: null,
    landingStatus: 'missing',
    landingUrl: null,
    hasImages: false,
    imageCount: 0,
    dataQuality: 32,
    adReadiness: 5,
    linkedCampaigns: 0,
    leads30d: 0,
    views30d: 0,
    lastUpdated: '2026-04-28',
    tags: ['coming_soon', 'rak', 'affordable'],
  },
]

export function getInventoryStats() {
  const props = inventoryProperties
  return {
    total: props.length,
    live: props.filter((p) => p.landingStatus === 'live').length,
    missingLanding: props.filter((p) => p.landingStatus === 'missing').length,
    adReady: props.filter((p) => p.adReadiness >= 70).length,
    totalLeads30d: props.reduce((s, p) => s + p.leads30d, 0),
    totalViews30d: props.reduce((s, p) => s + p.views30d, 0),
  }
}
