/**
 * Meta Marketing API v20.0 client.
 * All calls are server-side only — token is never exposed to the browser.
 */

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

function creds() {
  const token   = process.env.META_ACCESS_TOKEN
  const rawId   = process.env.META_AD_ACCOUNT_ID
  const pageId  = process.env.META_PAGE_ID
  const pixelId = process.env.META_PIXEL_ID

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
  const { token } = creds()
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
  const { token } = creds()
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const json = (await res.json()) as MetaApiResponse<T> & T
  if ('error' in json && json.error) {
    const e = json.error
    throw new MetaApiError(e.message, e.code, e.type, e.fbtrace_id)
  }
  return json as T
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export async function listCampaigns(): Promise<MetaCampaign[]> {
  const { adAccountId } = creds()
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

function objectiveToOptimizationGoal(obj: MetaCampaignObjective): MetaOptimizationGoal {
  switch (obj) {
    case 'LEAD_GENERATION': return 'LEAD_GENERATION'
    case 'CONVERSIONS':     return 'OFFSITE_CONVERSIONS'
    default:                return 'LINK_CLICKS'
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
  const { adAccountId, pixelId } = creds()
  const optimizationGoal = objectiveToOptimizationGoal(params.objective)

  const targetingSpec: Record<string, unknown> = {
    geo_locations: {
      countries: params.targeting.countries,
      ...(params.targeting.cityKeys.length > 0
        ? { cities: params.targeting.cityKeys.map((key) => ({ key })) }
        : {}),
    },
    age_min: params.targeting.ageMin,
    age_max: params.targeting.ageMax,
    publisher_platforms: params.targeting.publisherPlatforms,
    facebook_positions:  params.targeting.publisherPlatforms.includes('facebook')  ? ['feed', 'story'] : [],
    instagram_positions: params.targeting.publisherPlatforms.includes('instagram') ? ['stream', 'story'] : [],
    ...(params.targeting.interests.length > 0
      ? { interests: params.targeting.interests }
      : {}),
  }

  const body: Record<string, unknown> = {
    name:              params.name,
    campaign_id:       params.campaignId,
    billing_event:     'IMPRESSIONS',
    optimization_goal: optimizationGoal,
    daily_budget:      params.dailyBudgetAED * 100, // AED → fils (smallest unit)
    targeting:         targetingSpec,
    status:            params.status,
  }

  // Attach pixel for conversion/offsite campaigns
  if (pixelId && (params.objective === 'CONVERSIONS' || params.objective === 'LEAD_GENERATION')) {
    body.promoted_object = { pixel_id: pixelId, custom_event_type: 'LEAD' }
  }

  return apiPost(`/${adAccountId}/adsets`, body)
}

// ─── Creatives & Ads ─────────────────────────────────────────────────────────

export async function createAdCreative(params: {
  name: string
  creative: CampaignCreative
}): Promise<{ id: string }> {
  const { adAccountId, pageId } = creds()

  const linkData: Record<string, unknown> = {
    link:        params.creative.landingUrl,
    message:     params.creative.primaryText,
    name:        params.creative.headline,
    description: params.creative.description,
    call_to_action: { type: params.creative.cta },
  }

  if (params.creative.imageUrl) {
    linkData.picture = params.creative.imageUrl
  }

  return apiPost(`/${adAccountId}/adcreatives`, {
    name:               params.name,
    object_story_spec:  { page_id: pageId, link_data: linkData },
  })
}

export async function createAd(params: {
  adSetId:    string
  name:       string
  creativeId: string
  status:     'ACTIVE' | 'PAUSED'
}): Promise<{ id: string }> {
  const { adAccountId } = creds()
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
  const { adAccountId } = creds()

  // 1 — Campaign
  const campaign = await apiPost<{ id: string }>(`/${adAccountId}/campaigns`, {
    name:                  params.campaignName,
    objective:             params.objective,
    status:                params.launchStatus,
    special_ad_categories: [],
  })

  // 2 — Ad Set
  const adSet = await createAdSet({
    campaignId:     campaign.id,
    name:           `${params.listingName} — Ad Set`,
    objective:      params.objective,
    dailyBudgetAED: params.dailyBudgetAED,
    targeting:      params.targeting,
    status:         params.launchStatus,
  })

  // 3 — Creative
  const creative = await createAdCreative({
    name:     `${params.listingName} — Creative`,
    creative: params.creative,
  })

  // 4 — Ad
  const ad = await createAd({
    adSetId:    adSet.id,
    name:       `${params.listingName} — Ad`,
    creativeId: creative.id,
    status:     params.launchStatus,
  })

  return {
    campaignId: campaign.id,
    adSetId:    adSet.id,
    creativeId: creative.id,
    adId:       ad.id,
    status:     params.launchStatus,
  }
}
