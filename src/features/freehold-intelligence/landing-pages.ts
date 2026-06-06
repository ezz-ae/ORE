// Landing pages data — one record per property with a landing page

import { inventoryProperties, type InventoryProperty } from './inventory'

export interface LandingPage {
  id: string
  propertyId: string
  propertyName: string
  slug: string
  status: 'live' | 'draft' | 'pending_review' | 'missing'
  template: 'investor' | 'luxury' | 'end_user' | 'default'
  headline: string
  subheadline: string
  highlights: [string, string, string, string]
  ctaText: string
  leadFields: string[]
  showPaymentPlan: boolean
  publishedAt: string | null
  lastModifiedAt: string
  views30d: number
  leads30d: number
  conversionRate: number
}

// Template picker based on property tags
function pickTemplate(tags: string[]): LandingPage['template'] {
  if (tags.some((t) => t.includes('luxury') || t.includes('penthouse') || t.includes('palm'))) return 'luxury'
  if (tags.some((t) => t.includes('investor') || t.includes('yield') || t.includes('roi'))) return 'investor'
  if (tags.some((t) => t.includes('family') || t.includes('end_user') || t.includes('ready'))) return 'end_user'
  return 'default'
}

// Derive a landing page record from an inventory property
function buildLandingPage(prop: InventoryProperty, index: number): LandingPage {
  const template = pickTemplate(prop.tags)

  const headlines: Record<LandingPage['template'], string> = {
    investor:  `${prop.name} — Strong Yields in ${prop.area}`,
    luxury:    `${prop.name} — Exclusive Residences in ${prop.area}`,
    end_user:  `${prop.name} — Ready to Move In`,
    default:   `${prop.name} — ${prop.area}`,
  }

  const subheadlines: Record<LandingPage['template'], string> = {
    investor:  `Starting from ${prop.startingPriceAED ? `AED ${(prop.startingPriceAED / 1_000_000).toFixed(1)}M` : 'competitive pricing'} · ${prop.roi ? `${prop.roi}% ROI` : 'High-yield location'}`,
    luxury:    `Private collection in ${prop.area} · Limited availability`,
    end_user:  `${prop.bedrooms} bedrooms · ${prop.sizeRange} · ${prop.paymentPlan ?? 'Flexible payment plans'}`,
    default:   `${prop.bedrooms} bedrooms from ${prop.startingPriceAED ? `AED ${(prop.startingPriceAED / 1_000_000).toFixed(1)}M` : 'competitive prices'}`,
  }

  const highlights: [string, string, string, string] = [
    `Starting from ${prop.startingPriceAED ? `AED ${(prop.startingPriceAED / 1_000_000).toFixed(1)}M` : 'Request pricing'}`,
    prop.roi ? `${prop.roi}% estimated ROI` : `Prime ${prop.area} location`,
    prop.handoverYear ? `Handover ${prop.handoverYear}` : 'Ready to occupy',
    prop.paymentPlan ?? 'Flexible payment plans available',
  ]

  const convRate = prop.views30d > 0 ? parseFloat((prop.leads30d / prop.views30d).toFixed(4)) : 0

  const publishedAt = prop.landingStatus === 'live'
    ? `2026-0${(index % 5) + 1}-${String((index % 20) + 1).padStart(2, '0')}`
    : prop.landingStatus === 'draft' || prop.landingStatus === 'pending_review'
      ? null
      : null

  return {
    id: `lp_${prop.id}`,
    propertyId: prop.id,
    propertyName: prop.name,
    slug: prop.slug,
    status: prop.landingStatus,
    template,
    headline: headlines[template],
    subheadline: subheadlines[template],
    highlights,
    ctaText: template === 'investor' ? 'Get Investment Pack' : template === 'luxury' ? 'Request Private Viewing' : 'Book a Viewing',
    leadFields: ['name', 'phone', 'email', ...(template === 'investor' ? ['budget', 'timeline'] : ['move_in_date'])],
    showPaymentPlan: !!prop.paymentPlan && template !== 'luxury',
    publishedAt,
    lastModifiedAt: prop.lastUpdated,
    views30d: prop.views30d,
    leads30d: prop.leads30d,
    conversionRate: convRate,
  }
}

// All landing pages (include all properties including "missing" so UI can show what needs creating)
export const landingPages: LandingPage[] = inventoryProperties.map((p, i) => buildLandingPage(p, i))

// Only published/draft pages
export const activeLandingPages: LandingPage[] = landingPages.filter(
  (lp) => lp.status === 'live' || lp.status === 'draft' || lp.status === 'pending_review',
)

export function getLandingPageByPropertyId(propertyId: string): LandingPage | null {
  return landingPages.find((lp) => lp.propertyId === propertyId) ?? null
}

export function getLandingPageBySlug(slug: string): LandingPage | null {
  return landingPages.find((lp) => lp.slug === slug) ?? null
}

export function getLandingPageStats() {
  return {
    total: landingPages.length,
    live: landingPages.filter((lp) => lp.status === 'live').length,
    draft: landingPages.filter((lp) => lp.status === 'draft').length,
    pendingReview: landingPages.filter((lp) => lp.status === 'pending_review').length,
    missing: landingPages.filter((lp) => lp.status === 'missing').length,
    totalViews30d: landingPages.reduce((s, lp) => s + lp.views30d, 0),
    totalLeads30d: landingPages.reduce((s, lp) => s + lp.leads30d, 0),
    avgConversionRate: (() => {
      const active = landingPages.filter((lp) => lp.views30d > 0)
      if (!active.length) return 0
      return parseFloat((active.reduce((s, lp) => s + lp.conversionRate, 0) / active.length).toFixed(4))
    })(),
  }
}
