/**
 * Meta Marketing API v20.0 client.
 * All calls are server-side only — token is never exposed to the browser.
 */

import { getStoredMetaCreds } from '@/lib/freehold/integration-credentials'
import type {
  MetaCampaign,
  MetaAdSet,
  MetaAd,
  MetaInsights,
  MetaApiResponse,
  CampaignTargeting,
  CampaignCreative,
  MetaCampaignObjective,
  MetaCampaignStatus,
  MetaOptimizationGoal,
  LaunchCampaignResult,
  MetaLeadForm,
  MetaFormLead,
  CreateLeadFormPayload,
  MetaAdCreativeDetail,
} from './types'

const API_BASE = 'https://graph.facebook.com/v20.0'
const API_VERSION = 'v20.0'

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly type: string,
    public readonly fbtrace?: string,
  ) {
    super(message)
    this.name = 'MetaApiError'
  }
}

export class MetaConfigError extends Error {
  constructor(missing: string) {
    super(`Meta integration not configured: ${missing} environment variable is missing. Set it under Integrations → Meta Ads.`)
    this.name = 'MetaConfigError'
  }
}

// Credentials resolve env-first (ops override), then the DB-stored connection
// made through Integrations → Meta Ads in the UI. Async because the DB path
// may be consulted; every caller is already async.
async function creds() {
  let token   = process.env.META_ACCESS_TOKEN
  let rawId   = process.env.META_AD_ACCOUNT_ID
  let pageId  = process.env.META_PAGE_ID
  let pixelId: string | null | undefined = process.env.META_PIXEL_ID

  if (!token || !rawId || !pageId) {
    const stored = await getStoredMetaCreds()
    if (stored) {
      token  = token  || stored.accessToken
      rawId  = rawId  || stored.adAccountId
      pageId = pageId || stored.pageId
      pixelId = pixelId || stored.pixelId || undefined
    }
  }

  if (!token)  throw new MetaConfigError('META_ACCESS_TOKEN')
  if (!rawId)  throw new MetaConfigError('META_AD_ACCOUNT_ID')
  if (!pageId) throw new MetaConfigError('META_PAGE_ID')

  const adAccountId = rawId.startsWith('act_') ? rawId : `act_${rawId}`
  return { token, adAccountId, pageId, pixelId: pixelId ?? null }
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  params?: Record<string, string>,
): Promise<T> {
  const { token } = await creds()
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set('access_token', token)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    ...options,
    // short cache for list/read operations
    ...(options?.method ? {} : { next: { revalidate: 30 } }),
  })

  const json = (await res.json()) as MetaApiResponse<T> & T

  if ('error' in json && json.error) {
    const e = json.error
    throw new MetaApiError(e.message, e.code, e.type, e.fbtrace_id)
  }

  return json as T
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { token } = await creds()
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const json = (await res.json()) as MetaApiResponse<T> & T
  if ('error' in json && json.error) {
    const e = json.error as { message: string; code: number; type: string; fbtrace_id?: string; error_subcode?: number; error_user_msg?: string; error_user_title?: string }
    // Account-configuration blockers get an actionable message instead of
    // Meta's raw jargon — the fix is a dashboard step, not a system problem.
    const ACTIONABLE: Record<number, string> = {
      1885183:
        'Your Meta developer app is in Development Mode, so Meta blocks live ad creation. In developers.facebook.com open the app that issued your access token, complete Settings → Basic (privacy policy URL), switch the app to Live, then launch again. — subcode 1885183',
      1341012:
        'The connected access token cannot use this Facebook Page. Fix it in Meta Business Settings: (1) add the Page to the same Business that owns the ad account, (2) give the token owner (the person or system user who connected Meta) an Admin or Advertiser role on that Page, and (3) confirm META_PAGE_ID is that Page’s ID. Then reconnect and launch again. — subcode 1341012',
    }
    const detail = (e.error_subcode && ACTIONABLE[e.error_subcode])
      || [e.message, e.error_user_title, e.error_user_msg, e.error_subcode ? `subcode ${e.error_subcode}` : '']
          .filter(Boolean).join(' — ')
    throw new MetaApiError(detail, e.code, e.type, e.fbtrace_id)
  }
  return json as T
}

/**
 * Ingest an external image into the ad account: fetch the bytes server-side
 * and upload them, returning an image_hash — Meta's reliable creative path.
 * External `picture` URLs are rejected surprisingly often (redirects, webp,
 * hotlink protection); a native upload never is.
 */
export async function ingestImageFromUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1000 || buf.length > 8_000_000) return null
    const { hash } = await uploadAdImage(buf.toString('base64'))
    return hash
  } catch {
    return null
  }
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export async function listCampaigns(): Promise<MetaCampaign[]> {
  const { adAccountId } = await creds()
  const res = await apiFetch<{ data: MetaCampaign[] }>(`/${adAccountId}/campaigns`, undefined, {
    fields: 'id,name,status,objective,daily_budget,created_time,start_time,stop_time',
    limit: '100',
  })
  return res.data ?? []
}

export async function getCampaign(campaignId: string): Promise<MetaCampaign> {
  return apiFetch<MetaCampaign>(`/${campaignId}`, undefined, {
    fields: 'id,name,status,objective,daily_budget,created_time,start_time,stop_time',
  })
}

export async function getCampaignInsights(campaignId: string): Promise<MetaInsights | null> {
  const res = await apiFetch<{ data: MetaInsights[] }>(`/${campaignId}/insights`, undefined, {
    fields: 'impressions,clicks,spend,actions,cost_per_action_type,cpc,cpm',
    date_preset: 'this_month',
  })
  return res.data?.[0] ?? null
}

export async function updateCampaignStatus(
  campaignId: string,
  status: MetaCampaignStatus,
): Promise<{ success: boolean }> {
  return apiPost(`/${campaignId}`, { status })
}

export async function deleteCampaign(campaignId: string): Promise<{ success: boolean }> {
  return updateCampaignStatus(campaignId, 'DELETED')
}

// ─── Ad Sets ─────────────────────────────────────────────────────────────────

export async function listAdSets(campaignId: string): Promise<MetaAdSet[]> {
  const res = await apiFetch<{ data: MetaAdSet[] }>(`/${campaignId}/adsets`, undefined, {
    fields: 'id,name,status,daily_budget,targeting,optimization_goal,billing_event',
  })
  return res.data ?? []
}

// Graph v17+ accepts only ODAX outcome objectives for NEW campaigns — the
// legacy names (LEAD_GENERATION/CONVERSIONS/LINK_CLICKS) are rejected with
// error 100. The wizard keeps its familiar vocabulary; we translate here.
// Website-lead campaigns need a pixel to optimize for leads; without one the
// honest fallback is a traffic campaign optimized for landing-page views.
function toOdaxObjective(obj: MetaCampaignObjective, hasPixel: boolean): string {
  switch (obj) {
    case 'LEAD_GENERATION': return hasPixel ? 'OUTCOME_LEADS' : 'OUTCOME_TRAFFIC'
    case 'CONVERSIONS':     return hasPixel ? 'OUTCOME_SALES' : 'OUTCOME_TRAFFIC'
    default:                return 'OUTCOME_TRAFFIC'
  }
}

function objectiveToOptimizationGoal(obj: MetaCampaignObjective, hasPixel: boolean): MetaOptimizationGoal {
  switch (obj) {
    case 'LEAD_GENERATION':
    case 'CONVERSIONS':
      // With a pixel we optimize on real conversion signal; without one,
      // landing-page views is the best available quality proxy.
      return hasPixel ? 'OFFSITE_CONVERSIONS' : 'LANDING_PAGE_VIEWS'
    default:
      return 'LINK_CLICKS'
  }
}

export async function createAdSet(params: {
  campaignId: string
  name: string
  objective: MetaCampaignObjective
  dailyBudgetAED: number
  targeting: CampaignTargeting
  status: 'ACTIVE' | 'PAUSED'
}): Promise<{ id: string }> {
  const { adAccountId, pixelId } = await creds()
  const optimizationGoal = objectiveToOptimizationGoal(params.objective, !!pixelId)

  // Placements: an EMPTY platform list means Advantage+ placements (fully
  // automatic — Meta's recommendation). Explicit platforms get the complete
  // modern position set, Reels included, exactly as Ads Manager would.
  const platforms = params.targeting.publisherPlatforms
  const placementSpec: Record<string, unknown> = platforms.length === 0 ? {} : {
    publisher_platforms: platforms,
    ...(platforms.includes('facebook')
      ? { facebook_positions: ['feed', 'story', 'facebook_reels', 'marketplace', 'search'] }
      : {}),
    ...(platforms.includes('instagram')
      ? { instagram_positions: ['stream', 'story', 'reels', 'explore'] }
      : {}),
  }

  // Explicit Advantage-audience choice (required on newer accounts):
  // broad (no interests) → let the algorithm expand; interests → respect them.
  const advantageAudience = params.targeting.interests.length > 0 ? 0 : 1
  // Advantage+ audiences treat the age band as a suggestion only — Meta
  // rejects a hard age_min > 25 (subcode 1870188) or age_max < 65 (1870189).
  // Clamp both bounds; the algorithm still skews delivery to the intended
  // age band via its signals.
  const ageMin = advantageAudience === 1 ? Math.min(params.targeting.ageMin, 25) : params.targeting.ageMin
  const ageMax = advantageAudience === 1 ? Math.max(params.targeting.ageMax, 65) : params.targeting.ageMax

  const targetingSpec: Record<string, unknown> = {
    geo_locations: {
      countries: params.targeting.countries,
      ...(params.targeting.cityKeys.length > 0
        ? { cities: params.targeting.cityKeys.map((key) => ({ key })) }
        : {}),
    },
    age_min: ageMin,
    age_max: ageMax,
    ...placementSpec,
    ...(params.targeting.interests.length > 0
      ? { interests: params.targeting.interests }
      : {}),
    targeting_automation: { advantage_audience: advantageAudience },
  }

  const body: Record<string, unknown> = {
    name:              params.name,
    campaign_id:       params.campaignId,
    billing_event:     'IMPRESSIONS',
    optimization_goal: optimizationGoal,
    bid_strategy:      'LOWEST_COST_WITHOUT_CAP',
    daily_budget:      params.dailyBudgetAED * 100, // AED → fils (smallest unit)
    targeting:         targetingSpec,
    status:            params.status,
  }

  // Website destination + pixel signal for lead/conversion campaigns.
  if (params.objective === 'CONVERSIONS' || params.objective === 'LEAD_GENERATION') {
    body.destination_type = 'WEBSITE'
    if (pixelId) {
      body.promoted_object = {
        pixel_id: pixelId,
        custom_event_type: params.objective === 'CONVERSIONS' ? 'PURCHASE' : 'LEAD',
      }
    }
  }

  try {
    return await apiPost(`/${adAccountId}/adsets`, body)
  } catch (err) {
    // Some countries (the UAE included) don't support city-level targeting
    // (subcode 1487479). Self-heal: retry once at country level — the honest
    // equivalent, since the whole audience lives in one metro anyway.
    const cityUnsupported = err instanceof MetaApiError &&
      (err.message.includes('City Targeting Not Supported') || err.message.includes('subcode 1487479'))
    if (cityUnsupported && params.targeting.cityKeys.length > 0) {
      const geo = (body.targeting as Record<string, unknown>).geo_locations as Record<string, unknown>
      delete geo.cities
      return apiPost(`/${adAccountId}/adsets`, body)
    }
    throw err
  }
}

/**
 * Validate interests against Meta's LIVE vocabulary. Interest ids rot as
 * Meta prunes its graph — so we re-resolve by NAME at launch time and drop
 * anything Meta no longer recognises. A launch never fails on a stale id;
 * with no valid interests left, the ad set simply runs broad (Advantage+).
 */
export async function validateInterests(
  interests: { id: string; name: string }[],
): Promise<{ id: string; name: string }[]> {
  if (!interests.length) return []
  try {
    const { token } = await creds()
    const url = new URL(`${API_BASE}/search`)
    url.searchParams.set('type', 'adinterestvalid')
    url.searchParams.set('interest_list', JSON.stringify(interests.map((i) => i.name)))
    url.searchParams.set('access_token', token)
    const res = await fetch(url.toString())
    const json = (await res.json()) as { data?: Array<{ name: string; valid: boolean; id?: string }> }
    const valid = new Map((json.data ?? []).filter((d) => d.valid && d.id).map((d) => [d.name.toLowerCase(), String(d.id)]))
    return interests
      .map((i) => {
        const id = valid.get(i.name.toLowerCase())
        return id ? { id, name: i.name } : null
      })
      .filter((i): i is { id: string; name: string } => i !== null)
  } catch {
    // Validation unavailable → run broad rather than risk a stale-id failure.
    return []
  }
}

// ─── Creatives & Ads ─────────────────────────────────────────────────────────

export async function createAdCreative(params: {
  name: string
  creative: CampaignCreative
}): Promise<{ id: string }> {
  const { adAccountId, pageId } = await creds()

  const linkData: Record<string, unknown> = {
    link:        params.creative.landingUrl,
    message:     params.creative.primaryText,
    name:        params.creative.headline,
    description: params.creative.description,
    call_to_action: { type: params.creative.cta, value: { link: params.creative.landingUrl } },
  }

  // Prefer an uploaded image (image_hash) — Meta's native, most reliable path.
  // Fall back to an external picture URL (e.g. the listing's hero photo).
  if (params.creative.imageHash) {
    linkData.image_hash = params.creative.imageHash
  } else if (params.creative.imageUrl) {
    linkData.picture = params.creative.imageUrl
  }

  return apiPost(`/${adAccountId}/adcreatives`, {
    name:               params.name,
    object_story_spec:  { page_id: pageId, link_data: linkData },
    // Dynamic UTMs close the attribution loop: the lead that lands on the
    // page carries the REAL campaign/adset/ad ids into the CRM automatically.
    url_tags: 'utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_term={{adset.id}}&utm_content={{ad.id}}',
    // Note: the `standard_enhancements` field under degrees_of_freedom_spec is
    // deprecated (Meta error subcode 3858504) — it must not be sent. We omit it
    // and let the account's default creative-enhancement settings apply.
  })
}

/**
 * Upload an image to the connected Meta ad account and return its hash + URL.
 * The client sends raw base64 (no data-URL prefix). Used so agents can upload
 * their own ad media instead of only using a listing's hero photo.
 */
export async function uploadAdImage(base64: string): Promise<{ hash: string; url: string }> {
  const { adAccountId, token } = await creds()
  const res = await fetch(`${API_BASE}/${adAccountId}/adimages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ bytes: base64, access_token: token }),
  })
  const json = (await res.json()) as { images?: Record<string, { hash: string; url: string }>; error?: { message: string; code: number; type: string; fbtrace_id?: string } }
  if (json.error) throw new MetaApiError(json.error.message, json.error.code, json.error.type, json.error.fbtrace_id)
  const first = Object.values(json.images ?? {})[0]
  if (!first?.hash) throw new MetaApiError('Meta did not return an image hash', 0, 'upload')
  return { hash: first.hash, url: first.url }
}

export async function createAd(params: {
  adSetId:    string
  name:       string
  creativeId: string
  status:     'ACTIVE' | 'PAUSED'
}): Promise<{ id: string }> {
  const { adAccountId } = await creds()
  return apiPost(`/${adAccountId}/ads`, {
    name:     params.name,
    adset_id: params.adSetId,
    creative: { creative_id: params.creativeId },
    status:   params.status,
  })
}

export async function listAds(adSetId: string): Promise<MetaAd[]> {
  const res = await apiFetch<{ data: MetaAd[] }>(`/${adSetId}/ads`, undefined, {
    fields: 'id,name,status,creative{id,name}',
  })
  return res.data ?? []
}

// ─── Lead Gen Forms ───────────────────────────────────────────────────────────

export async function listLeadForms(): Promise<MetaLeadForm[]> {
  const { adAccountId } = await creds()
  const res = await apiFetch<{ data: MetaLeadForm[] }>(`/${adAccountId}/leadgen_forms`, undefined, {
    fields: 'id,name,status,leads_count,created_time,locale,follow_up_action_url',
    limit:  '50',
  })
  return res.data ?? []
}

export async function getLeadForm(formId: string): Promise<MetaLeadForm> {
  return apiFetch<MetaLeadForm>(`/${formId}`, undefined, {
    fields: 'id,name,status,leads_count,created_time,locale,follow_up_action_url,questions',
  })
}

export async function createLeadForm(payload: CreateLeadFormPayload): Promise<{ id: string }> {
  const { adAccountId } = await creds()
  const questions = payload.questions.map((q) => ({
    type:    q.type,
    ...(q.label   ? { label:   q.label   } : {}),
    ...(q.key     ? { key:     q.key     } : {}),
    ...(q.options ? { options: q.options } : {}),
  }))

  return apiPost(`/${adAccountId}/leadgen_forms`, {
    name:               payload.name,
    locale:             'en_US',
    follow_up_action_url: payload.landingUrl,
    questions,
    privacy_policy: {
      url:       payload.privacyPolicyUrl,
      link_text: 'Privacy Policy',
    },
    ...(payload.thankYouTitle
      ? { thank_you_page: { title: payload.thankYouTitle, body: payload.thankYouBody ?? '' } }
      : {}),
  })
}

export async function getFormLeads(formId: string): Promise<MetaFormLead[]> {
  const res = await apiFetch<{ data: MetaFormLead[] }>(`/${formId}/leads`, undefined, {
    fields: 'id,created_time,field_data,ad_id,adset_id,campaign_id',
    limit:  '200',
  })
  return res.data ?? []
}

// ─── Ad Set Updates ───────────────────────────────────────────────────────────

export async function updateAdSet(
  adSetId: string,
  params: {
    status?:         MetaCampaignStatus
    name?:           string
    dailyBudgetAED?: number
    targeting?:      CampaignTargeting
  },
): Promise<{ success: boolean }> {
  const body: Record<string, unknown> = {}
  if (params.status)         body.status = params.status
  if (params.name)           body.name   = params.name
  if (params.dailyBudgetAED) body.daily_budget = params.dailyBudgetAED * 100
  if (params.targeting) {
    body.targeting = {
      geo_locations: {
        countries: params.targeting.countries,
        ...(params.targeting.cityKeys.length > 0
          ? { cities: params.targeting.cityKeys.map((k) => ({ key: k })) }
          : {}),
      },
      age_min: params.targeting.ageMin,
      age_max: params.targeting.ageMax,
      publisher_platforms: params.targeting.publisherPlatforms,
      ...(params.targeting.interests.length > 0 ? { interests: params.targeting.interests } : {}),
    }
  }
  return apiPost(`/${adSetId}`, body)
}

export async function getAdSet(adSetId: string): Promise<MetaAdSet> {
  return apiFetch<MetaAdSet>(`/${adSetId}`, undefined, {
    fields: 'id,name,status,daily_budget,optimization_goal,billing_event,targeting',
  })
}

// ─── Creative Library ─────────────────────────────────────────────────────────

export async function listAdCreatives(): Promise<MetaAdCreativeDetail[]> {
  const { adAccountId } = await creds()
  const res = await apiFetch<{ data: MetaAdCreativeDetail[] }>(`/${adAccountId}/adcreatives`, undefined, {
    fields: 'id,name,status,body,title,object_story_spec',
    limit:  '50',
  })
  return res.data ?? []
}

// ─── Full Campaign Launch (atomic) ───────────────────────────────────────────

export async function launchFullCampaign(params: {
  campaignName: string
  objective:    MetaCampaignObjective
  listingName:  string
  dailyBudgetAED: number
  targeting:    CampaignTargeting
  creative:     CampaignCreative
  launchStatus: 'ACTIVE' | 'PAUSED'
}): Promise<LaunchCampaignResult> {
  const { adAccountId, pixelId } = await creds()

  // 1 — Campaign (ODAX objective — v20 rejects the legacy names)
  const campaign = await apiPost<{ id: string }>(`/${adAccountId}/campaigns`, {
    name:                  params.campaignName,
    objective:             toOdaxObjective(params.objective, !!pixelId),
    status:                params.launchStatus,
    special_ad_categories: [],
    // Budgets live on the ad set (not CBO) — Meta now requires this flag to
    // be explicit (subcode 4834011). False = classic per-ad-set budgets.
    is_adset_budget_sharing_enabled: false,
  })

  // From here on, a failure must not leave a headless campaign behind.
  const step = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn()
    } catch (err) {
      await apiPost(`/${campaign.id}`, { status: 'DELETED' }).catch(() => {})
      if (err instanceof MetaApiError) {
        throw new MetaApiError(`[${name}] ${err.message}`, err.code, err.type, err.fbtrace)
      }
      throw err
    }
  }

  // 2 — Ad Set. Interests are re-validated by NAME against Meta's live
  // vocabulary; stale ids drop instead of failing the launch.
  const validatedInterests = await validateInterests(params.targeting.interests)
  const adSet = await step('ad set', () => createAdSet({
    campaignId:     campaign.id,
    name:           `${params.listingName} — Ad Set`,
    objective:      params.objective,
    dailyBudgetAED: params.dailyBudgetAED,
    targeting:      { ...params.targeting, interests: validatedInterests },
    status:         params.launchStatus,
  }))

  // 3 — Creative. Prefer a NATIVE image: ingest the external URL into the ad
  // account first (image_hash); external `picture` URLs are the flaky path.
  const creativeInput = { ...params.creative }
  if (!creativeInput.imageHash && creativeInput.imageUrl) {
    const hash = await ingestImageFromUrl(creativeInput.imageUrl)
    if (hash) creativeInput.imageHash = hash
  }
  const creative = await step('creative', () => createAdCreative({
    name:     `${params.listingName} — Creative`,
    creative: creativeInput,
  }))

  // 4 — Ad
  const ad = await step('ad', () => createAd({
    adSetId:    adSet.id,
    name:       `${params.listingName} — Ad`,
    creativeId: creative.id,
    status:     params.launchStatus,
  }))

  return {
    campaignId: campaign.id,
    adSetId:    adSet.id,
    creativeId: creative.id,
    adId:       ad.id,
    status:     params.launchStatus,
  }
}
