import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { launchFullCampaign } from '@/lib/meta/client'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import { createLocalCampaign } from '@/lib/meta/local-store'
import { setCampaignAutoEnhance } from '@/lib/meta/campaign-prefs'
import type { LaunchCampaignPayload } from '@/lib/meta/types'
import { query } from '@/lib/db'
import { getAudience } from '@/lib/freehold/audiences'
import { deductCreditsForCampaign, refundCredits, settleCampaignReservation, getCreditBalance } from '@/lib/freehold/credits-db'
import { creditsForDailyBudget } from '@/lib/freehold/credits-shared'
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

  // Must be a real number BEFORE it becomes money: a non-numeric budget made
  // `Math.round(budget / 10)` NaN, which skipped the credit reservation entirely
  // and launched for free (NaN < 50 and NaN > 0 are both false).
  if (typeof body.dailyBudgetAED !== 'number' || !Number.isFinite(body.dailyBudgetAED)) {
    return NextResponse.json({ error: 'Daily budget must be a number in AED' }, { status: 400 })
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

  // 1 credit = AED 10 of funded ad spend (CREDIT_VALUE_AED). Whole credits only —
  // the ledger column is INTEGER. The rate lives in credits-shared so Meta and
  // Google charge identically instead of each re-deriving "/ 10".
  const creditsToSpend = brokerId ? creditsForDailyBudget(body.dailyBudgetAED) : 0

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
    // Friendly pre-check ONLY. A null balance means "no account yet" OR "the
    // read failed" — telling a broker they are out of credits because a query
    // errored is a lie, so we only 402 here on a balance we actually read. The
    // locked deduction below is the authority either way.
    const bal = await getCreditBalance(brokerId)
    if (bal && bal.balance < creditsToSpend) {
      return NextResponse.json(
        { error: 'Insufficient credits to launch this campaign.', balance: bal.balance, required: creditsToSpend },
        { status: 402 },
      )
    }
    const reservation = await deductCreditsForCampaign(brokerId, reservationRef, body.campaignName, creditsToSpend)
    if (!reservation.ok) {
      // Lost the race, or a concurrent spend drained the balance — never launch.
      // A failure that is NOT about the balance must say so: reporting "out of
      // credits" for a database error sends the broker to Finance for a refill
      // that will not help.
      if (reservation.reason === 'insufficient') {
        return NextResponse.json(
          { error: 'Insufficient credits to launch this campaign.', balance: reservation.balance ?? 0, required: creditsToSpend },
          { status: 402 },
        )
      }
      return NextResponse.json(
        {
          error: reservation.reason === 'invalid'
            ? 'That daily budget does not convert to a valid number of credits.'
            : 'Could not reserve credits for this campaign, so nothing was launched. Please try again.',
          required: creditsToSpend,
        },
        { status: reservation.reason === 'invalid' ? 400 : 500 },
      )
    }
    reserved = true
  }

  // Give the reserved credits back when a launch does NOT actually serve an ad
  // (Meta rejected it, or it fell back to a local/demo campaign). Returns false
  // when the ledger write failed — the credits are then still held, and the
  // caller must say so rather than report a clean outcome.
  async function releaseReservation(): Promise<boolean> {
    if (!reserved || !brokerId) return true
    const refund = await refundCredits(
      brokerId, reservationRef, creditsToSpend, 'Refund: campaign did not launch/serve',
    ).catch(() => ({ ok: false as const }))
    if (!refund.ok) {
      // Keep `reserved` true so a later attempt in this request retries, and
      // leave a trace an operator can reconcile the ledger from.
      console.error(
        '[meta/launch] credit refund FAILED — broker credits are still held',
        { brokerId, reservationRef, credits: creditsToSpend },
      )
      return false
    }
    reserved = false
    return true
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

  // A PATTERN AUDIENCE'S TARGETING NEVER REACHES THE BROWSER, so a client
  // cannot send it back. The launch resolves it here instead, from the id.
  //
  // This is the piece that was missing: `forClient` correctly stripped the
  // spec on the way out, and the wizard then spread `undefined` into
  // `targeting` and launched a campaign with no audience at all. The recipe
  // staying server-side only works if the server can also USE it.
  if (typeof body.audienceId === 'string' && body.audienceId) {
    const saved = await getAudience(body.audienceId)
    if (!saved) {
      return NextResponse.json({ error: 'That audience no longer exists', type: 'validation' }, { status: 400 })
    }
    // The wizard still owns placements; everything else comes from the
    // audience, whose definition is the whole reason it was attached.
    body.targeting = {
      ...saved.spec,
      ...(Array.isArray(body.targeting?.publisherPlatforms) && body.targeting.publisherPlatforms.length
        ? { publisherPlatforms: body.targeting.publisherPlatforms }
        : {}),
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
      const refunded = await releaseReservation()
      await recordDecision({
        projectSlug, campaignId: decision.targetCampaignId ?? null, brokerId: intent.brokerId,
        action: 'hold', outcome: 'auto', reason: decision.reason,
      })
      // Point the wizard's success screen at the live campaign already serving
      // this objective — no new (competing) campaign, no credits spent.
      return NextResponse.json(
        {
          campaignId: decision.targetCampaignId, held: true, decision, brokerId,
          ...(refunded ? {} : { creditsRefunded: false, creditsHeld: creditsToSpend }),
        },
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
      pixelId:          typeof body.pixelId === 'string' && body.pixelId.trim() ? body.pixelId.trim() : undefined,
      placementMode:    body.placementMode === 'manual' ? 'manual' : undefined,
      manualPlacements: Array.isArray(body.manualPlacements) ? body.manualPlacements.map(String) : undefined,
      leadLanguages:    Array.isArray(body.leadLanguages) ? body.leadLanguages.map(String) : undefined,
    })

    // Launch succeeded → the ad WILL serve, so the reservation is now committed.
    // Clearing the flag first is the whole point: everything below is
    // bookkeeping, and a throw in bookkeeping used to fall into the catch below
    // and REFUND a live campaign — the broker got funded ad spend for free and
    // the ledger said "did not launch/serve".
    reserved = false
    try {
      await attributeCampaign(result.campaignId)
      await settleCampaignReservation(brokerId ?? '', reservationRef, result.campaignId)
      await recordCampaignProject(result.campaignId, projectSlug) // link for the router
      await recordLaunchDecision(result.campaignId)
      // Persist the wizard's autopilot policy — the autopilot pass reads it.
      if (body.autoEnhance === 'on' || body.autoEnhance === 'approval' || body.autoEnhance === 'off') {
        await setCampaignAutoEnhance(result.campaignId, body.autoEnhance)
      }
    } catch (bookkeepingErr) {
      // The campaign is live and the credits are correctly spent; only the
      // links/logs are incomplete. Never turn that into a launch failure.
      console.error('[meta/launch] post-launch bookkeeping failed', bookkeepingErr)
    }

    return NextResponse.json({ ...result, brokerId, decision }, { status: 201 })
  } catch (err) {
    if (err instanceof MetaConfigError) {
      // Not connected → persist a local campaign (mirrors the Google flow) so
      // the wizard's success screen + detail page work end to end. A demo campaign
      // never serves an ad, so release the reservation (attribute, don't charge).
      const refunded = await releaseReservation()
      const local = await createLocalCampaign(body, brokerId)
      await attributeCampaign(local.campaignId)
      await recordCampaignProject(local.campaignId, projectSlug)
      await recordLaunchDecision(local.campaignId)
      if (body.autoEnhance === 'on' || body.autoEnhance === 'approval' || body.autoEnhance === 'off') {
        await setCampaignAutoEnhance(local.campaignId, body.autoEnhance)
      }
      return NextResponse.json(
        {
          ...local, brokerId, demo: true, decision,
          ...(refunded ? {} : { creditsRefunded: false, creditsHeld: creditsToSpend }),
        },
        { status: 201 },
      )
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
