// Meta Marketing API v20.0 — core types

export type MetaCampaignStatus = 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED'
export type MetaCampaignObjective =
  | 'LEAD_GENERATION'
  | 'LINK_CLICKS'
  | 'CONVERSIONS'
  | 'BRAND_AWARENESS'
  | 'REACH'
  | 'VIDEO_VIEWS'

export type MetaOptimizationGoal =
  | 'LEAD_GENERATION'
  | 'LINK_CLICKS'
  | 'LANDING_PAGE_VIEWS'
  | 'IMPRESSIONS'
  | 'REACH'
  | 'OFFSITE_CONVERSIONS'

export type MetaCta =
  | 'LEARN_MORE'
  | 'SIGN_UP'
  | 'GET_QUOTE'
  | 'CONTACT_US'
  | 'BOOK_NOW'
  | 'APPLY_NOW'
  | 'DOWNLOAD'

export interface MetaCampaign {
  id: string
  name: string
  status: MetaCampaignStatus
  objective: MetaCampaignObjective
  /** In smallest currency unit (e.g. fils for AED). 50000 = AED 500 */
  daily_budget?: string
  created_time: string
  start_time?: string
  stop_time?: string
}

export interface MetaInsightActions {
  action_type: string
  value: string
}

export interface MetaInsights {
  impressions: string
  clicks: string
  spend: string
  actions?: MetaInsightActions[]
  cpc?: string
  cpm?: string
  cpp?: string
  date_start: string
  date_stop: string
}

export interface MetaAdSet {
  id: string
  name: string
  status: MetaCampaignStatus
  daily_budget: string
  optimization_goal: MetaOptimizationGoal
  billing_event: string
  targeting?: Record<string, unknown>
}

export interface MetaAdCreative {
  id: string
  name: string
}

export interface MetaAd {
  id: string
  name: string
  status: MetaCampaignStatus
  creative?: MetaAdCreative
}

export interface MetaApiErrorDetail {
  message: string
  type: string
  code: number
  fbtrace_id?: string
}

export interface MetaApiResponse<T> {
  data?: T[]
  error?: MetaApiErrorDetail
  id?: string
  success?: boolean
}

// Internal types for the wizard / UI

export interface CampaignTargeting {
  countries: string[]
  cityKeys: string[]
  ageMin: number
  ageMax: number
  publisherPlatforms: string[]
  interests: { id: string; name: string }[]
}

export interface CampaignCreative {
  primaryText: string
  headline: string
  description: string
  landingUrl: string
  cta: MetaCta
  imageUrl?: string
}

export interface LaunchCampaignPayload {
  campaignName: string
  objective: MetaCampaignObjective
  listingId: string
  listingName: string
  dailyBudgetAED: number
  targeting: CampaignTargeting
  creative: CampaignCreative
  launchStatus: 'ACTIVE' | 'PAUSED'
}

export interface LaunchCampaignResult {
  campaignId: string
  adSetId: string
  adId: string
  creativeId: string
  status: 'ACTIVE' | 'PAUSED'
}

// ─── Lead Gen Forms ───────────────────────────────────────────────────────────

export type MetaFormQuestionType =
  | 'FULL_NAME'
  | 'PHONE'
  | 'EMAIL'
  | 'CITY'
  | 'STATE'
  | 'COUNTRY'
  | 'CUSTOM'
  | 'WORK_EMAIL'
  | 'COMPANY_NAME'

export interface MetaFormQuestion {
  type: MetaFormQuestionType
  key?: string
  label?: string
  options?: { value: string; label: string }[]
}

export interface MetaLeadForm {
  id: string
  name: string
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED'
  leads_count: number
  created_time: string
  locale?: string
  follow_up_action_url?: string
  questions?: { type: string; label: string; id: string }[]
}

export interface MetaFormLead {
  id: string
  created_time: string
  field_data: { name: string; values: string[] }[]
  ad_id?: string
  adset_id?: string
  campaign_id?: string
}

export interface CreateLeadFormPayload {
  name: string
  listingId: string
  listingName: string
  landingUrl: string
  questions: MetaFormQuestion[]
  privacyPolicyUrl: string
  thankYouTitle?: string
  thankYouBody?: string
}

// ─── Creatives ────────────────────────────────────────────────────────────────

export interface MetaAdCreativeDetail {
  id: string
  name: string
  status?: string
  body?: string
  title?: string
  object_story_spec?: {
    link_data?: {
      link?: string
      message?: string
      name?: string
      description?: string
      picture?: string
      call_to_action?: { type: string }
    }
  }
}

// ─── Targeting Templates ──────────────────────────────────────────────────────

export type TargetingUseCase =
  | 'investor'
  | 'end_user'
  | 'golden_visa'
  | 'secondary'
  | 'international'
  | 'custom'

export interface TargetingTemplate {
  id: string
  name: string
  description: string
  audience: string
  estimatedReach: string
  useCase: TargetingUseCase
  targeting: CampaignTargeting
}

// ─── Creative Generation ──────────────────────────────────────────────────────

export type CreativeAngle = 'investor' | 'end_user' | 'golden_visa' | 'urgency' | 'yield' | 'lifestyle'
export type CreativeTone  = 'direct' | 'aspirational' | 'premium'

export interface GenerateCreativePayload {
  listingId: string
  listingName: string
  area: string
  developer: string
  startingPrice: number | null
  paymentPlan: string | null
  angle: CreativeAngle
  tone: CreativeTone
  cta: MetaCta
}

export interface GeneratedCreativeVariant {
  id: string
  primaryText: string
  headline: string
  description: string
  cta: MetaCta
}
