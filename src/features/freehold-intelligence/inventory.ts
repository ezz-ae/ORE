// Full property inventory — 8 curated + 35 mapped from projects data

import { projects } from '@/src/data/projects'

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
  heroImage?: string | null
  handoverYear: number | null
  paymentPlan: string | null
  bedrooms: string
  totalUnits: number | null
  availableUnits: number | null
  sizeRange: string
  roi: number | null
  landingStatus: LandingStatus
  landingUrl: string | null
  hasImages: boolean
  imageCount: number
  dataQuality: number
  /** Inventory-pipeline confidence: 'verified' = DLD-reconciled, 'estimated' =
      PF-derived, null = not yet stamped. Sourced from payload.confidence. */
  dataConfidence?: 'estimated' | 'verified' | null
  adReadiness: number
  linkedCampaigns: number
  leads30d: number
  views30d: number
  lastUpdated: string
  tags: string[]
}

// ── Mapping helpers ───────────────────────────────────────────────────────────

const TYPE_ORDER: Record<string, number> = {
  Studio: 0, '1BR': 1, '2BR': 2, '3BR': 3, '4BR': 4, '5BR': 5,
  Loft: 6, Townhouse: 7, Villa: 8, Penthouse: 9, Office: 10, Retail: 11,
}

function inferType(unitTypes: string[]): InventoryProperty['type'] {
  const s = unitTypes.join(',')
  if (s.includes('Office') || s.includes('Retail')) return 'commercial'
  if (s.includes('Villa') && !s.includes('Townhouse')) return 'villa'
  if (s.includes('Townhouse') && !s.includes('Villa')) return 'townhouse'
  if (unitTypes.length === 1 && s.includes('Penthouse')) return 'penthouse'
  return 'apartment'
}

function bedroomsLabel(unitTypes: string[]): string {
  const sorted = [...unitTypes].sort((a, b) => (TYPE_ORDER[a] ?? 99) - (TYPE_ORDER[b] ?? 99))
  if (sorted.length === 1) return sorted[0]
  return `${sorted[0]}–${sorted[sorted.length - 1]}`
}

function parseHandoverYear(h: string): number | null {
  if (h === 'Ready') return 2024
  const m = h.match(/(\d{4})/)
  return m ? parseInt(m[1]) : null
}

function projectSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const AREA_ROI: Record<string, number> = {
  'Jumeirah Village Circle':  8.1,
  'Arjan':                    8.5,
  'Dubai South':              9.2,
  'International City':       10.1,
  'Dubai Silicon Oasis':      8.8,
  'Dubai Sports City':        8.3,
  'Motor City':               7.6,
  'Al Furjan':                7.9,
  'Town Square':              7.2,
  'Mirdif':                   7.1,
  'Al Jaddaf':                7.0,
  'Meydan':                   7.4,
  'Dubai Hills Estate':       6.4,
  'Dubai Creek Harbour':      6.8,
  'Mohammed Bin Rashid City': 5.8,
  'Dubai Marina':             5.6,
  'Business Bay':             6.9,
  'Downtown Dubai':           5.5,
  'Expo City':                6.2,
  'Bluewaters Island':        5.3,
  'The Valley':               5.9,
  'Tilal Al Ghaf':            4.8,
  'Damac Lagoons':            5.2,
  'Dubai Islands':            6.5,
  'Jumeirah Garden City':     7.3,
  'Jumeirah Lakes Towers':    7.0,
  'Dubai Maritime City':      6.7,
  'Mina Rashid':              6.8,
  'Palm Jumeirah':            5.0,
  'Al Mamzar Waterfront':     7.5,
  'Saadiyat Island':          4.9,
  'Yas Island':               7.2,
  'Al Reem Island':           7.8,
  'Al Marjan Island':         8.9,
  'Ras Al Khaimah':           8.0,
}

const BEDROOMS_SIZE: Record<string, string> = {
  'Studio':            '350–520 sqft',
  'Studio–1BR':        '350–800 sqft',
  'Studio–2BR':        '350–1,250 sqft',
  'Studio–2':          '350–1,250 sqft',
  'Studio–3BR':        '350–1,900 sqft',
  'Studio–3':          '350–1,900 sqft',
  '1BR–2BR':           '650–1,350 sqft',
  '1BR–3BR':           '650–2,050 sqft',
  '1BR':               '650–950 sqft',
  '1BR–Loft':          '720–1,200 sqft',
  '1–2':               '650–1,350 sqft',
  '1–3':               '650–2,050 sqft',
  '2BR–3BR':           '1,050–2,050 sqft',
  '2–3':               '1,050–2,050 sqft',
  'Townhouse':         '1,850–3,400 sqft',
  'Townhouse–Villa':   '1,850–5,600 sqft',
  'Villa':             '3,200–7,800 sqft',
  'Commercial':        '500–4,200 sqft',
}

function sizeRangeFor(unitTypes: string[]): string {
  const label = bedroomsLabel(unitTypes)
  return BEDROOMS_SIZE[label] ?? '550–1,800 sqft'
}

function mapProjectToInventory(p: typeof projects[0], index: number): InventoryProperty {
  const readiness = p.campaignReadiness
  const landingStatus: LandingStatus = readiness >= 90 ? 'live' : readiness >= 80 ? 'draft' : 'missing'
  const slug = projectSlug(p.projectName)
  const handoverYear = parseHandoverYear(p.handover)

  // Deterministic but varied counts
  const seed = (index + 1) * 7 % 11 + 1
  const leads30d = landingStatus === 'live'
    ? Math.round(readiness * seed * 0.08)
    : landingStatus === 'draft'
      ? Math.round(readiness * 0.04)
      : 0
  const views30d = leads30d > 0 ? leads30d * (13 + (index % 9)) : 0

  const totalUnits = 100 + (index * 19) % 320
  const isReady = p.status === 'Ready'
  const availableUnits = isReady
    ? Math.max(4, Math.round(totalUnits * 0.08))
    : Math.round(totalUnits * (0.35 + (index % 5) * 0.07))

  const maxPrice = Math.round(p.startingPrice * (1.6 + (index % 6) * 0.2) / 10000) * 10000

  return {
    id: p.id,
    slug,
    name: p.projectName,
    area: p.area,
    developer: p.developer,
    type: inferType(p.unitTypes),
    status: p.status === 'Off-plan' ? 'off_plan' : p.status === 'Under construction' ? 'under_construction' : 'ready',
    startingPriceAED: p.startingPrice,
    maxPriceAED: maxPrice,
    handoverYear,
    paymentPlan: p.paymentPlan,
    bedrooms: bedroomsLabel(p.unitTypes),
    totalUnits,
    availableUnits,
    sizeRange: sizeRangeFor(p.unitTypes),
    roi: AREA_ROI[p.area] ?? 6.5,
    landingStatus,
    landingUrl: landingStatus !== 'missing' ? `/lp/${slug}` : null,
    hasImages: readiness >= 85,
    imageCount: readiness >= 85 ? Math.round(readiness / 11) : 0,
    dataQuality: p.confidence,
    adReadiness: readiness,
    linkedCampaigns: readiness >= 90 ? ((index % 3) + 1) : readiness >= 80 ? 1 : 0,
    leads30d,
    views30d,
    lastUpdated: p.lastUpdated,
    tags: p.tags,
  }
}

// ── 8 curated detailed properties ────────────────────────────────────────────

// Seed inventory arrays removed for handover — projects come from the DB.

// ── Stats helper ──────────────────────────────────────────────────────────────

export function getInventoryStats(props: InventoryProperty[]) {
  return {
    total: props.length,
    live: props.filter((p) => p.landingStatus === 'live').length,
    missingLanding: props.filter((p) => p.landingStatus === 'missing').length,
    adReady: props.filter((p) => p.adReadiness >= 70).length,
    totalLeads30d: props.reduce((s, p) => s + p.leads30d, 0),
    totalViews30d: props.reduce((s, p) => s + p.views30d, 0),
  }
}

// ── Ad-readiness analysis ─────────────────────────────────────────────────────
// "Which properties should we advertise, and why?" — a composite score plus a
// recommended action for every property, used by the inventory analysis panel
// and the Web Designer AI skill.

export type AdVerdict = 'scale' | 'launch' | 'fix_first' | 'hold'

export interface AdCandidate {
  id: string
  name: string
  area: string
  developer: string
  /** 0–100 composite ad opportunity score. */
  score: number
  verdict: AdVerdict
  roi: number | null
  adReadiness: number
  dataQuality: number
  leads30d: number
  landingStatus: LandingStatus
  /** Human-readable reasons driving the verdict. */
  reasons: string[]
  /** The single highest-leverage next action. */
  nextAction: string
}

function conversionRate(p: InventoryProperty): number {
  return p.views30d > 0 ? (p.leads30d / p.views30d) * 100 : 0
}

/**
 * Composite score blending ad readiness, ROI, lead momentum, data quality and
 * landing status. Tuned so "ready + converting + high ROI" floats to the top
 * and "missing landing / no data" sinks.
 */
function adOpportunityScore(p: InventoryProperty): number {
  const readiness = p.adReadiness                         // 0–100
  const roiScore = p.roi ? Math.min(p.roi / 10, 1) * 100 : 40
  const momentum = Math.min(p.leads30d / 80, 1) * 100      // 80 leads/mo = full marks
  const quality = p.dataQuality                            // 0–100
  const landingBonus =
    p.landingStatus === 'live' ? 100 :
    p.landingStatus === 'pending_review' ? 70 :
    p.landingStatus === 'draft' ? 50 : 0

  const raw =
    readiness * 0.30 +
    landingBonus * 0.25 +
    momentum * 0.20 +
    roiScore * 0.15 +
    quality * 0.10

  return Math.round(raw)
}

function verdictFor(p: InventoryProperty, score: number): AdVerdict {
  if (p.landingStatus === 'live' && p.adReadiness >= 75 && score >= 70) return 'scale'
  if (p.adReadiness >= 60 && p.landingStatus !== 'missing') return 'launch'
  if (p.landingStatus === 'missing' || p.dataQuality < 55 || !p.hasImages) return 'fix_first'
  return 'hold'
}

function reasonsFor(p: InventoryProperty): string[] {
  const r: string[] = []
  if (p.roi && p.roi >= 7.5) r.push(`Strong ${p.roi.toFixed(1)}% ROI — a headline-worthy hook`)
  if (p.landingStatus === 'live') r.push('Landing page is live — ad traffic has somewhere to land')
  if (p.landingStatus === 'missing') r.push('No landing page — paid traffic would be wasted')
  if (!p.hasImages) r.push('No images — blocks ad creative generation')
  if (p.dataQuality < 55) r.push(`Low data quality (${p.dataQuality}) — fill missing fields first`)
  const cr = conversionRate(p)
  if (cr >= 3) r.push(`Converting at ${cr.toFixed(1)}% (leads/views) — proven demand`)
  if (p.leads30d >= 50) r.push(`${p.leads30d} leads in 30d — momentum already there`)
  if (p.linkedCampaigns > 0 && p.adReadiness >= 75) r.push('Already running and ready — increase budget')
  if (p.availableUnits !== null && p.totalUnits && p.availableUnits / p.totalUnits < 0.15)
    r.push('Low remaining inventory — lead with scarcity')
  if (r.length === 0) r.push('Moderate readiness — needs review before spend')
  return r
}

function nextActionFor(p: InventoryProperty, verdict: AdVerdict): string {
  switch (verdict) {
    case 'scale':     return 'Increase budget and add a Performance Max campaign.'
    case 'launch':    return p.landingStatus === 'draft'
      ? 'Publish the landing page, then create the ad request.'
      : 'Create the ad request — this is ready to launch.'
    case 'fix_first': return p.landingStatus === 'missing'
      ? 'Generate the landing page first (highest unblock value).'
      : !p.hasImages ? 'Add property images to unblock ad creative.'
      : 'Complete missing data fields, then re-score.'
    case 'hold':      return 'Hold — review positioning and data before spending.'
  }
}

export function getAdCandidates(props: InventoryProperty[]): AdCandidate[] {
  return props
    .map((p) => {
      const score = adOpportunityScore(p)
      const verdict = verdictFor(p, score)
      return {
        id: p.id,
        name: p.name,
        area: p.area,
        developer: p.developer,
        score,
        verdict,
        roi: p.roi,
        adReadiness: p.adReadiness,
        dataQuality: p.dataQuality,
        leads30d: p.leads30d,
        landingStatus: p.landingStatus,
        reasons: reasonsFor(p),
        nextAction: nextActionFor(p, verdict),
      }
    })
    .sort((a, b) => b.score - a.score)
}

export interface InventoryAnalysis {
  topPicks: AdCandidate[]      // best to advertise now
  fixFirst: AdCandidate[]      // high potential, blocked
  scaling: AdCandidate[]       // already live + ready, push budget
  counts: { scale: number; launch: number; fixFirst: number; hold: number }
  /** Properties with high ROI but no landing — biggest missed opportunity. */
  missedOpportunities: AdCandidate[]
}

export function getInventoryAnalysis(props: InventoryProperty[]): InventoryAnalysis {
  const candidates = getAdCandidates(props)
  return {
    topPicks: candidates.filter((c) => c.verdict === 'launch' || c.verdict === 'scale').slice(0, 5),
    fixFirst: candidates.filter((c) => c.verdict === 'fix_first').slice(0, 5),
    scaling: candidates.filter((c) => c.verdict === 'scale').slice(0, 5),
    counts: {
      scale: candidates.filter((c) => c.verdict === 'scale').length,
      launch: candidates.filter((c) => c.verdict === 'launch').length,
      fixFirst: candidates.filter((c) => c.verdict === 'fix_first').length,
      hold: candidates.filter((c) => c.verdict === 'hold').length,
    },
    missedOpportunities: candidates
      .filter((c) => (c.roi ?? 0) >= 7 && c.landingStatus === 'missing')
      .slice(0, 5),
  }
}
