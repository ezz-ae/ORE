// Demo data for Google Ads routes — returned (flagged `demo: true`) when
// credentials are not configured, so the UI renders fully populated.

import type {
  GoogleCampaign,
  GoogleKeyword,
  NegativeKeyword,
  GoogleResponsiveSearchAd,
  GoogleAudience,
  GoogleExtension,
  GoogleReportSummary,
  GoogleCampaignType,
} from './types'

const M = 1_000_000 // 1 AED in micros

// ─── Campaigns ─────────────────────────────────────────────────────────────

export const demoCampaigns: GoogleCampaign[] = [
  {
    id: '20100001',
    resourceName: 'customers/1234567890/campaigns/20100001',
    name: 'Palm Jumeirah Investor Search',
    status: 'ENABLED',
    type: 'SEARCH',
    biddingStrategyType: 'TARGET_CPA',
    dailyBudgetMicros: 450 * M,
    targetCpaMicros: 320 * M,
    startDate: '2026-04-01',
    metrics: {
      impressions: 48230,
      clicks: 2114,
      costMicros: 9820 * M,
      conversions: 31,
      conversionsValue: 0,
      ctr: 0.0438,
      averageCpcMicros: 4.65 * M,
      averageCpa: 316.77,
    },
  },
  {
    id: '20100002',
    resourceName: 'customers/1234567890/campaigns/20100002',
    name: 'Dubai Hills PMax',
    status: 'ENABLED',
    type: 'PERFORMANCE_MAX',
    biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
    dailyBudgetMicros: 600 * M,
    startDate: '2026-03-15',
    metrics: {
      impressions: 132540,
      clicks: 3987,
      costMicros: 13400 * M,
      conversions: 54,
      conversionsValue: 0,
      ctr: 0.0301,
      averageCpcMicros: 3.36 * M,
      averageCpa: 248.15,
    },
  },
  {
    id: '20100003',
    resourceName: 'customers/1234567890/campaigns/20100003',
    name: 'Off-Plan Downtown Display Remarketing',
    status: 'ENABLED',
    type: 'DISPLAY',
    biddingStrategyType: 'TARGET_CPA',
    dailyBudgetMicros: 250 * M,
    targetCpaMicros: 200 * M,
    startDate: '2026-04-10',
    metrics: {
      impressions: 289450,
      clicks: 1742,
      costMicros: 4120 * M,
      conversions: 18,
      conversionsValue: 0,
      ctr: 0.0060,
      averageCpcMicros: 2.37 * M,
      averageCpa: 228.89,
    },
  },
  {
    id: '20100004',
    resourceName: 'customers/1234567890/campaigns/20100004',
    name: 'Golden Visa Property Video',
    status: 'ENABLED',
    type: 'VIDEO',
    biddingStrategyType: 'MAXIMIZE_CONVERSIONS',
    dailyBudgetMicros: 300 * M,
    startDate: '2026-05-01',
    metrics: {
      impressions: 521300,
      clicks: 4210,
      costMicros: 5980 * M,
      conversions: 22,
      conversionsValue: 0,
      ctr: 0.0081,
      averageCpcMicros: 1.42 * M,
      averageCpa: 271.82,
    },
  },
  {
    id: '20100005',
    resourceName: 'customers/1234567890/campaigns/20100005',
    name: 'Business Bay Apartments Search',
    status: 'ENABLED',
    type: 'SEARCH',
    biddingStrategyType: 'TARGET_IMPRESSION_SHARE',
    dailyBudgetMicros: 380 * M,
    startDate: '2026-04-20',
    metrics: {
      impressions: 61870,
      clicks: 2456,
      costMicros: 8740 * M,
      conversions: 27,
      conversionsValue: 0,
      ctr: 0.0397,
      averageCpcMicros: 3.56 * M,
      averageCpa: 323.70,
    },
  },
  {
    id: '20100006',
    resourceName: 'customers/1234567890/campaigns/20100006',
    name: 'Dubai Marina Luxury Brand Search',
    status: 'PAUSED',
    type: 'SEARCH',
    biddingStrategyType: 'MANUAL_CPC',
    dailyBudgetMicros: 200 * M,
    startDate: '2026-02-01',
    endDate: '2026-05-31',
    metrics: {
      impressions: 18940,
      clicks: 894,
      costMicros: 3210 * M,
      conversions: 11,
      conversionsValue: 0,
      ctr: 0.0472,
      averageCpcMicros: 3.59 * M,
      averageCpa: 291.82,
    },
  },
]

// ─── Keywords ──────────────────────────────────────────────────────────────

export const demoKeywords: GoogleKeyword[] = [
  {
    id: '30100001', resourceName: 'customers/1234567890/adGroupCriteria/40100001~30100001',
    adGroupId: '40100001', campaignId: '20100001', text: 'buy apartment dubai',
    matchType: 'PHRASE', status: 'ENABLED', qualityScore: 8, approvalStatus: 'APPROVED',
    metrics: { impressions: 12400, clicks: 612, costMicros: 2890 * M, ctr: 0.0494, averageCpcMicros: 4.72 * M, conversions: 9 },
  },
  {
    id: '30100002', resourceName: 'customers/1234567890/adGroupCriteria/40100001~30100002',
    adGroupId: '40100001', campaignId: '20100001', text: 'palm jumeirah villas',
    matchType: 'EXACT', status: 'ENABLED', qualityScore: 9, approvalStatus: 'APPROVED',
    metrics: { impressions: 8230, clicks: 498, costMicros: 2640 * M, ctr: 0.0605, averageCpcMicros: 5.30 * M, conversions: 8 },
  },
  {
    id: '30100003', resourceName: 'customers/1234567890/adGroupCriteria/40100002~30100003',
    adGroupId: '40100002', campaignId: '20100001', text: 'off plan dubai',
    matchType: 'BROAD', status: 'ENABLED', qualityScore: 7, approvalStatus: 'APPROVED',
    metrics: { impressions: 15800, clicks: 421, costMicros: 1620 * M, ctr: 0.0266, averageCpcMicros: 3.85 * M, conversions: 5 },
  },
  {
    id: '30100004', resourceName: 'customers/1234567890/adGroupCriteria/40100003~30100004',
    adGroupId: '40100003', campaignId: '20100005', text: 'business bay apartments for sale',
    matchType: 'PHRASE', status: 'ENABLED', qualityScore: 8, approvalStatus: 'APPROVED',
    metrics: { impressions: 9870, clicks: 387, costMicros: 1410 * M, ctr: 0.0392, averageCpcMicros: 3.64 * M, conversions: 6 },
  },
  {
    id: '30100005', resourceName: 'customers/1234567890/adGroupCriteria/40100003~30100005',
    adGroupId: '40100003', campaignId: '20100005', text: 'dubai marina property',
    matchType: 'PHRASE', status: 'ENABLED', qualityScore: 7, approvalStatus: 'APPROVED',
    metrics: { impressions: 11200, clicks: 356, costMicros: 1290 * M, ctr: 0.0318, averageCpcMicros: 3.62 * M, conversions: 4 },
  },
  {
    id: '30100006', resourceName: 'customers/1234567890/adGroupCriteria/40100004~30100006',
    adGroupId: '40100004', campaignId: '20100001', text: 'dubai real estate investment',
    matchType: 'BROAD', status: 'ENABLED', qualityScore: 6, approvalStatus: 'APPROVED',
    metrics: { impressions: 18600, clicks: 402, costMicros: 1740 * M, ctr: 0.0216, averageCpcMicros: 4.33 * M, conversions: 3 },
  },
  {
    id: '30100007', resourceName: 'customers/1234567890/adGroupCriteria/40100004~30100007',
    adGroupId: '40100004', campaignId: '20100001', text: 'golden visa property dubai',
    matchType: 'EXACT', status: 'ENABLED', qualityScore: 10, approvalStatus: 'APPROVED',
    metrics: { impressions: 6420, clicks: 389, costMicros: 2010 * M, ctr: 0.0606, averageCpcMicros: 5.17 * M, conversions: 7 },
  },
  {
    id: '30100008', resourceName: 'customers/1234567890/adGroupCriteria/40100005~30100008',
    adGroupId: '40100005', campaignId: '20100002', text: 'dubai hills estate villas',
    matchType: 'PHRASE', status: 'ENABLED', qualityScore: 9, approvalStatus: 'APPROVED',
    metrics: { impressions: 7340, clicks: 312, costMicros: 1280 * M, ctr: 0.0425, averageCpcMicros: 4.10 * M, conversions: 5 },
  },
  {
    id: '30100009', resourceName: 'customers/1234567890/adGroupCriteria/40100005~30100009',
    adGroupId: '40100005', campaignId: '20100002', text: 'luxury apartments downtown dubai',
    matchType: 'PHRASE', status: 'ENABLED', qualityScore: 8, approvalStatus: 'APPROVED',
    metrics: { impressions: 8910, clicks: 298, costMicros: 1190 * M, ctr: 0.0334, averageCpcMicros: 3.99 * M, conversions: 4 },
  },
  {
    id: '30100010', resourceName: 'customers/1234567890/adGroupCriteria/40100006~30100010',
    adGroupId: '40100006', campaignId: '20100005', text: 'studio apartment for sale dubai',
    matchType: 'BROAD', status: 'PAUSED', qualityScore: 6, approvalStatus: 'APPROVED',
    metrics: { impressions: 13400, clicks: 241, costMicros: 760 * M, ctr: 0.0180, averageCpcMicros: 3.15 * M, conversions: 2 },
  },
  {
    id: '30100011', resourceName: 'customers/1234567890/adGroupCriteria/40100006~30100011',
    adGroupId: '40100006', campaignId: '20100005', text: 'jvc apartments for sale',
    matchType: 'PHRASE', status: 'ENABLED', qualityScore: 7, approvalStatus: 'APPROVED',
    metrics: { impressions: 6780, clicks: 198, costMicros: 590 * M, ctr: 0.0292, averageCpcMicros: 2.98 * M, conversions: 3 },
  },
  {
    id: '30100012', resourceName: 'customers/1234567890/adGroupCriteria/40100002~30100012',
    adGroupId: '40100002', campaignId: '20100001', text: 'penthouse for sale dubai',
    matchType: 'EXACT', status: 'ENABLED', qualityScore: 9, approvalStatus: 'APPROVED',
    metrics: { impressions: 4120, clicks: 234, costMicros: 1480 * M, ctr: 0.0568, averageCpcMicros: 6.32 * M, conversions: 4 },
  },
]

export const demoNegativeKeywords: NegativeKeyword[] = [
  { id: '50100001', text: 'cheap', matchType: 'BROAD', level: 'campaign', campaignId: '20100001' },
  { id: '50100002', text: 'rent', matchType: 'PHRASE', level: 'campaign', campaignId: '20100001' },
  { id: '50100003', text: 'jobs', matchType: 'BROAD', level: 'campaign', campaignId: '20100005' },
  { id: '50100004', text: 'free', matchType: 'BROAD', level: 'ad_group', campaignId: '20100001', adGroupId: '40100001' },
  { id: '50100005', text: 'salary', matchType: 'PHRASE', level: 'campaign', campaignId: '20100002' },
]

// ─── Ads (RSAs) ────────────────────────────────────────────────────────────

export const demoAds: GoogleResponsiveSearchAd[] = [
  {
    id: '60100001', resourceName: 'customers/1234567890/adGroupAds/40100001~60100001',
    adGroupId: '40100001', campaignId: '20100001', type: 'RESPONSIVE_SEARCH_AD',
    status: 'ENABLED', adStrength: 'EXCELLENT',
    headlines: [
      { text: 'Palm Jumeirah Villas', pinnedField: 'HEADLINE_1' },
      { text: 'Beachfront Living Dubai' },
      { text: 'Invest From AED 5M' },
      { text: 'Book a Private Viewing' },
    ],
    descriptions: [
      { text: 'Exclusive signature villas on the Palm. Direct beach access & private pools.' },
      { text: 'High-yield Dubai property for investors. Flexible payment plans available.' },
    ],
    finalUrls: ['https://example-realty.ae/palm-jumeirah'],
    displayUrl: 'example-realty.ae/Palm',
    metrics: {
      impressions: 14200, clicks: 712, costMicros: 3210 * M, conversions: 11,
      conversionsValue: 0, ctr: 0.0501, averageCpcMicros: 4.51 * M,
    },
  },
  {
    id: '60100002', resourceName: 'customers/1234567890/adGroupAds/40100003~60100002',
    adGroupId: '40100003', campaignId: '20100005', type: 'RESPONSIVE_SEARCH_AD',
    status: 'ENABLED', adStrength: 'GOOD',
    headlines: [
      { text: 'Business Bay Apartments' },
      { text: 'Canal View Residences' },
      { text: 'From AED 1.2M' },
    ],
    descriptions: [
      { text: 'Modern 1 & 2 bed apartments in Business Bay. Handover 2027, pay in stages.' },
      { text: 'Walk to Dubai Mall & Downtown. Strong rental yields for investors.' },
    ],
    finalUrls: ['https://example-realty.ae/business-bay'],
    displayUrl: 'example-realty.ae/BusinessBay',
    metrics: {
      impressions: 9870, clicks: 412, costMicros: 1490 * M, conversions: 7,
      conversionsValue: 0, ctr: 0.0417, averageCpcMicros: 3.62 * M,
    },
  },
  {
    id: '60100003', resourceName: 'customers/1234567890/adGroupAds/40100004~60100003',
    adGroupId: '40100004', campaignId: '20100001', type: 'RESPONSIVE_SEARCH_AD',
    status: 'ENABLED', adStrength: 'EXCELLENT',
    headlines: [
      { text: 'Golden Visa Property', pinnedField: 'HEADLINE_1' },
      { text: '10-Year UAE Residency' },
      { text: 'Qualify From AED 2M' },
      { text: 'Free Eligibility Check' },
    ],
    descriptions: [
      { text: 'Secure your 10-year Golden Visa with a qualifying Dubai property purchase.' },
      { text: 'Our advisors handle the full process. Speak to a specialist today.' },
    ],
    finalUrls: ['https://example-realty.ae/golden-visa'],
    displayUrl: 'example-realty.ae/GoldenVisa',
    metrics: {
      impressions: 6420, clicks: 389, costMicros: 2010 * M, conversions: 8,
      conversionsValue: 0, ctr: 0.0606, averageCpcMicros: 5.17 * M,
    },
  },
  {
    id: '60100004', resourceName: 'customers/1234567890/adGroupAds/40100005~60100004',
    adGroupId: '40100005', campaignId: '20100002', type: 'RESPONSIVE_SEARCH_AD',
    status: 'ENABLED', adStrength: 'AVERAGE',
    headlines: [
      { text: 'Dubai Hills Estate' },
      { text: 'Family Villas & Townhomes' },
      { text: 'Golf Course Community' },
    ],
    descriptions: [
      { text: 'Spacious family homes in Dubai Hills. Parks, schools & golf at your door.' },
      { text: 'Limited release now selling. Register interest for the latest prices.' },
    ],
    finalUrls: ['https://example-realty.ae/dubai-hills'],
    displayUrl: 'example-realty.ae/DubaiHills',
    metrics: {
      impressions: 7340, clicks: 268, costMicros: 1100 * M, conversions: 4,
      conversionsValue: 0, ctr: 0.0365, averageCpcMicros: 4.10 * M,
    },
  },
  {
    id: '60100005', resourceName: 'customers/1234567890/adGroupAds/40100002~60100005',
    adGroupId: '40100002', campaignId: '20100001', type: 'RESPONSIVE_SEARCH_AD',
    status: 'ENABLED', adStrength: 'GOOD',
    headlines: [
      { text: 'Off-Plan Dubai Property' },
      { text: 'Pay 20% On Booking' },
      { text: 'Post-Handover Plans' },
    ],
    descriptions: [
      { text: 'New launches across Dubai with flexible post-handover payment plans.' },
      { text: 'Get the full project brochure & floor plans. No obligation.' },
    ],
    finalUrls: ['https://example-realty.ae/off-plan'],
    displayUrl: 'example-realty.ae/OffPlan',
    metrics: {
      impressions: 15800, clicks: 421, costMicros: 1620 * M, conversions: 5,
      conversionsValue: 0, ctr: 0.0266, averageCpcMicros: 3.85 * M,
    },
  },
  {
    id: '60100006', resourceName: 'customers/1234567890/adGroupAds/40100006~60100006',
    adGroupId: '40100006', campaignId: '20100005', type: 'RESPONSIVE_SEARCH_AD',
    status: 'PAUSED', adStrength: 'POOR',
    headlines: [
      { text: 'JVC Apartments Dubai' },
      { text: 'Affordable Investor Units' },
    ],
    descriptions: [
      { text: 'Studios & 1-beds in Jumeirah Village Circle. High rental demand area.' },
    ],
    finalUrls: ['https://example-realty.ae/jvc'],
    displayUrl: 'example-realty.ae/JVC',
    metrics: {
      impressions: 6780, clicks: 198, costMicros: 590 * M, conversions: 3,
      conversionsValue: 0, ctr: 0.0292, averageCpcMicros: 2.98 * M,
    },
  },
]

// ─── Audiences ─────────────────────────────────────────────────────────────

export const demoAudiences: GoogleAudience[] = [
  {
    id: '70100001', resourceName: 'customers/1234567890/userLists/70100001',
    name: 'CRM — Past Buyers (Customer Match)', type: 'CUSTOMER_MATCH', status: 'OPEN',
    size: 8420, matchRate: 0.71, description: 'Uploaded list of previous property buyers.',
  },
  {
    id: '70100002', resourceName: 'customers/1234567890/userLists/70100002',
    name: 'In-Market: Real Estate & Property', type: 'IN_MARKET', status: 'OPEN',
    size: 1240000, description: 'Users actively researching property purchases.',
  },
  {
    id: '70100003', resourceName: 'customers/1234567890/userLists/70100003',
    name: 'Affinity: Luxury Shoppers', type: 'AFFINITY', status: 'OPEN',
    size: 2860000, description: 'Audiences with affinity for luxury goods & lifestyle.',
  },
  {
    id: '70100004', resourceName: 'customers/1234567890/userLists/70100004',
    name: 'Website Visitors — 30 Day (Remarketing)', type: 'REMARKETING', status: 'OPEN',
    size: 24600, description: 'All visitors in the last 30 days.',
  },
  {
    id: '70100005', resourceName: 'customers/1234567890/userLists/70100005',
    name: 'Lead Form Submitters (Remarketing)', type: 'REMARKETING', status: 'OPEN',
    size: 3180, description: 'Visitors who submitted a lead form but did not convert.',
  },
  {
    id: '70100006', resourceName: 'customers/1234567890/userLists/70100006',
    name: 'Similar to Past Buyers', type: 'SIMILAR_AUDIENCE', status: 'OPEN',
    size: 412000, description: 'Lookalike of the Customer Match buyer list.',
  },
  {
    id: '70100007', resourceName: 'customers/1234567890/userLists/70100007',
    name: 'In-Market: Luxury Apartments Dubai', type: 'IN_MARKET', status: 'OPEN',
    size: 186000, description: 'In-market for high-end residential property.',
  },
  {
    id: '70100008', resourceName: 'customers/1234567890/userLists/70100008',
    name: 'Investor + High Income (Combined)', type: 'COMBINED', status: 'CLOSED',
    size: 54000, description: 'In-market real estate intersected with high household income.',
  },
]

// ─── Extensions ────────────────────────────────────────────────────────────

export const demoExtensions: GoogleExtension[] = [
  {
    type: 'SITELINK', id: '80100001', linkText: 'Off-Plan Projects',
    description1: 'New launches across Dubai', description2: 'Flexible payment plans',
    finalUrls: ['https://example-realty.ae/off-plan'],
  },
  {
    type: 'SITELINK', id: '80100002', linkText: 'Golden Visa',
    description1: '10-year UAE residency', description2: 'Check your eligibility',
    finalUrls: ['https://example-realty.ae/golden-visa'],
  },
  {
    type: 'SITELINK', id: '80100003', linkText: 'Book a Viewing',
    description1: 'Private tours available', description2: 'Speak to an advisor',
    finalUrls: ['https://example-realty.ae/contact'],
  },
  {
    type: 'CALLOUT', id: '80100004', calloutText: 'No Commission Off-Plan',
  },
  {
    type: 'CALLOUT', id: '80100005', calloutText: 'RERA Certified Agents',
  },
  {
    type: 'CALLOUT', id: '80100006', calloutText: 'Free Investment Consultation',
  },
  {
    type: 'CALL', id: '80100007', phoneNumber: '+97144000000', countryCode: 'AE', callOnly: false,
  },
  {
    type: 'LOCATION', id: '80100008', businessName: 'Example Realty',
    addressLine1: 'Boulevard Plaza Tower 1', city: 'Dubai', countryCode: 'AE',
  },
  {
    type: 'LEAD_FORM', id: '80100009', headline: 'Get Dubai Property Prices',
    description: 'Receive the latest off-plan price list & floor plans by email.',
    businessName: 'Example Realty',
    fields: ['FULL_NAME', 'EMAIL', 'PHONE'], callToActionType: 'GET_QUOTE',
  },
]

// ─── Report Summary ──────────────────────────────────────────────────────────

export function demoReport(range: '7d' | '30d' | '90d'): GoogleReportSummary {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90

  // Build per-day rows with mild variance.
  const byDay = Array.from({ length: days }, (_, i) => {
    const idx = days - 1 - i
    const d = new Date('2026-06-07T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - idx)
    const weekend = [5, 6].includes(d.getUTCDay())
    const base = weekend ? 0.78 : 1
    const wobble = 0.85 + ((i * 37) % 30) / 100 // 0.85–1.14, deterministic
    const impressions = Math.round(38000 * base * wobble)
    const clicks = Math.round(1450 * base * wobble)
    const conversions = Math.round(18 * base * wobble)
    const costMicros = Math.round(6200 * base * wobble) * M
    return {
      date: d.toISOString().slice(0, 10),
      impressions,
      clicks,
      costMicros,
      conversions,
    }
  })

  const totalImpressions = byDay.reduce((s, r) => s + r.impressions, 0)
  const totalClicks = byDay.reduce((s, r) => s + r.clicks, 0)
  const totalConversions = byDay.reduce((s, r) => s + r.conversions, 0)
  const totalCostMicros = byDay.reduce((s, r) => s + r.costMicros, 0)
  const avgCtr = totalImpressions ? totalClicks / totalImpressions : 0
  const avgCpcMicros = totalClicks ? Math.round(totalCostMicros / totalClicks) : 0

  const byDevice: GoogleReportSummary['byDevice'] = [
    {
      device: 'MOBILE',
      impressions: Math.round(totalImpressions * 0.62),
      clicks: Math.round(totalClicks * 0.66),
      conversions: Math.round(totalConversions * 0.58),
      costMicros: Math.round(totalCostMicros * 0.6),
    },
    {
      device: 'DESKTOP',
      impressions: Math.round(totalImpressions * 0.31),
      clicks: Math.round(totalClicks * 0.28),
      conversions: Math.round(totalConversions * 0.36),
      costMicros: Math.round(totalCostMicros * 0.33),
    },
    {
      device: 'TABLET',
      impressions: Math.round(totalImpressions * 0.07),
      clicks: Math.round(totalClicks * 0.06),
      conversions: Math.round(totalConversions * 0.06),
      costMicros: Math.round(totalCostMicros * 0.07),
    },
  ]

  const byCampaign: GoogleReportSummary['byCampaign'] = demoCampaigns.map((c) => ({
    campaignId: c.id,
    name: c.name,
    type: c.type as GoogleCampaignType,
    impressions: c.metrics?.impressions ?? 0,
    clicks: c.metrics?.clicks ?? 0,
    conversions: c.metrics?.conversions ?? 0,
    costMicros: c.metrics?.costMicros ?? 0,
  }))

  return {
    dateRange: range,
    totalImpressions,
    totalClicks,
    totalCostMicros,
    totalConversions,
    avgCtr,
    avgCpcMicros,
    byDay,
    byDevice,
    byCampaign,
    searchTerms: [
      { searchTerm: 'buy 2 bed apartment palm jumeirah', matchType: 'PHRASE', adGroupName: 'Palm — Apartments', campaignName: 'Palm Jumeirah Investor Search', impressions: 3120, clicks: 184, ctr: 0.059, costMicros: 920 * M, conversions: 4, status: 'ADDED' },
      { searchTerm: 'dubai hills villa price', matchType: 'PHRASE', adGroupName: 'Dubai Hills — Villas', campaignName: 'Dubai Hills PMax', impressions: 2740, clicks: 142, ctr: 0.0518, costMicros: 610 * M, conversions: 3, status: 'NONE' },
      { searchTerm: 'golden visa dubai property requirements', matchType: 'BROAD', adGroupName: 'Golden Visa', campaignName: 'Palm Jumeirah Investor Search', impressions: 1980, clicks: 156, ctr: 0.0788, costMicros: 810 * M, conversions: 5, status: 'ADDED' },
      { searchTerm: 'cheap flats dubai', matchType: 'BROAD', adGroupName: 'Business Bay', campaignName: 'Business Bay Apartments Search', impressions: 1420, clicks: 38, ctr: 0.0268, costMicros: 110 * M, conversions: 0, status: 'EXCLUDED' },
      { searchTerm: 'business bay studio for sale', matchType: 'EXACT', adGroupName: 'Business Bay', campaignName: 'Business Bay Apartments Search', impressions: 1180, clicks: 71, ctr: 0.0602, costMicros: 260 * M, conversions: 2, status: 'NONE' },
      { searchTerm: 'off plan downtown dubai 2027', matchType: 'BROAD', adGroupName: 'Off-Plan', campaignName: 'Palm Jumeirah Investor Search', impressions: 2210, clicks: 88, ctr: 0.0398, costMicros: 340 * M, conversions: 1, status: 'NONE' },
    ],
    auctionInsights: [
      { domain: 'You', impressionShare: 0.42, overlapRate: 1, positionAboveRate: 0, topOfPageRate: 0.71, absoluteTopRate: 0.38 },
      { domain: 'bayut.com', impressionShare: 0.58, overlapRate: 0.49, positionAboveRate: 0.55, topOfPageRate: 0.82, absoluteTopRate: 0.51 },
      { domain: 'propertyfinder.ae', impressionShare: 0.51, overlapRate: 0.44, positionAboveRate: 0.48, topOfPageRate: 0.78, absoluteTopRate: 0.46 },
      { domain: 'emaar.com', impressionShare: 0.33, overlapRate: 0.27, positionAboveRate: 0.39, topOfPageRate: 0.69, absoluteTopRate: 0.41 },
      { domain: 'damacproperties.com', impressionShare: 0.29, overlapRate: 0.22, positionAboveRate: 0.34, topOfPageRate: 0.64, absoluteTopRate: 0.33 },
    ],
  }
}
