import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { launchFullCampaign } from '@/lib/meta/client'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import { createLocalCampaign } from '@/lib/meta/local-store'
import { setCampaignAutoEnhance } from '@/lib/meta/campaign-prefs'
import type { LaunchCampaignPayload } from '@/lib/meta/types'
import { query } from '@/lib/db'
import { deductCreditsForCampaign, refundCredits, settleCampaignReservation, getCreditBalance } from '@/lib/freehold/credits-db'
import { randomUUID } from 'crypto'
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

  // ── Money: RESERVE credits BEFORE launching (fail-closed) ────────────────────
  // A campaign must never reach the auction without its credits already committed.
  // The debit is atomic (row-locked, balance re-derived under the lock), booked
  // under a placeholder reference; two concurrent launches for the same broker
  // serialize on that lock, so the second can't slip past a stale balance read and
  // over-serve. The getCreditBalance check below is only the fast, friendly 402 —
  // the reservation debit is the authority. If the launch then fails or falls back
  // to a demo campaign that never serves, the reservation is refunded.
  const reservationRef = `res-${randomUUID()}`
  let reserved = false
  if (brokerId && creditsToSpend > 0) {
    const bal = await getCreditBalance(brokerId)
    if ((bal?.balance ?? 0) < creditsToSpend) {
      return NextResponse.json(
        { error: 'Insufficient credits to launch this campaign.', balance: bal?.balance ?? 0, required: creditsToSpend },
        { status: 402 },
      )
    }
    const reservation = await deductCreditsForCampaign(brokerId, reservationRef, body.campaignName, creditsToSpend)
    if (!reservation.ok) {
      // Lost the race, or a concurrent spend drained the balance — never launch.
      return NextResponse.json(
        { error: 'Insufficient credits to launch this campaign.', balance: reservation.balance ?? 0, required: creditsToSpend },
        { status: reservation.reason === 'insufficient' ? 402 : 500 },
      )
    }
    reserved = true
  }

  // Give the reserved credits back when a launch does NOT actually serve an ad
  // (Meta rejected it, or it fell back to a local/demo campaign).
  async function releaseReservation() {
    if (reserved && brokerId) {
      await refundCredits(brokerId, reservationRef, creditsToSpend, 'Refund: campaign did not launch/serve').catch(() => {})
      reserved = false
    }
  }

  // Persist broker↔campaign attribution (best-effort link). The money is already
  // reserved above, so this never charges — on a real launch the reservation is
  // separately reconciled to the true campaign id.
  async function attributeCampaign(campaignId: string) {
    if (!brokerId) return
    try {
      await ensureBrokerTable()
      await query(
        `INSERT INTO meta_campaign_brokers (campaign_id, broker_id, campaign_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (campaign_id) DO NOTHING`,
        [campaignId, brokerId, body.campaignName],
      )
    } catch {
      // Non-fatal — attribution logging failed.
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
      // No new campaign serves on this path → return the reserved credits first,
      // so a held launch never charges the broker.
      await releaseReservation()
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
    // A real campaign WAS launched and credits WERE committed on this path, so
    // the ledger records an executed new_campaign with the true budget movement.
    // When a smarter action was available, that nuance lives in the reason — we
    // never label a live launch as 'blocked'/held (which means "nothing spent").
    const wasBest = decision.action === 'new_campaign'
    await recordDecision({
      projectSlug, campaignId, brokerId: intent.brokerId,
      action: 'new_campaign',
      outcome: 'auto',
      reason: wasBest
        ? decision.reason
        : `Launched a new campaign. The intent router recommended "${decision.action}" to avoid competing spend on this objective — fold the arms via Campaign Groups. ${decision.adminNote}`,
      spendBeforeAED: 0,
      spendAfterAED: body.dailyBudgetAED,
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

    // Launch succeeded → the campaign will serve, so the reservation stands.
    // Attribute the broker and reconcile the reservation to the real campaign id.
    await attributeCampaign(result.campaignId)
    await settleCampaignReservation(brokerId ?? '', reservationRef, result.campaignId)
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
      // the wizard's success screen + detail page work end to end. A demo campaign
      // never serves an ad, so release the reservation (attribute, don't charge).
      await releaseReservation()
      const local = await createLocalCampaign(body, brokerId)
      await attributeCampaign(local.campaignId)
      await recordCampaignProject(local.campaignId, projectSlug)
      await recordLaunchDecision(local.campaignId)
      if (body.autoEnhance === 'on' || body.autoEnhance === 'approval' || body.autoEnhance === 'off') {
        await setCampaignAutoEnhance(local.campaignId, body.autoEnhance)
      }
      return NextResponse.json({ ...local, brokerId, demo: true, decision }, { status: 201 })
    }
    // A real launch failed → nothing serves → return the reserved credits.
    await releaseReservation()
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
