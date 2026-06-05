// Google Ads API v16 — core types

export type GoogleCampaignStatus = 'ENABLED' | 'PAUSED' | 'REMOVED'
export type GoogleCampaignType =
  | 'SEARCH'
  | 'DISPLAY'
  | 'PERFORMANCE_MAX'
  | 'VIDEO'
  | 'SHOPPING'

export type GoogleBiddingStrategy =
  | 'TARGET_CPA'
  | 'MAXIMIZE_CONVERSIONS'
  | 'TARGET_ROAS'
  | 'MAXIMIZE_CONVERSION_VALUE'
  | 'MANUAL_CPC'
  | 'TARGET_IMPRESSION_SHARE'

export type GoogleKeywordMatchType = 'BROAD' | 'PHRASE' | 'EXACT'

export type GoogleAdType =
  | 'RESPONSIVE_SEARCH_AD'
  | 'RESPONSIVE_DISPLAY_AD'
  | 'EXPANDED_TEXT_AD'
  | 'PERFORMANCE_MAX_AD'

export type GoogleAdStrength = 'PENDING' | 'POOR' | 'AVERAGE' | 'GOOD' | 'EXCELLENT'

export type GoogleAudienceType =
  | 'CUSTOMER_MATCH'
  | 'IN_MARKET'
  | 'AFFINITY'
  | 'REMARKETING'
  | 'SIMILAR_AUDIENCE'
  | 'COMBINED'

export type GoogleExtensionType =
  | 'SITELINK'
  | 'CALLOUT'
  | 'CALL'
  | 'LOCATION'
  | 'LEAD_FORM'
  | 'STRUCTURED_SNIPPET'

// ─── Campaign ───────────────────────────────────────────────────────────────

export interface GoogleCampaign {
  id: string
  resourceName: string
  name: string
  status: GoogleCampaignStatus
  type: GoogleCampaignType
  biddingStrategyType: GoogleBiddingStrategy
  /** Micros (1 AED = 1_000_000 micros) */
  dailyBudgetMicros: number
  targetCpaMicros?: number
  targetRoas?: number
  startDate?: string
  endDate?: string
  metrics?: GoogleCampaignMetrics
}

export interface GoogleCampaignMetrics {
  impressions: number
  clicks: number
  costMicros: number
  conversions: number
  conversionsValue: number
  ctr: number
  averageCpcMicros: number
  averageCpa?: number
}

// ─── Ad Group ────────────────────────────────────────────────────────────────

export interface GoogleAdGroup {
  id: string
  resourceName: string
  campaignId: string
  name: string
  status: GoogleCampaignStatus
  type: 'STANDARD' | 'DISPLAY_STANDARD' | 'SHOPPING_PRODUCT' | 'HOTEL' | 'UNKNOWN'
  cpcBidMicros?: number
  metrics?: GoogleCampaignMetrics
}

// ─── Keyword ─────────────────────────────────────────────────────────────────

export interface GoogleKeyword {
  id: string
  resourceName: string
  adGroupId: string
  campaignId: string
  text: string
  matchType: GoogleKeywordMatchType
  status: GoogleCampaignStatus
  qualityScore?: number
  approvalStatus?: string
  metrics?: {
    impressions: number
    clicks: number
    costMicros: number
    ctr: number
    averageCpcMicros: number
    conversions: number
  }
}

export interface NegativeKeyword {
  id: string
  text: string
  matchType: GoogleKeywordMatchType
  level: 'campaign' | 'ad_group'
  campaignId: string
  adGroupId?: string
}

// ─── Ads ─────────────────────────────────────────────────────────────────────

export interface GoogleResponsiveSearchAd {
  id: string
  resourceName: string
  adGroupId: string
  campaignId: string
  type: 'RESPONSIVE_SEARCH_AD'
  status: GoogleCampaignStatus
  adStrength: GoogleAdStrength
  headlines: { text: string; pinnedField?: 'HEADLINE_1' | 'HEADLINE_2' | 'HEADLINE_3' }[]
  descriptions: { text: string; pinnedField?: 'DESCRIPTION_1' | 'DESCRIPTION_2' }[]
  finalUrls: string[]
  displayUrl?: string
  metrics?: GoogleCampaignMetrics
}

export interface GoogleAssetGroup {
  id: string
  resourceName: string
  campaignId: string
  name: string
  status: GoogleCampaignStatus
  adStrength: GoogleAdStrength
  headlines: string[]
  longHeadlines: string[]
  descriptions: string[]
  images: string[]
  logos: string[]
  finalUrls: string[]
}

export type GoogleAd = GoogleResponsiveSearchAd | (GoogleAssetGroup & { type: 'PERFORMANCE_MAX_AD' })

// ─── Audience ────────────────────────────────────────────────────────────────

export interface GoogleAudience {
  id: string
  resourceName: string
  name: string
  type: GoogleAudienceType
  status: 'OPEN' | 'CLOSED'
  size?: number
  description?: string
  matchRate?: number
}

// ─── Extensions ──────────────────────────────────────────────────────────────

export interface GoogleSitelinkExtension {
  type: 'SITELINK'
  id: string
  linkText: string
  description1?: string
  description2?: string
  finalUrls: string[]
}

export interface GoogleCalloutExtension {
  type: 'CALLOUT'
  id: string
  calloutText: string
}

export interface GoogleCallExtension {
  type: 'CALL'
  id: string
  phoneNumber: string
  countryCode: string
  callOnly: boolean
}

export interface GoogleLocationExtension {
  type: 'LOCATION'
  id: string
  businessName: string
  addressLine1: string
  city: string
  countryCode: string
}

export interface GoogleLeadFormExtension {
  type: 'LEAD_FORM'
  id: string
  headline: string
  description: string
  businessName: string
  fields: string[]
  callToActionType: string
}

export type GoogleExtension =
  | GoogleSitelinkExtension
  | GoogleCalloutExtension
  | GoogleCallExtension
  | GoogleLocationExtension
  | GoogleLeadFormExtension

// ─── Reports ─────────────────────────────────────────────────────────────────

export interface SearchTermRow {
  searchTerm: string
  matchType: string
  adGroupName: string
  campaignName: string
  impressions: number
  clicks: number
  ctr: number
  costMicros: number
  conversions: number
  status: 'NONE' | 'ADDED' | 'EXCLUDED' | 'ADDED_EXCLUDED'
}

export interface AuctionInsightRow {
  domain: string
  impressionShare: number
  overlapRate: number
  positionAboveRate: number
  topOfPageRate: number
  absoluteTopRate: number
}

export interface GoogleReportSummary {
  dateRange: '7d' | '30d' | '90d'
  totalImpressions: number
  totalClicks: number
  totalCostMicros: number
  totalConversions: number
  avgCtr: number
  avgCpcMicros: number
  searchTerms: SearchTermRow[]
  auctionInsights: AuctionInsightRow[]
  byDay: { date: string; impressions: number; clicks: number; costMicros: number; conversions: number }[]
  byDevice: { device: 'DESKTOP' | 'MOBILE' | 'TABLET'; impressions: number; clicks: number; conversions: number; costMicros: number }[]
  byCampaign: { campaignId: string; name: string; type: GoogleCampaignType; impressions: number; clicks: number; conversions: number; costMicros: number }[]
}

// ─── API payloads ────────────────────────────────────────────────────────────

export interface LaunchGoogleCampaignPayload {
  listingId: string
  listingName: string
  area: string
  campaignName: string
  type: GoogleCampaignType
  biddingStrategy: GoogleBiddingStrategy
  dailyBudgetAED: number
  targetCpaAED?: number
  targetRoas?: number
  keywords?: { text: string; matchType: GoogleKeywordMatchType }[]
  keywordThemeIds?: string[]
  finalUrl: string
  headlines: string[]
  descriptions: string[]
  startDate?: string
  endDate?: string
}

export interface GenerateRsaPayload {
  listingId: string
  listingName: string
  area: string
  developer: string
  startingPrice: number | null
  paymentPlan: string | null
  angle: 'investor' | 'end_user' | 'golden_visa' | 'urgency' | 'yield' | 'lifestyle'
  tone: 'direct' | 'aspirational' | 'premium'
}

export interface GeneratedRsaVariant {
  id: string
  headlines: string[]
  descriptions: string[]
  note: string
}

// ─── Config error ────────────────────────────────────────────────────────────

export class GoogleConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleConfigError'
  }
}

export class GoogleApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'GoogleApiError'
  }
}
