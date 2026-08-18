/**
 * WHERE THIS CAMPAIGN'S LEADS ACTUALLY GO — and whether they can come back.
 *
 * The campaign page shows spend, delivery, placements, creatives and results.
 * It has never shown the one thing that decides whether any of those numbers
 * will ever mean anything: where a click lands, and whether a person who fills
 * something in there arrives in the CRM with this campaign's name attached.
 *
 * THIS IS NOT A THEORETICAL GAP. This account has already run the failure. 571
 * CRM rows read "General enquiry" with no campaign against them, because the
 * landing URL carried no utm_id — so the money was spent, the leads arrived,
 * and nothing could say which campaign bought them. Every per-campaign number
 * downstream (cost per lead, lead quality, the rating loop, the budget
 * rotation) is computed from an attribution that silently was not happening.
 *
 * FIVE DESTINATIONS, AND THEY ARE NOT EQUALLY ANSWERABLE:
 *
 *   form      Meta's instant form. Attributed by the lead sync, which stamps
 *             the Graph lead's campaign_id as utm_id. Nothing to configure —
 *             this is why the machine prefers it.
 *   landing   one of this company's own pages. Attributed ONLY if the URL
 *             carries utm_id. Without it the lead arrives anonymous.
 *   external  a URL that is not ours. The lead never reaches the CRM at all,
 *             whatever the parameters say, because nothing of ours is on the
 *             other end to record it.
 *   whatsapp  a conversation. Real, often the best lead in the account, and
 *   phone     invisible to every number on this page. Said plainly rather
 *             than scored as a failure.
 *
 * A destination that cannot be attributed is not always wrong — a WhatsApp
 * campaign is a legitimate choice. What is always wrong is not KNOWING, and
 * reading a cost-per-lead that was computed as though the leads were counted.
 *
 * Pure — no I/O, no clock. Runs in `pnpm guards`.
 */

/** Walkable — each renders its own word. */
export const DESTINATION_KINDS = ['form', 'landing', 'external', 'whatsapp', 'phone', 'unknown'] as const
export type DestinationKind = (typeof DESTINATION_KINDS)[number]

/** Walkable — can a lead from here reach the CRM with this campaign on it? */
export const ATTRIBUTION_STATES = ['attributed', 'anonymous', 'offCrm', 'conversation', 'unknown'] as const
export type AttributionState = (typeof ATTRIBUTION_STATES)[number]

/**
 * The parameter the whole attribution contract hangs on.
 *
 * lead-attribution.ts matches a lead to a campaign by EXACT utm_id, and the
 * launcher writes Meta's campaign id into it. A landing URL without it is a
 * page that cannot say where its visitor came from.
 */
export const ATTRIBUTION_PARAM = 'utm_id'

export interface AdDestination {
  adId: string
  adName: string
  /** The creative's final URL, when it has one. */
  url: string | null
  /** Meta instant-form id, when the ad uses one. */
  leadFormId: string | null
  /** The form's own NAME, when Meta gave us one. Never its id — see below. */
  leadFormName?: string | null
  /** ACTIVE / PAUSED — a paused ad's destination is still worth reporting,
   *  because it is what will run when somebody turns it back on. */
  active: boolean
}

export interface DestinationRead {
  adId: string
  adName: string
  kind: DestinationKind
  attribution: AttributionState
  /** The URL as it will be clicked, when there is one. */
  url: string | null
  /** The campaign id found in the URL, when one is there. Compared against the
   *  campaign this ad actually belongs to — a stale id copied from a duplicated
   *  campaign attributes real leads to the wrong buy, which is worse than no
   *  attribution because it looks correct. */
  taggedCampaignId: string | null
  /** True when the URL carries an id that is NOT this campaign's. */
  mistagged: boolean
  active: boolean
  /** For an instant form: which form, by name. Empty when Meta did not say. */
  formName?: string
}

/** Is this host one of ours? Compared on the registrable domain so that
 *  `lp.freeholdproperty.ae` and `www.freeholdproperty.ae` both count, while
 *  `freeholdproperty.ae.evil.com` does not. */
export function isOwnHost(url: string, domain: string): boolean {
  let host: string
  try { host = new URL(url).hostname.toLowerCase() } catch { return false }
  const d = domain.toLowerCase().replace(/^www\./, '')
  return host === d || host.endsWith(`.${d}`)
}

/** The attribution id written into a URL, when one is there. */
export function taggedCampaignId(url: string): string | null {
  try {
    const v = new URL(url).searchParams.get(ATTRIBUTION_PARAM)
    return v && v.trim() ? v.trim() : null
  } catch { return null }
}

/**
 * Read one ad's destination.
 *
 * ORDER MATTERS: an ad can carry both a form id and a link, and the form is
 * what actually opens. Reading the link first would report a landing page
 * nobody ever sees and — worse — declare it unattributed when the form's own
 * sync attributes it perfectly.
 */
export function readDestination(
  ad: AdDestination,
  opts: { campaignId: string; domain: string },
): DestinationRead {
  const base = { adId: ad.adId, adName: ad.adName, url: ad.url, active: ad.active }

  if (ad.leadFormId) {
    // AN INSTANT FORM HAS NO DESTINATION URL, and the one on the creative is
    // not where anybody goes.
    //
    // A lead-form ad still carries a link — the display link on the creative,
    // or Meta's own `fb.me/` stub — and the panel used to print it under the
    // ad's name as though a click landed there. It does not: the form opens
    // inside Facebook. So the reader was shown `www.freeholdproperty.ae` for
    // an ad that never sends anybody to the website, and `fb.me/` for one that
    // sends them nowhere at all. Both are worse than saying nothing, because
    // both are readable and wrong.
    //
    // The url is dropped here rather than in the screen so no other consumer
    // can make the same mistake. What replaces it is the FORM'S NAME, which is
    // the fact a person can actually act on — and never its id, for the same
    // reason the CRM stopped printing `meta_form:120251…`.
    return {
      ...base,
      url: null,
      kind: 'form',
      attribution: 'attributed',
      taggedCampaignId: null,
      mistagged: false,
      formName: (ad.leadFormName ?? '').trim(),
    }
  }

  const url = (ad.url ?? '').trim()
  if (!url) {
    return { ...base, kind: 'unknown', attribution: 'unknown', taggedCampaignId: null, mistagged: false }
  }

  // A conversation is a real destination and a real lead. It simply produces
  // no CRM row, so every per-lead number on this page is blind to it — said,
  // not scored as a fault.
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(url) || /^whatsapp:/i.test(url)) {
    return { ...base, kind: 'whatsapp', attribution: 'conversation', taggedCampaignId: null, mistagged: false }
  }
  if (/^tel:/i.test(url)) {
    return { ...base, kind: 'phone', attribution: 'conversation', taggedCampaignId: null, mistagged: false }
  }

  const tagged = taggedCampaignId(url)

  if (!isOwnHost(url, opts.domain)) {
    // Nothing of ours is on the other end. The parameters make no difference:
    // there is no form of ours to submit and no page of ours to record it.
    return { ...base, kind: 'external', attribution: 'offCrm', taggedCampaignId: tagged, mistagged: false }
  }

  // A DIFFERENT campaign's id is the dangerous case, and it happens exactly
  // when somebody duplicates a working campaign and edits the budget. The
  // leads land in the CRM against the ORIGINAL campaign, so one buy shows a
  // cost per lead that is too good and the other shows none at all.
  const mistagged = !!tagged && tagged !== opts.campaignId

  return {
    ...base,
    kind: 'landing',
    attribution: tagged && !mistagged ? 'attributed' : 'anonymous',
    taggedCampaignId: tagged,
    mistagged,
  }
}

export interface DestinationSummary {
  reads: DestinationRead[]
  /** The worst state among the LIVE ads — a paused ad's problem is not
   *  costing anything today, and a panel that shouted about it would train
   *  people to ignore the one that is. */
  headline: AttributionState
  /** Live ads whose leads cannot be matched to this campaign. The number the
   *  panel leads with, because it is the number that invalidates every other
   *  number on the page. */
  unattributedLive: number
  mistaggedLive: number
}

/** Worst-first, so a single broken ad is never averaged away by good ones. */
const SEVERITY: Record<AttributionState, number> = {
  anonymous: 4, offCrm: 3, unknown: 2, conversation: 1, attributed: 0,
}

export function summariseDestinations(
  ads: AdDestination[],
  opts: { campaignId: string; domain: string },
): DestinationSummary {
  const reads = ads.map((a) => readDestination(a, opts))
  const live = reads.filter((r) => r.active)

  // Judged on the LIVE ads only. A paused ad is a plan, not a leak.
  const headline = live.reduce<AttributionState>(
    (worst, r) => (SEVERITY[r.attribution] > SEVERITY[worst] ? r.attribution : worst),
    live.length > 0 ? 'attributed' : 'unknown',
  )

  return {
    reads,
    headline,
    unattributedLive: live.filter((r) => r.attribution === 'anonymous' || r.attribution === 'offCrm').length,
    mistaggedLive: live.filter((r) => r.mistagged).length,
  }
}

/**
 * The URL this ad SHOULD point at — the same one with the attribution
 * parameter added, or corrected.
 *
 * Offered rather than applied: the fix path belongs at the place the fault is
 * exposed, and an operator pasting one corrected link is a decision they can
 * see. Returns null when there is nothing to fix, so the screen never offers a
 * button that would change nothing.
 */
export function correctedUrl(read: DestinationRead, campaignId: string): string | null {
  if (read.kind !== 'landing' || !read.url) return null
  if (read.attribution === 'attributed' && !read.mistagged) return null
  try {
    const u = new URL(read.url)
    u.searchParams.set(ATTRIBUTION_PARAM, campaignId)
    return u.toString()
  } catch { return null }
}
