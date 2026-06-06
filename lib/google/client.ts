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
  type LaunchGoogleCampaignPayload,
  type NegativeKeyword,
} from './types'

// ─── Credentials ─────────────────────────────────────────────────────────────

function creds() {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  const clientId       = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret   = process.env.GOOGLE_ADS_CLIENT_SECRET
  const refreshToken   = process.env.GOOGLE_ADS_REFRESH_TOKEN
  const customerId     = process.env.GOOGLE_ADS_CUSTOMER_ID

  if (!developerToken || !clientId || !clientSecret || !refreshToken || !customerId) {
    throw new GoogleConfigError(
      'Google Ads credentials are not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN, ' +
      'GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_REFRESH_TOKEN, ' +
      'and GOOGLE_ADS_CUSTOMER_ID in environment variables.',
    )
  }
  return { developerToken, clientId, clientSecret, refreshToken, customerId }
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

async function gaqlQuery<T>(gaql: string): Promise<T[]> {
  const { developerToken, clientId, clientSecret, refreshToken, customerId } = creds()
  const accessToken = await getAccessToken(clientId, clientSecret, refreshToken)

  const res = await fetch(
    `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:searchStream`,
    {
      method:  'POST',
      headers: {
        Authorization:        `Bearer ${accessToken}`,
        'developer-token':    developerToken,
        'Content-Type':       'application/json',
        'login-customer-id':  process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? customerId,
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
  const { developerToken, clientId, clientSecret, refreshToken, customerId } = creds()
  const accessToken = await getAccessToken(clientId, clientSecret, refreshToken)

  const res = await fetch(
    `https://googleads.googleapis.com/v16/customers/${customerId}/googleAds:mutate`,
    {
      method:  'POST',
      headers: {
        Authorization:       `Bearer ${accessToken}`,
        'developer-token':   developerToken,
        'Content-Type':      'application/json',
        'login-customer-id': process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? customerId,
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

export async function listCampaigns(): Promise<GoogleCampaign[]> {
  const rows = await gaqlQuery<Record<string, any>>(`
    SELECT
      campaign.id,
      campaign.resource_name,
      campaign.name,
      campaign.status,
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
      metrics.average_cpc
    FROM campaign
    WHERE campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 50
  `)

  return rows.map((r) => ({
    id:                   String(r.campaign?.id ?? ''),
    resourceName:         String(r.campaign?.resource_name ?? ''),
    name:                 String(r.campaign?.name ?? ''),
    status:               String(r.campaign?.status ?? 'PAUSED') as GoogleCampaign['status'],
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
  }))
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
    WHERE campaign.id = ${campaignId}
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
  const { customerId } = creds()
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

// ─── Ad Groups ────────────────────────────────────────────────────────────────

export async function listAdGroups(campaignId?: string): Promise<GoogleAdGroup[]> {
  const where = campaignId
    ? `WHERE campaign.id = ${campaignId} AND ad_group.status != 'REMOVED'`
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
    ? `WHERE campaign.id = ${campaignId} AND ad_group_criterion.status != 'REMOVED'`
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
    ? `WHERE campaign.id = ${campaignId}`
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
    ? `WHERE campaign.id = ${campaignId} AND ad_group_ad.status != 'REMOVED'`
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
    auctionInsights: [],
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
  const { customerId } = creds()
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
