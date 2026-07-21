/**
 * Honest campaign delivery state.
 *
 * "Active" is a control flag we set — it does NOT mean an ad is actually
 * showing. Once a campaign is created it goes through review, then a learning
 * phase, and may end up limited or not delivering at all. This module reads the
 * platform's OWN delivery signal (Meta effective_status + ad-set learning
 * phase; Google primary_status) and normalises it into one honest state the
 * operator can act on — so the machine explains what's really happening instead
 * of just saying "live".
 */
import { getCampaignDelivery as metaDelivery, MetaConfigError, type MetaCampaignDelivery } from '@/lib/meta/client'
import { getCampaignDelivery as googleDelivery, type GoogleCampaignDelivery } from '@/lib/google/client'
import { GoogleConfigError } from '@/lib/google/types'
import type { MachineCampaign } from '@/lib/freehold/ads-machine'

export type DeliveryState =
  | 'delivering'        // showing and out of learning
  | 'learning'          // in Meta's learning phase
  | 'learning_limited'  // learning limited — too few conversions to exit learning
  | 'limited'           // eligible but limited (Google)
  | 'in_review'         // pending platform review / processing
  | 'rejected'          // disapproved by the platform
  | 'not_delivering'    // eligible on paper but not serving (issues / not eligible)
  | 'paused'            // paused (by us or the platform)
  | 'ended'             // archived / removed / completed
  | 'local_draft'       // prepared locally, never sent live (channel not connected)
  | 'not_connected'     // the channel isn't connected, so delivery can't be read
  | 'unknown'           // connected, but the platform didn't return a state

export interface CampaignDelivery {
  state: DeliveryState
  /** Honest extra context — the platform's own reason(s), never invented. */
  detail?: string
}

function mapMeta(raw: MetaCampaignDelivery): CampaignDelivery {
  const es = raw.effectiveStatus
  if (es === 'ACTIVE') {
    const set = raw.adSetEffectiveStatus
    if (set === 'PENDING_REVIEW' || set === 'IN_PROCESS' || set === 'PENDING_BILLING_INFO') return { state: 'in_review' }
    if (set === 'DISAPPROVED') return { state: 'rejected' }
    if (set === 'WITH_ISSUES') return { state: 'not_delivering', detail: 'The ad set has issues' }
    if (raw.learningStage === 'LEARNING') return { state: 'learning' }
    if (raw.learningStage === 'LEARNING_LIMITED') return { state: 'learning_limited' }
    return { state: 'delivering' }
  }
  if (es === 'PENDING_REVIEW' || es === 'IN_PROCESS' || es === 'PENDING_BILLING_INFO' || es === 'PREAPPROVED') return { state: 'in_review' }
  if (es === 'DISAPPROVED') return { state: 'rejected' }
  if (es === 'WITH_ISSUES') return { state: 'not_delivering', detail: 'The campaign has issues' }
  if (es === 'PAUSED' || es === 'CAMPAIGN_PAUSED' || es === 'ADSET_PAUSED') return { state: 'paused' }
  if (es === 'ARCHIVED' || es === 'DELETED' || es === 'COMPLETED') return { state: 'ended' }
  return { state: 'unknown' }
}

function mapGoogle(raw: GoogleCampaignDelivery): CampaignDelivery {
  const detail = raw.reasons.length ? raw.reasons.slice(0, 2).join(', ') : undefined
  switch (raw.primaryStatus) {
    case 'ELIGIBLE':     return { state: 'delivering' }
    case 'LIMITED':      return { state: 'limited', detail }
    case 'PENDING':      return { state: 'in_review', detail }
    case 'PAUSED':       return { state: 'paused' }
    case 'ENDED':        return { state: 'ended' }
    case 'REMOVED':      return { state: 'ended' }
    case 'NOT_ELIGIBLE': return { state: 'not_delivering', detail }
    default: break
  }
  // No primary_status — fall back to the plain campaign status.
  if (raw.status === 'ENABLED') return { state: 'delivering' }
  if (raw.status === 'PAUSED') return { state: 'paused' }
  if (raw.status === 'REMOVED') return { state: 'ended' }
  return { state: 'unknown' }
}

/**
 * Resolve one machine campaign's honest delivery state. Fail-soft: a read error
 * never throws — it returns 'unknown' (or 'not_connected' when the channel
 * credentials are missing) so the dashboard degrades honestly.
 */
export async function getMachineCampaignDelivery(c: MachineCampaign): Promise<CampaignDelivery> {
  // A locally-prepared Google draft was never sent live — say so plainly.
  if (c.channel === 'google' && c.campaignId.startsWith('local-')) {
    return { state: 'local_draft', detail: 'Prepared locally — Google Ads is not connected' }
  }
  try {
    if (c.channel === 'google') return mapGoogle(await googleDelivery(c.campaignId))
    return mapMeta(await metaDelivery(c.campaignId))
  } catch (e) {
    if (e instanceof MetaConfigError || e instanceof GoogleConfigError) return { state: 'not_connected' }
    return { state: 'unknown' }
  }
}

/** Resolve delivery for many campaigns with bounded concurrency (fail-soft). */
export async function getMachineDeliveryMap(campaigns: MachineCampaign[]): Promise<Record<string, CampaignDelivery>> {
  const out: Record<string, CampaignDelivery> = {}
  const CONCURRENCY = 6
  let i = 0
  async function worker() {
    while (i < campaigns.length) {
      const c = campaigns[i++]
      out[c.campaignId] = await getMachineCampaignDelivery(c)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, campaigns.length) }, worker))
  return out
}
