/**
 * Catch the registration event and snap the audience.
 *
 * This is the wire between a lead arriving and `audience-snapshot` having
 * something to store. It resolves, from Meta, the ad set's targeting and the
 * ad's copy AS THEY STAND AT THIS MOMENT, and freezes them against the lead.
 *
 * TWO RULES GOVERN EVERYTHING HERE.
 *
 * 1. A LEAD IS WORTH MORE THAN A ROW OF LEARNING. Capture runs after the lead
 *    is committed, never inside its transaction, and every failure is
 *    swallowed. A slow Graph call must not cost a customer. `captureLater`
 *    exists so a request path can start this and return immediately.
 *
 * 2. READ META, NOT THE PLAN. The launch plan records what we intended; an ad
 *    set can be edited by hand in Ads Manager an hour later. Snapshotting the
 *    plan would freeze our intention, which is the one thing we already know.
 *    The point of the snapshot is what actually ran.
 *
 * The per-cycle cache matters more than it looks. A sync that imports forty
 * leads from one ad set would otherwise make forty identical Graph calls, hit
 * the rate limit, and lose the tail of the batch — so the same ad set is
 * fetched once and reused for the life of the process tick.
 */
import { getAdSet, listCampaignAds } from '@/lib/meta/client'
import { targetingFromMeta } from '@/lib/meta/targeting-parse'
import { captureAudienceSnapshot, leadsAwaitingSnapshot } from '@/lib/freehold/audience-snapshot'
import type { CampaignTargeting } from '@/lib/meta/types'

/** Short-lived memo, keyed by id. Deliberately process-local and unbounded in
 *  time but bounded in size: a serverless invocation lives for seconds, and a
 *  persistent cache would eventually serve a definition that has since been
 *  edited — which is exactly the staleness this module exists to avoid. */
const MAX_CACHE = 200
const targetingCache = new Map<string, CampaignTargeting | null>()
const creativeCache = new Map<string, Map<string, CreativeCopy>>()

interface CreativeCopy { headline: string | null; body: string | null; image: string | null; destination: string | null }

function remember<T>(cache: Map<string, T>, key: string, value: T): T {
  if (cache.size >= MAX_CACHE) {
    // Drop the oldest entry rather than let a long-running import grow without
    // bound. Insertion order is Map's iteration order, so this is FIFO.
    const first = cache.keys().next().value
    if (first !== undefined) cache.delete(first)
  }
  cache.set(key, value)
  return value
}

async function targetingFor(adsetId: string): Promise<CampaignTargeting | null> {
  const hit = targetingCache.get(adsetId)
  if (hit !== undefined) return hit
  try {
    const set = await getAdSet(adsetId)
    return remember(targetingCache, adsetId, targetingFromMeta(set.targeting))
  } catch {
    // Cache the failure too: a deleted ad set would otherwise be retried once
    // per lead for the whole batch.
    return remember(targetingCache, adsetId, null)
  }
}

async function creativeFor(campaignId: string, adId: string): Promise<CreativeCopy | null> {
  if (!campaignId || !adId) return null
  let byAd = creativeCache.get(campaignId)
  if (!byAd) {
    byAd = new Map()
    try {
      for (const ad of await listCampaignAds(campaignId)) {
        byAd.set(ad.id, {
          headline: ad.creative?.headline || null,
          body: ad.creative?.primaryText || null,
          image: ad.creative?.imageUrl || null,
          // Where the ad actually sends people. Read from the live ad rather
          // than from the plan, for the same reason targeting is: a human can
          // repoint an ad at a landing page and the plan would not know.
          destination: ad.destination || null,
        })
      }
    } catch { /* leave the map empty — no creative is better than a wrong one */ }
    remember(creativeCache, campaignId, byAd)
  }
  return byAd.get(adId) ?? null
}

export interface CaptureRequest {
  leadId: string
  campaignId?: string | null
  adsetId?: string | null
  adId?: string | null
  /** Meta's {{placement}} from the landing URL. Absent for instant forms. */
  placement?: string | null
}

/**
 * Resolve and freeze one lead's audience. Returns whether a row was written.
 *
 * A lead with no ad set id cannot be snapshotted — organic traffic, a manual
 * entry, an import. That is not a failure, and it is not recorded as one.
 */
export async function captureForLead(req: CaptureRequest): Promise<boolean> {
  if (!req.leadId || !req.adsetId) return false
  try {
    const [targeting, creative] = await Promise.all([
      targetingFor(req.adsetId),
      creativeFor(req.campaignId ?? '', req.adId ?? ''),
    ])
    // Write even when targeting could not be read: the placement, the ad and
    // the ids are still worth freezing, and a row with a null targeting is an
    // honest partial record rather than a lost event.
    return await captureAudienceSnapshot({
      leadId: req.leadId,
      campaignId: req.campaignId ?? null,
      adsetId: req.adsetId,
      adId: req.adId ?? null,
      targeting,
      creative,
      placement: req.placement ?? null,
      destination: creative?.destination ?? null,
    })
  } catch {
    return false
  }
}

/**
 * Start a capture and return immediately.
 *
 * For request paths that owe a user a response. The floating promise is
 * deliberate and its rejection is handled, so this can never surface as an
 * unhandled rejection that takes the process down.
 */
export function captureLater(req: CaptureRequest): void {
  void captureForLead(req).catch(() => undefined)
}

/**
 * Snapshot leads that arrived before this wire existed, or whose capture
 * failed at the time.
 *
 * Deliberately bounded and deliberately imperfect: it reads the ad set's
 * targeting as it stands TODAY, which for an old lead may not be what it
 * arrived through. That is a weaker record than a live capture and it is
 * better than none — but it is why the backfill is a one-off catch-up rather
 * than the mechanism. Live capture is the mechanism.
 */
export async function backfillSnapshots(limit = 100): Promise<{ attempted: number; written: number }> {
  const pending = await leadsAwaitingSnapshot(limit)
  let written = 0
  for (const p of pending) {
    if (await captureForLead({ leadId: p.leadId, campaignId: p.campaignId, adsetId: p.adsetId })) written++
  }
  return { attempted: pending.length, written }
}
