import {
  GoogleConfigError,
  GoogleApiError,
  type GoogleCampaign,
  type GoogleAdGroup,
  type GoogleKeyword,
  type GoogleResponsiveSearchAd,
  type GoogleAssetGroup,
  type GoogleAudience,
  type GoogleExtension,
  type GoogleReportSummary,
  type GoogleKeywordMatchType,
  type LaunchGoogleCampaignPayload,
  type NegativeKeyword,
} from './types'

// ─── Credentials ─────────────────────────────────────────────────────────────

import { getStoredCreds } from '@/lib/freehold/integration-credentials'
import { GOOGLE_CLICK_TRACKING } from '@/lib/freehold/click-identity'

export interface GoogleStoredCreds {
  developerToken: string
  clientId: string
  clientSecret: string
  refreshToken: string
  customerId: string
  loginCustomerId?: string | null
}

export interface ResolvedGoogleCreds extends GoogleStoredCreds {
  loginCustomerId: string
}

/**
 * Resolve Google Ads credentials env-first, then from the in-app connection
 * stored in `freehold_site_integration_credentials` (provider = 'google').
 * Env vars always win. Throws GoogleConfigError when neither is complete.
 */
async function creds(): Promise<ResolvedGoogleCreds> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const clientId       = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret   = process.env.GOOGLE_ADS_CLIENT_SECRET
  const refreshToken   = process.env.GOOGLE_ADS_REFRESH_TOKEN
  const customerId     = process.env.GOOGLE_ADS_CUSTOMER_ID

  if (developerToken && clientId && clientSecret && refreshToken && customerId) {
    return {
      developerToken, clientId, clientSecret, refreshToken, customerId,
      loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || customerId,
    }
  }

  const stored = await getStoredCreds<GoogleStoredCreds>('google').catch(() => null)
  if (stored?.developerToken && stored.clientId && stored.clientSecret && stored.refreshToken && stored.customerId) {
    return {
      developerToken: stored.developerToken,
      clientId: stored.clientId,
      clientSecret: stored.clientSecret,
      refreshToken: stored.refreshToken,
      customerId: stored.customerId,
      loginCustomerId: stored.loginCustomerId || stored.customerId,
    }
  }

  throw new GoogleConfigError(
    'Google Ads credentials are not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN, ' +
    'GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, ' +
    'and GOOGLE_ADS_CUSTOMER_ID — or connect in Integrations → Google Ads.',
  )
}

/** True when Google Ads is usable via env OR an in-app connection. */
export async function googleConfiguredAsync(): Promise<boolean> {
  try { await creds(); return true } catch { return false }
}

// ─── OAuth token refresh ──────────────────────────────────────────────────────

async function getAccessToken(clientId: string, clientSecret: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new GoogleApiError(`OAuth token refresh failed: ${err}`, res.status)
  }
  const json = await res.json()
  return json.access_token as string
}

// ─── GAQL query helper ────────────────────────────────────────────────────────

// Google campaign ids are numeric. GAQL has no bound parameters, so any id
// interpolated into a query string is sanitized to digits at the boundary —
// a non-numeric id can never reach the query.
function gid(id: string): string {
  const d = String(id).replace(/\D/g, '')
  if (!d) throw new GoogleApiError(`Invalid campaign id "${id}"`, 400)
  return d
}

async function gaqlQuery<T>(gaql: string): Promise<T[]> {
  const { developerToken, clientId, clientSecret, refreshToken, customerId, loginCustomerId } = await creds()
  const accessToken = await getAccessToken(clientId, clientSecret, refreshToken)

  const res = await fetch(
    `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:searchStream`,
    {
      method:  'POST',
      headers: {
        Authorization:        `Bearer ${accessToken}`,
        'developer-token':    developerToken,
        'Content-Type':       'application/json',
        'login-customer-id':  loginCustomerId,
      },
      body: JSON.stringify({ query: gaql }),
    },
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new GoogleApiError(
      (err as { error?: { message?: string } })?.error?.message ?? `Google Ads API error ${res.status}`,
      res.status,
      err,
    )
  }

  // searchStream returns newline-delimited JSON arrays
  const text    = await res.text()
  const batches = text.trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
  return batches.flatMap((b: { results?: T[] }) => b.results ?? []) as T[]
}

// ─── Resource mutate helper ───────────────────────────────────────────────────

async function mutate(operations: unknown[]): Promise<unknown> {
  const { developerToken, clientId, clientSecret, refreshToken, customerId, loginCustomerId } = await creds()
  const accessToken = await getAccessToken(clientId, clientSecret, refreshToken)

  const res = await fetch(
    `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:mutate`,
    {
      method:  'POST',
      headers: {
        Authorization:       `Bearer ${accessToken}`,
        'developer-token':   developerToken,
        'Content-Type':      'application/json',
        'login-customer-id': loginCustomerId,
      },
      body: JSON.stringify({ mutateOperations: operations }),
    },
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new GoogleApiError(
      (err as { error?: { message?: string } })?.error?.message ?? `Google Ads mutate error ${res.status}`,
      res.status,
      err,
    )
  }
  return res.json()
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

// `during` scopes the metrics to a Google date range. Without it the metrics
// are LIFETIME, which is the right read for a LIST — a report of what a
// campaign brought must never go down, and a rolling window drains to zero
// thirty days after a campaign is switched off, as though it never ran. The
// Ads Machine passes 'LAST_30_DAYS' instead, because a JUDGEMENT is made on
// recent behaviour and that is the same rolling window the Meta side reads
// (RECENT_WINDOW in lib/meta/insights-window.ts).
//
// NOT 'THIS_MONTH', on either channel: a calendar window erases every
// campaign's history at midnight on the 1st, which froze the machine for the
// first days of every month and made the product read as "everything is dead".
const GOOGLE_DATE_RANGES = new Set(['TODAY', 'YESTERDAY', 'LAST_7_DAYS', 'LAST_14_DAYS', 'LAST_30_DAYS', 'THIS_MONTH', 'LAST_MONTH'])
export async function listCampaigns(during?: string): Promise<GoogleCampaign[]> {
  const dateFilter = during && GOOGLE_DATE_RANGES.has(during) ? ` AND segments.date DURING ${during}` : ''
  const rows = await gaqlQuery<Record<string, any>>(`
    SELECT
      campaign.id,
      campaign.resource_name,
      campaign.name,
      campaign.status,
      -- What Google is ACTUALLY doing with it, and why not when it is not.
      -- Selected on the LIST, not only per-campaign: every Google screen used
      -- to paint its badge from campaign.status, which is the switch we set.
      campaign.primary_status,
      campaign.primary_status_reasons,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      campaign_budget.amount_micros,
      campaign.target_cpa.target_cpa_micros,
      campaign.maximize_conversions.target_cpa_micros,
      campaign.start_date,
      campaign.end_date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      -- THE COMPETITION READ. How much of the auction we got, and which of the
      -- two opposite causes lost the rest: outranked, or out of money. Never
      -- queried before; see lib/google/competition.ts for why they matter and
      -- why Google's 0.9 / 0.0999 clamps are carried as bounds.
      metrics.search_impression_share,
      metrics.search_rank_lost_impression_share,
      metrics.search_budget_lost_impression_share,
      metrics.search_top_impression_share,
      metrics.search_absolute_top_impression_share
    FROM campaign
    WHERE campaign.status != 'REMOVED'${dateFilter}
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `)

  return rows.map((r) => ({
    id:                   String(r.campaign?.id ?? ''),
    resourceName:         String(r.campaign?.resource_name ?? ''),
    name:                 String(r.campaign?.name ?? ''),
    status:               String(r.campaign?.status ?? 'PAUSED') as GoogleCampaign['status'],
    primaryStatus:        r.campaign?.primary_status ? String(r.campaign.primary_status) : null,
    primaryStatusReasons: Array.isArray(r.campaign?.primary_status_reasons)
      ? (r.campaign.primary_status_reasons as unknown[]).map(String) : [],
    type:                 String(r.campaign?.advertising_channel_type ?? 'SEARCH') as GoogleCampaign['type'],
    biddingStrategyType:  String(r.campaign?.bidding_strategy_type ?? 'MAXIMIZE_CONVERSIONS') as GoogleCampaign['biddingStrategyType'],
    dailyBudgetMicros:    Number(r.campaign_budget?.amount_micros ?? 0),
    targetCpaMicros:      Number(r.campaign?.target_cpa?.target_cpa_micros ?? r.campaign?.maximize_conversions?.target_cpa_micros ?? 0) || undefined,
    startDate:            r.campaign?.start_date ? String(r.campaign.start_date) : undefined,
    endDate:              r.campaign?.end_date ? String(r.campaign.end_date) : undefined,
    metrics: {
      impressions:      Number(r.metrics?.impressions ?? 0),
      clicks:           Number(r.metrics?.clicks ?? 0),
      costMicros:       Number(r.metrics?.cost_micros ?? 0),
      conversions:      Number(r.metrics?.conversions ?? 0),
      conversionsValue: Number(r.metrics?.conversions_value ?? 0),
      ctr:              Number(r.metrics?.ctr ?? 0),
      averageCpcMicros: Number(r.metrics?.average_cpc ?? 0),
    },
    // null, never 0, when Google reported nothing: "you showed in 0% of
    // auctions" and "we do not know" are different sentences and only one of
    // them is true. competitionOf depends on the difference.
    competition: {
      impressionShare:  num(r.metrics?.search_impression_share),
      rankLost:         num(r.metrics?.search_rank_lost_impression_share),
      budgetLost:       num(r.metrics?.search_budget_lost_impression_share),
      topShare:         num(r.metrics?.search_top_impression_share),
      absoluteTopShare: num(r.metrics?.search_absolute_top_impression_share),
    },
  }))
}

/** A Google metric that may legitimately be absent. Absent stays null. */
function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * Real serving state for a campaign — Google's own primary_status (the honest
 * "is it serving, and if not why") plus its reasons. This is what the plain
 * ENABLED/PAUSED status can't tell you (eligible / limited / pending / not
 * eligible / ended). Fail-soft to the plain status if primary_status isn't
 * available.
 */
export interface GoogleCampaignDelivery {
  status: string
  primaryStatus: string | null
  reasons: string[]
}

/**
 * Today's spend for a campaign in AED (cost_micros / 1e6). Zero when it hasn't
 * spent today — the honest "delivering but not spending" signal. Fail-soft to 0
 * (a day with no spend simply returns no rows).
 */
export async function getCampaignSpendToday(campaignId: string): Promise<number> {
  try {
    const rows = await gaqlQuery<Record<string, any>>(`
      SELECT metrics.cost_micros FROM campaign
      WHERE campaign.id = ${gid(campaignId)} AND segments.date DURING TODAY
    `)
    const micros = rows.reduce((n, r) => n + Number(r?.metrics?.cost_micros ?? 0), 0)
    return micros / 1_000_000
  } catch {
    return 0
  }
}

export async function getCampaignDelivery(campaignId: string): Promise<GoogleCampaignDelivery> {
  try {
    const rows = await gaqlQuery<Record<string, any>>(`
      SELECT campaign.status, campaign.primary_status, campaign.primary_status_reasons
      FROM campaign WHERE campaign.id = ${gid(campaignId)} LIMIT 1
    `)
    const r = rows[0]
    const reasons = Array.isArray(r?.campaign?.primary_status_reasons)
      ? (r.campaign.primary_status_reasons as unknown[]).map(String)
      : []
    return {
      status: String(r?.campaign?.status ?? 'UNKNOWN'),
      primaryStatus: r?.campaign?.primary_status ? String(r.campaign.primary_status) : null,
      reasons,
    }
  } catch {
    // Older API surface without primary_status — fall back to the plain status.
    const rows = await gaqlQuery<Record<string, any>>(`
      SELECT campaign.status FROM campaign WHERE campaign.id = ${gid(campaignId)} LIMIT 1
    `)
    return { status: String(rows[0]?.campaign?.status ?? 'UNKNOWN'), primaryStatus: null, reasons: [] }
  }
}

export async function getCampaign(campaignId: string): Promise<GoogleCampaign> {
  const rows = await gaqlQuery<Record<string, any>>(`
    SELECT
      campaign.id, campaign.resource_name, campaign.name, campaign.status,
      campaign.advertising_channel_type, campaign.bidding_strategy_type,
      campaign_budget.amount_micros, campaign.start_date, campaign.end_date,
      metrics.impressions, metrics.clicks, metrics.cost_micros,
      metrics.conversions, metrics.ctr, metrics.average_cpc
    FROM campaign
    WHERE campaign.id = ${gid(campaignId)}
    LIMIT 1
  `)
  if (!rows[0]) throw new GoogleApiError(`Campaign ${campaignId} not found`, 404)
  const r = rows[0]
  return {
    id:                  String(r.campaign?.id),
    resourceName:        String(r.campaign?.resource_name),
    name:                String(r.campaign?.name),
    status:              String(r.campaign?.status) as GoogleCampaign['status'],
    type:                String(r.campaign?.advertising_channel_type) as GoogleCampaign['type'],
    biddingStrategyType: String(r.campaign?.bidding_strategy_type) as GoogleCampaign['biddingStrategyType'],
    dailyBudgetMicros:   Number(r.campaign_budget?.amount_micros ?? 0),
    startDate:           r.campaign?.start_date ? String(r.campaign.start_date) : undefined,
    metrics: {
      impressions:      Number(r.metrics?.impressions ?? 0),
      clicks:           Number(r.metrics?.clicks ?? 0),
      costMicros:       Number(r.metrics?.cost_micros ?? 0),
      conversions:      Number(r.metrics?.conversions ?? 0),
      conversionsValue: 0,
      ctr:              Number(r.metrics?.ctr ?? 0),
      averageCpcMicros: Number(r.metrics?.average_cpc ?? 0),
    },
  }
}

export async function updateCampaignStatus(
  campaignId: string,
  status: 'ENABLED' | 'PAUSED',
): Promise<void> {
  const { customerId } = await creds()
  await mutate([{
    campaignOperation: {
      update: {
        resourceName: `customers/${customerId}/campaigns/${campaignId}`,
        status,
      },
      updateMask: 'status',
    },
  }])
}

/**
 * Set a campaign's daily budget. Budgets live on a separate campaign_budget
 * resource, so we first resolve the campaign's budget resource name via GAQL,
 * then mutate that budget's amount_micros (same AED→micros convention as
 * launchSearchCampaign: 1 AED = 1_000_000 micros, account currency is AED).
 */
export async function updateCampaignBudget(
  campaignId: string,
  dailyBudgetAED: number,
): Promise<void> {
  if (!/^\d+$/.test(campaignId)) {
    throw new GoogleApiError(`Invalid campaign id "${campaignId}"`, 400)
  }
  const rows = await gaqlQuery<Record<string, any>>(`
    SELECT campaign.id, campaign.campaign_budget
    FROM campaign
    WHERE campaign.id = ${gid(campaignId)}
    LIMIT 1
  `)
  const budgetResourceName = rows[0]?.campaign?.campaign_budget
    ? String(rows[0].campaign.campaign_budget)
    : ''
  if (!budgetResourceName) {
    throw new GoogleApiError(`Campaign ${campaignId} not found or has no budget`, 404)
  }
  await mutate([{
    campaignBudgetOperation: {
      update: {
        resourceName: budgetResourceName,
        amountMicros: Math.round(dailyBudgetAED * 1_000_000),
      },
      updateMask: 'amountMicros',
    },
  }])
}

// ─── Keyword mutations ───────────────────────────────────────────────────────

/**
 * Add keywords to an ad group (adGroupCriterionOperation create).
 * Returns the created criterion resource names, in input order.
 */
export async function addKeywords(
  adGroupId: string,
  keywords: { text: string; matchType: GoogleKeywordMatchType }[],
): Promise<string[]> {
  const { customerId } = await creds()
  const result = await mutate(keywords.map((kw) => ({
    adGroupCriterionOperation: {
      create: {
        adGroup: `customers/${customerId}/adGroups/${adGroupId}`,
        status:  'ENABLED',
        keyword: { text: kw.text, matchType: kw.matchType },
      },
    },
  }))) as { mutateOperationResponses?: { adGroupCriterionResult?: { resourceName?: string } }[] }
  return (result?.mutateOperationResponses ?? [])
    .map((r) => r.adGroupCriterionResult?.resourceName ?? '')
    .filter(Boolean)
}

/**
 * Add CAMPAIGN-level negative keywords.
 *
 * Campaign level, not ad group: a query that wastes money in one ad group
 * wastes it in every other group of the same campaign, and a negative added
 * only where it was noticed leaves the leak open everywhere else.
 *
 * PHRASE by default, never BROAD. A broad negative for 'rent' also blocks
 * "current" and every other query containing the letters — and a wrongly
 * blocked query is invisible forever, because no report can show what a query
 * that never ran would have brought.
 *
 * Idempotent from the caller's side is NOT assumed: Google errors on an exact
 * duplicate, so the harvest filters against listNegativeKeywords first.
 */
export async function addNegativeKeywords(
  campaignId: string,
  keywords: { text: string; matchType?: GoogleKeywordMatchType }[],
): Promise<number> {
  if (keywords.length === 0) return 0
  const { customerId } = await creds()
  const id = gid(campaignId)
  const ops = keywords.map((kw) => ({
    campaignCriterionOperation: {
      create: {
        campaign: `customers/${customerId}/campaigns/${id}`,
        negative: true,
        keyword: { text: kw.text, matchType: kw.matchType ?? 'PHRASE' },
      },
    },
  }))
  const result = await mutate(ops) as { mutateOperationResponses?: unknown[] }
  return (result?.mutateOperationResponses ?? []).length
}

/** Remove a keyword by its ad_group_criterion resource name. */
export async function removeKeyword(criterionResourceName: string): Promise<void> {
  if (!/^customers\/\d+\/adGroupCriteria\/[\d~]+$/.test(criterionResourceName)) {
    throw new GoogleApiError(`Invalid keyword resource name "${criterionResourceName}"`, 400)
  }
  await mutate([{
    adGroupCriterionOperation: { remove: criterionResourceName },
  }])
}

// ─── Ad Groups ────────────────────────────────────────────────────────────────

export async function listAdGroups(campaignId?: string): Promise<GoogleAdGroup[]> {
  const where = campaignId
    ? `WHERE campaign.id = ${gid(campaignId)} AND ad_group.status != 'REMOVED'`
    : `WHERE ad_group.status != 'REMOVED'`

  const rows = await gaqlQuery<Record<string, any>>(`
    SELECT
      ad_group.id, ad_group.resource_name, ad_group.name, ad_group.status,
      ad_group.type, ad_group.cpc_bid_micros, campaign.id,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.ctr
    FROM ad_group
    ${where}
    ORDER BY metrics.cost_micros DESC
    LIMIT 100
  `)

  return rows.map((r) => ({
    id:           String(r.ad_group?.id ?? ''),
    resourceName: String(r.ad_group?.resource_name ?? ''),
    campaignId:   String(r.campaign?.id ?? ''),
    name:         String(r.ad_group?.name ?? ''),
    status:       String(r.ad_group?.status ?? 'PAUSED') as GoogleAdGroup['status'],
    type:         String(r.ad_group?.type ?? 'STANDARD') as GoogleAdGroup['type'],
    cpcBidMicros: Number(r.ad_group?.cpc_bid_micros ?? 0) || undefined,
    metrics: {
      impressions:      Number(r.metrics?.impressions ?? 0),
      clicks:           Number(r.metrics?.clicks ?? 0),
      costMicros:       Number(r.metrics?.cost_micros ?? 0),
      conversions:      Number(r.metrics?.conversions ?? 0),
      conversionsValue: 0,
      ctr:              Number(r.metrics?.ctr ?? 0),
      averageCpcMicros: 0,
    },
  }))
}

// ─── Keywords ────────────────────────────────────────────────────────────────

export async function listKeywords(campaignId?: string): Promise<GoogleKeyword[]> {
  const where = campaignId
    ? `WHERE campaign.id = ${gid(campaignId)} AND ad_group_criterion.status != 'REMOVED'`
    : `WHERE ad_group_criterion.status != 'REMOVED' AND ad_group_criterion.type = 'KEYWORD'`

  const rows = await gaqlQuery<Record<string, any>>(`
    SELECT
      ad_group_criterion.criterion_id,
      ad_group_criterion.resource_name,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group_criterion.status,
      ad_group_criterion.quality_info.quality_score,
      ad_group_criterion.approval_status,
      ad_group.id, campaign.id,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.ctr,
      metrics.average_cpc, metrics.conversions
    FROM ad_group_criterion
    ${where}
    ORDER BY metrics.cost_micros DESC
    LIMIT 200
  `)

  return rows.map((r) => ({
    id:             String(r.ad_group_criterion?.criterion_id ?? ''),
    resourceName:   String(r.ad_group_criterion?.resource_name ?? ''),
    adGroupId:      String(r.ad_group?.id ?? ''),
    campaignId:     String(r.campaign?.id ?? ''),
    text:           String(r.ad_group_criterion?.keyword?.text ?? ''),
    matchType:      String(r.ad_group_criterion?.keyword?.match_type ?? 'BROAD') as GoogleKeyword['matchType'],
    status:         String(r.ad_group_criterion?.status ?? 'ENABLED') as GoogleKeyword['status'],
    qualityScore:   Number(r.ad_group_criterion?.quality_info?.quality_score ?? 0) || undefined,
    approvalStatus: r.ad_group_criterion?.approval_status ? String(r.ad_group_criterion.approval_status) : undefined,
    metrics: {
      impressions:      Number(r.metrics?.impressions ?? 0),
      clicks:           Number(r.metrics?.clicks ?? 0),
      costMicros:       Number(r.metrics?.cost_micros ?? 0),
      ctr:              Number(r.metrics?.ctr ?? 0),
      averageCpcMicros: Number(r.metrics?.average_cpc ?? 0),
      conversions:      Number(r.metrics?.conversions ?? 0),
    },
  }))
}

export async function listNegativeKeywords(campaignId?: string): Promise<NegativeKeyword[]> {
  const where = campaignId
    ? `WHERE campaign.id = ${gid(campaignId)}`
    : 'WHERE campaign.id != 0'

  const rows = await gaqlQuery<Record<string, any>>(`
    SELECT
      campaign_criterion.criterion_id,
      campaign_criterion.keyword.text,
      campaign_criterion.keyword.match_type,
      campaign.id
    FROM campaign_criterion
    ${where}
    AND campaign_criterion.type = 'KEYWORD'
    AND campaign_criterion.negative = TRUE
    LIMIT 200
  `)

  return rows.map((r) => ({
    id:         String(r.campaign_criterion?.criterion_id ?? ''),
    text:       String(r.campaign_criterion?.keyword?.text ?? ''),
    matchType:  String(r.campaign_criterion?.keyword?.match_type ?? 'BROAD') as GoogleKeyword['matchType'],
    level:      'campaign' as const,
    campaignId: String(r.campaign?.id ?? ''),
  }))
}

// ─── Ads ─────────────────────────────────────────────────────────────────────

export async function listResponsiveSearchAds(campaignId?: string): Promise<GoogleResponsiveSearchAd[]> {
  const where = campaignId
    ? `WHERE campaign.id = ${gid(campaignId)} AND ad_group_ad.status != 'REMOVED'`
    : `WHERE ad_group_ad.status != 'REMOVED' AND ad_group_ad.ad.type = 'RESPONSIVE_SEARCH_AD'`

  const rows = await gaqlQuery<Record<string, any>>(`
    SELECT
      ad_group_ad.ad.id,
      ad_group_ad.resource_name,
      ad_group_ad.ad.type,
      ad_group_ad.status,
      ad_group_ad.ad_strength,
      ad_group_ad.ad.responsive_search_ad.headlines,
      ad_group_ad.ad.responsive_search_ad.descriptions,
      ad_group_ad.ad.final_urls,
      ad_group.id, campaign.id,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.ctr, metrics.conversions
    FROM ad_group_ad
    ${where}
    ORDER BY metrics.cost_micros DESC
    LIMIT 100
  `)

  return rows.map((r) => {
    const rsa = r.ad_group_ad?.ad?.responsive_search_ad as { headlines?: unknown[]; descriptions?: unknown[] } | undefined
    return {
      id:           String(r.ad_group_ad?.ad?.id ?? ''),
      resourceName: String(r.ad_group_ad?.resource_name ?? ''),
      adGroupId:    String(r.ad_group?.id ?? ''),
      campaignId:   String(r.campaign?.id ?? ''),
      type:         'RESPONSIVE_SEARCH_AD' as const,
      status:       String(r.ad_group_ad?.status ?? 'ENABLED') as GoogleResponsiveSearchAd['status'],
      adStrength:   String(r.ad_group_ad?.ad_strength ?? 'AVERAGE') as GoogleResponsiveSearchAd['adStrength'],
      headlines:    ((rsa?.headlines ?? []) as { text: string; pinned_field?: string }[]).map((h) => ({
        text: String(h.text ?? ''),
        pinnedField: h.pinned_field as GoogleResponsiveSearchAd['headlines'][0]['pinnedField'],
      })),
      descriptions: ((rsa?.descriptions ?? []) as { text: string; pinned_field?: string }[]).map((d) => ({
        text: String(d.text ?? ''),
        pinnedField: d.pinned_field as GoogleResponsiveSearchAd['descriptions'][0]['pinnedField'],
      })),
      finalUrls: (r.ad_group_ad?.ad?.final_urls as string[] | undefined) ?? [],
      metrics: {
        impressions:      Number(r.metrics?.impressions ?? 0),
        clicks:           Number(r.metrics?.clicks ?? 0),
        costMicros:       Number(r.metrics?.cost_micros ?? 0),
        conversions:      Number(r.metrics?.conversions ?? 0),
        conversionsValue: 0,
        ctr:              Number(r.metrics?.ctr ?? 0),
        averageCpcMicros: 0,
      },
    }
  })
}

// ─── Audiences ───────────────────────────────────────────────────────────────

export async function listAudiences(): Promise<GoogleAudience[]> {
  const rows = await gaqlQuery<Record<string, any>>(`
    SELECT
      user_list.id,
      user_list.resource_name,
      user_list.name,
      user_list.type,
      user_list.membership_status,
      user_list.size_for_display,
      user_list.description,
      user_list.match_rate_percentage
    FROM user_list
    WHERE user_list.membership_status = 'OPEN'
    LIMIT 100
  `)

  return rows.map((r) => ({
    id:           String(r.user_list?.id ?? ''),
    resourceName: String(r.user_list?.resource_name ?? ''),
    name:         String(r.user_list?.name ?? ''),
    type:         'CUSTOMER_MATCH' as GoogleAudience['type'],
    status:       'OPEN' as const,
    size:         Number(r.user_list?.size_for_display ?? 0) || undefined,
    description:  r.user_list?.description ? String(r.user_list.description) : undefined,
    matchRate:    Number(r.user_list?.match_rate_percentage ?? 0) || undefined,
  }))
}

// ─── Extensions ──────────────────────────────────────────────────────────────

export async function listExtensions(): Promise<GoogleExtension[]> {
  const rows = await gaqlQuery<Record<string, any>>(`
    SELECT
      asset.id,
      asset.resource_name,
      asset.type,
      asset.sitelink_asset.link_text,
      asset.sitelink_asset.description1,
      asset.sitelink_asset.description2,
      asset.sitelink_asset.final_urls,
      asset.callout_asset.callout_text,
      asset.call_asset.phone_number,
      asset.call_asset.country_code
    FROM asset
    WHERE asset.type IN ('SITELINK', 'CALLOUT', 'CALL')
    LIMIT 100
  `)

  return rows.map((r): GoogleExtension => {
    const type = String(r.asset?.type ?? '')
    if (type === 'SITELINK') {
      return {
        type:         'SITELINK',
        id:           String(r.asset?.id ?? ''),
        linkText:     String(r.asset?.sitelink_asset?.link_text ?? ''),
        description1: r.asset?.sitelink_asset?.description1 ? String(r.asset.sitelink_asset.description1) : undefined,
        description2: r.asset?.sitelink_asset?.description2 ? String(r.asset.sitelink_asset.description2) : undefined,
        finalUrls:    (r.asset?.sitelink_asset?.final_urls as string[] | undefined) ?? [],
      }
    }
    if (type === 'CALL') {
      return {
        type:        'CALL',
        id:          String(r.asset?.id ?? ''),
        phoneNumber: String(r.asset?.call_asset?.phone_number ?? ''),
        countryCode: String(r.asset?.call_asset?.country_code ?? 'AE'),
        callOnly:    false,
      }
    }
    return {
      type:         'CALLOUT',
      id:           String(r.asset?.id ?? ''),
      calloutText:  String(r.asset?.callout_asset?.callout_text ?? ''),
    }
  })
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function getReportSummary(dateRange: '7d' | '30d' | '90d'): Promise<GoogleReportSummary> {
  const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90
  const during = `LAST_${days}_DAYS`

  const [campaignRows, searchTermRows, dayRows, deviceRows] = await Promise.all([
    gaqlQuery<Record<string, any>>(`
      SELECT campaign.id, campaign.name, campaign.advertising_channel_type,
        metrics.impressions, metrics.clicks, metrics.cost_micros,
        metrics.conversions, metrics.ctr, metrics.average_cpc
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      AND segments.date DURING ${during}
    `),
    gaqlQuery<Record<string, any>>(`
      SELECT search_term_view.search_term, search_term_view.status,
        segments.keyword.info.match_type,
        ad_group.name, campaign.name,
        metrics.impressions, metrics.clicks, metrics.cost_micros,
        metrics.conversions, metrics.ctr
      FROM search_term_view
      WHERE segments.date DURING ${during}
      ORDER BY metrics.impressions DESC
      LIMIT 200
    `),
    gaqlQuery<Record<string, any>>(`
      SELECT segments.date,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      AND segments.date DURING ${during}
    `),
    gaqlQuery<Record<string, any>>(`
      SELECT segments.device,
        metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE campaign.status != 'REMOVED'
      AND segments.date DURING ${during}
    `),
  ])

  const totalImpressions = campaignRows.reduce((s, r) => s + Number(r.metrics?.impressions ?? 0), 0)
  const totalClicks      = campaignRows.reduce((s, r) => s + Number(r.metrics?.clicks ?? 0), 0)
  const totalCostMicros  = campaignRows.reduce((s, r) => s + Number(r.metrics?.cost_micros ?? 0), 0)
  const totalConversions = campaignRows.reduce((s, r) => s + Number(r.metrics?.conversions ?? 0), 0)

  return {
    dateRange,
    totalImpressions,
    totalClicks,
    totalCostMicros,
    totalConversions,
    avgCtr:         totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    avgCpcMicros:   totalClicks > 0 ? totalCostMicros / totalClicks : 0,
    searchTerms:    searchTermRows.map((r) => ({
      searchTerm:   String(r.search_term_view?.search_term ?? ''),
      matchType:    String(r.segments?.keyword?.info?.match_type ?? ''),
      adGroupName:  String(r.ad_group?.name ?? ''),
      campaignName: String(r.campaign?.name ?? ''),
      impressions:  Number(r.metrics?.impressions ?? 0),
      clicks:       Number(r.metrics?.clicks ?? 0),
      ctr:          Number(r.metrics?.ctr ?? 0),
      costMicros:   Number(r.metrics?.cost_micros ?? 0),
      conversions:  Number(r.metrics?.conversions ?? 0),
      status:       String(r.search_term_view?.status ?? 'NONE') as GoogleReportSummary['searchTerms'][0]['status'],
    })),
    byDay: dayRows.map((r) => ({
      date:        String(r.segments?.date ?? ''),
      impressions: Number(r.metrics?.impressions ?? 0),
      clicks:      Number(r.metrics?.clicks ?? 0),
      costMicros:  Number(r.metrics?.cost_micros ?? 0),
      conversions: Number(r.metrics?.conversions ?? 0),
    })),
    byDevice: deviceRows.map((r) => ({
      device:      String(r.segments?.device ?? 'DESKTOP') as GoogleReportSummary['byDevice'][0]['device'],
      impressions: Number(r.metrics?.impressions ?? 0),
      clicks:      Number(r.metrics?.clicks ?? 0),
      conversions: Number(r.metrics?.conversions ?? 0),
      costMicros:  Number(r.metrics?.cost_micros ?? 0),
    })),
    byCampaign: campaignRows.map((r) => ({
      campaignId:  String(r.campaign?.id ?? ''),
      name:        String(r.campaign?.name ?? ''),
      type:        String(r.campaign?.advertising_channel_type ?? 'SEARCH') as GoogleCampaign['type'],
      impressions: Number(r.metrics?.impressions ?? 0),
      clicks:      Number(r.metrics?.clicks ?? 0),
      conversions: Number(r.metrics?.conversions ?? 0),
      costMicros:  Number(r.metrics?.cost_micros ?? 0),
    })),
  }
}

// ─── Launch campaign ──────────────────────────────────────────────────────────

export async function launchSearchCampaign(p: LaunchGoogleCampaignPayload): Promise<{ campaignId: string }> {
  const { customerId } = await creds()
  const budgetMicros   = Math.round(p.dailyBudgetAED * 1_000_000)
  const tempBudgetKey  = 'budget~1'
  const tempCampaignKey = 'campaign~1'
  const tempAdGroupKey  = 'adgroup~1'

  const ops: unknown[] = [
    {
      campaignBudgetOperation: {
        create: {
          resourceName:  `customers/${customerId}/campaignBudgets/${tempBudgetKey}`,
          name:          `${p.campaignName} Budget`,
          amountMicros:  budgetMicros,
          deliveryMethod: 'STANDARD',
        },
      },
    },
    {
      campaignOperation: {
        create: {
          resourceName:           `customers/${customerId}/campaigns/${tempCampaignKey}`,
          name:                   p.campaignName,
          advertisingChannelType: p.type,
          status:                 'PAUSED',
          campaignBudget:         `customers/${customerId}/campaignBudgets/${tempBudgetKey}`,
          // Campaign-level tracking template — the Google mirror of the
          // url_tags lib/meta/client.ts stamps on every Meta creative. {lpurl}
          // and {campaignid} are Google ValueTrack params substituted at SERVE
          // time (so referencing the campaign id here works even though the
          // campaign doesn't exist yet in this atomic mutate). Every served
          // click lands with utm_source/medium/campaign/id, which is exactly
          // what the CRM attribution matcher keys on (utm_id = campaign id OR
          // utm_campaign name) — and what makes getCampaignQuality work for
          // Google leads. finalUrls stay untouched; Google appends at serve.
          // THE CLICK ID IS NOT AUTOMATIC. Auto-tagging puts a gclid on the
          // landing URL only when it is switched on in the account, and that
          // is a setting nobody in this product can see or fix. Without it,
          // Google will never accept an offline conversion for this lead —
          // and a click id not captured is gone, unlike a deal value which can
          // be typed in next month. See lib/freehold/click-identity.ts.
          trackingUrlTemplate:
            '{lpurl}?utm_source=google&utm_medium=paid&utm_campaign={campaignid}&utm_id={campaignid}'
            + `&${GOOGLE_CLICK_TRACKING}`,
          ...(p.biddingStrategy === 'TARGET_CPA'
            ? { targetCpa: { targetCpaMicros: Math.round((p.targetCpaAED ?? 50) * 1_000_000) } }
            : { maximizeConversions: {} }),
          startDate: p.startDate ?? new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        },
      },
    },
    {
      adGroupOperation: {
        create: {
          resourceName: `customers/${customerId}/adGroups/${tempAdGroupKey}`,
          name:         `${p.listingName} — ${p.area}`,
          campaign:     `customers/${customerId}/campaigns/${tempCampaignKey}`,
          status:       'ENABLED',
          type:         'STANDARD',
        },
      },
    },
    {
      adGroupAdOperation: {
        create: {
          adGroup: `customers/${customerId}/adGroups/${tempAdGroupKey}`,
          status:  'ENABLED',
          ad: {
            responsiveSearchAd: {
              headlines:    p.headlines.slice(0, 15).map((text) => ({ text })),
              descriptions: p.descriptions.slice(0, 4).map((text) => ({ text })),
            },
            finalUrls: [p.finalUrl],
          },
        },
      },
    },
    ...(p.keywords ?? []).map((kw) => ({
      adGroupCriterionOperation: {
        create: {
          adGroup:  `customers/${customerId}/adGroups/${tempAdGroupKey}`,
          status:   'ENABLED',
          keyword: {
            text:      kw.text,
            matchType: kw.matchType,
          },
        },
      },
    })),
  ]

  const result = await mutate(ops) as { mutateOperationResponses?: { campaignResult?: { resourceName?: string } }[] }
  const campaignResourceName = result?.mutateOperationResponses?.[1]?.campaignResult?.resourceName ?? ''
  const campaignId = campaignResourceName.split('/').pop() ?? ''
  return { campaignId }
}
