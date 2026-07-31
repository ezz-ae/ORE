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
  | 'QUALITY_CALL'

/**
 * Meta ad_format values accepted by the Graph `generatepreviews` endpoint —
 * the placements we render a live preview for. A subset of Meta's full list,
 * covering the surfaces this app targets.
 */
export type MetaAdFormat =
  | 'MOBILE_FEED_STANDARD'
  | 'INSTAGRAM_STANDARD'
  | 'INSTAGRAM_STORY'
  | 'FACEBOOK_STORY_MOBILE'
  | 'DESKTOP_FEED_STANDARD'

export type MetaCta =
  | 'LEARN_MORE'
  | 'SIGN_UP'
  | 'GET_QUOTE'
  | 'CONTACT_US'
  | 'BOOK_NOW'
  | 'APPLY_NOW'
  | 'DOWNLOAD'
  | 'WHATSAPP_MESSAGE'
  | 'CALL_NOW'

/** Where a click/submit on the ad goes. 'form' = Meta instant form (on-ad). */
export type AdDestination = 'landing' | 'form' | 'whatsapp' | 'phone'

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

export type MetaCampaignWithInsights = MetaCampaign & { insights: MetaInsights | null }

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

/** One id+name entry from Meta's live targeting vocabulary. */
export interface TargetingEntity {
  id: string
  name: string
}

export interface CampaignTargeting {
  countries: string[]
  cityKeys: string[]
  ageMin: number
  ageMax: number
  publisherPlatforms: string[]
  interests: TargetingEntity[]
  /** Meta gender codes: 1 = men, 2 = women. Omitted / empty = all genders. */
  genders?: number[]
  /** Meta locale (language) keys from the adlocale vocabulary. Empty = all. */
  locales?: number[]
  /** Behavioral segments from Meta's live vocabulary (expats, frequent travellers…). */
  behaviors?: TargetingEntity[]
  /**
   * AND-narrowing: a person must match the base interests/behaviors AND at
   * least one entry of EVERY group (Meta flexible_spec semantics). This is
   * what makes an audience genuinely narrow instead of a bag of interests.
   */
  narrowing?: Array<{ interests?: TargetingEntity[]; behaviors?: TargetingEntity[] }>
  /** People to exclude (e.g. real-estate agents when advertising to buyers). */
  exclusions?: { interests?: TargetingEntity[]; behaviors?: TargetingEntity[] }
  /** Meta Custom/Lookalike audience ids to include (from the Audiences tab). */
  customAudienceIds?: string[]
}

/** A Meta ad locale (language) from the live adlocale search vocabulary. */
export interface MetaLocale {
  key: number
  name: string
}

/**
 * The 5 placement surfaces the campaign wizard lets an operator preview and
 * (for landing-click ads) customize creative for. Maps 1:1 to Meta's
 * publisher_platforms + facebook_positions/instagram_positions targeting
 * vocabulary — see PLACEMENT_TARGETING in lib/meta/client.ts.
 */
export type PlacementKey = 'fbFeed' | 'igFeed' | 'igStory' | 'fbStory' | 'reels'

/**
 * A per-placement creative override. Every field is optional — a blank field
 * inherits the matching field from the ad's default CampaignCreative below.
 * An override with every field blank is equivalent to no override at all.
 */
export interface PlacementCreativeOverride {
  headline?: string
  primaryText?: string
  /** External image URL (fallback) — used only when imageHash is absent. */
  imageUrl?: string
  /** Meta ad-account image hash from an uploaded file (preferred). */
  imageHash?: string
}

export interface CampaignCreative {
  primaryText: string
  headline: string
  description: string
  landingUrl: string
  cta: MetaCta
  /** External image URL (fallback) — used only when imageHash is absent. */
  imageUrl?: string
  /** Meta ad-account image hash from an uploaded file (preferred). */
  imageHash?: string
  /**
   * Meta's real "Multiple text options" / dynamic-creative feature — Meta
   * auto-tests combinations of these headlines/descriptions within this ONE
   * ad (not several separate ads). When either array has MORE THAN ONE
   * entry, createAdCreative builds a real asset_feed_spec instead of the
   * classic single object_story_spec. Absent, empty, or a single entry each
   * is the exact backward-compatible single-creative path — callers that
   * only know the singular `headline`/`description` fields (e.g. the
   * coordinator agent tools) simply never set these and behave unchanged.
   * `headline`/`description` above should still carry `headlines[0]` /
   * `descriptions[0]` for any single-value context.
   */
  headlines?: string[]
  /** See `headlines` above. */
  descriptions?: string[]
  /**
   * Per-placement creative overrides (image / headline / primary text).
   * Applied for 'landing' (via Meta's asset_feed_spec, one ad) and 'form'
   * (via a separate single-creative ad set per customized placement — Meta
   * restricts the asset_feed_spec field needed to carry a lead_gen_form_id
   * to internal/Special-Ad-Category apps, so lead ads can't use the same
   * single-ad mechanism). WhatsApp / call ads always use the default
   * creative above. Blank/absent = every placement uses the default creative.
   */
  placementOverrides?: Partial<Record<PlacementKey, PlacementCreativeOverride>>
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
  /** Optional conversion pixel to optimize on. Overrides the account default. */
  pixelId?: string
  /** Set automatically by the server when a broker creates a campaign */
  brokerId?: string
  /** Where a click/submit goes. Defaults to 'landing' (the landingUrl). */
  destination?: AdDestination
  /** Meta instant-form id — REQUIRED when destination is 'form' (lead ads). */
  leadFormId?: string
  /** E.164 phone number — required for 'whatsapp' / 'phone' destinations. */
  destinationPhone?: string
  /** Lifetime spend ceiling in AED — becomes the Meta campaign spend_cap. */
  lifetimeCapAED?: number
  /** Cost-per-result ceiling in AED — becomes a COST_CAP bid on the ad set. */
  cplCapAED?: number
  /**
   * Placement targeting mode. 'automatic' (or omitted — the default, and what
   * every existing caller sends today) keeps createAdSet's current
   * publisherPlatforms-derived placement behavior unchanged. 'manual'
   * restricts delivery to exactly the surfaces listed in manualPlacements.
   */
  placementMode?: 'automatic' | 'manual'
  /**
   * PlacementKey values (fbFeed/igFeed/igStory/fbStory/reels) to run on when
   * placementMode is 'manual'. Ignored when placementMode is 'automatic' (or
   * omitted) or when this is empty.
   */
  manualPlacements?: string[]
  /** Autopilot policy for THIS campaign: act / record-for-approval / skip. */
  autoEnhance?: 'on' | 'approval' | 'off'
  /**
   * Lead-language codes ('en' | 'ar' | 'ru') to narrow delivery to people
   * whose Facebook locale matches — the same three languages the /lp landing
   * pages actually serve. Resolved server-side to Meta's numeric locale IDs
   * via the live adlocale search (Meta publishes no stable static ID table),
   * then merged into targeting_spec.locales. Omitted (or all three) = no
   * language narrowing, today's unchanged behavior.
   */
  leadLanguages?: string[]
}

/** A Meta conversion pixel on the connected ad account. */
export interface MetaPixel {
  id: string
  name: string
  /** ISO timestamp of the last event the pixel received, if any. */
  lastFiredTime?: string | null
}

export interface LaunchCampaignResult {
  campaignId: string
  adSetId: string
  adId: string
  creativeId: string
  status: 'ACTIVE' | 'PAUSED'
  /**
   * Present only when a lead-form launch had per-placement creative overrides
   * — one entry per ad set actually created (one per customized placement,
   * plus a `placementKey: null` entry for the remaining/untouched placements
   * if any). `adSetId`/`adId`/`creativeId` above mirror the first entry here.
   */
  placementAdSets?: Array<{
    placementKey: PlacementKey | null
    adSetId: string
    adId: string
    creativeId: string
    dailyBudgetAED: number
  }>
}

// ─── Lead Gen Forms ───────────────────────────────────────────────────────────

// The Meta prefill catalog relevant to real estate — every value here is a
// documented `questions[].type` enum member of POST /{page}/leadgen_forms
// (verified against Meta's leadgen_forms reference; the full enum also holds
// auto/ID types like VIN or ID_CPF that make no sense for property leads).
export type MetaFormQuestionType =
  | 'FULL_NAME'
  | 'FIRST_NAME'
  | 'LAST_NAME'
  | 'PHONE'
  | 'EMAIL'
  | 'WORK_EMAIL'
  | 'WORK_PHONE_NUMBER'
  | 'CITY'
  | 'STATE'
  | 'ZIP'
  | 'COUNTRY'
  | 'COMPANY_NAME'
  | 'JOB_TITLE'
  | 'DOB'
  | 'GENDER'
  | 'CUSTOM'

export interface MetaFormQuestion {
  type: MetaFormQuestionType
  key?: string
  label?: string
  options?: { value: string; label: string }[]
}

/** Thank-you-page button variants this platform supports (subset of Meta's
 *  enum — the three that make sense for property leads). Each carries its own
 *  required companion field: VIEW_WEBSITE/DOWNLOAD → website_url,
 *  CALL_BUSINESS → business_phone_number (+ country_code). */
export type ThankYouButtonType = 'VIEW_WEBSITE' | 'CALL_BUSINESS' | 'DOWNLOAD'

/** Meta context card — the optional intro screen shown before the questions.
 *  Note: a cover PHOTO on the card requires a separate page-photo upload flow
 *  (context_card takes a photo id, not a URL) — deliberately not implemented,
 *  so the card here is text-only. */
export interface FormContextCard {
  title: string
  /** LIST_STYLE renders `content` as bullets, PARAGRAPH_STYLE as prose. */
  style?: 'LIST_STYLE' | 'PARAGRAPH_STYLE'
  content: string[]
  buttonText?: string
}

export interface MetaLeadForm {
  id: string
  name: string
  // Meta also returns DRAFT (created but not yet attached to a live ad) and
  // PAUSED — plus whatever it adds next. The fallback keeps unknown statuses
  // representable so the UI can render them honestly instead of mislabeling
  // them "deleted".
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED' | 'DRAFT' | 'PAUSED' | (string & {})
  leads_count: number
  created_time: string
  locale?: string
  follow_up_action_url?: string
  /** The Page this form belongs to. Forms are a Page asset and the app reads
   *  every accessible Page, so a form has to say which one it came from — both
   *  to group them in the UI and to sync its leads with that Page's own token.
   *  Never carries the token itself; that is resolved server-side. */
  page_id?: string
  page_name?: string | null
  questions?: {
    type: string
    label?: string
    id?: string
    key?: string
    options?: { value?: string; label?: string; key?: string }[]
  }[]
  // Richer read fields (requested by getLeadForm; absent on older forms or
  // when Meta declines the field — render nothing rather than a placeholder).
  is_optimized_for_quality?: boolean
  question_page_custom_headline?: string
  privacy_policy_url?: string
  context_card?: { title?: string; style?: string; content?: string[]; button_text?: string }
  thank_you_page?: {
    title?: string
    body?: string
    button_type?: string
    button_text?: string
    website_url?: string
    business_phone_number?: string
    country_code?: string
  }
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
  /** Meta form locale (en_US / ar_AR / ru_RU). Defaults to en_US when omitted. */
  locale?: string
  /**
   * Meta's form type: false/omitted = "More volume" (short, one-tap submit),
   * true = "Higher intent" (adds Meta's review-before-submit screen; fewer but
   * better-qualified leads). Maps to is_optimized_for_quality.
   */
  isOptimizedForQuality?: boolean
  /** Custom headline above the questions (question_page_custom_headline). */
  questionPageHeadline?: string
  /** Optional intro card shown before the questions (context_card). */
  contextCard?: FormContextCard
  /**
   * Meta's SMS phone verification (is_phone_sms_verify_enabled) — the lead
   * must confirm an OTP texted to their number before submitting, so the
   * phone on the lead is a verified one. Only meaningful when the form asks
   * for PHONE. Documented on POST /{page}/leadgen_forms.
   */
  phoneSmsVerification?: boolean
  /** Thank-you button. Defaults to VIEW_WEBSITE → landingUrl (today's behavior). */
  thankYouButtonType?: ThankYouButtonType
  thankYouButtonText?: string
  /** Target for VIEW_WEBSITE, or the file URL for DOWNLOAD. Falls back to landingUrl. */
  thankYouWebsiteUrl?: string
  /** E.164 number the CALL_BUSINESS button dials. Required for that button type. */
  thankYouBusinessPhone?: string
  /** ISO country code for the CALL_BUSINESS number (defaults to AE). */
  thankYouPhoneCountryCode?: string
  /**
   * Extra tracking_parameters merged OVER the auto-injected attribution set
   * ({ utm_source: 'meta-form', utm_medium: 'paid', utm_campaign: <name slug> })
   * — these ride on every lead's field data for attribution.
   */
  trackingParameters?: Record<string, string>
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
  /** Extra source material (links, brochure text, notes) to ground the copy. */
  sources?: string[]
}

export interface GeneratedCreativeVariant {
  id: string
  primaryText: string
  headline: string
  description: string
  cta: MetaCta
}
