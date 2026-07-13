import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { launchFullCampaign } from '@/lib/meta/client'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import { createLocalCampaign } from '@/lib/meta/local-store'
import { setCampaignAutoEnhance } from '@/lib/meta/campaign-prefs'
import type { LaunchCampaignPayload } from '@/lib/meta/types'
import { query } from '@/lib/db'
import { deductCreditsForCampaign, getCreditBalance } from '@/lib/freehold/credits-db'
import { decideCampaignAction, type CampaignIntent, type RouterDecision } from '@/lib/meta/campaign-router'
import {
  buildProjectAdStructure, recordCampaignProject,
  audienceFingerprintFromTargeting, languageFingerprintFromTargeting,
} from '@/lib/meta/campaign-structure'
import { recordDecision } from '@/lib/meta/decision-log'
import { getAutonomyLevel } from '@/lib/freehold/agent-autonomy'

async function ensureBrokerTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS meta_campaign_brokers (
      campaign_id  TEXT PRIMARY KEY,
      broker_id    TEXT NOT NULL,
      campaign_name TEXT,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )`,
    [],
  )
}

export async function POST(req: NextRequest) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res

  const body = (await req.json()) as LaunchCampaignPayload

  const required = ['campaignName', 'objective', 'listingId', 'listingName', 'dailyBudgetAED', 'creative']
  for (const field of required) {
    if (!body[field as keyof LaunchCampaignPayload]) {
      return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
    }
  }

  if (!body.creative.primaryText || !body.creative.headline || !body.creative.landingUrl) {
    return NextResponse.json({ error: 'Creative must include primaryText, headline, and landingUrl' }, { status: 400 })
  }

  if (body.dailyBudgetAED < 50) {
    return NextResponse.json({ error: 'Minimum daily budget is AED 50' }, { status: 400 })
  }

  // Destination integrity — fail closed rather than launch a half-wired ad.
  if (body.destination === 'form' && !body.leadFormId) {
    return NextResponse.json({ error: 'A Meta instant form is required for a lead-form campaign.' }, { status: 400 })
  }
  if (body.destination === 'phone' && !body.destinationPhone) {
    return NextResponse.json({ error: 'A phone number is required for a call campaign.' }, { status: 400 })
  }

  // Identify the creating broker (if any) from the verified session.
  const sessionUser = __auth.user
  const brokerId    = sessionUser.role === 'broker'
    ? (sessionUser.brokerId ?? sessionUser.email)
    : undefined

  const creditsToSpend = brokerId ? Math.round((body.dailyBudgetAED ?? 100) / 10) : 0

  // Fail closed on money: a broker cannot launch a campaign they can't fund.
  // Checked server-side before any launch so the balance is authoritative.
  if (brokerId && creditsToSpend > 0) {
    const bal = await getCreditBalance(brokerId)
    if ((bal?.balance ?? 0) < creditsToSpend) {
      return NextResponse.json(
        { error: 'Insufficient credits to launch this campaign.', balance: bal?.balance ?? 0, required: creditsToSpend },
        { status: 402 },
      )
    }
  }

  // Persist broker attribution + deduct launch credits. Attribution is
  // best-effort; the credit deduction is guarded (deductCreditsForCampaign
  // refuses to drive the balance negative) so spend always reconciles.
  async function recordBrokerSpend(campaignId: string) {
    if (!brokerId) return
    try {
      await ensureBrokerTable()
      await query(
        `INSERT INTO meta_campaign_brokers (campaign_id, broker_id, campaign_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (campaign_id) DO NOTHING`,
        [campaignId, brokerId, body.campaignName],
      )
      const deduction = await deductCreditsForCampaign(brokerId, campaignId, body.campaignName, creditsToSpend)
      if (!deduction.ok) {
        console.error('[meta/launch] credit deduction failed after launch', { campaignId, brokerId, reason: deduction.reason })
      }
    } catch {
      // Non-fatal — attribution/credits logging failed.
    }
  }

  // ── Intent routing ──────────────────────────────────────────────────────────
  // Read the request as intent against what's already running for this project.
  // By default (advisory autonomy) this only RECORDS the recommendation — the
  // launch proceeds unchanged. Under full autopilot, a redundant duplicate
  // launched during the learning phase is silently HELD (the identical campaign
  // is already working; a competitor would just burn credits in the same auction).
  const projectSlug = String(body.listingId)
  const intent: CampaignIntent = {
    projectSlug,
    objectiveKey: String(body.objective),
    language: languageFingerprintFromTargeting(body.targeting),
    audienceKey: audienceFingerprintFromTargeting(body.targeting),
    hasNewCreative: true, // a wizard launch always brings its own creative
    dailyBudgetAED: body.dailyBudgetAED,
    brokerId: brokerId ?? sessionUser.email,
  }
  let decision: RouterDecision | null = null
  try {
    const structure = await buildProjectAdStructure(projectSlug)
    decision = decideCampaignAction(intent, structure)
    const autonomy = await getAutonomyLevel()
    if (autonomy === 3 && decision.action === 'hold') {
      await recordDecision({
        projectSlug, campaignId: decision.targetCampaignId ?? null, brokerId: intent.brokerId,
        action: 'hold', outcome: 'auto', reason: decision.reason,
      })
      // Point the wizard's success screen at the live campaign already serving
      // this objective — no new (competing) campaign, no credits spent.
      return NextResponse.json(
        { campaignId: decision.targetCampaignId, held: true, decision, brokerId },
        { status: 200 },
      )
    }
  } catch {
    decision = null // routing is best-effort; never block a real launch
  }

  async function recordLaunchDecision(campaignId: string) {
    if (!decision) return
    const applied = decision.action === 'new_campaign'
    await recordDecision({
      projectSlug, campaignId, brokerId: intent.brokerId,
      action: decision.action,
      outcome: applied ? 'auto' : 'blocked',
      reason: applied
        ? decision.reason
        : `Recommended ${decision.action} — launched as a new campaign; autonomous reroute pending admin/execution. ${decision.adminNote}`,
    })
  }

  try {
    const result = await launchFullCampaign({
      campaignName:     body.campaignName,
      objective:        body.objective,
      listingName:      body.listingName,
      dailyBudgetAED:   body.dailyBudgetAED,
      targeting:        body.targeting,
      creative:         body.creative,
      launchStatus:     body.launchStatus ?? 'PAUSED',
      destination:      body.destination,
      leadFormId:       body.leadFormId,
      destinationPhone: body.destinationPhone,
      lifetimeCapAED:   typeof body.lifetimeCapAED === 'number' && body.lifetimeCapAED > 0 ? body.lifetimeCapAED : undefined,
      cplCapAED:        typeof body.cplCapAED === 'number' && body.cplCapAED > 0 ? body.cplCapAED : undefined,
    })

    await recordBrokerSpend(result.campaignId)
    await recordCampaignProject(result.campaignId, projectSlug) // link for the router
    await recordLaunchDecision(result.campaignId)
    // Persist the wizard's autopilot policy — the autopilot pass reads it.
    if (body.autoEnhance === 'on' || body.autoEnhance === 'approval' || body.autoEnhance === 'off') {
      await setCampaignAutoEnhance(result.campaignId, body.autoEnhance)
    }

    return NextResponse.json({ ...result, brokerId, decision }, { status: 201 })
  } catch (err) {
    if (err instanceof MetaConfigError) {
      // Not connected → persist a local campaign (mirrors the Google flow) so
      // the wizard's success screen + detail page work end to end.
      const local = await createLocalCampaign(body, brokerId)
      await recordBrokerSpend(local.campaignId)
      await recordCampaignProject(local.campaignId, projectSlug)
      await recordLaunchDecision(local.campaignId)
      if (body.autoEnhance === 'on' || body.autoEnhance === 'approval' || body.autoEnhance === 'off') {
        await setCampaignAutoEnhance(local.campaignId, body.autoEnhance)
      }
      return NextResponse.json({ ...local, brokerId, demo: true, decision }, { status: 201 })
    }
    if (err instanceof MetaApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code, type: err.type },
        { status: 400 },
      )
    }
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}
