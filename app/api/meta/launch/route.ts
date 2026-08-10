import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { launchFullCampaign, listAccessiblePages } from '@/lib/meta/client'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import { createLocalCampaign } from '@/lib/meta/local-store'
import { setCampaignAutoEnhance } from '@/lib/meta/campaign-prefs'
import type { LaunchCampaignPayload } from '@/lib/meta/types'
import { query } from '@/lib/db'
import { getAudience } from '@/lib/freehold/audiences'
import { getCampaignRequest, markRequestLaunched } from '@/lib/freehold/campaign-requests'
import { rememberCampaignAudience } from '@/lib/freehold/audience-outcomes'
import { getInventoryPropertyBySlug } from '@/lib/inventory-data'
import { adEndTimeForPermit, endTimeHasPassed } from '@/lib/freehold/permit-schedule'
import { crmExclusionAudienceId } from '@/lib/freehold/crm-exclusion'
import { getReadyBuyer } from '@/lib/freehold/ready-buyers'
import { planPattern, parsePattern } from '@/lib/freehold/audience-pattern'
import { SUPPORTED_LEAD_LANGUAGES } from '@/lib/meta/lead-language'
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

  // An instant-form ad captures the lead ON the ad — there is no landing page
  // in its journey, so demanding a listing before launch was a wall in front
  // of nothing. The listing stays required for landing-page ads (it IS the
  // destination's content) and stays USEFUL for form ads (permit window,
  // project attribution) — useful is offered, required is dropped.
  const isFormAd = body.destination === 'form'
  const required = isFormAd
    ? ['campaignName', 'objective', 'dailyBudgetAED', 'creative']
    : ['campaignName', 'objective', 'listingId', 'listingName', 'dailyBudgetAED', 'creative']
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
  // A COST CAP THAT CANNOT POSSIBLY CLEAR THE AUCTION IS A SELF-STRANGLE, and
  // it is permanent: updateAdSet carries no bid fields, so the only exit is a
  // relaunch. A real account shipped with a cap of AED 7.50 per lead — in a
  // market where a property lead clears at ~AED 195 — and sat in "Active
  // Learning" delivering nothing while the money waited. The wizard only ever
  // sends a cap when the optimisation unit is a lead or a call (it zeroes the
  // field for click goals), so any cap arriving here prices one of those; AED
  // 30 is far below any lead this market has ever produced, which makes a cap
  // under it a typo or a fils confusion, never an intent.
  if (typeof body.cplCapAED === 'number' && body.cplCapAED > 0 && body.cplCapAED < 30) {
    return NextResponse.json({
      error: `A cost cap of AED ${body.cplCapAED} per result cannot win any auction for property leads — the ad set would sit "active" and deliver nothing, and a cap cannot be changed after launch. Launch without a cap (recommended), or set one above AED 30.`,
      type: 'validation',
    }, { status: 400 })
  }

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
  let brokerId: string | undefined = sessionUser.role === 'broker'
    ? (sessionUser.brokerId ?? sessionUser.email)
    : undefined

  // A LAUNCH ON BEHALF. When the launch fulfils a broker's campaign request,
  // the credits charge and the campaign attribution both belong to the
  // REQUESTING broker, not to the manager clicking the button — that is the
  // entire INBOUND deal: the broker pays in Assets and owns the result, the
  // manager operates the tools. The request must still be launchable
  // (requested/approved, never rejected or already launched).
  let fulfilsRequest: Awaited<ReturnType<typeof getCampaignRequest>> = null
  if (typeof body.campaignRequestId === 'string' && body.campaignRequestId) {
    fulfilsRequest = await getCampaignRequest(body.campaignRequestId)
    if (!fulfilsRequest) {
      return NextResponse.json({ error: 'The campaign request behind this launch no longer exists.' }, { status: 404 })
    }
    if (fulfilsRequest.status === 'rejected' || fulfilsRequest.status === 'launched') {
      return NextResponse.json({ error: `This campaign request is already ${fulfilsRequest.status} — launching it again would double-charge the broker.` }, { status: 409 })
    }
    brokerId = fulfilsRequest.brokerId
  }

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
  // The audience this launch came from, kept for the record. A fingerprint of
  // the targeting can spot a duplicate; only the identity answers "which of
  // our audiences produces buyers".
  let launchedAudienceKey = ''
  let launchedAudienceName = ''
  if (typeof body.audienceId === 'string' && body.audienceId) {
    const saved = await getAudience(body.audienceId)
    if (!saved) {
      return NextResponse.json({ error: 'That audience no longer exists', type: 'validation' }, { status: 400 })
    }
    launchedAudienceKey = `saved:${saved.id}`
    launchedAudienceName = saved.name
    // The wizard still owns placements; everything else comes from the
    // audience, whose definition is the whole reason it was attached.
    body.targeting = {
      ...saved.spec,
      ...(Array.isArray(body.targeting?.publisherPlatforms) && body.targeting.publisherPlatforms.length
        ? { publisherPlatforms: body.targeting.publisherPlatforms }
        : {}),
    }
  } else if (typeof body.presetId === 'string' && body.presetId) {
    // A ready-buyer template, launched directly — no save-first detour. The
    // same kitchen resolves it as any saved pattern audience.
    const preset = getReadyBuyer(body.presetId)
    if (!preset) {
      return NextResponse.json({ error: 'That audience no longer exists', type: 'validation' }, { status: 400 })
    }
    launchedAudienceKey = `ready:${preset.id}`
    // A ready-buyer's display name lives in the dictionaries, keyed by id —
    // storing an English label here would freeze it out of Arabic and Russian.
    launchedAudienceName = preset.id
    const plan = planPattern(parsePattern({ ...preset.pattern, name: preset.id }), [...SUPPORTED_LEAD_LANGUAGES])
    body.targeting = {
      ...plan.targeting,
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
  // ── THE PERMIT WINDOW IS THE AD'S WINDOW ────────────────────────────────
  //
  // trakheesi.ts states the rule: an ad running past its permit is as
  // non-compliant as one that never had a permit. Until now the Ads Machine
  // was the only thing enforcing it, on a cron that runs twice a day — so a
  // lapsed permit could keep advertising for up to twelve hours — and this
  // manual launch path enforced nothing at all.
  //
  // Meta enforces it exactly, for free, whether or not anything of ours is
  // awake: end_time on the ad set. Read from the listing here rather than
  // trusted from the browser, because a compliance deadline the client can
  // edit is not a deadline.
  let permitEndTime: string | undefined
  try {
    const listing = body.listingId ? await getInventoryPropertyBySlug(String(body.listingId)) : null
    const end = adEndTimeForPermit(listing?.permitExpiry)
    if (end && endTimeHasPassed(end)) {
      // We KNOW this one has lapsed. 'missing' and 'no_expiry' are different:
      // they are the absence of evidence, and refusing on those would block
      // launches over a blank field. Only a date that has actually passed is
      // grounds to stop someone.
      return NextResponse.json({
        error: `The Trakheesi permit for this listing expired on ${String(listing?.permitExpiry).slice(0, 10)}. Renew it before advertising this property.`,
        type: 'validation',
      }, { status: 400 })
    }
    permitEndTime = end ?? undefined
  } catch {
    // Inventory unreachable is not grounds to block a launch — but it is also
    // not grounds to invent a deadline. No end time, and the Ads Machine's own
    // permit gate remains the backstop it has always been.
  }

  // WHO THIS MUST NOT BE SHOWN TO.
  //
  // Resolved server-side from our own record. The browser sends the intent —
  // "not the CRM" — and never the id, so it cannot point an exclusion at an
  // audience that is not ours.
  let excludeAudienceIds: string[] = []
  if (body.excludeCrmAudience) {
    const id = await crmExclusionAudienceId().catch(() => null)
    if (id) excludeAudienceIds = [id]
    // No audience built yet ⇒ no exclusion, and no pretending there was one.
  }

  // Attribution key. A form ad launched without a listing still needs a
  // stable non-empty slug for the ledger, the router and the audience memory
  // — 'general' groups them rather than scattering them under ''.
  const projectSlug = String(body.listingId || 'general')
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
    // THE PAGE THE AD RUNS AS. Optional; the configured Page when absent. A
    // posted id is checked against the Pages this account can actually use —
    // not because Meta would accept a stranger's Page (it would not), but so
    // the operator gets a readable sentence instead of a Graph error code.
    let launchPageId: string | undefined
    if (typeof body.pageId === 'string' && body.pageId.trim()) {
      const wanted = body.pageId.trim()
      const accessible = await listAccessiblePages().catch(() => [])
      // An empty list is a lookup failure, not proof of inaccessibility —
      // pass through and let Meta be the judge rather than blocking a launch
      // on our own outage.
      if (accessible.length > 0 && !accessible.some((pg) => pg.id === wanted)) {
        return NextResponse.json({ error: `This Meta account cannot publish as Page ${wanted} — reconnect the Page or pick one of the ${accessible.length} connected Pages.` }, { status: 400 })
      }
      launchPageId = wanted
    }

    const result = await launchFullCampaign({
      campaignName:     body.campaignName,
      objective:        body.objective,
      listingName:      body.listingName || body.campaignName,
      dailyBudgetAED:   body.dailyBudgetAED,
      // The exclusion is merged LAST, after the audience (saved or preset) has
      // been resolved into body.targeting — so it survives whichever path
      // built the spec, and an audience that already carries its own
      // exclusions keeps them.
      targeting: excludeAudienceIds.length
        ? {
            ...body.targeting,
            excludedCustomAudienceIds: [
              ...new Set([...(body.targeting.excludedCustomAudienceIds ?? []), ...excludeAudienceIds]),
            ],
          }
        : body.targeting,
      creative:         body.creative,
      launchStatus:     body.launchStatus ?? 'PAUSED',
      destination:      body.destination,
      leadFormId:       body.leadFormId,
      destinationPhone: body.destinationPhone,
      pageId:           launchPageId,
      instagramUserId:  typeof body.instagramUserId === 'string' && body.instagramUserId.trim() ? body.instagramUserId.trim() : undefined,
      lifetimeCapAED:   typeof body.lifetimeCapAED === 'number' && body.lifetimeCapAED > 0 ? body.lifetimeCapAED : undefined,
      cplCapAED:        typeof body.cplCapAED === 'number' && body.cplCapAED > 0 ? body.cplCapAED : undefined,
      pixelId:          typeof body.pixelId === 'string' && body.pixelId.trim() ? body.pixelId.trim() : undefined,
      placementMode:    body.placementMode === 'manual' ? 'manual' : undefined,
      manualPlacements: Array.isArray(body.manualPlacements) ? body.manualPlacements.map(String) : undefined,
      leadLanguages:    Array.isArray(body.leadLanguages) ? body.leadLanguages.map(String) : undefined,
      // The permit window, applied to every ad set this launch creates.
      endTimeIso:       permitEndTime,
    })

    // Launch succeeded → the ad WILL serve, so the reservation is now committed.
    // Clearing the flag first is the whole point: everything below is
    // bookkeeping, and a throw in bookkeeping used to fall into the catch below
    // and REFUND a live campaign — the broker got funded ad spend for free and
    // the ledger said "did not launch/serve".
    reserved = false
    try {
      await attributeCampaign(result.campaignId)
      // The request's receipt: it is a campaign now.
      if (fulfilsRequest) await markRequestLaunched(fulfilsRequest.id, result.campaignId).catch(() => {})
      await settleCampaignReservation(brokerId ?? '', reservationRef, result.campaignId)
      await recordCampaignProject(result.campaignId, projectSlug) // link for the router
      // WHICH AUDIENCE THIS CAME FROM. The launch resolves a named audience
      // into a targeting spec and then, until now, forgot the name — so the
      // one question worth asking before the next launch ("which of these
      // actually brought buyers?") had no answer. Recorded here, read back
      // against the CRM's own outcomes.
      if (launchedAudienceKey) {
        await rememberCampaignAudience({
          campaignId: result.campaignId,
          campaignName: body.campaignName ?? '',
          audienceKey: launchedAudienceKey,
          audienceName: launchedAudienceName || launchedAudienceKey,
        })
      }
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
