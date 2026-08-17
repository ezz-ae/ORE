/**
 * Meta Marketing API v20.0 client.
 * All calls are server-side only — token is never exposed to the browser.
 */

import { createHash } from 'crypto'
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
  MetaPixel,
  MetaPixelDetail,
  MetaCustomConversion,
  MetaAdFormat,
  MetaLocale,
  AdDestination,
  MetaCta,
  PlacementKey,
  PlacementCreativeOverride,
} from './types'
import { mergeLeadLanguages } from './lead-language'
import { questionsForMeta } from './form-templates'
import { explainMetaError } from './error-advice'
import { pageAdsVerdict, type PageAdsVerdict } from './page-ads'
import { objectiveToOptimizationGoal } from './optimization-goal'
import { metaLeadCount } from './lead-count'
import { eventCostsFromInsights } from './event-costs'
import { geoLocationsSpec } from './geo-spec'
import { HEADLINE_WINDOW, RECENT_WINDOW, indexInsightsByCampaign, type CampaignInsightRow } from './insights-window'
import {
  callToActionSpec, isVideoUrl, pickThumbnail, videoDataSpec, videoStatusOf,
  whyNotLaunchable, VIDEO_POLL_DELAYS_MS, type VideoStatus, type VideoThumbnail,
} from './video-ad'
import type { EventCosts } from '@/lib/freehold/learning-phase'
import {
  placementSpecFor, ADVANTAGE_AUDIENCE_OFF, CREATIVE_ENHANCEMENTS_OFF,
  findAdvantageInAdSet, describeViolations,
} from './no-advantage'
import {
  readInvariants, withoutPlacement, placementKeys, type PlacementWriteOutcome,
} from './placement-write'
import type { MetaInsightActions } from './types'

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
  // Where the AD ACCOUNT came from. Env wins over the UI connection, so if an
  // env var is set, reconnecting through Integrations → Meta changes nothing —
  // which looks exactly like the app ignoring you. Callers surface this.
  const accountSource: 'env' | 'db' = process.env.META_AD_ACCOUNT_ID ? 'env' : 'db'
  return { token, adAccountId, pageId, pixelId: pixelId ?? null, accountSource }
}

// True when Meta ad credentials are configured (env or stored) — distinct from
// whether a given API call succeeds. Lets callers separate "not connected" from
// "connected but this call returned nothing".
export async function isMetaConfigured(): Promise<boolean> {
  try { await creds(); return true } catch { return false }
}

/**
 * Turn a Graph error into something the person reading it can ACT on.
 *
 * This used to exist only on the write path (apiPost). Every READ — the
 * campaigns list, insights, forms, the Ads Machine's whole evaluate step —
 * threw Meta's raw text straight at the operator, e.g.
 *
 *   "(#200) Ad account owner has NOT grant ads_management or ads_read
 *    permission, refer to https://developers.facebook.com/docs/marketing-api/…"
 *
 * That is a developer's sentence on a business owner's screen: it names no
 * button, no page, and links to API reference documentation. Reads are what
 * people hit constantly, so the friendlier half was on exactly the wrong side.
 * One translator now serves both.
 */
interface GraphError {
  message: string
  code: number
  type: string
  fbtrace_id?: string
  error_subcode?: number
  error_user_msg?: string
  error_user_title?: string
}

// Keyed by Graph error_subcode — the most specific signal when present.
/**
 * Meta's failure, said in words the person reading it can act on.
 *
 * A fault we know gets one plain sentence (see error-advice). Anything else
 * keeps Meta's own text, subcode included — the subcode is what makes a new
 * fault identifiable, and inventing an explanation for an error nobody has
 * seen would be confidently wrong.
 */
function metaErrorDetail(e: GraphError): string {
  const advice = explainMetaError({ message: e.message, code: e.code, subcode: e.error_subcode })
  if (advice) return advice
  return [e.message, e.error_user_title, e.error_user_msg, e.error_subcode ? `subcode ${e.error_subcode}` : '']
    .filter(Boolean).join(' — ')
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  params?: Record<string, string>,
  /** Use a specific access token instead of the connected one. Lead-gen forms
   *  and their leads are PAGE assets: Meta expects the owning Page's own access
   *  token, and a business with several Pages needs a different token per Page.
   *  See listAccessiblePages. */
  tokenOverride?: string,
): Promise<T> {
  const token = tokenOverride || (await creds()).token
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
    const e = json.error as GraphError
    throw new MetaApiError(metaErrorDetail(e), e.code, e.type, e.fbtrace_id)
  }

  return json as T
}

/**
 * Cursor-following variant of apiFetch for Graph edges that return
 * `{ data, paging }` — apiFetch itself is untouched, so every existing caller
 * keeps its exact behavior. Follows paging.cursors.after until Meta reports no
 * next page or `maxItems` is reached (silent truncation at one page was hiding
 * forms/leads past the first `limit`).
 */
async function apiFetchAllPages<T>(
  path: string,
  params: Record<string, string>,
  maxItems: number,
  tokenOverride?: string,
): Promise<T[]> {
  const items: T[] = []
  let after: string | undefined
  while (items.length < maxItems) {
    const res = await apiFetch<{
      data: T[]
      paging?: { cursors?: { after?: string }; next?: string }
    }>(path, undefined, { ...params, ...(after ? { after } : {}) }, tokenOverride)
    const batch = res.data ?? []
    items.push(...batch)
    after = res.paging?.cursors?.after
    if (!res.paging?.next || !after || batch.length === 0) break
  }
  return items.length > maxItems ? items.slice(0, maxItems) : items
}

async function apiPost<T>(path: string, body: Record<string, unknown>, tokenOverride?: string): Promise<T> {
  const token = tokenOverride || (await creds()).token
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set('access_token', token)

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const json = (await res.json()) as MetaApiResponse<T> & T
  if ('error' in json && json.error) {
    const e = json.error as GraphError
    // Same translator as the read path — one place to teach, both sides learn.
    throw new MetaApiError(metaErrorDetail(e), e.code, e.type, e.fbtrace_id)
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

/**
 * THE TRACKING TAGS ON EVERY AD WE CREATE — and the one parameter the whole
 * CRM hangs on.
 *
 * Meta appends these at click time, substituting its own macros. The critical
 * one is utm_id.
 *
 * THE BUG THIS FIXES, live since these tags were written: the string set
 * `utm_campaign={{campaign.id}}` and no utm_id at all. Every reader of
 * attribution in this product — bucketLeadsByCampaign, getCampaignQuality, the
 * form analysis, the audience snapshot, the CRM's source column — matches a
 * lead to a campaign on `utm_id`, falling back to `utm_campaign` compared
 * against the campaign NAME.
 *
 * So a landing-page lead stored the campaign ID in the NAME column and left
 * the ID column empty, and BOTH matches missed: the id match had nothing to
 * read, and the name match compared a seventeen-digit number against a human
 * campaign name. Every landing-page lead this account ever bought was
 * unattributed. That is the 571 CRM rows reading "General enquiry" — the money
 * was spent, the leads arrived, and no per-campaign number downstream was
 * standing on anything.
 *
 * Instant-form leads were unaffected: meta-lead-sync stamps utm_id itself at
 * sync time, which is why the machine's Google-versus-Meta comparisons looked
 * plausible while half the evidence was missing.
 *
 * Now the id goes in the id column and the name goes in the name column. ONE
 * definition, so the four creative-building paths cannot drift apart again.
 */
const AD_URL_TAGS =
  'utm_source=meta&utm_medium=paid' +
  '&utm_id={{campaign.id}}' +
  '&utm_campaign={{campaign.name}}' +
  '&utm_term={{adset.id}}&utm_content={{ad.id}}' +
  '&fh_placement={{placement}}&fh_site={{site_source_name}}'

// ─── Campaigns ───────────────────────────────────────────────────────────────

/**
 * Can we actually READ this ad account right now?
 *
 * "Connected" has meant "someone saved a token" — presence, never capability.
 * A token can be present, well-formed and stored, while Meta refuses every
 * call because the ad account never granted it ads_read/ads_management. That
 * is the state where the Integrations page shows green and the campaigns page
 * shows nothing, which is exactly as confusing as it sounds.
 *
 * One cheap field read against the configured ad account. Never throws — the
 * failure IS the answer, and it arrives already translated into instructions.
 */
export async function probeAdAccountAccess(): Promise<{ ok: boolean; message?: string; accountName?: string }> {
  try {
    const { adAccountId } = await creds()
    const acct = await apiFetch<{ id: string; name?: string }>(`/${adAccountId}`, undefined, { fields: 'id,name' })
    return { ok: true, accountName: acct?.name }
  } catch (e) {
    if (e instanceof MetaConfigError) return { ok: false, message: e.message }
    if (e instanceof MetaApiError) return { ok: false, message: e.message }
    return { ok: false, message: e instanceof Error ? e.message : 'Meta could not be reached' }
  }
}

export async function listCampaigns(): Promise<MetaCampaign[]> {
  const { adAccountId } = await creds()
  const res = await apiFetch<{ data: MetaCampaign[] }>(`/${adAccountId}/campaigns`, undefined, {
    fields: 'id,name,status,effective_status,objective,daily_budget,created_time,start_time,stop_time,issues_info',
    limit: '100',
  })
  return res.data ?? []
}

/**
 * Why is the campaign list empty when Integrations → Meta shows plenty?
 *
 * Those two screens ask Meta different questions. Integrations enumerates
 * `/me/adaccounts` and lists campaigns for EVERY account the access token can
 * see. Everything else in the app — this client — reads exactly ONE account,
 * the configured `META_AD_ACCOUNT_ID`. So a token with access to several
 * accounts, pointed at the wrong (or a brand-new, empty) one, produces a fully
 * "connected" integration page and a completely empty ads page.
 *
 * The empty state could not tell those apart, so it said "no campaigns yet —
 * create one", which is simply false when the campaigns exist one account over.
 * This scan is what lets it tell the truth instead. Only run it when the list
 * came back empty: it costs one call per visible account, which is worth it
 * exactly once, at the moment someone is staring at a wrong empty screen.
 */
export interface MetaAccountScan {
  configuredAccountId: string
  configuredName: string | null
  /** 'env' means an environment variable pins this account and reconnecting
   *  through the UI will NOT change it — the fix is an env change. */
  accountSource: 'env' | 'db'
  /** Other ad accounts this token can see, with how many campaigns each holds. */
  others: { id: string; name: string | null; campaigns: number }[]
  /** Total campaigns visible to the token outside the configured account. */
  elsewhere: number
}

export async function scanAdAccounts(): Promise<MetaAccountScan | null> {
  try {
    const { adAccountId, accountSource } = await creds()
    const accts = await apiFetch<{ data: { id: string; name?: string }[] }>('/me/adaccounts', undefined, {
      fields: 'id,name',
      limit: '25',
    })
    const list = accts.data ?? []
    if (list.length === 0) return null

    const configured = list.find((a) => a.id === adAccountId) ?? null
    const others: MetaAccountScan['others'] = []
    for (const a of list) {
      if (a.id === adAccountId) continue
      try {
        const r = await apiFetch<{ data: { id: string }[] }>(`/${a.id}/campaigns`, undefined, { fields: 'id', limit: '50' })
        const n = (r.data ?? []).length
        if (n > 0) others.push({ id: a.id, name: a.name ?? null, campaigns: n })
      } catch { /* one unreadable account must not sink the whole diagnosis */ }
    }
    return {
      configuredAccountId: adAccountId,
      configuredName: configured?.name ?? null,
      accountSource,
      others,
      elsewhere: others.reduce((s, o) => s + o.campaigns, 0),
    }
  } catch {
    return null
  }
}

export async function getCampaign(campaignId: string): Promise<MetaCampaign> {
  return apiFetch<MetaCampaign>(`/${campaignId}`, undefined, {
    fields: 'id,name,status,effective_status,objective,daily_budget,created_time,start_time,stop_time,issues_info',
  })
}

/**
 * EVERYTHING THIS CAMPAIGN EVER DID — a total that cannot shrink.
 *
 * `getCampaignInsights` reads a rolling 30 days, which is right for judging
 * how a LIVE campaign is doing now and wrong for the question a broker asks
 * about a finished one: how many leads did this bring?
 *
 * A rolling window has a property nobody expects until they see it. Switch a
 * campaign off and its results start draining out of the window a day at a
 * time; thirty days after the last lead the campaign reads zero leads and zero
 * spend, as though it had never run. The work is not gone from Meta — it has
 * simply fallen out of the question we were asking.
 *
 * `maximum` is Meta's lifetime preset. The number it returns only ever goes up.
 *
 * Returns null rather than throwing — a caller falls back to the rolling
 * window instead of losing the page.
 */
export async function getCampaignLifetimeInsights(campaignId: string): Promise<MetaInsights | null> {
  try {
    const res = await apiFetch<{ data: MetaInsights[] }>(`/${campaignId}/insights`, undefined, {
      fields: 'impressions,clicks,spend,actions,cost_per_action_type,cpc,cpm,frequency,reach',
      date_preset: 'maximum',
    })
    return res.data?.[0] ?? null
  } catch {
    return null
  }
}

/**
 * WHAT AN EVENT COSTS ON THIS ACCOUNT, over the last 30 days.
 *
 * The input the learning-phase ceiling has always needed and never had. Read
 * at the ACCOUNT, not at a campaign: the question is what this advertiser's
 * money buys, and a brand-new campaign has no history of its own to answer it
 * with — which is precisely the moment the ceiling matters.
 *
 * Returns all-null rather than throwing. All-null is a real answer here: it
 * means nothing has been measured yet, and the planner is built to respond to
 * that by running one arm until there is something to measure.
 */
export async function getAccountEventCosts(): Promise<EventCosts> {
  try {
    const { adAccountId } = await creds()
    const res = await apiFetch<{ data: MetaInsights[] }>(`/${adAccountId}/insights`, undefined, {
      fields: 'spend,actions',
      date_preset: 'last_30d',
    })
    return eventCostsFromInsights(res.data?.[0] ?? null)
  } catch {
    return { link_click: null, landing_view: null, lead: null }
  }
}

/**
 * DAY BY DAY — the shape a total cannot show.
 *
 * A campaign's lifetime spend and lead count answer "how much" and hide
 * "which way". Rising cost per lead and falling cost per lead produce the
 * same average; a campaign that stopped delivering four days ago and one
 * that never started read identically as a single number. The daily series
 * is the difference between a figure and a trend.
 *
 * Returns [] rather than throwing — a page that cannot draw a chart still
 * has its numbers, and an empty series renders as "not enough days yet"
 * instead of an error.
 */
export async function getCampaignDailySeries(campaignId: string): Promise<Array<{
  date: string; spend: number; leads: number; impressions: number; clicks: number
}>> {
  try {
    const res = await apiFetch<{ data?: MetaInsights[] }>(`/${campaignId}/insights`, undefined, {
      fields: 'spend,impressions,clicks,actions',
      date_preset: 'last_30d',
      time_increment: '1',
    })
    return (res.data ?? []).map((row) => ({
      date: String(row.date_start ?? ''),
      spend: Number(row.spend) || 0,
      leads: metaLeadCount(row.actions),
      impressions: Number(row.impressions) || 0,
      clicks: Number(row.clicks) || 0,
    })).filter((r) => r.date)
  } catch {
    return []
  }
}

/**
 * EVERY CAMPAIGN'S LIFETIME NUMBERS, IN ONE CALL.
 *
 * The campaigns list used to ask per campaign, and only for the ones whose
 * status was ACTIVE — so a paused campaign that had spent AED 400 and brought
 * two leads printed AED 0 and zero on the home screen. The account-level
 * insights edge answers for all of them at once, at the same lifetime window
 * the campaign page's headline numbers use, so the two screens cannot
 * disagree. One Graph call rather than one per campaign.
 *
 * Returns an empty map rather than throwing: a list that loses its numbers is
 * still a usable list, and every consumer already renders a missing row as
 * "never delivered".
 */
export async function getAccountCampaignInsights(): Promise<Map<string, MetaInsights>> {
  try {
    const { adAccountId } = await creds()
    const res = await apiFetch<{ data: CampaignInsightRow[] }>(`/${adAccountId}/insights`, undefined, {
      fields: 'campaign_id,impressions,clicks,spend,actions,cost_per_action_type,cpc,cpm,frequency,reach',
      level: 'campaign',
      date_preset: HEADLINE_WINDOW,
      limit: '200',
    })
    return indexInsightsByCampaign(res.data)
  } catch {
    return new Map()
  }
}

/**
 * EVERY AD'S NUMBERS DAY BY DAY — keyed by ad id, oldest day first.
 *
 * Every other insights read in this file asks for a TOTAL, and a total cannot
 * answer the one question that matters about a picture: is it still working?
 * A creative that produced brilliantly for a fortnight and nothing since reads
 * as a good creative in any window that contains both fortnights.
 *
 * `time_increment: 1` is the whole difference. It is one call for the account
 * rather than one per ad, and `frequency` rides along on each row because
 * telling fatigue from an audience change needs it — see
 * lib/freehold/creative-decay.ts, which is where the judgement lives.
 *
 * Thirty days: long enough for two halves that can separate, short enough that
 * it is about the creative running now. Returns an empty map rather than
 * throwing — a panel with no history is a true screen, an error is not.
 */
export async function getAdDailyInsights(): Promise<Map<string, Array<{
  day: string; impressions: number; leads: number; spendAed: number; frequency: number
}>>> {
  const out = new Map<string, Array<{
    day: string; impressions: number; leads: number; spendAed: number; frequency: number
  }>>()
  try {
    const { adAccountId } = await creds()
    const res = await apiFetchAllPages<Record<string, unknown>>(
      `/${adAccountId}/insights`,
      {
        fields: 'ad_id,impressions,spend,actions,frequency',
        level: 'ad',
        time_increment: '1',
        date_preset: RECENT_WINDOW,
        limit: '500',
      },
      5000,
    )
    for (const row of res) {
      const id = String(row?.ad_id ?? '').trim()
      const day = String(row?.date_start ?? '').trim()
      if (!id || !day) continue
      const list = out.get(id) ?? []
      list.push({
        day,
        impressions: Number(row?.impressions) || 0,
        leads: metaLeadCount(row?.actions as MetaInsightActions[] | undefined),
        spendAed: Number(row?.spend) || 0,
        frequency: Number(row?.frequency) || 0,
      })
      out.set(id, list)
    }
    // Oldest first, so "early" and "recent" mean what they say downstream.
    for (const list of out.values()) list.sort((a, b) => a.day.localeCompare(b.day))
  } catch { /* an empty history is a true screen; an error is not */ }
  return out
}

/**
 * EVERY AD'S LIFETIME NUMBERS, IN ONE CALL — keyed by ad id.
 *
 * The creative lab ranks recipes by what the ads made from them actually did,
 * and a project can easily hold thirty ads across five campaigns. Asking per
 * ad would be thirty Graph calls to answer one screen. The account-level
 * insights edge answers for all of them at once, at the same lifetime window
 * every other report in this product uses — a creative that ran in March and
 * brought leads did not stop having brought them in April.
 *
 * Returns an empty map rather than throwing: the lab then shows the project's
 * uniform and an empty history, which is a true screen, instead of an error.
 */
export async function getAccountAdInsights(): Promise<Map<string, {
  impressions: number; clicks: number; leads: number; spendAED: number
}>> {
  const out = new Map<string, { impressions: number; clicks: number; leads: number; spendAED: number }>()
  try {
    const { adAccountId } = await creds()
    const res = await apiFetch<{ data?: Array<Record<string, unknown>> }>(`/${adAccountId}/insights`, undefined, {
      fields: 'ad_id,impressions,clicks,spend,actions',
      level: 'ad',
      date_preset: HEADLINE_WINDOW,
      limit: '500',
    })
    for (const row of res.data ?? []) {
      const id = String(row?.ad_id ?? '').trim()
      if (!id || out.has(id)) continue
      out.set(id, {
        impressions: Number(row?.impressions) || 0,
        clicks: Number(row?.clicks) || 0,
        leads: metaLeadCount(row?.actions as MetaInsightActions[] | undefined),
        spendAED: Number(row?.spend) || 0,
      })
    }
  } catch { /* an empty history is a true screen; an error is not */ }
  return out
}

export async function getCampaignInsights(campaignId: string): Promise<MetaInsights | null> {
  const res = await apiFetch<{ data: MetaInsights[] }>(`/${campaignId}/insights`, undefined, {
    // frequency/reach are what make creative fatigue detectable at all —
    // without them a decaying winner is indistinguishable from a healthy one.
    fields: 'impressions,clicks,spend,actions,cost_per_action_type,cpc,cpm,frequency,reach',
    // ROLLING 30 DAYS, not this_month. A calendar window silently erases every
    // trial's history at midnight on the 1st: spend and leads both read ~zero,
    // so the Ads Machine's spend gate cannot fire, its CPL and quality branches
    // have nothing to compare, and GROW cannot identify a winner. The machine
    // was therefore frozen for the first days of EVERY month — unable to
    // condemn or to scale — no matter how much evidence the previous 30 days
    // had produced. It also made this page read as "everything is dead" on the
    // 1st. A rolling window is what an ads operator means by recent
    // performance, and it never resets.
    date_preset: 'last_30d',
  })
  return res.data?.[0] ?? null
}

/** One placement's slice of a campaign's delivery. */
export interface MetaPlacementInsight {
  /** e.g. 'facebook', 'instagram', 'audience_network', 'messenger'. */
  platform: string
  /** e.g. 'feed', 'story', 'facebook_reels', 'instream_video', 'an_classic'. */
  position: string
  impressions: number
  clicks: number
  spend: number
  leads: number
}

/**
 * Delivery broken down by PLACEMENT — the answer to "where did the money
 * actually go", which the campaign-level rollup cannot give.
 *
 * This matters for two separate reasons that look identical in a rollup:
 *
 *  1. Overflow inventory. Audience Network and Reels surplus are bundled into
 *     every advertiser's delivery, and Meta will happily push a large share of
 *     impressions there, priced in your own currency so it reads as ordinary
 *     spend. A campaign can look fine on cost per lead while most of its
 *     impressions went somewhere nobody else bid for.
 *  2. Creative destruction. A 1:1 or 4:5 image placed into a 9:16 surface is
 *     cropped, overlaid with UI chrome, or letterboxed. The ad that performs
 *     in feed is not the ad that ran in Stories — same creative id, different
 *     ad. Judging the creative on a blended number judges an average of two
 *     different ads.
 *
 * Both are invisible above this call and both are fixable, because placements
 * are one of the few things Meta still lets an advertiser control outright.
 *
 * Returns [] rather than throwing when the breakdown is unavailable, so a
 * caller degrades to the rollup instead of losing the whole view.
 */
/**
 * WHERE THE MONEY ACTUALLY LANDED, BY COUNTRY.
 *
 * A campaign targets the UAE. That is an instruction, not a receipt. Meta will
 * deliver to people it believes are IN the targeted locations, and the only
 * way to know whether that held is to read the country breakdown back.
 *
 * This answers one question and deliberately not another. It says WHERE an
 * impression was served and what it cost — a delivery fact, the same kind as
 * the placement audit. It says nothing about who anyone is; Meta's `country`
 * breakdown is the location the ad was shown in, not a person's nationality,
 * and it must never be read as one.
 *
 * What it is FOR: spend that lands outside the countries the campaign was
 * pointed at is money bought by mistake, and until now nothing in this product
 * could see it.
 *
 * Returns [] rather than throwing — a caller degrades to the rollup instead of
 * losing the whole view.
 */
export interface MetaCountryInsight {
  country: string
  impressions: number
  clicks: number
  spend: number
  leads: number
}

export async function getCampaignInsightsByCountry(campaignId: string): Promise<MetaCountryInsight[]> {
  try {
    const res = await apiFetch<{ data: Array<Record<string, unknown>> }>(`/${campaignId}/insights`, undefined, {
      fields: 'impressions,clicks,spend,actions',
      breakdowns: 'country',
      // The same rolling window as the rollup and the placement audit, so the
      // three can be read side by side without one quietly covering a
      // different span of time.
      date_preset: 'last_30d',
      limit: '200',
    })
    return (res.data ?? []).map((r) => ({
      country: String(r.country ?? 'unknown'),
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      spend: Number(r.spend) || 0,
      // The canonical lead rule — Meta reports one lead under several
      // overlapping action types, and summing them multiplies it.
      leads: metaLeadCount(r.actions as MetaInsightActions[] | undefined),
    })).sort((a, b) => b.spend - a.spend)
  } catch {
    return []
  }
}

export async function getCampaignInsightsByPlacement(campaignId: string): Promise<MetaPlacementInsight[]> {
  try {
    const res = await apiFetch<{ data: Array<Record<string, unknown>> }>(`/${campaignId}/insights`, undefined, {
      fields: 'impressions,clicks,spend,actions',
      // publisher_platform alone answers "is this Audience Network"; adding
      // platform_position answers "is this Stories eating the creative". They
      // are a legal breakdown pair and the second is what makes the aspect-
      // ratio problem visible at all.
      breakdowns: 'publisher_platform,platform_position',
      // Same rolling window as the rollup, so the two can be compared without
      // one of them silently covering a different span of time.
      date_preset: 'last_30d',
      limit: '200',
    })
    return (res.data ?? []).map((r) => ({
      platform: String(r.publisher_platform ?? 'unknown'),
      position: String(r.platform_position ?? 'unknown'),
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      spend: Number(r.spend) || 0,
      // Same canonical lead rule as everywhere else — Meta reports one lead
      // under several overlapping action types, and summing them multiplies it.
      leads: metaLeadCount(r.actions as MetaInsightActions[] | undefined),
    }))
  } catch {
    return []
  }
}

/**
 * Real delivery/learning state for a campaign — Meta's own effective_status
 * plus the ad set's learning phase. This is the honest "what is actually
 * happening" (in review / delivering / learning / not delivering) that the
 * generic ACTIVE/PAUSED status hides.
 */
export interface MetaCampaignDelivery {
  effectiveStatus: string
  adSetEffectiveStatus: string | null
  learningStage: string | null
}

/**
 * Today's spend for a campaign in the ad-account currency (AED). Zero when the
 * campaign hasn't spent yet today — the honest signal for "delivering but not
 * actually spending". Fail-soft to 0.
 */
export async function getCampaignSpendToday(campaignId: string): Promise<number> {
  const res = await apiFetch<{ data: Array<{ spend?: string }> }>(
    `/${campaignId}/insights`, undefined, { fields: 'spend', date_preset: 'today' },
  ).catch(() => ({ data: [] as Array<{ spend?: string }> }))
  return Number(res.data?.[0]?.spend ?? 0) || 0
}

export async function getCampaignDelivery(campaignId: string): Promise<MetaCampaignDelivery> {
  const camp = await apiFetch<{ effective_status?: string; status?: string }>(
    `/${campaignId}`, undefined, { fields: 'effective_status,status' },
  )
  // The learning phase lives on the ad set — read the first one (the machine
  // launches one ad set per trial campaign).
  const sets = await apiFetch<{ data: Array<{ effective_status?: string; learning_stage_info?: { learning_stage?: string } }> }>(
    `/${campaignId}/adsets`, undefined, { fields: 'effective_status,learning_stage_info', limit: '1' },
  ).catch(() => ({ data: [] as Array<{ effective_status?: string; learning_stage_info?: { learning_stage?: string } }> }))
  const first = sets.data?.[0]
  return {
    effectiveStatus: camp.effective_status ?? camp.status ?? 'UNKNOWN',
    adSetEffectiveStatus: first?.effective_status ?? null,
    learningStage: first?.learning_stage_info?.learning_stage ?? null,
  }
}

export async function updateCampaignStatus(
  campaignId: string,
  status: MetaCampaignStatus,
): Promise<{ success: boolean }> {
  return apiPost(`/${campaignId}`, { status })
}

// ─── Live reach / delivery estimate ──────────────────────────────────────────
// Meta's real audience-size estimate for a targeting spec — the number a free
// tool never surfaces mid-build. Returns null when Meta isn't connected (so the
// UI shows "connect for a live estimate" instead of a fabricated figure) or when
// the estimate isn't ready yet.
export interface ReachEstimate { lower: number; upper: number; ready: boolean }

export async function getReachEstimate(
  targeting: CampaignTargeting,
  optimizationGoal: MetaOptimizationGoal = 'REACH',
): Promise<ReachEstimate | null> {
  try {
    const { adAccountId } = await creds()
    // Same interest repair the launch does — a dead id fails an estimate
    // exactly as it fails an ad set, and this call swallows its errors
    // (callers `.catch(() => null)`), so the symptom was silent: every reach
    // number on the buyer cards and in the persona studio simply never
    // appeared. Repairing here is what makes them show up at all.
    ;({ targeting } = await repairTargetingInterests(targeting))
    // A minimal, valid targeting_spec for the estimate — geo + age + gender +
    // interests. Kept independent of createAdSet so the proven launch path is
    // untouched.
    const narrowing = (targeting.narrowing ?? []).filter((g) => (g.interests?.length || 0) + (g.behaviors?.length || 0) > 0)
    const baseGroup: Record<string, unknown> = {
      ...(targeting.interests.length ? { interests: targeting.interests } : {}),
      ...(targeting.behaviors?.length ? { behaviors: targeting.behaviors } : {}),
    }
    const spec: Record<string, unknown> = {
      // Through the ONE builder, so the reach number describes the audience the
      // ad will actually buy — residents, not residents plus tourists.
      geo_locations: geoLocationsSpec({
        countries: targeting.countries.length ? targeting.countries : ['AE'],
        cityKeys: targeting.cityKeys,
        locationTypes: targeting.locationTypes,
      }),
      age_min: targeting.ageMin,
      age_max: targeting.ageMax,
      ...(targeting.genders && targeting.genders.length ? { genders: targeting.genders } : {}),
      ...(narrowing.length
        ? {
            flexible_spec: [
              ...(Object.keys(baseGroup).length ? [baseGroup] : []),
              ...narrowing.map((g) => ({
                ...(g.interests?.length ? { interests: g.interests } : {}),
                ...(g.behaviors?.length ? { behaviors: g.behaviors } : {}),
              })),
            ],
          }
        : baseGroup),
      ...(targeting.customAudienceIds?.length
        ? { custom_audiences: targeting.customAudienceIds.map((id) => ({ id })) }
        : {}),
      // The estimate has to see the exclusion too. A reach number that counts
      // people the ad will never be shown to is not this audience's reach.
      ...(targeting.excludedCustomAudienceIds?.length
        ? { excluded_custom_audiences: targeting.excludedCustomAudienceIds.map((id) => ({ id })) }
        : {}),
      ...(targeting.exclusions && ((targeting.exclusions.interests?.length || 0) + (targeting.exclusions.behaviors?.length || 0) > 0)
        ? {
            exclusions: {
              ...(targeting.exclusions.interests?.length ? { interests: targeting.exclusions.interests } : {}),
              ...(targeting.exclusions.behaviors?.length ? { behaviors: targeting.exclusions.behaviors } : {}),
            },
          }
        : {}),
    }
    const res = await apiFetch<{ data?: Array<{ estimate_mau_lower_bound?: number; estimate_mau_upper_bound?: number; estimate_dau?: number; estimate_ready?: boolean }> }>(
      `/${adAccountId}/delivery_estimate`,
      undefined,
      { optimization_goal: optimizationGoal, targeting_spec: JSON.stringify(spec) },
    )
    const d = res.data?.[0]
    if (!d) return null
    const lower = d.estimate_mau_lower_bound ?? d.estimate_dau ?? 0
    const upper = d.estimate_mau_upper_bound ?? lower
    if (!lower && !upper) return null
    return { lower, upper, ready: d.estimate_ready ?? true }
  } catch {
    // Not connected / not permitted / not ready → honest null, never a fake number.
    return null
  }
}

/**
 * REPUBLISH THE ONE FIELD META DEPRECATED, and nothing else.
 *
 * Meta's targeting field is replace-whole: posting a partial spec would
 * silently DROP the narrowing layers, locales and exclusions — a worse
 * outcome than the flag it fixes. So: read the live spec raw, change only
 * geo_locations.location_types to the one supported pair, write the whole
 * spec back verbatim. The republish clears the deprecated-option validation
 * flag that blocks every other edit on the ad set.
 */
export async function fixAdSetLocationTypes(adSetId: string): Promise<{
  changed: boolean
  before: string[]
  after: string[]
  /** What we managed to send: the supported pair, or the field omitted. */
  attempted: string
}> {
  const res = await apiFetch<{ targeting?: Record<string, unknown> }>(
    `/${adSetId}`, undefined, { fields: 'targeting' })
  const spec = (res.targeting && typeof res.targeting === 'object' ? res.targeting : {}) as Record<string, unknown>
  const geo = (spec.geo_locations && typeof spec.geo_locations === 'object' ? spec.geo_locations : {}) as Record<string, unknown>
  const before = Array.isArray(geo.location_types) ? (geo.location_types as unknown[]).map(String) : []

  // ALWAYS REPUBLISH, even when the value already looks right. Meta's flag
  // lives on the ad set's draft state, not on the value alone — an ad set can
  // read home+recent and still refuse to publish until the audience is
  // rewritten. A no-op republish is free; a skipped one leaves the operator
  // pressing a button that reports success and changes nothing.
  let attempted: string
  try {
    await apiPost(`/${adSetId}`, {
      targeting: { ...spec, geo_locations: { ...geo, location_types: ['home', 'recent'] } },
    })
    attempted = 'home,recent'
  } catch (err) {
    // Meta removed the individual options ("living in", "recently in",
    // "traveling in") as SEPARATE choices. If it also refuses the explicit
    // pair, stop naming the field at all and let Meta apply the one behaviour
    // it still has — better than failing over a field nobody can set.
    if (!(err instanceof MetaApiError)) throw err
    const withoutField = { ...geo }
    delete (withoutField as Record<string, unknown>).location_types
    await apiPost(`/${adSetId}`, { targeting: { ...spec, geo_locations: withoutField } })
    attempted = 'omitted'
  }

  // READ IT BACK. A 200 from Meta means the write was accepted, NOT that the
  // stored value changed — and a button that reloads the page on a 200 is a
  // black box that reports success to an operator watching nothing happen.
  // The truth is whatever Meta holds after the write, so we go and ask.
  const verify = await apiFetch<{ targeting?: Record<string, unknown> }>(
    `/${adSetId}`, undefined, { fields: 'targeting' }).catch(() => null)
  const vGeo = (verify?.targeting?.geo_locations && typeof verify.targeting.geo_locations === 'object'
    ? verify.targeting.geo_locations : {}) as Record<string, unknown>
  const after = Array.isArray(vGeo.location_types) ? (vGeo.location_types as unknown[]).map(String) : []

  return {
    before,
    after,
    attempted,
    // Honest: did the STORED value actually move?
    changed: before.slice().sort().join(',') !== after.slice().sort().join(','),
  }
}

export async function deleteCampaign(campaignId: string): Promise<{ success: boolean }> {
  return updateCampaignStatus(campaignId, 'DELETED')
}

// ─── Ad Sets ─────────────────────────────────────────────────────────────────

export async function listAdSets(campaignId: string): Promise<MetaAdSet[]> {
  // Explicit high limit so a multi-ad-set (ABO) campaign isn't silently capped
  // at Meta's default page size — the budget rollup must see every ad set.
  const res = await apiFetch<{ data: MetaAdSet[] }>(`/${campaignId}/adsets`, undefined, {
    // learning_stage_info is the difference between "active" and "Meta gave
    // up learning at this volume" — the state that quietly costs the most.
    fields: 'id,name,status,effective_status,daily_budget,targeting,optimization_goal,billing_event,learning_stage_info,end_time,bid_strategy,bid_amount,issues_info',
    limit: '200',
  })
  return res.data ?? []
}

// Graph v17+ accepts only ODAX outcome objectives for NEW campaigns — the
// legacy names (LEAD_GENERATION/CONVERSIONS/LINK_CLICKS) are rejected with
// error 100. The wizard keeps its familiar vocabulary; we translate here.
// Website-lead campaigns need a pixel to optimize for leads; without one the
// honest fallback is a traffic campaign optimized for landing-page views.
function toOdaxObjective(obj: MetaCampaignObjective, hasPixel: boolean, destination?: AdDestination): string {
  // Instant-form lead ads collect ON Meta — no pixel needed for OUTCOME_LEADS.
  if (destination === 'form') return 'OUTCOME_LEADS'
  switch (obj) {
    case 'LEAD_GENERATION': return hasPixel ? 'OUTCOME_LEADS' : 'OUTCOME_TRAFFIC'
    case 'CONVERSIONS':     return hasPixel ? 'OUTCOME_SALES' : 'OUTCOME_TRAFFIC'
    default:                return 'OUTCOME_TRAFFIC'
  }
}

// The goal lives in lib/meta/optimization-goal.ts — client-safe, so the wizard
// can SHOW what Meta will optimise for instead of the operator discovering it
// from the shape of the results. One definition: a second copy here is a copy
// that disagrees with the screen the day either is edited.

export async function createAdSet(params: {
  campaignId: string
  name: string
  /** Page override for promoted_object — must be the Page the ad runs as. */
  pageId?: string
  objective: MetaCampaignObjective
  dailyBudgetAED: number
  targeting: CampaignTargeting
  status: 'ACTIVE' | 'PAUSED'
  /** Conversion pixel override — falls back to the account default. */
  pixelId?: string
  /** Where a click/submit goes — shapes destination_type + promoted_object. */
  destination?: AdDestination
  /** Cost-per-result ceiling in AED → COST_CAP bid strategy on the ad set. */
  cplCapAED?: number
  /**
   * Narrow this ad set to an EXACT placement set — used when a lead-form
   * launch splits into one ad set per customized placement (see
   * launchFullCampaign). Overrides the platform-derived placementSpec below.
   */
  placementOverride?: { publisher_platforms: string[]; facebook_positions?: string[]; instagram_positions?: string[] }
  /**
   * Placement targeting mode from the wizard. 'automatic' (or omitted — the
   * default, and what every existing caller sends today) keeps the
   * platform-derived placementSpec below exactly as before. 'manual' (with a
   * non-empty manualPlacements) instead narrows to ONLY those placement
   * surfaces via PLACEMENT_TARGETING. Ignored entirely when placementOverride
   * is set — that mechanism (per-placement ad-set split) already picks an
   * exact placement set of its own.
   */
  placementMode?: 'automatic' | 'manual'
  /** PlacementKey values to run on when placementMode is 'manual'. */
  manualPlacements?: string[]
  /**
   * Set Meta's real ad-set-level `is_dynamic_creative` flag. This is what
   * gates whether the ad's asset_feed_spec (multiple titles/bodies/
   * descriptions, zero asset_customization_rules) is actually treated as
   * dynamic/auto-tested creative rather than a malformed or silently-ignored
   * payload — see createAdCreative's `wantsMultiText`. Callers must pass
   * exactly that same eligibility here so the ad set's flag and the ad's
   * actual creative shape always agree.
   */
  wantsDynamicCreative?: boolean
  /**
   * When delivery must stop, as an ABSOLUTE instant (ISO 8601 with an
   * offset). Used for the Trakheesi permit window: an ad running past its
   * permit is as non-compliant as one that never had a permit, and Meta
   * enforces this exactly whether or not our cron is awake.
   *
   * An offset is required rather than polite. A bare local timestamp is read
   * in the AD ACCOUNT's timezone, which this codebase never reads — on an
   * account set to anything west of Dubai that keeps a lapsed permit
   * advertising for hours.
   */
  endTimeIso?: string
}): Promise<{ id: string }> {
  const { adAccountId, pageId: configuredPageId, pixelId: accountPixel } = await creds()
  // The Page in promoted_object must be the Page the ad runs as, or Meta
  // rejects the ad against its own form. See createAdCreative's pageId.
  const pageId = params.pageId || configuredPageId
  const pixelId = params.pixelId || accountPixel
  const optimizationGoal = objectiveToOptimizationGoal(params.objective, !!pixelId, params.destination)

  // Manual placements: an operator-picked EXACT set of real placement
  // surfaces (fbFeed/igFeed/igStory/fbStory/reels), unioned into the same
  // publisher_platforms/facebook_positions/instagram_positions shape via
  // PLACEMENT_TARGETING. Only unknown/stale keys are dropped defensively —
  // an empty or all-invalid list falls through to the automatic behavior
  // below rather than accidentally narrowing to nothing.
  const manualKeys = (params.manualPlacements ?? []).filter(
    (k): k is PlacementKey => PLACEMENT_KEYS.includes(k as PlacementKey),
  )
  const manualPlacementSpec = params.placementMode === 'manual' && manualKeys.length > 0
    ? unionPlacementTargeting(manualKeys)
    : null

  // Placements are ALWAYS explicit. An empty platform list used to fall
  // through to `{}`, which is precisely how a request enrols in Advantage+
  // placements — Meta then buys wherever it likes, Audience Network included,
  // and the cheap non-converting impressions that follow are indistinguishable
  // from a weak audience. `placementSpecFor` never returns an empty spec.
  const platforms = params.targeting.publisherPlatforms
  const placementSpec: Record<string, unknown> = params.placementOverride
    ? { ...params.placementOverride }
    : manualPlacementSpec
    ? { ...manualPlacementSpec }
    : placementSpecFor(platforms)

  const t = params.targeting
  const behaviors = t.behaviors ?? []
  const narrowing = (t.narrowing ?? []).filter((g) => (g.interests?.length || 0) + (g.behaviors?.length || 0) > 0)
  const excludedInterests = t.exclusions?.interests ?? []
  const excludedBehaviors = t.exclusions?.behaviors ?? []
  const customAudienceIds = t.customAudienceIds ?? []
  // An id cannot be both included and excluded — Meta rejects the ad set, and
  // the intent is incoherent anyway. Exclusion wins: it is the safer reading
  // of "do not show this to these people".
  const excludedCustomAudienceIds = (t.excludedCustomAudienceIds ?? [])
    .filter((id) => !customAudienceIds.includes(id))
  // Advantage audience is OFF, unconditionally. It used to switch on whenever
  // an ad set had no interest/behaviour/custom-audience definition — which is
  // exactly the broad control arm whose whole job is to measure ONE thing.
  // Expansion made that arm deliver outside its own definition, so whatever it
  // proved could not be reproduced and could not be compared with its
  // siblings. A broad ad set is still a defined ad set: geo, age, gender,
  // language. Meta must stay inside it.
  //
  // Consequence, deliberately kept: the age band is now honoured exactly as
  // set. The old 25/65 clamp existed only to satisfy Advantage audiences
  // (subcodes 1870188 / 1870189 reject a hard band under expansion). With
  // expansion off, an operator who says 30–50 gets 30–50.
  const ageMin = t.ageMin
  const ageMax = t.ageMax

  // Base interests/behaviors + AND-narrowing groups → Meta flexible_spec: a
  // person must match at least one entry of EVERY group. Without narrowing,
  // plain top-level keys keep the proven single-group shape.
  const baseGroup: Record<string, unknown> = {
    ...(t.interests.length > 0 ? { interests: t.interests } : {}),
    ...(behaviors.length > 0 ? { behaviors } : {}),
  }
  const interestSpec: Record<string, unknown> = narrowing.length > 0
    ? {
        flexible_spec: [
          ...(Object.keys(baseGroup).length > 0 ? [baseGroup] : []),
          ...narrowing.map((g) => ({
            ...(g.interests?.length ? { interests: g.interests } : {}),
            ...(g.behaviors?.length ? { behaviors: g.behaviors } : {}),
          })),
        ],
      }
    : baseGroup

  const targetingSpec: Record<string, unknown> = {
    geo_locations: geoLocationsSpec({
      countries: t.countries,
      cityKeys: t.cityKeys,
      locationTypes: t.locationTypes,
    }),
    age_min: ageMin,
    age_max: ageMax,
    ...placementSpec,
    ...(t.genders && t.genders.length > 0
      ? { genders: t.genders }
      : {}),
    ...interestSpec,
    ...(t.locales && t.locales.length > 0
      ? { locales: t.locales }
      : {}),
    // Who this must NOT be shown to. Meta keeps audience exclusion in its own
    // field — `exclusions` above is interests and behaviours only — which is
    // why "exclude our own CRM" was advice the system could not carry out.
    ...(excludedCustomAudienceIds.length > 0
      ? { excluded_custom_audiences: excludedCustomAudienceIds.map((id) => ({ id })) }
      : {}),
    ...(customAudienceIds.length > 0
      ? { custom_audiences: customAudienceIds.map((id) => ({ id })) }
      : {}),
    ...(excludedInterests.length > 0 || excludedBehaviors.length > 0
      ? {
          exclusions: {
            ...(excludedInterests.length > 0 ? { interests: excludedInterests } : {}),
            ...(excludedBehaviors.length > 0 ? { behaviors: excludedBehaviors } : {}),
          },
        }
      : {}),
    targeting_automation: { ...ADVANTAGE_AUDIENCE_OFF },
  }

  // The wizard's CPL cap is a REAL Meta COST_CAP: the algorithm keeps the
  // average cost per result at or under bid_amount (fils). No cap → lowest cost.
  const useCostCap = !!params.cplCapAED && params.cplCapAED > 0
  const body: Record<string, unknown> = {
    name:              params.name,
    campaign_id:       params.campaignId,
    billing_event:     'IMPRESSIONS',
    optimization_goal: optimizationGoal,
    bid_strategy:      useCostCap ? 'COST_CAP' : 'LOWEST_COST_WITHOUT_CAP',
    ...(useCostCap ? { bid_amount: Math.round(params.cplCapAED! * 100) } : {}),
    daily_budget:      params.dailyBudgetAED * 100, // AED → fils (smallest unit)
    // Only ever sent when a real stop is known. Meta treats an absent
    // end_time as "runs until stopped", which is the truth when no permit
    // window is on file — inventing one would be worse than not having it.
    ...(params.endTimeIso ? { end_time: params.endTimeIso } : {}),
    targeting:         targetingSpec,
    status:            params.status,
    // Meta's real Dynamic Creative flag — REQUIRED for the ad's
    // asset_feed_spec (multiple titles/bodies, no asset_customization_rules)
    // to actually be auto-tested rather than error/silently misbehave.
    ...(params.wantsDynamicCreative ? { is_dynamic_creative: true } : {}),
  }

  // Destination wiring — where a click/submit actually goes.
  if (params.destination === 'form') {
    // Meta instant form: the lead is captured ON the ad, promoted via the Page.
    body.destination_type = 'ON_AD'
    body.promoted_object  = { page_id: pageId }
  } else if (params.destination === 'whatsapp') {
    // Click-to-WhatsApp: uses the Page's connected WhatsApp number.
    body.destination_type = 'WHATSAPP'
    body.promoted_object  = { page_id: pageId }
  } else if (params.destination === 'phone') {
    // Call ads: the CTA dials the number carried on the creative.
    body.destination_type = 'PHONE_CALL'
    body.promoted_object  = { page_id: pageId }
  } else if (params.objective === 'CONVERSIONS' || params.objective === 'LEAD_GENERATION') {
    // Website destination + pixel signal for lead/conversion campaigns.
    body.destination_type = 'WEBSITE'
    if (pixelId) {
      body.promoted_object = {
        pixel_id: pixelId,
        custom_event_type: params.objective === 'CONVERSIONS' ? 'PURCHASE' : 'LEAD',
      }
    }
  }

  // LAST CHECK BEFORE MONEY MOVES. The opt-outs above are correct today; this
  // is what keeps them correct after the next change to this function. Every
  // Advantage feature is enrolled by OMISSION, so a refactor that drops a
  // field would otherwise launch an expanded, auto-placed ad set and report
  // success. Refusing here is loud and cheap; discovering it in Ads Manager a
  // week later is neither.
  const violations = findAdvantageInAdSet(body)
  if (violations.length > 0) {
    throw new Error(`Refusing to launch: Meta Advantage would be active — ${describeViolations(violations)}`)
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
 * with no valid interests left, the ad set runs on its remaining definition
 * (geo, age, gender, language) — NOT on Advantage expansion, which is off.
 */
/**
 * Ask Meta, by NAME, what the current live id for each interest is.
 *
 * The name is the durable thing; the numeric id is not. Meta retires and
 * merges targeting nodes on its own schedule, and a hardcoded id simply
 * stops resolving — the launch then fails on whichever ad set Meta
 * validates first. Resolving by name returns whatever id is live TODAY, so
 * a stale id is repaired rather than sent.
 *
 * Returns a lowercased-name → live-id map. Names Meta doesn't recognise are
 * absent from the map (the caller drops them).
 */
async function resolveInterestNames(names: string[]): Promise<Map<string, string>> {
  if (!names.length) return new Map()
  const { token } = await creds()
  const url = new URL(`${API_BASE}/search`)
  url.searchParams.set('type', 'adinterestvalid')
  url.searchParams.set('interest_list', JSON.stringify(names))
  url.searchParams.set('access_token', token)
  const res = await fetch(url.toString())
  const json = (await res.json()) as { data?: Array<{ name: string; valid: boolean; id?: string }> }

  // KEYED ON WHAT WE ASKED, NOT ON WHAT META ANSWERED.
  //
  // This map used to be keyed on `d.name` — Meta's spelling — and the caller
  // then looked up OUR spelling. Any difference in casing, punctuation or
  // canonical wording missed, the interest was recorded as unrecognised, and a
  // perfectly live targeting node was dropped from a real launch. Meta returns
  // its answers in request order, so the query is the reliable key and the
  // response is not.
  const answers = json.data ?? []
  const byQuery = new Map<string, string>()
  names.forEach((asked, i) => {
    const d = answers[i]
    if (d && d.valid && d.id) byQuery.set(asked.toLowerCase(), String(d.id))
  })
  // Belt and braces: also accept a match on Meta's own spelling, for the case
  // where the response is NOT in request order. Added rather than substituted,
  // because the failure this replaces was caused by trusting one signal.
  for (const d of answers) {
    if (d?.valid && d.id && d.name) byQuery.set(String(d.name).toLowerCase(), String(d.id))
  }
  return byQuery
}

export async function validateInterests(
  interests: { id: string; name: string }[],
): Promise<{ id: string; name: string }[]> {
  if (!interests.length) return []
  try {
    const valid = await resolveInterestNames(interests.map((i) => i.name))
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

/**
 * REPAIR EVERY INTEREST IN A SPEC, NOT JUST THE BASE ONES.
 *
 * This is the fix for three consecutive live launch failures, each on a
 * different hardcoded interest id, each reported as "Interests with ID X is
 * invalid". `validateInterests` above already existed and already did the
 * right thing — but it was only ever applied to `targeting.interests`. Every
 * id that actually failed lived somewhere else in the same spec:
 *
 *   · `narrowing[]` — where the real-estate MUST group goes, so the one
 *     rule applied to EVERY audience this product builds was also the one
 *     path that never got validated. That is why replacing a dead id just
 *     surfaced the next dead id: the repair shop existed, the car never
 *     went in.
 *   · `exclusions.interests` — the agent/job-seeker/bargain-hunter
 *     exclusions, equally hardcoded and equally able to fail a launch.
 *
 * Every interest name in the whole spec is resolved in ONE call, ids are
 * rewritten to whatever is live now, unrecognised names are dropped, and
 * any group left empty is removed (an empty flexible_spec group is itself
 * a rejection). Behaviours are left alone: the only ones this system sends
 * come from live search already.
 *
 * Fail-open on a network error — a transient Meta outage should not block a
 * launch, and the ids may well be fine.
 */
export async function repairTargetingInterests<T extends CampaignTargeting>(
  targeting: T,
): Promise<{ targeting: T; dropped: string[]; keptDespiteFailure: string[] }> {
  const names = new Set<string>()
  const collect = (xs?: { id: string; name: string }[]) => {
    for (const x of xs ?? []) if (x?.name) names.add(x.name)
  }
  collect(targeting.interests)
  for (const g of targeting.narrowing ?? []) collect(g.interests)
  collect(targeting.exclusions?.interests)
  if (names.size === 0) return { targeting, dropped: [], keptDespiteFailure: [] }

  let live: Map<string, string>
  try {
    live = await resolveInterestNames([...names])
  } catch {
    return { targeting, dropped: [], keptDespiteFailure: [] } // fail-open; see doc above
  }

  const dropped: string[] = []
  const fix = (xs?: { id: string; name: string }[]) =>
    (xs ?? []).flatMap((x) => {
      const id = live.get(String(x.name).toLowerCase())
      if (!id) { dropped.push(x.name); return [] }
      return [{ id, name: x.name }]
    })

  // ── A NARROWING GROUP IS NEVER SILENTLY EMPTIED ────────────────────────
  //
  // The narrowing groups are the MUST rules — the real-estate qualifier rides
  // on every audience this product builds. Dropping one does not make the
  // audience slightly less precise; it removes the only thing making the
  // audience about property at all, and the campaign runs BROAD.
  //
  // That used to happen quietly: any interest whose name failed to resolve was
  // dropped, a group left empty was filtered out, and the sole record was a
  // console.warn. A day of broad delivery and expensive rubbish leads, with
  // nothing on any screen to explain it.
  //
  // So the inversion: if repair would empty a group that HAD content, keep the
  // group exactly as it was and let Meta judge it. A launch Meta refuses costs
  // one retry and says why. A launch that quietly goes broad costs a day of
  // spend and looks like the ads simply underperformed.
  // TWO PROPERTIES, BOTH REQUIRED, and they pull in opposite directions:
  //
  //   · never SEND an empty group — Meta rejects an empty flexible_spec entry,
  //     so a group that arrives with nothing in it is still dropped exactly as
  //     it always was;
  //   · never EMPTY a group that had something — that is the qualifier going
  //     broad, silently, which is what this change exists to stop.
  //
  // The distinction is where the emptiness came from. Arrived empty: drop it,
  // it was never a rule. Emptied by our own failure to validate: keep it whole
  // and let Meta be the one to refuse.
  const emptiedGroups: string[] = []
  const narrowing = (targeting.narrowing ?? [])
    .map((g) => {
      const had = (g.interests?.length ?? 0) + (g.behaviors?.length ?? 0)
      if (had === 0) return null
      const repairedInterests = fix(g.interests)
      const left = repairedInterests.length + (g.behaviors?.length ?? 0)
      if (left === 0) {
        emptiedGroups.push((g.interests ?? []).map((i) => i.name).join(' / '))
        return g
      }
      return { ...g, interests: repairedInterests }
    })
    .filter((g): g is NonNullable<typeof g> => g !== null)

  const exInterests = fix(targeting.exclusions?.interests)
  const exBehaviors = targeting.exclusions?.behaviors ?? []

  return {
    targeting: {
      ...targeting,
      interests: fix(targeting.interests),
      narrowing,
      exclusions: exInterests.length + exBehaviors.length > 0
        ? { interests: exInterests, behaviors: exBehaviors }
        : undefined,
    },
    dropped: [...new Set(dropped)],
    // Named separately from `dropped` because it means something far worse: a
    // qualifier we kept ONLY because emptying it would have gone broad. The
    // launch must say this out loud rather than log it.
    keptDespiteFailure: [...new Set(emptiedGroups)],
  }
}

// ─── Creatives & Ads ─────────────────────────────────────────────────────────

// PlacementKey → Meta's real publisher_platforms / facebook_positions /
// instagram_positions targeting vocabulary. Used both by the ad set's
// placement targeting (elsewhere) and by asset_customization_rules below, so
// a creative override actually lands on the placement it was made for.
// THE FOUR SURFACES THIS PRODUCT BUYS, by owner decision: Instagram Feed
// first, then Instagram Stories, Reels, Facebook Feed.
//
// `fbStory` is deliberately ABSENT. Meta refuses Facebook Stories as a
// placement on its own ("Facebook Stories Placement Not Allowed Alone",
// subcode 1815891) — it must be accompanied by Facebook Feeds or Instagram
// Stories. This map used to carry all five while the wizard only offered
// four, so a lead-form launch that customised every offered placement left
// exactly one surface for the "everything else" ad set: Facebook Stories,
// alone, which Meta rejected every time. Keeping the list to what the
// product actually buys makes that combination unconstructible.
//
// The KEY stays in the PlacementKey type: audiences saved before this can
// still carry an fbStory override, and it now resolves to nothing rather
// than to an ad set Meta will refuse.
const PLACEMENT_TARGETING: Partial<Record<PlacementKey, { publisher_platforms: string[]; facebook_positions?: string[]; instagram_positions?: string[] }>> = {
  igFeed:  { publisher_platforms: ['instagram'],               instagram_positions: ['stream'] },
  igStory: { publisher_platforms: ['instagram'],               instagram_positions: ['story'] },
  reels:   { publisher_platforms: ['facebook', 'instagram'],   facebook_positions: ['facebook_reels'], instagram_positions: ['reels'] },
  fbFeed:  { publisher_platforms: ['facebook'],                facebook_positions: ['feed'] },
}

const PLACEMENT_KEYS = Object.keys(PLACEMENT_TARGETING) as PlacementKey[]

// Plain English backend naming for the multi-ad-set split below — Ads
// Manager naming, not user-facing UI, so it doesn't need i18n.
const PLACEMENT_LABELS: Record<PlacementKey, string> = {
  fbFeed:  'Facebook Feed',
  igFeed:  'Instagram Feed',
  igStory: 'Instagram Story',
  fbStory: 'Facebook Story',
  reels:   'Reels',
}

/** Union of several placements' targeting vocabulary — used to build the
 * "everything not customized" ad set when a lead-form launch splits by
 * placement (see launchFullCampaign). */
function unionPlacementTargeting(keys: PlacementKey[]): { publisher_platforms: string[]; facebook_positions?: string[]; instagram_positions?: string[] } {
  const platforms = new Set<string>()
  const fbPositions = new Set<string>()
  const igPositions = new Set<string>()
  for (const key of keys) {
    // Unsupported/legacy keys (fbStory) resolve to nothing rather than
    // throwing — see PLACEMENT_TARGETING.
    const t = PLACEMENT_TARGETING[key]
    if (!t) continue
    t.publisher_platforms.forEach((p) => platforms.add(p))
    t.facebook_positions?.forEach((p) => fbPositions.add(p))
    t.instagram_positions?.forEach((p) => igPositions.add(p))
  }
  return {
    publisher_platforms: [...platforms],
    ...(fbPositions.size > 0 ? { facebook_positions: [...fbPositions] } : {}),
    ...(igPositions.size > 0 ? { instagram_positions: [...igPositions] } : {}),
  }
}

/** Merge a placement override over the default creative for a classic
 * single-creative ad (the lead-form multi-ad-set path) — blank override
 * fields inherit the default. Strips placementOverrides so createAdCreative
 * never mistakes this merged, single-placement creative for one that still
 * needs asset_feed_spec treatment. */
function mergeCreativeForPlacement(base: CampaignCreative, override: PlacementCreativeOverride): CampaignCreative {
  return {
    ...base,
    headline:    override.headline?.trim() || base.headline,
    primaryText: override.primaryText?.trim() || base.primaryText,
    imageHash:   override.imageHash || base.imageHash,
    imageUrl:    override.imageUrl || base.imageUrl,
    placementOverrides: undefined,
  }
}

/**
 * Build Meta's `asset_feed_spec` (the "placement asset customization" shape)
 * from a default creative + a set of non-empty per-placement overrides. Each
 * distinct image hash / body text / title text becomes exactly one labelled
 * asset (deduped), and one `asset_customization_rules` entry per overridden
 * placement points at its labels — plus a catch-all rule (lowest priority,
 * listed last) so every placement NOT explicitly overridden still gets the
 * default creative instead of silently falling through with no creative.
 */
function buildAssetFeedSpec(params: {
  defaultCreative: CampaignCreative
  overrides: Array<[PlacementKey, PlacementCreativeOverride]>
  ctaType: string
  /**
   * Meta's real "Multiple text options" / dynamic-creative headline variants
   * — Meta auto-tests every combination of these (plus `descriptions` below)
   * within this ONE ad. Only set by the plain multi-text launch path (no
   * per-placement overrides); the per-placement-override path leaves this
   * empty and titles off the single default headline exactly as before.
   */
  titles?: string[]
  /** Description variants for the same multi-text feature — see `titles`. */
  descriptions?: string[]
}) {
  const imageLabels = new Map<string, string>()       // hash -> label
  const bodyLabels = new Map<string, string>()         // text -> label
  const titleLabels = new Map<string, string>()        // text -> label
  const descriptionLabels = new Map<string, string>()  // text -> label
  const labelFor = (map: Map<string, string>, prefix: string, value: string) => {
    let label = map.get(value)
    if (!label) { label = `${prefix}_${map.size}`; map.set(value, label) }
    return label
  }

  const defaultImageHash = params.defaultCreative.imageHash
  const defaultBody = params.defaultCreative.primaryText
  const defaultTitle = params.defaultCreative.headline
  if (defaultImageHash) labelFor(imageLabels, 'img', defaultImageHash)
  labelFor(bodyLabels, 'body', defaultBody)
  labelFor(titleLabels, 'title', defaultTitle)
  // Multi-text variants beyond the single default — every one becomes its
  // own labelled asset so Meta can freely recombine them.
  for (const title of params.titles ?? []) labelFor(titleLabels, 'title', title)
  for (const description of params.descriptions ?? []) labelFor(descriptionLabels, 'desc', description)

  const rules: Record<string, unknown>[] = params.overrides.map(([key, ov], i) => {
    const imageHash = ov.imageHash || defaultImageHash
    const body = ov.primaryText?.trim() || defaultBody
    const title = ov.headline?.trim() || defaultTitle
    return {
      customization_spec: PLACEMENT_TARGETING[key],
      ...(imageHash ? { image_label: { name: labelFor(imageLabels, 'img', imageHash) } } : {}),
      body_label: { name: labelFor(bodyLabels, 'body', body) },
      title_label: { name: labelFor(titleLabels, 'title', title) },
      priority: i + 1,
    }
  })
  // Catch-all — broadest customization_spec, lowest priority, always last —
  // covers every placement the ad set serves that has no specific rule
  // above. Only meaningful when there ARE per-placement rules to fall back
  // from; a plain multi-text launch (no overrides) omits it entirely so Meta
  // freely auto-tests every title/body/description combo everywhere,
  // instead of pinning every placement to one fixed combo.
  if (params.overrides.length > 0) {
    rules.push({
      customization_spec: { publisher_platforms: ['facebook', 'instagram'] },
      ...(defaultImageHash ? { image_label: { name: labelFor(imageLabels, 'img', defaultImageHash) } } : {}),
      body_label: { name: labelFor(bodyLabels, 'body', defaultBody) },
      title_label: { name: labelFor(titleLabels, 'title', defaultTitle) },
      priority: rules.length + 1,
    })
  }

  return {
    images: [...imageLabels.entries()].map(([hash, label]) => ({ hash, adlabels: [{ name: label }] })),
    bodies: [...bodyLabels.entries()].map(([text, label]) => ({ text, adlabels: [{ name: label }] })),
    titles: [...titleLabels.entries()].map(([text, label]) => ({ text, adlabels: [{ name: label }] })),
    ...(descriptionLabels.size > 0
      ? { descriptions: [...descriptionLabels.entries()].map(([text, label]) => ({ text, adlabels: [{ name: label }] })) }
      : {}),
    link_urls: [{ website_url: params.defaultCreative.landingUrl }],
    call_to_action_types: [params.ctaType],
    ...(rules.length > 0 ? { asset_customization_rules: rules } : {}),
  }
}

export async function createAdCreative(params: {
  name: string
  creative: CampaignCreative
  /** Where the CTA goes; defaults to the landing URL. */
  destination?: AdDestination
  /** Meta instant-form id — attached to the CTA when destination is 'form'. */
  leadFormId?: string
  /** E.164 number for 'whatsapp' / 'phone' destinations. */
  destinationPhone?: string
  /**
   * The Page the ad RUNS AS. Defaults to the configured Page — which was the
   * only option for as long as this parameter did not exist, even though the
   * account can post from several Pages and an instant form belongs to ONE of
   * them. An ad pointing at a form from a different Page is rejected by Meta,
   * so the form's Page must be able to travel here.
   */
  pageId?: string
  /**
   * The Instagram account the ad runs as on Instagram. Omitted = Meta's own
   * fallback: the Page's connected account, or the Page itself. Must be one
   * of the Page's own connections (getAdIdentity().instagramOptions) —
   * Meta's rule, and the identity picker only offers that set.
   */
  instagramUserId?: string
}): Promise<{ id: string }> {
  const { adAccountId, pageId: configuredPageId } = await creds()
  const pageId = params.pageId || configuredPageId
  const igActor = params.instagramUserId ? { instagram_user_id: params.instagramUserId } : {}

  // CTA shaping per destination. The instant form rides ON the CTA
  // (lead_gen_form_id) — this is the wiring that makes a picked Meta form
  // actually reach the launched ad.
  //
  // Shared with the VIDEO path (createVideoAdCreative) through one pure
  // function, because an image ad and a video ad in the same ad set must point
  // at the same place. Two copies of this rule is how a video variant quietly
  // becomes a link click in a form campaign.
  const callToAction: Record<string, unknown> = callToActionSpec({
    destination: params.destination,
    cta: params.creative.cta,
    landingUrl: params.creative.landingUrl,
    leadFormId: params.leadFormId,
    destinationPhone: params.destinationPhone,
  })

  // Placement-customized creative via asset_feed_spec is only used for the
  // plain landing-click case. Lead-form ads DO get per-placement creative,
  // but through a different real mechanism — launchFullCampaign splits them
  // into a separate single-creative ad set per customized placement — because
  // Meta restricts the asset_feed_spec field that would carry a
  // lead_gen_form_id (AdAssetFeedSpec.call_to_actions) to internal/Special-Ad-
  // Category apps. So a 'form' destination reaching this function always has
  // its placementOverrides already merged away (mergeCreativeForPlacement) or
  // absent; this check is the defense-in-depth backstop for a stale/replayed
  // payload. WhatsApp/call ads always use ONE creative for every placement.
  const overrideEntries = (params.destination === undefined || params.destination === 'landing')
    ? (Object.entries(params.creative.placementOverrides ?? {}) as Array<[PlacementKey, PlacementCreativeOverride]>)
        .filter(([, ov]) => ov && (ov.headline?.trim() || ov.primaryText?.trim() || ov.imageHash || ov.imageUrl))
    : []

  if (overrideEntries.length > 0) {
    const assetFeedSpec = buildAssetFeedSpec({
      defaultCreative: params.creative,
      overrides: overrideEntries,
      ctaType: params.creative.cta,
    })
    return apiPost(`/${adAccountId}/adcreatives`, {
      name:              params.name,
      object_story_spec: { page_id: pageId, ...igActor },
      asset_feed_spec:   assetFeedSpec,
      url_tags: AD_URL_TAGS,
    })
  }

  // Meta's real "Multiple text options" / dynamic-creative feature — Meta
  // auto-tests every combination of the headlines/descriptions provided
  // within this ONE ad (never several separate ads). Only valid for a plain
  // link-click creative: asset_feed_spec's call_to_action_types carries no
  // `value` (lead_gen_form_id / WhatsApp app_destination / tel: link) — the
  // same restriction that keeps the per-placement path above off form/
  // WhatsApp/call ads — so those destinations always fall through to the
  // exact single-creative path below, even with a multi-entry array.
  const headlines = params.creative.headlines?.length ? params.creative.headlines : [params.creative.headline]
  const descriptions = params.creative.descriptions?.length ? params.creative.descriptions : [params.creative.description]
  const wantsMultiText = (headlines.length > 1 || descriptions.length > 1)
    && (params.destination === undefined || params.destination === 'landing')

  if (wantsMultiText) {
    const assetFeedSpec = buildAssetFeedSpec({
      defaultCreative: params.creative,
      overrides: [],
      ctaType: params.creative.cta,
      titles: headlines,
      descriptions,
    })
    return apiPost(`/${adAccountId}/adcreatives`, {
      name:              params.name,
      object_story_spec: { page_id: pageId, ...igActor },
      asset_feed_spec:   assetFeedSpec,
      url_tags: AD_URL_TAGS,
    })
  }

  const linkData: Record<string, unknown> = {
    link:        params.creative.landingUrl,
    message:     params.creative.primaryText,
    name:        params.creative.headline,
    description: params.creative.description,
    call_to_action: callToAction,
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
    object_story_spec:  { page_id: pageId, ...igActor, link_data: linkData },
    // Dynamic UTMs close the attribution loop: the lead that lands on the
    // page carries the REAL campaign/adset/ad ids into the CRM automatically.
    url_tags: AD_URL_TAGS,
    // Advantage+ creative OFF. Omitting this block does not mean "off" — it
    // means the ad ACCOUNT's default applies, and on most accounts that
    // default rewords the headline, recolours the image and adds music to a
    // creative someone already approved. Meta deprecated the umbrella switch
    // entirely — `standard_enhancements` in ANY shape is now rejected with
    // subcode 3858504 — so every feature is named and opted out on its own.
    degrees_of_freedom_spec: { ...CREATIVE_ENHANCEMENTS_OFF },
  })
}

/**
 * Render a real Meta ad preview via the Graph `generatepreviews` endpoint.
 * Meta returns the exact iframe HTML Ads Manager would show for the given
 * placement — no mock markup. The `creative` object mirrors the
 * `object_story_spec` that `createAdCreative` builds, so the preview matches
 * what actually launches. Prefer a native image_hash; ingest an external
 * imageUrl first (same path launch uses) so previews aren't blank.
 */
export async function generateAdPreview(params: {
  creative: CampaignCreative
  adFormat?: MetaAdFormat
}): Promise<{ body: string }> {
  const { adAccountId, pageId } = await creds()

  // Native image_hash is Meta's reliable path; ingest an external URL first so
  // the rendered preview shows the real hero photo instead of a blank frame.
  const creativeInput = { ...params.creative }
  if (!creativeInput.imageHash && creativeInput.imageUrl) {
    const hash = await ingestImageFromUrl(creativeInput.imageUrl)
    if (hash) creativeInput.imageHash = hash
  }

  const linkData: Record<string, unknown> = {
    link:        creativeInput.landingUrl,
    message:     creativeInput.primaryText,
    name:        creativeInput.headline,
    description: creativeInput.description,
    call_to_action: { type: creativeInput.cta, value: { link: creativeInput.landingUrl } },
  }
  if (creativeInput.imageHash) {
    linkData.image_hash = creativeInput.imageHash
  } else if (creativeInput.imageUrl) {
    linkData.picture = creativeInput.imageUrl
  }

  const creativeSpec = { object_story_spec: { page_id: pageId, link_data: linkData } }
  const adFormat: MetaAdFormat = params.adFormat ?? 'MOBILE_FEED_STANDARD'

  const res = await apiPost<{ data?: Array<{ body?: string }> }>(
    `/${adAccountId}/generatepreviews`,
    {
      ad_format: adFormat,
      // Graph requires the creative spec as a JSON-encoded string param.
      creative: JSON.stringify(creativeSpec),
    },
  )

  const body = res.data?.[0]?.body
  if (!body) throw new MetaApiError('Meta returned no ad preview for this creative', 0, 'preview')
  return { body }
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

/**
 * The bytes of an image already uploaded to the ad account, by hash.
 *
 * The hash is the only durable handle the wizard keeps for a picture — it is
 * what actually launches, and it survives a reload, a different device and a
 * resumed draft. The CDN url Meta hands back does not: it is not reliably
 * loadable in an <img> from our origin, so a preview built on it renders an
 * empty frame for an image that uploaded perfectly well.
 *
 * Fetching server-side sidesteps that entirely — no browser, no referrer, no
 * session. Returns the raw bytes so the caller can serve them from our own
 * origin, where an <img> always works.
 */
export async function getAdImageBytes(
  hash: string,
): Promise<{ body: ArrayBuffer; contentType: string } | null> {
  const { adAccountId, token } = await creds()
  const url = new URL(`${API_BASE}/${adAccountId}/adimages`)
  url.searchParams.set('hashes', JSON.stringify([hash]))
  url.searchParams.set('fields', 'hash,url')
  url.searchParams.set('access_token', token)
  const meta = await fetch(url.toString())
  const json = (await meta.json()) as {
    data?: Array<{ hash?: string; url?: string }>
    error?: { message: string; code: number; type: string; fbtrace_id?: string }
  }
  if (json.error) throw new MetaApiError(json.error.message, json.error.code, json.error.type, json.error.fbtrace_id)
  const src = json.data?.find((d) => d?.url)?.url
  if (!src) return null
  const img = await fetch(src)
  if (!img.ok) return null
  return {
    body: await img.arrayBuffer(),
    contentType: img.headers.get('content-type') || 'image/jpeg',
  }
}

// ─── Video ads ────────────────────────────────────────────────────────────────
// The four-step negotiation described in lib/meta/video-ad.ts. The rules live
// there so they can be asserted; this half is the I/O they describe.

export interface AdVideo {
  id: string
  status: VideoStatus
  /** The cover frame Meta picked. Null until one exists — and null means NOT
   *  launchable, never "launch it without a cover". */
  thumbnailUrl: string | null
}

/**
 * Push a video into the ad account and return its id — WITHOUT waiting.
 *
 * `file_url` is Meta fetching the file itself, which is the right shape here:
 * every video this product would launch is already hosted (the Library, the
 * reel maker's export, a project's media). Forwarding the bytes through this
 * server would mean holding a 200 MB file in memory to hand Meta a URL it can
 * reach on its own.
 *
 * The returned id is real and the video is NOT yet playable. Callers must go
 * through waitForAdVideo before building a creative on it.
 */
export async function uploadAdVideoFromUrl(fileUrl: string, name?: string): Promise<{ id: string }> {
  const { adAccountId } = await creds()
  if (!isVideoUrl(fileUrl)) {
    throw new MetaApiError('That file is not a video Meta can read (mp4, mov, m4v, webm).', 0, 'unsupported')
  }
  return apiPost(`/${adAccountId}/advideos`, {
    file_url: fileUrl,
    ...(name ? { name: name.slice(0, 100) } : {}),
  })
}

/** One read of a video's transcode state and cover frame. */
export async function getAdVideo(videoId: string): Promise<AdVideo> {
  const raw = await apiFetch<Record<string, unknown>>(`/${videoId}`, undefined, {
    fields: 'id,status,thumbnails{uri,is_preferred,width,height}',
  })
  const thumbs = (raw?.thumbnails as { data?: VideoThumbnail[] } | undefined)?.data
  return {
    id: String(raw?.id ?? videoId),
    status: videoStatusOf(raw),
    thumbnailUrl: pickThumbnail(thumbs),
  }
}

/**
 * Poll until the video is playable and has a cover frame, or give up.
 *
 * Giving up RETURNS the last state rather than throwing: the video id is
 * valuable — the upload succeeded and Meta is still working — so the caller
 * can report "still processing, try again in a minute" instead of losing a
 * 200 MB upload to an exception. The schedule is a fixed array (see
 * VIDEO_POLL_DELAYS_MS) so the total wait is a number a person can read.
 */
export async function waitForAdVideo(videoId: string): Promise<AdVideo> {
  let last: AdVideo = { id: videoId, status: 'processing', thumbnailUrl: null }
  for (const delay of VIDEO_POLL_DELAYS_MS) {
    last = await getAdVideo(videoId).catch(() => last)
    // A thumbnail can lag a ready status by a poll or two, so both are waited
    // for — an ad launched in that gap is a black rectangle in the feed.
    if (last.status === 'error') return last
    if (last.status === 'ready' && last.thumbnailUrl) return last
    await new Promise((r) => setTimeout(r, delay))
  }
  return await getAdVideo(videoId).catch(() => last)
}

/**
 * A video ad creative. Deliberately a separate function from createAdCreative
 * rather than a branch inside it: `video_data` and `link_data` share no field
 * names, and the per-placement / multi-text asset_feed_spec paths there do not
 * apply to a video ad at all. One function per object shape keeps both honest.
 *
 * The CTA comes from the SHARED callToActionSpec, so a video ad dropped into a
 * lead-form ad set carries the same lead_gen_form_id as its image siblings.
 */
export async function createVideoAdCreative(params: {
  name: string
  videoId: string
  thumbnailUrl?: string | null
  thumbnailHash?: string | null
  creative: CampaignCreative
  destination?: AdDestination
  leadFormId?: string
  destinationPhone?: string
  pageId?: string
  instagramUserId?: string
}): Promise<{ id: string }> {
  const { adAccountId, pageId: configuredPageId } = await creds()
  const pageId = params.pageId || configuredPageId
  const igActor = params.instagramUserId ? { instagram_user_id: params.instagramUserId } : {}

  const blocked = whyNotLaunchable({
    status: 'ready',
    thumbnailUrl: params.thumbnailUrl,
    thumbnailHash: params.thumbnailHash,
  })
  if (blocked === 'noThumbnail') {
    throw new MetaApiError(
      'Meta has not produced a cover frame for this video yet. Without one the ad shows a black rectangle, so it is not launched.',
      0, 'unsupported',
    )
  }

  return apiPost(`/${adAccountId}/adcreatives`, {
    name: params.name,
    object_story_spec: {
      page_id: pageId,
      ...igActor,
      video_data: videoDataSpec({
        videoId:          params.videoId,
        primaryText:      params.creative.primaryText,
        headline:         params.creative.headline,
        description:      params.creative.description,
        landingUrl:       params.creative.landingUrl,
        cta:              params.creative.cta,
        destination:      params.destination,
        leadFormId:       params.leadFormId,
        destinationPhone: params.destinationPhone,
        thumbnailUrl:     params.thumbnailUrl,
        thumbnailHash:    params.thumbnailHash,
      }),
    },
    url_tags: AD_URL_TAGS,
    // Same reason as the image path: omitting this block means the ad
    // ACCOUNT's default applies, and on most accounts that default recolours,
    // re-crops and adds music to a video someone already approved.
    degrees_of_freedom_spec: { ...CREATIVE_ENHANCEMENTS_OFF },
  })
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

// ─── Ad editing ───────────────────────────────────────────────────────────────
// Meta creatives are immutable once created — the REAL edit flow is: read the
// ad's current creative, build a NEW creative with the merged fields, then
// repoint the ad at it. The old creative stays in the account's history.

export interface AdCreativeSnapshot {
  id: string
  name: string
  status: string
  /**
   * True when this ad's creative uses asset_feed_spec (per-placement
   * creative — either the landing-click path or one leg of a lead-form
   * ad-set split). Editing THIS ad's single merged creative here would
   * silently discard its per-placement images/copy, so callers must refuse
   * to edit it — see updateAdCreativeContent.
   */
  usesAssetFeedSpec: boolean
  /** Derived from the current call_to_action — reused so an edit preserves
   * the ad's real destination (lead form / WhatsApp / call) instead of
   * silently downgrading it to a plain link click. */
  destination?: AdDestination
  leadFormId?: string
  destinationPhone?: string
  creative: {
    id: string
    primaryText: string
    headline: string
    description: string
    landingUrl: string
    ctaType: string
    imageUrl: string
    imageHash: string
  } | null
}

/** One ad with its current creative content — the "before" of an edit. */
export async function getAdWithCreative(adId: string): Promise<AdCreativeSnapshot> {
  const ad = await apiFetch<{
    id: string; name?: string; status?: string
    creative?: {
      id?: string; body?: string; title?: string; asset_feed_spec?: unknown
      object_story_spec?: {
        link_data?: {
          link?: string; message?: string; name?: string; description?: string
          picture?: string; image_hash?: string
          call_to_action?: { type?: string; value?: { link?: string; lead_gen_form_id?: string; app_destination?: string } }
        }
      }
    }
  }>(`/${adId}`, undefined, {
    fields: 'id,name,status,creative{id,body,title,object_story_spec,asset_feed_spec}',
  })
  const ld = ad.creative?.object_story_spec?.link_data
  const ctaValue = ld?.call_to_action?.value

  let destination: AdDestination | undefined
  let leadFormId: string | undefined
  let destinationPhone: string | undefined
  if (ctaValue?.lead_gen_form_id) {
    destination = 'form'
    leadFormId = ctaValue.lead_gen_form_id
  } else if (ctaValue?.app_destination === 'WHATSAPP') {
    destination = 'whatsapp'
  } else if (ld?.call_to_action?.type === 'CALL_NOW' && ctaValue?.link?.startsWith('tel:')) {
    destination = 'phone'
    destinationPhone = ctaValue.link.slice(4)
  } else if (ld) {
    destination = 'landing'
  }

  return {
    id: String(ad.id),
    name: String(ad.name ?? ''),
    status: String(ad.status ?? ''),
    usesAssetFeedSpec: !!ad.creative?.asset_feed_spec,
    destination,
    leadFormId,
    destinationPhone,
    creative: ad.creative?.id
      ? {
          id: String(ad.creative.id),
          primaryText: ld?.message ?? ad.creative.body ?? '',
          headline: ld?.name ?? ad.creative.title ?? '',
          description: ld?.description ?? '',
          landingUrl: ld?.link ?? '',
          ctaType: ld?.call_to_action?.type ?? 'LEARN_MORE',
          imageUrl: ld?.picture ?? '',
          imageHash: ld?.image_hash ?? '',
        }
      : null,
  }
}

/** The ads under a campaign, with current copy — the edit flow's directory. */
export async function listCampaignAds(campaignId: string): Promise<AdCreativeSnapshot[]> {
  const res = await apiFetch<{ data?: Array<Record<string, unknown>> }>(`/${campaignId}/ads`, undefined, {
    fields: 'id,name,status,creative{id,body,title,object_story_spec}',
    limit: '25',
  })
  const rows = res.data ?? []
  return Promise.all(rows.map((r) => getAdWithCreative(String(r.id))))
}

const CTA_TYPES: MetaCta[] = ['LEARN_MORE', 'SIGN_UP', 'GET_QUOTE', 'CONTACT_US', 'BOOK_NOW', 'APPLY_NOW', 'DOWNLOAD', 'WHATSAPP_MESSAGE', 'CALL_NOW']

/**
 * Edit a live ad's copy/creative: merge the changes over the current values,
 * create the new creative, repoint the ad. Returns before + after.
 *
 * Preserves the ad's real destination (lead form / WhatsApp / call) by
 * passing the SAME destination/leadFormId/destinationPhone the ad already
 * had through to createAdCreative — otherwise this would silently rebuild
 * every edited ad as a plain link click, breaking its actual CTA.
 */
export async function updateAdCreativeContent(
  adId: string,
  changes: { primaryText?: string; headline?: string; description?: string; landingUrl?: string; imageUrl?: string; imageHash?: string; cta?: string },
): Promise<{ adId: string; before: AdCreativeSnapshot['creative']; after: CampaignCreative; creativeId: string }> {
  const current = await getAdWithCreative(adId)
  if (!current.creative) throw new MetaApiError('This ad has no editable link creative.', 0, 'unsupported')
  if (current.usesAssetFeedSpec) {
    throw new MetaApiError(
      'This ad uses per-placement creative (a different image/headline per placement) and can\'t be edited as a single creative here — relaunch the campaign to change it.',
      0, 'unsupported',
    )
  }
  const cta = (changes.cta && CTA_TYPES.includes(changes.cta as MetaCta) ? changes.cta : current.creative.ctaType) as MetaCta
  const merged: CampaignCreative = {
    primaryText: changes.primaryText ?? current.creative.primaryText,
    headline: changes.headline ?? current.creative.headline,
    description: changes.description ?? current.creative.description,
    landingUrl: changes.landingUrl ?? current.creative.landingUrl,
    cta: CTA_TYPES.includes(cta) ? cta : 'LEARN_MORE',
    imageHash: changes.imageHash ?? current.creative.imageHash ?? undefined,
    imageUrl: changes.imageUrl ?? current.creative.imageUrl ?? undefined,
  }
  const created = await createAdCreative({
    name: `${current.name} — edited`,
    creative: merged,
    destination: current.destination,
    leadFormId: current.leadFormId,
    destinationPhone: current.destinationPhone,
  })
  await apiPost(`/${adId}`, { creative: { creative_id: created.id } })
  return { adId, before: current.creative, after: merged, creativeId: created.id }
}

/** Resolve native image hashes to their preview URLs — best-effort; a hash
 * Meta declines to resolve (or an unconnected account) just comes back blank
 * rather than failing the whole read. */
async function getAdImageUrls(hashes: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(hashes.filter(Boolean))]
  if (!unique.length) return {}
  try {
    const { adAccountId } = await creds()
    const res = await apiFetch<{ data?: Array<{ hash?: string; url?: string }> }>(`/${adAccountId}/adimages`, undefined, {
      hashes: JSON.stringify(unique),
      fields: 'hash,url',
    })
    const map: Record<string, string> = {}
    for (const img of res.data ?? []) if (img.hash && img.url) map[img.hash] = img.url
    return map
  } catch {
    return {}
  }
}

function sameStringSet(a?: string[], b?: string[]): boolean {
  const as = [...(a ?? [])].sort()
  const bs = [...(b ?? [])].sort()
  return as.length === bs.length && as.every((v, i) => v === bs[i])
}

export interface AdPlacementSnapshot {
  id: string
  name: string
  status: string
  /** False when this ad has no asset_feed_spec at all — nothing to decode. */
  isPlacementCreative: boolean
  landingUrl: string
  ctaType: string
  default: { headline: string; primaryText: string; imageHash: string; imageUrl: string }
  overrides: Partial<Record<PlacementKey, PlacementCreativeOverride>>
}

/**
 * Decode a live asset_feed_spec creative back into a default + per-placement
 * overrides — the exact inverse of buildAssetFeedSpec below, so a launched
 * landing-click ad's per-placement creative can be viewed and edited instead
 * of only being settable at launch time.
 *
 * Round-trip works because buildAssetFeedSpec dedupes identical values to the
 * SAME label: a placement whose rule shares its title/body/image label with
 * the catch-all rule was never actually customized on that field — so
 * comparing labels (not resolved text) tells us exactly what to show as
 * "customized" vs. "inherits the default", with no guessing.
 */
export async function getAdPlacementCreative(adId: string): Promise<AdPlacementSnapshot> {
  const ad = await apiFetch<{
    id: string; name?: string; status?: string
    creative?: {
      id?: string
      asset_feed_spec?: {
        images?: Array<{ hash: string; adlabels?: Array<{ name: string }> }>
        bodies?: Array<{ text: string; adlabels?: Array<{ name: string }> }>
        titles?: Array<{ text: string; adlabels?: Array<{ name: string }> }>
        link_urls?: Array<{ website_url?: string }>
        call_to_action_types?: string[]
        asset_customization_rules?: Array<{
          customization_spec?: { publisher_platforms?: string[]; facebook_positions?: string[]; instagram_positions?: string[] }
          image_label?: { name: string }
          body_label?: { name: string }
          title_label?: { name: string }
          priority?: number
        }>
      }
    }
  }>(`/${adId}`, undefined, {
    fields: 'id,name,status,creative{id,asset_feed_spec}',
  })

  const base = { id: String(ad.id), name: String(ad.name ?? ''), status: String(ad.status ?? '') }
  const afs = ad.creative?.asset_feed_spec
  const rules = afs?.asset_customization_rules ?? []
  if (!afs || rules.length === 0) {
    return {
      ...base, isPlacementCreative: false, landingUrl: '', ctaType: '',
      default: { headline: '', primaryText: '', imageHash: '', imageUrl: '' }, overrides: {},
    }
  }

  const imageByLabel = new Map((afs.images ?? []).flatMap((i) => (i.adlabels ?? []).map((l) => [l.name, i.hash] as const)))
  const bodyByLabel  = new Map((afs.bodies ?? []).flatMap((b) => (b.adlabels ?? []).map((l) => [l.name, b.text] as const)))
  const titleByLabel = new Map((afs.titles ?? []).flatMap((t) => (t.adlabels ?? []).map((l) => [l.name, t.text] as const)))

  // The catch-all rule is always written LAST with the highest priority
  // number (see buildAssetFeedSpec) — the one real invariant to key off.
  const catchAll = rules.reduce((a, b) => ((b.priority ?? 0) > (a.priority ?? 0) ? b : a))
  const defaultHeadline = catchAll.title_label ? (titleByLabel.get(catchAll.title_label.name) ?? '') : ''
  const defaultPrimaryText = catchAll.body_label ? (bodyByLabel.get(catchAll.body_label.name) ?? '') : ''
  const defaultImageHash = catchAll.image_label ? (imageByLabel.get(catchAll.image_label.name) ?? '') : ''

  const overrides: Partial<Record<PlacementKey, PlacementCreativeOverride>> = {}
  for (const rule of rules) {
    if (rule === catchAll) continue
    const spec = rule.customization_spec ?? {}
    const key = PLACEMENT_KEYS.find((k) => {
      const t = PLACEMENT_TARGETING[k]
      return !!t
        && sameStringSet(t.publisher_platforms, spec.publisher_platforms)
        && sameStringSet(t.facebook_positions, spec.facebook_positions)
        && sameStringSet(t.instagram_positions, spec.instagram_positions)
    })
    if (!key) continue // a rule we don't recognise — skip rather than guess
    const headline = rule.title_label && rule.title_label.name !== catchAll.title_label?.name
      ? (titleByLabel.get(rule.title_label.name) ?? '') : ''
    const primaryText = rule.body_label && rule.body_label.name !== catchAll.body_label?.name
      ? (bodyByLabel.get(rule.body_label.name) ?? '') : ''
    const imageHash = rule.image_label && rule.image_label.name !== catchAll.image_label?.name
      ? (imageByLabel.get(rule.image_label.name) ?? '') : ''
    if (headline || primaryText || imageHash) overrides[key] = { headline, primaryText, imageHash }
  }

  const hashes = [defaultImageHash, ...Object.values(overrides).map((o) => o?.imageHash ?? '')]
  const urls = await getAdImageUrls(hashes)
  const overridesWithUrls = Object.fromEntries(
    (Object.entries(overrides) as Array<[PlacementKey, PlacementCreativeOverride]>)
      .map(([k, o]) => [k, { ...o, imageUrl: o.imageHash ? (urls[o.imageHash] ?? '') : '' }]),
  ) as Partial<Record<PlacementKey, PlacementCreativeOverride>>

  return {
    ...base,
    isPlacementCreative: true,
    landingUrl: afs.link_urls?.[0]?.website_url ?? '',
    ctaType: afs.call_to_action_types?.[0] ?? 'LEARN_MORE',
    default: {
      headline: defaultHeadline, primaryText: defaultPrimaryText,
      imageHash: defaultImageHash, imageUrl: defaultImageHash ? (urls[defaultImageHash] ?? '') : '',
    },
    overrides: overridesWithUrls,
  }
}

/**
 * Edit a live per-placement (asset_feed_spec) ad: rebuild it from a new
 * default + override set and repoint the ad — same immutable-creative
 * pattern as updateAdCreativeContent, via the SAME encoder (buildAssetFeedSpec,
 * called through createAdCreative) that launchFullCampaign already uses, so
 * a saved edit is indistinguishable from one written at launch time.
 */
export async function updateAdPlacementCreative(
  adId: string,
  changes: {
    headline?: string; primaryText?: string; landingUrl?: string; cta?: string
    imageUrl?: string; imageHash?: string
    overrides: Partial<Record<PlacementKey, PlacementCreativeOverride>>
  },
): Promise<{ adId: string; creativeId: string }> {
  const current = await getAdPlacementCreative(adId)
  if (!current.isPlacementCreative) {
    throw new MetaApiError('This ad does not use per-placement creative.', 0, 'unsupported')
  }
  const cta = (changes.cta && CTA_TYPES.includes(changes.cta as MetaCta) ? changes.cta : current.ctaType) as MetaCta
  const merged: CampaignCreative = {
    primaryText: changes.primaryText ?? current.default.primaryText,
    headline: changes.headline ?? current.default.headline,
    description: '', // asset_feed_spec creatives don't carry a description
    landingUrl: changes.landingUrl ?? current.landingUrl,
    cta: CTA_TYPES.includes(cta) ? cta : 'LEARN_MORE',
    imageHash: changes.imageHash ?? current.default.imageHash ?? undefined,
    imageUrl: changes.imageUrl ?? current.default.imageUrl ?? undefined,
    placementOverrides: changes.overrides,
  }
  const created = await createAdCreative({ name: `${current.name} — edited`, creative: merged })
  await apiPost(`/${adId}`, { creative: { creative_id: created.id } })
  return { adId, creativeId: created.id }
}

export async function listAds(adSetId: string): Promise<MetaAd[]> {
  const res = await apiFetch<{ data: MetaAd[] }>(`/${adSetId}/ads`, undefined, {
    fields: 'id,name,status,effective_status,creative{id,name},issues_info,ad_review_feedback',
  })
  return res.data ?? []
}

/**
 * Real rendered previews of a LIVE ad across placements. Meta returns the exact
 * iframe HTML Ads Manager shows — no mock markup — so the team sees the ad
 * "everywhere" it runs. A placement Meta can't render is skipped, not faked.
 */
export async function getAdPreviews(adId: string): Promise<{ format: MetaAdFormat; body: string }[]> {
  const formats: MetaAdFormat[] = ['MOBILE_FEED_STANDARD', 'INSTAGRAM_STANDARD', 'FACEBOOK_STORY_MOBILE']
  const out: { format: MetaAdFormat; body: string }[] = []
  for (const format of formats) {
    try {
      const res = await apiFetch<{ data?: Array<{ body?: string }> }>(`/${adId}/previews`, undefined, { ad_format: format })
      const body = res.data?.[0]?.body
      if (body) out.push({ format, body })
    } catch { /* skip a placement Meta declines to render */ }
  }
  return out
}

/**
 * Live engagement on the ACTUAL post behind an ad — likes, comments, shares.
 * Real social proof from the running creative that the spend/leads KPIs don't
 * capture. Returns null when the ad has no organic post to read.
 */
export async function getAdEngagement(adId: string): Promise<{ likes: number; comments: number; shares: number } | null> {
  const ad = await apiFetch<{ creative?: { effective_object_story_id?: string; object_story_id?: string } }>(
    `/${adId}`, undefined, { fields: 'creative{effective_object_story_id,object_story_id}' },
  )
  const postId = ad.creative?.effective_object_story_id || ad.creative?.object_story_id
  if (!postId) return null
  const post = await apiFetch<{
    likes?: { summary?: { total_count?: number } }
    comments?: { summary?: { total_count?: number } }
    shares?: { count?: number }
  }>(`/${postId}`, undefined, { fields: 'likes.summary(true),comments.summary(true),shares' })
  return {
    likes: post.likes?.summary?.total_count ?? 0,
    comments: post.comments?.summary?.total_count ?? 0,
    shares: post.shares?.count ?? 0,
  }
}

// ─── Lead Gen Forms ───────────────────────────────────────────────────────────

/**
 * Every Facebook Page this login can act on, each with its OWN page access
 * token.
 *
 * Why this exists: lead-gen forms and their leads are PAGE assets, and the app
 * only ever looked at the single configured META_PAGE_ID using the single
 * connected token. Two consequences, both reported as bugs:
 *
 *   · a business running several Pages saw only one Page's forms — the rest
 *     were invisible, so their leads were never even attempted;
 *   · reading /{form}/leads with a USER token frequently fails where the
 *     owning Page's token succeeds, which is a very common reason for a form
 *     that plainly has leads on Meta to sync none of them.
 *
 * Falls back to the configured page on its own token when /me/accounts can't
 * be read — which is the normal case when the stored token IS already a page
 * token. Never throws: an unreadable page list degrades to today's behaviour.
 */
export interface MetaPageRef {
  id: string
  name: string | null
  token: string
  /** May this login run ads from the Page? Unknown reads as true — only an
   *  explicit tasks list without ADVERTISE/MANAGE is a real no. */
  canAdvertise: boolean
  /** The same answer without the guess: 'unknown' where canAdvertise had to
   *  assume. See lib/meta/page-ads.ts — a launch may not be refused on an
   *  assumption, so the refusal path reads THIS. */
  adsVerdict: PageAdsVerdict
}

export async function listAccessiblePages(): Promise<MetaPageRef[]> {
  const { pageId, token } = await creds()
  // A LOOKUP FAILURE IS NOT A PERMISSION ANSWER. The fallback row exists so the
  // launcher still opens; its verdict is 'unknown' so nothing downstream reads
  // our own outage as Meta's approval.
  const fallback: MetaPageRef[] = [
    { id: pageId, name: null, token, canAdvertise: true, adsVerdict: 'unknown' },
  ]
  try {
    const res = await apiFetchAllPages<{ id: string; name?: string; access_token?: string; tasks?: string[] }>(
      '/me/accounts', { fields: 'id,name,access_token,tasks', limit: '50' }, 100,
    )
    const pages = res
      .filter((p) => p.id)
      .map((p) => {
        // Whether this login may RUN ADS from the Page — Meta's `tasks` edge.
        // Absent tasks is unknown, not forbidden: only an explicit list that
        // lacks ADVERTISE/MANAGE is a real "no", and the launcher shows it
        // instead of letting the launch fail at the far end (subcode 1487202).
        const adsVerdict = pageAdsVerdict(p.tasks)
        return {
          id: p.id, name: p.name ?? null, token: p.access_token || token,
          canAdvertise: adsVerdict !== 'cannot',
          adsVerdict,
        }
      })
    if (pages.length === 0) return fallback
    // The configured Page must always be included, even if /me/accounts omits
    // it (it can, for Pages held through a Business rather than personally).
    // It used to be appended with canAdvertise hardcoded TRUE — and it is the
    // Page the wizard uses when nobody picks another, so the one Page most
    // launches run from was the one Page never checked.
    if (!pages.some((p) => p.id === pageId)) {
      pages.unshift({ id: pageId, name: null, token, canAdvertise: true, adsVerdict: 'unknown' })
    }
    return pages
  } catch {
    return fallback
  }
}

/**
 * CAN AN AD BE CREATED FROM THIS PAGE — the question the launch route asks
 * before it creates anything.
 *
 * Two reads, because they fail differently. `/me/accounts` carries `tasks` for
 * every Page this login holds personally; a Page held through a Business can be
 * missing from it entirely, and reading the Page node directly answers for that
 * one. Neither throws: an unreadable answer is 'unknown', which never refuses.
 *
 * `pageId` omitted ⇒ the configured Page, which is what a launch that names no
 * Page will actually run from.
 */
export async function checkPageAds(pageId?: string): Promise<{
  pageId: string
  pageName: string | null
  verdict: PageAdsVerdict
}> {
  const { pageId: configured } = await creds()
  const id = (pageId || configured || '').trim()
  if (!id) return { pageId: '', pageName: null, verdict: 'unknown' }

  const listed = await listAccessiblePages().catch(() => [] as MetaPageRef[])
  const hit = listed.find((p) => p.id === id)
  if (hit && hit.adsVerdict !== 'unknown') {
    return { pageId: id, pageName: hit.name, verdict: hit.adsVerdict }
  }

  try {
    const page = await apiFetch<{ id: string; name?: string; tasks?: string[] }>(
      `/${id}`, undefined, { fields: 'id,name,tasks' },
    )
    return { pageId: id, pageName: page.name ?? hit?.name ?? null, verdict: pageAdsVerdict(page.tasks) }
  } catch {
    return { pageId: id, pageName: hit?.name ?? null, verdict: 'unknown' }
  }
}

/**
 * WHOSE PROFILE THE AD APPEARS UNDER.
 *
 * An ad does not run from the ad account, it runs from a Facebook Page — and
 * on Instagram it appears as whichever Instagram account that Page is
 * connected to. The system knew both and showed neither, so nobody launching
 * an ad could see whose name and picture the buyer would see next to it. On a
 * brokerage with more than one Page that is not a detail.
 *
 * The Instagram side is read, not assumed: a Page with no connected Instagram
 * account still runs on Instagram, as the Page itself, and saying so is the
 * honest answer rather than showing a blank.
 */
export interface AdIdentity {
  pageId: string
  pageName: string | null
  /** The Instagram account the ads appear as, when the Page has one. */
  instagram: { id: string; username: string | null } | null
  /**
   * Every distinct Instagram account this Page can run ads as. Meta allows
   * the creative to name one via instagram_user_id, but only from the Page's
   * own connections — the business account and the connected account, which
   * are usually the same and occasionally two. This is the whole legal set;
   * an arbitrary Instagram account cannot be chosen, by Meta's rule not ours.
   */
  instagramOptions: Array<{ id: string; username: string | null }>
}

export async function getAdIdentity(pageIdOverride?: string): Promise<AdIdentity> {
  const { pageId: configured } = await creds()
  const pageId = pageIdOverride || configured
  try {
    const page = await apiFetch<{
      id: string
      name?: string
      instagram_business_account?: { id: string; username?: string }
      connected_instagram_account?: { id: string; username?: string }
    }>(`/${pageId}`, undefined, {
      fields: 'id,name,instagram_business_account{id,username},connected_instagram_account{id,username}',
    })
    const ig = page.instagram_business_account ?? page.connected_instagram_account ?? null
    const options = [page.instagram_business_account, page.connected_instagram_account]
      .filter((x): x is { id: string; username?: string } => !!x?.id)
      .filter((x, i, xs) => xs.findIndex((y) => y.id === x.id) === i)
      .map((x) => ({ id: x.id, username: x.username ?? null }))
    return {
      pageId,
      pageName: page.name ?? null,
      instagram: ig ? { id: ig.id, username: ig.username ?? null } : null,
      instagramOptions: options,
    }
  } catch {
    // Never throws: not knowing the name is a smaller problem than a screen
    // that will not load.
    return { pageId, pageName: null, instagram: null, instagramOptions: [] }
  }
}

/**
 * Lead-gen forms across EVERY accessible Page, not just the configured one.
 * Each Page is read with its own token, and each form is tagged with the Page
 * it belongs to so the UI can group them and the sync can pick the right token.
 */
export async function listLeadForms(): Promise<MetaLeadForm[]> {
  const pages = await listAccessiblePages()
  const perPage = await Promise.all(pages.map(async (page) => {
    try {
      // Follows pagination (capped at 200 forms per Page) — one un-followed
      // page of 50 was silently hiding every form past the first.
      const forms = await apiFetchAllPages<MetaLeadForm>(`/${page.id}/leadgen_forms`, {
        fields: 'id,name,status,leads_count,created_time,locale,follow_up_action_url',
        limit:  '50',
      }, 200, page.token)
      return forms.map((f) => ({ ...f, page_id: page.id, page_name: page.name }))
    } catch {
      // One Page we lack a role on must not hide every OTHER Page's forms.
      return [] as MetaLeadForm[]
    }
  }))
  // Dedupe by form id — a Page reachable both directly and via a Business can
  // appear twice in /me/accounts.
  const byId = new Map<string, MetaLeadForm>()
  for (const f of perPage.flat()) if (!byId.has(f.id)) byId.set(f.id, f)
  return [...byId.values()]
}

// Conversion pixels on the ad account. Powers the campaign wizard's pixel
// picker so a campaign can optimize on a specific pixel instead of only the
// account default.
export async function listPixels(): Promise<MetaPixel[]> {
  const { adAccountId } = await creds()
  const res = await apiFetch<{ data: { id: string; name?: string; last_fired_time?: string }[] }>(
    `/${adAccountId}/adspixels`, undefined,
    { fields: 'id,name,last_fired_time', limit: '25' },
  )
  return (res.data ?? []).map((p) => ({
    id: p.id,
    name: p.name || p.id,
    lastFiredTime: p.last_fired_time ?? null,
  }))
}

/**
 * The pixel id the SERVER-side Conversions API fires at (lib/meta/capi.ts) —
 * env META_PIXEL_ID, else the id stored with the Meta connection. Exposed so
 * the Pixel tab can tell the operator when the browser pixel on the landing
 * pages and the server pixel are two DIFFERENT pixels, which silently breaks
 * Meta's browser/server deduplication of the same lead.
 */
export async function getConfiguredPixelId(): Promise<string | null> {
  const { pixelId } = await creds()
  return pixelId
}

/** Create a pixel on the connected ad account. POST /{adAccountId}/adspixels. */
export async function createPixel(name: string): Promise<MetaPixel> {
  const { adAccountId } = await creds()
  const res = await apiPost<{ id: string; name?: string }>(`/${adAccountId}/adspixels`, { name })
  // Graph answers a create with the id only; the name is the one we just sent.
  return { id: res.id, name: res.name || name, lastFiredTime: null }
}

/**
 * One pixel read on its own node, including `code` — Meta's base-code snippet.
 * Only needed for sites this platform does NOT own; our landing pages inject
 * the pixel themselves from the saved global id.
 */
export async function getPixelDetail(pixelId: string): Promise<MetaPixelDetail> {
  const res = await apiFetch<{ id: string; name?: string; code?: string; last_fired_time?: string }>(
    `/${pixelId}`, undefined, { fields: 'id,name,code,last_fired_time' },
  )
  return {
    id: res.id,
    name: res.name || res.id,
    lastFiredTime: res.last_fired_time ?? null,
    code: res.code ?? null,
  }
}

// ─── Custom conversions ───────────────────────────────────────────────────────
// A custom conversion is the object an ad set can actually optimize toward: a
// named rule over the events a pixel receives.

interface RawCustomConversion {
  id: string
  name?: string
  custom_event_type?: string
  rule?: string | Record<string, unknown>
  is_archived?: boolean
  last_fired_time?: string
  description?: string
  pixel?: { id?: string; name?: string }
  data_sources?: { id?: string; name?: string; source_type?: string }[]
}

// `event_source_id` is a create-only PARAMETER — it is not a readable field on
// the node, so the pixel a conversion listens to is read from `pixel` /
// `data_sources` instead. The richer list is tried first and narrowed on a
// field error (Graph rejects the whole read if one field is unavailable to the
// account), so a permission quirk degrades the detail rather than the page.
const CUSTOM_CONVERSION_FIELDS_FULL =
  'id,name,custom_event_type,rule,is_archived,last_fired_time,description,pixel{id,name},data_sources{id,name,source_type}'
const CUSTOM_CONVERSION_FIELDS_MIN = 'id,name,custom_event_type,rule,is_archived'

function normalizeCustomConversion(raw: RawCustomConversion): MetaCustomConversion {
  const sources = Array.isArray(raw.data_sources) ? raw.data_sources : []
  return {
    id: raw.id,
    name: raw.name || raw.id,
    customEventType: raw.custom_event_type ?? null,
    rule: typeof raw.rule === 'string' ? raw.rule : raw.rule ? JSON.stringify(raw.rule) : null,
    eventSourceId: raw.pixel?.id ?? sources[0]?.id ?? null,
    eventSourceName: raw.pixel?.name ?? sources[0]?.name ?? null,
    isArchived: raw.is_archived === true,
    lastFiredTime: raw.last_fired_time ?? null,
    description: raw.description ?? null,
  }
}

/** Every custom conversion on the connected ad account, archived ones included
 *  (the UI labels them rather than hiding them). */
export async function listCustomConversions(): Promise<MetaCustomConversion[]> {
  const { adAccountId } = await creds()
  const read = (fields: string) =>
    apiFetch<{ data: RawCustomConversion[] }>(
      `/${adAccountId}/customconversions`, undefined, { fields, limit: '100' },
    )
  let res: { data: RawCustomConversion[] }
  try {
    res = await read(CUSTOM_CONVERSION_FIELDS_FULL)
  } catch (err) {
    // Code 100 is Graph's "unknown/unavailable field" — retry with the subset
    // every account can read. Any other error is a real failure and propagates.
    if (!(err instanceof MetaApiError) || err.code !== 100) throw err
    res = await read(CUSTOM_CONVERSION_FIELDS_MIN)
  }
  return (res.data ?? []).map(normalizeCustomConversion)
}

export interface CreateCustomConversionPayload {
  name: string
  /** The pixel the conversion listens to. */
  eventSourceId: string
  /** Meta's custom_event_type enum (LEAD, CONTENT_VIEW, SCHEDULE, OTHER, …). */
  customEventType: string
  /** Rule as a JSON STRING — Graph rejects a nested object here. */
  rule: string
  description?: string
}

/** Create a custom conversion. POST /{adAccountId}/customconversions. */
export async function createCustomConversion(
  payload: CreateCustomConversionPayload,
): Promise<{ id: string }> {
  const { adAccountId } = await creds()
  return apiPost<{ id: string }>(`/${adAccountId}/customconversions`, {
    name:              payload.name,
    event_source_id:   payload.eventSourceId,
    custom_event_type: payload.customEventType,
    rule:              payload.rule,
    ...(payload.description ? { description: payload.description } : {}),
  })
}

// Language (locale) targeting vocabulary. Meta's adlocale keys are numeric and
// stable, but we resolve them LIVE from Graph search rather than hardcoding
// guesses — so a selected "Arabic" is exactly Meta's Arabic locale key.
export async function searchAdLocales(q: string): Promise<MetaLocale[]> {
  const term = q.trim()
  if (!term) return []
  const res = await apiFetch<{ data: { key: number; name: string }[] }>(
    `/search`, undefined,
    { type: 'adlocale', q: term, limit: '25' },
  )
  return (res.data ?? [])
    .filter((l) => typeof l.key === 'number' && l.name)
    .map((l) => ({ key: l.key, name: l.name }))
}

// Lead-language → Meta locale IDs. Meta documents no complete static locale-ID
// table (its docs show only an illustrative example and direct integrators to
// /search?type=adlocale), so these are resolved LIVE per language and cached.
// MANUAL QA BEFORE FIRST LIVE LAUNCH: with a connected ad account, launch with
// a language narrowed and confirm the ad set's targeting.locales in Ads
// Manager covers the expected variants (all "English (…)" entries, etc.).
// Every language an ad can REACH, not just the three it can be written in.
// A code missing from this table resolves to no locale at all and silently
// stops narrowing for that language, so it must stay in step with
// REACHABLE_LEAD_LANGUAGES — the guard suite checks that it does.
const LEAD_LANGUAGE_SEARCH_TERMS: Record<string, string> = {
  en: 'English', ar: 'Arabic', ru: 'Russian',
  ur: 'Urdu', es: 'Spanish', de: 'German', fr: 'French', it: 'Italian',
}
// Only ever holds genuinely-resolved (non-empty) results — a language absent
// from this cache is retried on the next call rather than treated as
// "resolved to nothing".
const leadLanguageLocaleCache: Partial<Record<string, number[]>> = {}
async function resolveLeadLanguageLocaleIds(codes: string[]): Promise<number[]> {
  const ids = new Set<number>()
  for (const code of codes) {
    const term = LEAD_LANGUAGE_SEARCH_TERMS[code]
    if (!term) continue
    let resolved = leadLanguageLocaleCache[code]
    if (!resolved) {
      const matches = await searchAdLocales(term).catch(() => [] as MetaLocale[])
      // A name search can surface unrelated hits — keep only entries whose
      // name actually contains the language asked for (e.g. every English
      // variant: "English (US)", "English (UK)", …), so a bad search result
      // never widens targeting to the wrong language.
      resolved = matches
        .filter((m) => m.name.toLowerCase().includes(term.toLowerCase()))
        .map((m) => m.key)
      if (resolved.length > 0) {
        // Only cache a genuinely non-empty resolution. searchAdLocales's
        // failure path is indistinguishable from a real empty result here —
        // caching it would permanently pin this language to "no restriction"
        // for the life of the process. Uncached = simply retried next launch.
        leadLanguageLocaleCache[code] = resolved
      } else {
        console.warn(`[meta-lead-language] locale search for "${term}" (${code}) returned no matches — targeting.locales will not be narrowed for this language until a future call succeeds`)
      }
    }
    resolved.forEach((id) => ids.add(id))
  }
  return Array.from(ids)
}

/**
 * Subscribe the connected Page to Meta's `leadgen` real-time webhook field —
 * the piece that makes a new lead push to us instantly instead of waiting on
 * a poll. Idempotent (safe to call repeatedly). This does NOT configure the
 * app-level Callback URL / Verify Token — that half only exists in Meta's App
 * Dashboard (Webhooks product) and has no API equivalent, so it's a one-time
 * manual step for whoever administers the Meta App.
 */
export async function subscribePageToLeadgenWebhook(): Promise<{ success: boolean }> {
  const { pageId } = await creds()
  return apiPost(`/${pageId}/subscribed_apps`, { subscribed_fields: 'leadgen' })
}

/**
 * Subscribe the leadgen webhook on EVERY accessible Page, each with its own
 * token. Subscribing only the configured Page meant real-time lead push simply
 * did not exist for any other Page's forms — their leads waited for the next
 * sweep, or never arrived at all if that Page's forms were invisible too.
 * Returns per-page outcomes rather than one boolean, so a partial failure is
 * reportable instead of collapsing to "false".
 */
export async function subscribeAllPagesToLeadgen(): Promise<{
  subscribed: number
  failed: { pageId: string; pageName: string | null; error: string }[]
}> {
  const pages = await listAccessiblePages()
  let subscribed = 0
  const failed: { pageId: string; pageName: string | null; error: string }[] = []
  for (const page of pages) {
    try {
      await apiPost(`/${page.id}/subscribed_apps`, { subscribed_fields: 'leadgen' }, page.token)
      subscribed += 1
    } catch (e) {
      failed.push({ pageId: page.id, pageName: page.name, error: e instanceof Error ? e.message : 'Unknown error' })
    }
  }
  return { subscribed, failed }
}

/**
 * Whether real-time lead push is actually live: reads the Page's
 * subscribed_apps edge and checks the `leadgen` field is among the
 * subscribed fields for this app. This is the honest signal — a form can
 * exist and collect leads on Meta while nothing ever reaches us because
 * this subscription silently lapsed.
 */
export async function getLeadgenSubscriptionStatus(): Promise<{
  subscribed: boolean
  /** Pages with leadgen push live, out of every accessible Page. */
  subscribedPages: number
  totalPages: number
  /** Named Pages that are NOT pushing — the ones whose forms go quiet. */
  unsubscribed: { pageId: string; pageName: string | null }[]
}> {
  // Checked across EVERY accessible Page, because that is what we subscribe.
  // Reading only the configured Page made this badge structurally unable to
  // report the failure it exists to catch: a second Page whose forms collect
  // leads while nothing pushes would still have shown a green "real-time on".
  const pages = await listAccessiblePages()
  const results = await Promise.all(pages.map(async (page) => {
    try {
      const res = await apiFetch<{ data?: { subscribed_fields?: string[] }[] }>(
        `/${page.id}/subscribed_apps`, undefined, { fields: 'subscribed_fields' }, page.token,
      )
      const apps = Array.isArray(res.data) ? res.data : []
      return { page, ok: apps.some((a) => (a.subscribed_fields ?? []).includes('leadgen')) }
    } catch {
      // Unreadable is not subscribed — this gate must fail closed, or it goes
      // back to reassuring the operator about a Page it cannot actually see.
      return { page, ok: false }
    }
  }))
  const unsubscribed = results.filter((r) => !r.ok).map((r) => ({ pageId: r.page.id, pageName: r.page.name }))
  const subscribedPages = results.length - unsubscribed.length
  return {
    // Green only when EVERY Page pushes. Partial coverage is a real defect for
    // the Pages left out, so it must not read as healthy.
    subscribed: results.length > 0 && unsubscribed.length === 0,
    subscribedPages,
    totalPages: results.length,
    unsubscribed,
  }
}

// The rich read set — everything the builder writes that Meta lets us read
// back (questions incl. options, intro card, thank-you page, form type). If a
// Graph version rejects one of the richer fields ((#100) nonexistent field),
// fall back to the always-safe basic set so the detail page and duplication
// keep working instead of hard-failing.
const LEAD_FORM_FIELDS_RICH =
  'id,name,status,leads_count,created_time,locale,follow_up_action_url,privacy_policy_url,questions,context_card,thank_you_page,is_optimized_for_quality,question_page_custom_headline'
const LEAD_FORM_FIELDS_BASIC =
  'id,name,status,leads_count,created_time,locale,follow_up_action_url,questions'

export async function getLeadForm(formId: string): Promise<MetaLeadForm> {
  try {
    return await apiFetch<MetaLeadForm>(`/${formId}`, undefined, { fields: LEAD_FORM_FIELDS_RICH })
  } catch (e) {
    if (e instanceof MetaApiError && e.code === 100) {
      return apiFetch<MetaLeadForm>(`/${formId}`, undefined, { fields: LEAD_FORM_FIELDS_BASIC })
    }
    throw e
  }
}

export async function createLeadForm(payload: CreateLeadFormPayload): Promise<{ id: string }> {
  // Lead forms are owned by the Page, not the ad account — the create edge is
  // POST /{page-id}/leadgen_forms. Posting to /act_XXX/leadgen_forms (a
  // read-only aggregation edge) is what Meta answers with its opaque
  // "An unknown error has occurred."
  const { pageId } = await creds()
  // A PREFILL question (FULL_NAME, EMAIL, PHONE, …) carries its type and
  // nothing else. Meta writes its wording itself and rejects the whole form if
  // we send our own:
  //   "Parameter label cannot be specified for non-custom questions" (1892063)
  // Duplicating a form walked straight into this — reading a form back gives
  // every question a label, including the prefill ones, and sending that shape
  // back is not a form Meta will accept. Enforced here rather than in each
  // caller: this is the single door every form goes through.
  const questions = questionsForMeta(payload.questions)

  // Attribution that rides on every lead this form ever collects
  // (tracking_parameters is echoed back with each lead's field data).
  // Caller-provided params are merged over the defaults.
  const campaignSlug = payload.name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'lead-form'
  const trackingParameters: Record<string, string> = {
    utm_source:   'meta-form',
    utm_medium:   'paid',
    utm_campaign: campaignSlug,
    ...(payload.trackingParameters ?? {}),
  }

  // Thank-you button — each type carries the companion field Meta requires:
  // VIEW_WEBSITE / DOWNLOAD → website_url, CALL_BUSINESS → business_phone_number
  // (+ country_code). A CALL_BUSINESS request without a phone number falls back
  // to the landing-page button rather than sending Meta an invalid page.
  const buttonType: string =
    payload.thankYouButtonType === 'CALL_BUSINESS' && !payload.thankYouBusinessPhone
      ? 'VIEW_WEBSITE'
      : (payload.thankYouButtonType ?? 'VIEW_WEBSITE')
  const thankYouButton =
    buttonType === 'CALL_BUSINESS'
      ? {
          button_type: 'CALL_BUSINESS',
          button_text: payload.thankYouButtonText || 'Call us',
          business_phone_number: payload.thankYouBusinessPhone,
          country_code: payload.thankYouPhoneCountryCode || 'AE',
        }
      : buttonType === 'DOWNLOAD'
        ? {
            button_type: 'DOWNLOAD',
            button_text: payload.thankYouButtonText || 'Download',
            website_url: payload.thankYouWebsiteUrl || payload.landingUrl,
          }
        : {
            button_type: 'VIEW_WEBSITE',
            button_text: payload.thankYouButtonText || 'Visit site',
            website_url: payload.thankYouWebsiteUrl || payload.landingUrl,
          }

  return apiPost(`/${pageId}/leadgen_forms`, {
    name:               payload.name,
    // Optional per-form language (en_US / ar_AR / ru_RU) — defaults to the
    // previous hardcoded en_US so omitting it changes nothing.
    locale:             payload.locale ?? 'en_US',
    follow_up_action_url: payload.landingUrl,
    questions,
    privacy_policy: {
      url:       payload.privacyPolicyUrl,
      link_text: 'Privacy Policy',
    },
    tracking_parameters: trackingParameters,
    // "Higher intent" (review screen) vs "More volume". Only sent when the
    // caller chose — omitting keeps Meta's default (More volume) untouched.
    ...(payload.isOptimizedForQuality !== undefined
      ? { is_optimized_for_quality: payload.isOptimizedForQuality }
      : {}),
    ...(payload.questionPageHeadline
      ? { question_page_custom_headline: payload.questionPageHeadline }
      : {}),
    // Text-only intro card. A cover photo needs a separate page-photo upload
    // (context_card takes a photo id, not a URL) — intentionally not sent.
    ...(payload.contextCard
      ? {
          context_card: {
            title:   payload.contextCard.title,
            style:   payload.contextCard.style ?? 'LIST_STYLE',
            content: payload.contextCard.content,
            ...(payload.contextCard.buttonText ? { button_text: payload.contextCard.buttonText } : {}),
          },
        }
      : {}),
    // Meta's SMS OTP verification of the lead's phone number — documented as
    // is_phone_sms_verify_enabled on POST /{page}/leadgen_forms.
    ...(payload.phoneSmsVerification ? { is_phone_sms_verify_enabled: true } : {}),
    ...(payload.thankYouTitle
      ? {
          thank_you_page: {
            title: payload.thankYouTitle,
            body: payload.thankYouBody ?? '',
            // Meta requires a button on the thank-you page ((#100)
            // thank_you_page[button_type] is required).
            ...thankYouButton,
          },
        }
      : {}),
  })
}

export async function getFormLeads(
  formId: string,
  pageToken?: string,
  /** Unix seconds. When given, Meta returns ONLY leads created after this —
   *  the difference between re-reading a form's entire history on every cron
   *  pass and reading the handful that are actually new. */
  sinceUnix?: number,
): Promise<MetaFormLead[]> {
  // Follows pagination up to 5000 leads per form (25 pages) — and says so
  // when the cap is hit, so a monster form can't silently under-sync.
  // `pageToken`: leads are a Page asset, and reading them with the owning
  // Page's token succeeds in cases where the generic connected token is
  // rejected — a very common reason a form with leads on Meta syncs none.
  const CAP = 5000
  const leads = await apiFetchAllPages<MetaFormLead>(`/${formId}/leads`, {
    fields: 'id,created_time,field_data,ad_id,adset_id,campaign_id',
    limit:  '200',
    ...(sinceUnix && Number.isFinite(sinceUnix)
      ? { filtering: JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: Math.floor(sinceUnix) }]) }
      : {}),
  }, CAP, pageToken)
  if (leads.length >= CAP) {
    console.warn(`[meta-leads] form ${formId} returned ${CAP}+ leads — pagination capped, oldest leads beyond the cap were not fetched this pass`)
  }
  return leads
}

// ─── Ad Set Updates ───────────────────────────────────────────────────────────

/**
 * Turn a single AD on or off.
 *
 * The one level of the hierarchy that had no status control anywhere — the
 * campaign could be paused and so could an ad set, but an individual ad could
 * only be edited or left alone. That is the control you need when one creative
 * in a working ad set is the problem: pausing the ad set to stop one ad throws
 * away the ad set's learning along with it.
 */
export async function updateAdStatus(
  adId: string,
  status: MetaCampaignStatus,
): Promise<{ success: boolean }> {
  await apiPost(`/${adId}`, { status })
  return { success: true }
}

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
      geo_locations: geoLocationsSpec({
        countries: params.targeting.countries,
        cityKeys: params.targeting.cityKeys,
        locationTypes: params.targeting.locationTypes,
      }),
      age_min: params.targeting.ageMin,
      age_max: params.targeting.ageMax,
      publisher_platforms: params.targeting.publisherPlatforms,
      ...(params.targeting.interests.length > 0 ? { interests: params.targeting.interests } : {}),
    }
  }
  return apiPost(`/${adSetId}`, body)
}

/**
 * DROP ONE PLACEMENT FROM A LIVE AD SET, AND PROVE IT HAPPENED.
 *
 * `updateAdSet` above must never be used for this. It builds a targeting
 * object from a CampaignTargeting shape — geo, ages, publisher_platforms,
 * interests — and Meta REPLACES the whole targeting object on write, so
 * everything not in that shape is deleted: flexible_spec (the property
 * qualifier), exclusions (the do-not-target audience), locales (the Arabic
 * narrowing), the position lists, and targeting_automation (the Advantage
 * opt-out, whose absence Meta reads as opt-IN). One such call turns a bounded
 * property audience into everybody with Advantage back on.
 *
 * That was harmless while nothing called it with targeting on a live ad set.
 * It stops being harmless the moment a person can press Accept, which is what
 * this function exists to make safe:
 *
 *   read the live spec → change only the placement fields → write the SAME
 *   object back → read it again and check both that the placement went and
 *   that nothing else did.
 *
 * A 200 from Meta means "request accepted", not "field changed" — this product
 * has already been caught by that with location_types. So nothing is reported
 * as done until Meta says it is, and a write that did not land comes back as a
 * failure rather than an assumption. The rules live in ./placement-write.ts,
 * pure, so they are asserted without a network.
 */
export async function dropPlacement(
  adSetId: string, drop: string,
): Promise<PlacementWriteOutcome> {
  let live: Record<string, unknown>
  try {
    const res = await apiFetch<{ targeting?: Record<string, unknown> }>(
      `/${adSetId}`, undefined, { fields: 'targeting' },
    )
    if (!res?.targeting) return { ok: false, reason: 'unreadable', detail: 'Meta returned no targeting spec' }
    live = res.targeting
  } catch (err) {
    return { ok: false, reason: 'unreadable', detail: err instanceof Error ? err.message : 'read failed' }
  }

  const before = readInvariants(live)
  const next = withoutPlacement(live, drop)
  if (!next) {
    return {
      ok: false, reason: 'would_empty',
      detail: 'Removing this would leave no placements, and an empty placement list lets Meta choose — including Audience Network.',
    }
  }

  try {
    await apiPost(`/${adSetId}`, { targeting: next })
  } catch (err) {
    return { ok: false, reason: 'write_rejected', detail: err instanceof Error ? err.message : 'Meta refused the change' }
  }

  let after: Record<string, unknown>
  try {
    const res = await apiFetch<{ targeting?: Record<string, unknown> }>(
      `/${adSetId}`, undefined, { fields: 'targeting' },
    )
    after = res?.targeting ?? {}
  } catch (err) {
    return { ok: false, reason: 'not_applied', detail: `could not confirm the change: ${err instanceof Error ? err.message : 'read failed'}` }
  }

  const now = placementKeys(after)
  if (now.includes(drop)) {
    return { ok: false, reason: 'not_applied', detail: `Meta accepted the request but ${drop} is still on the ad set` }
  }

  // THE REASON THIS FUNCTION EXISTS. If the qualifier, the exclusions, the
  // languages or the Advantage opt-out moved with the placement, the fix cost
  // more than it saved and the person is told, not congratulated.
  const post = readInvariants(after)
  const lost: string[] = []
  if (post.flexibleGroups < before.flexibleGroups) lost.push('the narrowing groups')
  if (before.hasExclusions && !post.hasExclusions) lost.push('the exclusions')
  if (post.locales < before.locales) lost.push('the language targeting')
  if (before.advantageAudienceOff && !post.advantageAudienceOff) lost.push('the Advantage opt-out')
  if (lost.length > 0) {
    return { ok: false, reason: 'collateral_damage', detail: `the placement changed but so did ${lost.join(', ')}` }
  }

  return { ok: true, placements: now }
}

export async function getAdSet(adSetId: string): Promise<MetaAdSet> {
  return apiFetch<MetaAdSet>(`/${adSetId}`, undefined, {
    fields: 'id,name,status,daily_budget,optimization_goal,billing_event,targeting',
  })
}

/** One design's results inside a campaign — the row of the designs report. */
export interface AdResult {
  id: string
  name: string
  status: string
  thumbnailUrl: string | null
  spend: number
  leads: number
  cpl: number | null
}

/**
 * Every ad (design) in a campaign with its own spend and leads — the answer to
 * "which design brings the leads". Numbers come from Meta or the row shows
 * zeros; nothing is invented.
 *
 * LIFETIME, NOT A ROLLING WINDOW. This read was the last copy of the window
 * bug: the designs panel showed "9 leads" on a winning design while the CRM
 * held 20 from the same campaign, because a rolling 30 days silently drops
 * everything older. A design that brought a lead in March did not stop having
 * brought it in April, and a panel that judges which creative wins must count
 * every lead it ever won or it will retire the wrong one.
 */
export async function getAdResults(campaignId: string): Promise<AdResult[]> {
  const res = await apiFetch<{ data?: Array<{
    id?: string; name?: string; status?: string
    creative?: { thumbnail_url?: string }
    insights?: { data?: Array<{ spend?: string; actions?: Array<{ action_type: string; value: string }> }> }
  }> }>(`/${campaignId}/ads`, undefined, {
    fields: `id,name,status,creative{thumbnail_url},insights.date_preset(${HEADLINE_WINDOW}){spend,actions}`,
    limit: '50',
  })
  return (res.data ?? [])
    .filter((a) => a.id)
    .map((a) => {
      const ins = a.insights?.data?.[0]
      const spend = Number(ins?.spend ?? 0)
      const leads = metaLeadCount(ins?.actions)
      return {
        id: String(a.id),
        name: String(a.name ?? ''),
        status: String(a.status ?? ''),
        thumbnailUrl: a.creative?.thumbnail_url ?? null,
        spend,
        leads,
        cpl: leads > 0 ? Math.round((spend / leads) * 10) / 10 : null,
      }
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

// ─── Custom & Lookalike Audiences (from the company's own closed buyers) ──────
//
// Meta requires every identifier to be normalized and SHA-256 hashed BEFORE it
// leaves our server — raw customer emails/phones are never sent. We build a
// source Custom Audience from the hashed contacts, then create a Lookalike from
// it. This is a consequential outward action (buyer data → Meta), so the caller
// must gate it behind an explicit user confirmation.

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
// Meta's normalization rules: email lowercased/trimmed; phone digits only with
// country code, no leading +. Empty input → '' (Meta treats it as "no value").
function hashEmail(email: string): string {
  const e = email.trim().toLowerCase()
  return e ? sha256(e) : ''
}
function hashPhone(phone: string): string {
  const p = phone.replace(/[^\d]/g, '').replace(/^0+/, '')
  return p ? sha256(p) : ''
}

export interface BuyerContact { email?: string | null; phone?: string | null }

// ─── Live targeting vocabulary ────────────────────────────────────────────────
// Real Meta interest/behavior entities with real audience sizes — never a
// hardcoded id (they rot) and never an invented segment name.

export interface VocabularyEntry {
  id: string
  name: string
  /** Meta's own audience-size band for the segment, when it reports one. */
  audienceLower?: number
  audienceUpper?: number
  /** Category path, e.g. "Behaviors > Travel". */
  path?: string
}

type RawVocabRow = {
  id?: string | number
  name?: string
  audience_size_lower_bound?: number
  audience_size_upper_bound?: number
  path?: string[]
}

const mapVocab = (rows: RawVocabRow[] | undefined): VocabularyEntry[] =>
  (rows ?? [])
    .filter((r) => r.id && r.name)
    .map((r) => ({
      id: String(r.id),
      name: String(r.name),
      audienceLower: r.audience_size_lower_bound,
      audienceUpper: r.audience_size_upper_bound,
      path: Array.isArray(r.path) ? r.path.join(' > ') : undefined,
    }))

/** Search Meta's live interest vocabulary (type=adinterest). */
export async function searchInterests(q: string, limit = 25): Promise<VocabularyEntry[]> {
  const res = await apiFetch<{ data?: RawVocabRow[] }>('/search', undefined, {
    type: 'adinterest',
    q,
    limit: String(Math.min(limit, 50)),
  })
  return mapVocab(res.data)
}

/**
 * Browse Meta's live behavior/demographic vocabulary (adTargetingCategory).
 * Meta returns the full class list — filter by the query here.
 */
export async function searchBehaviors(
  q: string,
  cls: 'behaviors' | 'demographics' | 'life_events' = 'behaviors',
  limit = 25,
): Promise<VocabularyEntry[]> {
  const res = await apiFetch<{ data?: RawVocabRow[] }>('/search', undefined, {
    type: 'adTargetingCategory',
    class: cls,
    limit: '500',
  })
  const all = mapVocab(res.data)
  const needle = q.trim().toLowerCase()
  const hits = needle ? all.filter((e) => e.name.toLowerCase().includes(needle) || e.path?.toLowerCase().includes(needle)) : all
  return hits.slice(0, Math.min(limit, 50))
}

/**
 * VERIFY OUR OWN HARDCODED CATALOG AGAINST LIVE META.
 *
 * Every interest/behaviour id this system ships with (the real-estate
 * anchor, the motive/money mappings, the AI's targeting catalog) is a
 * literal id someone copied down once. Meta deprecates and merges targeting
 * nodes on its own schedule, silently — the id just stops resolving, and
 * the first anyone hears of it is a launch failing at whichever ad set
 * Meta happens to validate first (which is exactly what happened: the
 * real-estate anchor rides on every audience, one entry in it went dead,
 * and every launch failed until someone read the error).
 *
 * This checks each id directly against the node it names — `GET /{id}` on
 * a live interest/behaviour node returns the node; on a dead one Meta
 * answers with an error, same shape as every other Graph error this file
 * already parses. Run individually, not batched: Meta's batch `?ids=`
 * lookup silently DROPS dead ids from the response instead of reporting
 * them, which would hide exactly the failure this exists to catch.
 */
/** Walkable — what we actually learned about one catalog entry. */
export const ENTITY_VERDICTS = ['live', 'renamed', 'dead', 'unknown'] as const
export type EntityVerdict = (typeof ENTITY_VERDICTS)[number]

export interface EntityCheck {
  id: string
  /** The name our own catalog claims for this id. */
  claimedName: string
  /**
   * `unknown` is not a failure of the interest — it is a failure of the CHECK,
   * and the two must never render the same. The screen that reported eight
   * core property interests as retired was reporting its own inability to ask.
   */
  verdict: EntityVerdict
  valid: boolean
  /** Meta's own current name for the id, when it told us one. */
  liveName: string | null
  error: string | null
}

/**
 * VALIDATE AGAINST THE TARGETING VOCABULARY, NOT THE OBJECT GRAPH.
 *
 * This used to do `GET /{id}?fields=id,name` per entry. That resolves an id
 * against whatever object in Meta's graph happens to carry it — a Page, a post,
 * an ad — because targeting nodes are not first-class Graph objects you can
 * fetch that way. The results were not a report on our catalog at all:
 *
 *   · eight core property interests came back "retired" because the GET simply
 *     errored, which for a targeting id is the normal answer
 *   · "Job seeking" came back RENAMED TO "Beauty" — not a rename, a different
 *     object entirely that happens to hold that number
 *
 * The right endpoint is the one `resolveInterestNames` two thousand lines above
 * has used all along: `search?type=adinterestvalid`, scoped to the targeting
 * vocabulary. `interest_fbid_list` asks it by ID, which is what a catalog audit
 * needs — the ids are the thing being audited.
 *
 * A missing answer is `unknown`, never `dead`. A checker with only two outcomes
 * reports every one of its own failures as somebody else's.
 */
export async function verifyEntityIds(
  entities: Array<{ id: string; name: string }>,
): Promise<EntityCheck[]> {
  if (!entities.length) return []
  const unchecked = (error: string): EntityCheck[] =>
    entities.map((e) => ({
      id: e.id, claimedName: e.name, verdict: 'unknown' as const,
      valid: false, liveName: null, error,
    }))

  type Answer = { id?: string; name?: string; valid?: boolean }

  let token: string
  try { ({ token } = await creds()) } catch {
    // COULD NOT ASK. Every entry is unknown — reporting a catalog as dead
    // because our own request failed is the fault this rewrite exists for.
    return unchecked('Meta could not be reached')
  }

  const ask = async (ids: string[]): Promise<Answer[] | { error: string }> => {
    try {
      const url = new URL(`${API_BASE}/search`)
      url.searchParams.set('type', 'adinterestvalid')
      url.searchParams.set('interest_fbid_list', JSON.stringify(ids))
      url.searchParams.set('access_token', token)
      const res = await fetch(url.toString())
      const json = (await res.json()) as { data?: Answer[]; error?: { message?: string } }
      if (json.error) return { error: json.error.message ?? 'Meta refused the check' }
      return json.data ?? []
    } catch {
      return { error: 'Meta could not be reached' }
    }
  }

  const batch = await ask(entities.map((e) => e.id))
  if ('error' in batch) return unchecked(batch.error)

  const byId = new Map<string, Answer>()
  batch.forEach((a) => { if (a?.id) byId.set(String(a.id), a) })

  // ── WHEN THE BATCH CANNOT BE MATCHED, ASK ONE AT A TIME ──────────────────
  //
  // Meta does not always echo the id back. With nothing to match on, the batch
  // is unusable — and answering "could not check" for the whole catalog is
  // honest but worthless, which is its own kind of failure: a panel that says
  // "unknown" every time is a panel nobody reads, and then the one time an
  // interest really is dead, nobody looks.
  //
  // So each id is asked for on its own. One request carrying one id has
  // exactly one possible answer, so `singles[i]` belongs to `entities[i]` BY
  // CONSTRUCTION — not by assuming Meta preserved an order across a list.
  // That is the difference between this and the `answers[i]` fallback that put
  // the name "Beauty" on two unrelated interests: there, position was a guess
  // about a multi-item response; here, there is only one item it could be.
  if (byId.size === 0) {
    const singles = await Promise.all(entities.map(async (e) => {
      const one = await ask([e.id])
      return 'error' in one ? null : (one[0] ?? null)
    }))
    entities.forEach((e, i) => {
      const a = singles[i]
      if (a) byId.set(e.id, a)
    })
  }

  // MATCHED STRICTLY BY ID.
  //
  // There was a `?? answers[i]` positional fallback here, and it is what put
  // the name "Beauty" on two unrelated interests at once. Meta does not always
  // echo the id back; when it does not, `byId` was empty and EVERY entity fell
  // through to position, so a short or reordered `data` array married each id
  // to somebody else's answer and the screen reported renames that never
  // happened — the same false alarm, from a different direction, as the bare
  // GET this function replaced.
  //
  // A position inside a multi-item response is a guess. This function exists
  // because a guess was once dressed up as an answer, so it does not keep one.
  //
  // If even the one-at-a-time pass came back with nothing, say so.
  if (byId.size === 0) {
    return unchecked('Meta answered without saying which id each answer belongs to')
  }

  return entities.map((e) => {
    const a = byId.get(e.id)
    if (!a) {
      return { id: e.id, claimedName: e.name, verdict: 'unknown' as const,
               valid: false, liveName: null, error: 'Meta did not answer for this id' }
    }
    if (!a.valid) {
      return { id: e.id, claimedName: e.name, verdict: 'dead' as const,
               valid: false, liveName: null, error: 'Meta no longer recognises this id' }
    }
    const liveName = a.name ? String(a.name) : null
    const renamed = !!liveName && liveName.toLowerCase() !== e.name.toLowerCase()
    return {
      id: e.id, claimedName: e.name,
      verdict: renamed ? ('renamed' as const) : ('live' as const),
      valid: true, liveName, error: null,
    }
  })
}

/** The ad account's Custom + Lookalike audiences with real size bands. */
export interface CustomAudienceSummary {
  id: string
  name: string
  subtype: string
  approxLower: number | null
  approxUpper: number | null
  timeUpdated: string | null
}

export async function listCustomAudiences(): Promise<CustomAudienceSummary[]> {
  const { adAccountId } = await creds()
  const res = await apiFetch<{ data?: Array<Record<string, unknown>> }>(
    `/${adAccountId}/customaudiences`,
    undefined,
    {
      fields: 'id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,time_updated',
      limit: '100',
    },
  )
  return (res.data ?? []).map((r) => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    subtype: String(r.subtype ?? ''),
    approxLower: typeof r.approximate_count_lower_bound === 'number' ? r.approximate_count_lower_bound : null,
    approxUpper: typeof r.approximate_count_upper_bound === 'number' ? r.approximate_count_upper_bound : null,
    timeUpdated: r.time_updated ? String(r.time_updated) : null,
  }))
}

/**
 * A RULE audience: Meta fills it from behaviour — pixel visits, Page
 * engagement, lead-form opens — instead of an uploaded list. The rule shapes
 * are Meta's own vocabulary and are validated by Meta at creation; a refused
 * rule surfaces as a readable error rather than a silently empty audience.
 */
export async function createRuleAudience(
  name: string,
  description: string,
  subtype: 'WEBSITE' | 'ENGAGEMENT',
  rule: Record<string, unknown>,
): Promise<{ id: string }> {
  const { adAccountId } = await creds()
  return apiPost(`/${adAccountId}/customaudiences`, {
    name,
    description,
    subtype,
    rule: JSON.stringify(rule),
  })
}

export async function createCustomAudience(
  name: string,
  description: string,
  opts?: { valueBased?: boolean },
): Promise<{ id: string }> {
  const { adAccountId } = await creds()
  return apiPost(`/${adAccountId}/customaudiences`, {
    name,
    description,
    subtype: 'CUSTOM',
    customer_file_source: 'USER_PROVIDED_ONLY',
    // A value-based source is what unlocks a value-based lookalike: Meta
    // weights similarity by the number attached to each row instead of
    // treating every seed member as equally worth copying. The flag must be
    // set AT CREATION — it cannot be added to an audience that already exists,
    // which is why it is a parameter here rather than a later patch.
    ...(opts?.valueBased ? { is_value_based: true } : {}),
  })
}

/**
 * Upload hashed identifiers WITH a per-person value.
 *
 * The difference from `addHashedBuyers` is the whole thesis of a deeper seed:
 * a closed AED 4m buyer and a lead who merely answered the phone are both
 * "seed members", and without a weight Meta copies them equally. With one, it
 * looks hardest for people like the buyer.
 *
 * Rows with no usable identifier are skipped, as are rows with a value of zero
 * or less — Meta discards those silently, and a silently discarded row is a
 * row we thought we sent.
 */
export async function addWeightedBuyers(
  audienceId: string,
  contacts: Array<BuyerContact & { value: number }>,
): Promise<number> {
  const rows = contacts
    .filter((c) => Number.isFinite(c.value) && c.value > 0)
    .map((c) => [hashEmail(c.email || ''), hashPhone(c.phone || ''), String(Math.round(c.value))])
    .filter(([e, p]) => e || p)
  if (!rows.length) return 0
  for (let i = 0; i < rows.length; i += 5000) {
    await apiPost(`/${audienceId}/users`, {
      // LOOKALIKE_VALUE is Meta's name for the weight column; it is only
      // honoured when the audience was created with is_value_based.
      payload: { schema: ['EMAIL', 'PHONE', 'LOOKALIKE_VALUE'], data: rows.slice(i, i + 5000) },
    })
  }
  return rows.length
}

// Upload hashed identifiers to a custom audience. Rows missing both a usable
// email and phone are skipped. Returns how many rows were sent.
export async function addHashedBuyers(audienceId: string, contacts: BuyerContact[]): Promise<number> {
  const rows = contacts
    .map((c) => [hashEmail(c.email || ''), hashPhone(c.phone || '')])
    .filter(([e, p]) => e || p)
  if (!rows.length) return 0
  // Meta accepts up to 10k rows per call; batch to be safe.
  for (let i = 0; i < rows.length; i += 5000) {
    const batch = rows.slice(i, i + 5000)
    await apiPost(`/${audienceId}/users`, {
      payload: { schema: ['EMAIL', 'PHONE'], data: batch },
    })
  }
  return rows.length
}

export async function createLookalikeAudience(params: {
  name: string
  sourceAudienceId: string
  country: string
  /** 0.01–0.20 — the top X% most-similar people in the country. */
  ratio: number
}): Promise<{ id: string }> {
  const { adAccountId } = await creds()
  return apiPost(`/${adAccountId}/customaudiences`, {
    name: params.name,
    subtype: 'LOOKALIKE',
    origin_audience_id: params.sourceAudienceId,
    lookalike_spec: JSON.stringify({
      type: 'similarity',
      country: params.country,
      ratio: Math.min(0.2, Math.max(0.01, params.ratio)),
    }),
  })
}

// Orchestrate: seed Custom Audience from hashed buyers → Lookalike. Returns the
// ids + how many buyers were uploaded. Raw PII never leaves this function.
export async function buildLookalikeFromBuyers(params: {
  contacts: BuyerContact[]
  label: string
  country: string
  ratio: number
}): Promise<{ sourceAudienceId: string; lookalikeAudienceId: string; uploaded: number }> {
  const source = await createCustomAudience(
    `${params.label} — Closed Buyers`,
    'Seed audience built from the company’s own closed buyers (hashed).',
  )
  const uploaded = await addHashedBuyers(source.id, params.contacts)
  const lookalike = await createLookalikeAudience({
    name: `${params.label} — Lookalike (${params.country}, ${Math.round(params.ratio * 100)}%)`,
    sourceAudienceId: source.id,
    country: params.country,
    ratio: params.ratio,
  })
  return { sourceAudienceId: source.id, lookalikeAudienceId: lookalike.id, uploaded }
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
  /** Conversion pixel override — falls back to the account default. */
  pixelId?:     string
  /** Where a click/submit goes; default 'landing' (the landingUrl). */
  destination?: AdDestination
  /** Meta instant-form id — REQUIRED when destination is 'form'. */
  leadFormId?:  string
  /** E.164 number for 'whatsapp' / 'phone' destinations. */
  destinationPhone?: string
  /** Lifetime spend ceiling in AED → Meta campaign spend_cap. */
  lifetimeCapAED?: number
  /** Cost-per-result ceiling in AED → ad set COST_CAP bid strategy. */
  cplCapAED?: number
  /** Placement targeting mode — see createAdSet. 'automatic'/omitted = unchanged behavior. */
  placementMode?: 'automatic' | 'manual'
  /** PlacementKey values to run on when placementMode is 'manual'. */
  manualPlacements?: string[]
  /**
   * The Page the campaign's ads run as. Omitted = the configured Page, the
   * unchanged behaviour. When the destination is an instant form this must be
   * the Page that OWNS the form — Meta rejects the mismatch, and the wizard
   * follows the form's Page automatically for exactly that reason.
   */
  pageId?: string
  /** The Instagram account the ads run as — one of the Page's own
   *  connections. Omitted = Meta's fallback (connected IG, or the Page). */
  instagramUserId?: string
  /** Lead-language codes ('en'|'ar'|'ru') resolved live to Meta locale IDs. */
  leadLanguages?: string[]
  /**
   * When delivery must stop — the Trakheesi permit window, as an absolute
   * instant. Applied to EVERY ad set the launch creates, including each one
   * in a placement split: a permit does not expire per placement.
   */
  endTimeIso?: string
}): Promise<LaunchCampaignResult> {
  const { adAccountId, pixelId: accountPixel } = await creds()
  const pixelId = params.pixelId || accountPixel

  // 1 — Campaign (ODAX objective — v20 rejects the legacy names)
  const campaign = await apiPost<{ id: string }>(`/${adAccountId}/campaigns`, {
    name:                  params.campaignName,
    objective:             toOdaxObjective(params.objective, !!pixelId, params.destination),
    status:                params.launchStatus,
    special_ad_categories: [],
    // Budgets live on the ad set (not CBO) — Meta now requires this flag to
    // be explicit (subcode 4834011). False = classic per-ad-set budgets.
    is_adset_budget_sharing_enabled: false,
    // The wizard's lifetime cap is a REAL Meta spend_cap (fils) — the
    // campaign stops delivering once total spend reaches it.
    ...(params.lifetimeCapAED && params.lifetimeCapAED > 0
      ? { spend_cap: Math.round(params.lifetimeCapAED * 100) }
      : {}),
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

  // 2 — EVERY interest in the spec is re-resolved by NAME against Meta's live
  // vocabulary — base, narrowing groups and exclusions alike. Stale ids are
  // rewritten to whatever is live now; names Meta no longer knows are dropped
  // along with any group they leave empty. See repairTargetingInterests: for
  // three launches this ran on the base interests only, while the ids that
  // actually failed sat in the narrowing group the whole time.
  const repaired = await repairTargetingInterests(params.targeting)
  if (repaired.dropped.length > 0) {
    console.warn('[meta/launch] dropped interests Meta no longer recognises:', repaired.dropped.join(', '))
  }
  // A QUALIFIER THAT SURVIVED ONLY BECAUSE WE REFUSED TO DROP IT is the loudest
  // thing this function can learn, and it used to be a console line. It means
  // our catalog and Meta disagree about a rule that shapes every audience —
  // and if the ad set is then refused, THIS is the reason, not the creative.
  if (repaired.keptDespiteFailure.length > 0) {
    console.error(
      '[meta/launch] TARGETING QUALIFIER COULD NOT BE VALIDATED and was sent unchanged rather than dropped:',
      repaired.keptDespiteFailure.join(' | '),
    )
  }
  // Lead-language narrowing: resolve the wizard's language codes to Meta's
  // real numeric locale IDs (live search — Meta publishes no static table)
  // and merge with any locales the targeting spec already carries. An empty
  // resolution (Meta unreachable) narrows nothing rather than mis-targeting.
  // Languages come from two places and BOTH must count: the wizard's own
  // selection for this launch, and the language a SAVED audience carries in
  // its spec. Reading only the wizard param would silently drop the narrowing
  // whenever someone attached a saved "Arabic-speaking buyers" audience —
  // the audience would look right in the UI and deliver unnarrowed.
  const languageCodes = mergeLeadLanguages(params.leadLanguages, params.targeting.leadLanguages)
  const leadLanguageLocales = languageCodes.length
    ? await resolveLeadLanguageLocaleIds(languageCodes)
    : []

  // ASKED FOR AND NOT APPLIED IS A REFUSAL, NOT A DEGRADATION.
  //
  // "An empty resolution narrows nothing rather than mis-targeting" sounds
  // cautious and is the opposite. Someone chose Arabic-speaking buyers; the
  // locale lookup failed — Meta unreachable, rate-limited, a token without the
  // scope — and the ad set went live reaching EVERYONE in the country while
  // every screen still said Arabic. The money is spent, the audience is wrong,
  // and nothing in the product ever mentions it.
  //
  // Unnarrowed is not a smaller version of what they asked for; it is a
  // different campaign. So it does not launch. Same principle as the Advantage
  // guard: refuse loudly rather than deliver something nobody chose.
  if (languageCodes.length > 0 && leadLanguageLocales.length === 0) {
    throw new MetaConfigError(
      `Refusing to launch: this campaign asks to reach ${languageCodes.join(', ')} speakers, and Meta did not return the locale ids for that. ` +
      `Launching anyway would spend the budget on everyone, while every screen still said ${languageCodes.join(', ')}. ` +
      `This is usually Meta being briefly unreachable — try again in a minute — or an access token without ads permissions.`,
    )
  }

  const mergedLocales = Array.from(new Set([...(params.targeting.locales ?? []), ...leadLanguageLocales]))
  const baseTargeting = {
    ...repaired.targeting,
    ...(mergedLocales.length > 0 ? { locales: mergedLocales } : {}),
  }

  // 3 — Creative prep. Prefer a NATIVE image: ingest the external URL into
  // the ad account first (image_hash); external `picture` URLs are flaky.
  //
  // AND WHEN THE INGEST FAILS, REFUSE — never fall back to the URL. The
  // fallback handed Meta the very address our own server just failed to
  // fetch, so Meta failed on it too (subcode 3858258, "Image Wasn't
  // Downloaded") — but only AFTER the campaign and ad set existed, leaving a
  // half-built campaign and an error at the far end of the launch. A picture
  // neither we nor Meta can download is a fact best delivered before any
  // money object is created, with the URL named so the operator knows which
  // image to re-upload.
  const creativeInput = { ...params.creative }
  if (!creativeInput.imageHash && creativeInput.imageUrl) {
    // A blob:/data: URL is a browser-local preview — it does not exist
    // outside the operator's own tab, so "ingest" is not a thing that can
    // succeed. Reaching here with one means the real upload never finished.
    if (creativeInput.imageUrl.startsWith('blob:') || creativeInput.imageUrl.startsWith('data:')) {
      throw new MetaApiError(
        'The ad picture never finished uploading — what launched would have been a preview only your browser can see. Go back to the design step and upload the image again.',
        100, 'validation',
      )
    }
    const hash = await ingestImageFromUrl(creativeInput.imageUrl)
    if (hash) creativeInput.imageHash = hash
    else {
      throw new MetaApiError(
        `The ad image could not be downloaded from ${creativeInput.imageUrl} — the link is not publicly reachable (blocked, moved, or behind a login). Upload the picture in the launcher instead of linking it.`,
        100, 'validation',
      )
    }
  }
  // Same ingestion for any per-placement override image that only carries a
  // pasted/library URL — a native hash is required everywhere an override's
  // image actually gets used (asset_feed_spec, and the per-placement ad sets
  // below), so an override without one would otherwise silently fall back
  // to the default image.
  if (creativeInput.placementOverrides) {
    const entries = Object.entries(creativeInput.placementOverrides) as Array<[PlacementKey, PlacementCreativeOverride]>
    const ingested = await Promise.all(entries.map(async ([key, ov]) => {
      if (ov.imageHash || !ov.imageUrl) return [key, ov] as const
      const hash = await ingestImageFromUrl(ov.imageUrl)
      return [key, hash ? { ...ov, imageHash: hash } : ov] as const
    }))
    creativeInput.placementOverrides = Object.fromEntries(ingested)
  }

  const overridePairs = (Object.entries(creativeInput.placementOverrides ?? {}) as Array<[PlacementKey, PlacementCreativeOverride]>)
    // Only placements this product actually buys. An override saved against a
    // retired surface (fbStory) would otherwise get its own ad set narrowed to
    // a placement Meta refuses to run alone.
    .filter(([key]) => PLACEMENT_KEYS.includes(key))
    .filter(([, ov]) => ov && (ov.headline?.trim() || ov.primaryText?.trim() || ov.imageHash || ov.imageUrl))

  // Mirrors createAdCreative's EXACT `wantsMultiText` eligibility so the
  // single ad set's is_dynamic_creative flag and the ad's actual creative
  // shape always agree: a plain landing-click ad (destination undefined or
  // 'landing'), with no active per-placement overrides (those take the
  // asset_customization_rules path instead — a different real feature), and
  // more than one headline or description.
  const singleAdSetWantsDynamicCreative =
    (params.destination === undefined || params.destination === 'landing') &&
    overridePairs.length === 0 &&
    ((creativeInput.headlines?.length ?? 0) > 1 || (creativeInput.descriptions?.length ?? 0) > 1)

  // Lead-form ads with per-placement overrides can't use asset_feed_spec
  // (see createAdCreative) — the real mechanism is a separate single-creative
  // ad set per customized placement, each narrowed to just that placement,
  // plus one shared ad set for everything left untouched. Every other case
  // (landing-click with overrides via asset_feed_spec, or no overrides at
  // all) keeps the original single ad-set/ad/creative shape.
  if (params.destination === 'form' && overridePairs.length > 0) {
    const customizedKeys = overridePairs.map(([key]) => key)
    const defaultKeys = PLACEMENT_KEYS.filter((key) => !customizedKeys.includes(key))
    const groups = customizedKeys.length + (defaultKeys.length > 0 ? 1 : 0)
    const totalFils = Math.round(params.dailyBudgetAED * 100)
    const baseFils = Math.floor(totalFils / groups)
    const remainderFils = totalFils - baseFils * groups

    const placementAdSets: NonNullable<LaunchCampaignResult['placementAdSets']> = []
    let first = true
    for (const [key, override] of overridePairs) {
      const fils = baseFils + (first ? remainderFils : 0)
      first = false
      const dailyBudgetAED = fils / 100
      const label = PLACEMENT_LABELS[key]
      const adSet = await step(`ad set (${label})`, () => createAdSet({
        campaignId: campaign.id,
        name: `${params.listingName} — Ad Set — ${label}`,
        objective: params.objective,
        dailyBudgetAED,
        targeting: baseTargeting,
        status: params.launchStatus,
        pixelId: pixelId ?? undefined,
        destination: params.destination,
        cplCapAED: params.cplCapAED,
        pageId: params.pageId,
        endTimeIso: params.endTimeIso,
        placementOverride: PLACEMENT_TARGETING[key],
      }))
      const creative = await step(`creative (${label})`, () => createAdCreative({
        name: `${params.listingName} — Creative — ${label}`,
        creative: mergeCreativeForPlacement(creativeInput, override),
        destination: params.destination,
        leadFormId: params.leadFormId,
        destinationPhone: params.destinationPhone,
        pageId: params.pageId,
        instagramUserId: params.instagramUserId,
      }))
      const ad = await step(`ad (${label})`, () => createAd({
        adSetId: adSet.id,
        name: `${params.listingName} — Ad — ${label}`,
        creativeId: creative.id,
        status: params.launchStatus,
      }))
      placementAdSets.push({ placementKey: key, adSetId: adSet.id, adId: ad.id, creativeId: creative.id, dailyBudgetAED })
    }

    if (defaultKeys.length > 0) {
      const dailyBudgetAED = baseFils / 100
      const adSet = await step('ad set (other placements)', () => createAdSet({
        campaignId: campaign.id,
        name: `${params.listingName} — Ad Set — Other placements`,
        objective: params.objective,
        dailyBudgetAED,
        targeting: baseTargeting,
        status: params.launchStatus,
        pixelId: pixelId ?? undefined,
        destination: params.destination,
        cplCapAED: params.cplCapAED,
        pageId: params.pageId,
        endTimeIso: params.endTimeIso,
        placementOverride: unionPlacementTargeting(defaultKeys),
      }))
      const creative = await step('creative (other placements)', () => createAdCreative({
        name: `${params.listingName} — Creative — Default`,
        creative: { ...creativeInput, placementOverrides: undefined },
        destination: params.destination,
        leadFormId: params.leadFormId,
        destinationPhone: params.destinationPhone,
        pageId: params.pageId,
        instagramUserId: params.instagramUserId,
      }))
      const ad = await step('ad (other placements)', () => createAd({
        adSetId: adSet.id,
        name: `${params.listingName} — Ad — Default`,
        creativeId: creative.id,
        status: params.launchStatus,
      }))
      placementAdSets.push({ placementKey: null, adSetId: adSet.id, adId: ad.id, creativeId: creative.id, dailyBudgetAED })
    }

    const primary = placementAdSets[0]
    return {
      campaignId: campaign.id,
      adSetId:    primary.adSetId,
      creativeId: primary.creativeId,
      adId:       primary.adId,
      status:     params.launchStatus,
      placementAdSets,
    }
  }

  // 4 — Ad Set (single, unchanged shape)
  const adSet = await step('ad set', () => createAdSet({
    campaignId:     campaign.id,
    name:           `${params.listingName} — Ad Set`,
    objective:      params.objective,
    dailyBudgetAED: params.dailyBudgetAED,
    targeting:      baseTargeting,
    status:         params.launchStatus,
    pixelId:        pixelId ?? undefined,
    destination:    params.destination,
    cplCapAED:      params.cplCapAED,
    pageId:         params.pageId,
    endTimeIso:     params.endTimeIso,
    placementMode:      params.placementMode,
    manualPlacements:   params.manualPlacements,
    wantsDynamicCreative: singleAdSetWantsDynamicCreative,
  }))

  // 5 — Creative
  const creative = await step('creative', () => createAdCreative({
    name:             `${params.listingName} — Creative`,
    creative:         creativeInput,
    destination:      params.destination,
    leadFormId:       params.leadFormId,
    destinationPhone: params.destinationPhone,
    pageId:           params.pageId,
    instagramUserId:  params.instagramUserId,
  }))

  // 6 — Ad
  const ad = await step('ad', () => createAd({
    adSetId:    adSet.id,
    name:       `${params.listingName} — Ad`,
    creativeId: creative.id,
    status:     params.launchStatus,
  }))

  // 7 — Extra designs: one ad per variant image, same copy, same ad set.
  // Meta's delivery routes spend to whichever design converts; the per-design
  // report reads the result back. Cap keeps an ad set reviewable.
  // Each extra design's picture goes native too. One whose URL cannot be
  // fetched is DROPPED rather than launched: by the time designs launch the
  // main ad already exists, and killing a live launch over a side design's
  // dead link would cost the whole campaign to save a variant.
  const variantsRaw = (creativeInput.variants ?? [])
    .filter((v) => v.imageHash || v.imageUrl)
    .slice(0, 3)
  const variants = (await Promise.all(variantsRaw.map(async (v) => {
    if (v.imageHash || !v.imageUrl || v.imageUrl.startsWith('blob:') || v.imageUrl.startsWith('data:')) return v
    const hash = await ingestImageFromUrl(v.imageUrl)
    return hash ? { ...v, imageHash: hash } : null
  }))).filter((v): v is NonNullable<typeof v> => v !== null)
  for (let i = 0; i < variants.length; i++) {
    const letter = String.fromCharCode(66 + i) // B, C, D
    const v = variants[i]
    const vCreative = await step(`creative (design ${letter})`, () => createAdCreative({
      name:             `${params.listingName} — Creative ${letter}`,
      creative:         { ...creativeInput, imageUrl: v.imageUrl, imageHash: v.imageHash, variants: undefined, placementOverrides: undefined },
      destination:      params.destination,
      leadFormId:       params.leadFormId,
      destinationPhone: params.destinationPhone,
      pageId:           params.pageId,
      instagramUserId:  params.instagramUserId,
    }))
    await step(`ad (design ${letter})`, () => createAd({
      adSetId:    adSet.id,
      name:       `${params.listingName} — Ad ${letter}`,
      creativeId: vCreative.id,
      status:     params.launchStatus,
    }))
  }

  return {
    campaignId: campaign.id,
    adSetId:    adSet.id,
    creativeId: creative.id,
    adId:       ad.id,
    status:     params.launchStatus,
  }
}
