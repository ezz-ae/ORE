import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { launchFullCampaign, listAccessiblePages, checkPageAds, getCampaign } from '@/lib/meta/client'
import { blocksLaunch as blocksPageAds, pageAdsRefusal } from '@/lib/meta/page-ads'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import { createLocalCampaign } from '@/lib/meta/local-store'
import { setCampaignAutoEnhance } from '@/lib/meta/campaign-prefs'
import type { LaunchCampaignPayload } from '@/lib/meta/types'
import { query } from '@/lib/db'
import { getAudience } from '@/lib/freehold/audiences'
import { getCampaignRequest, markRequestLaunched } from '@/lib/freehold/campaign-requests'
import { rememberCampaignAudience } from '@/lib/freehold/audience-outcomes'
import { readQualifiedGoal, qualifiedConversionId } from '@/lib/meta/qualified-goal-db'
import { getInventoryPropertyBySlug } from '@/lib/inventory-data'
import { adEndTimeForPermit, endTimeHasPassed } from '@/lib/freehold/permit-schedule'
import { getLandingPublishState } from '@/lib/landing-pages'
import { BRAND } from '@/lib/freehold/brand'
import { preflightLanding, landingSlugOf, blocksLaunch } from '@/lib/freehold/landing-preflight'
import { avoidAudienceId } from '@/lib/freehold/rating-audiences'
import { crmExclusionAudienceId, syncCrmExclusionAudience } from '@/lib/freehold/crm-exclusion'
import { getReadyBuyer } from '@/lib/freehold/ready-buyers'
import { planPattern, parsePattern } from '@/lib/freehold/audience-pattern'
import { SUPPORTED_LEAD_LANGUAGES } from '@/lib/meta/lead-language'
import { canLaunch, LAUNCH_FLOOR_DAYS } from '@/lib/freehold/ad-settlement'
import { ensureBankWallets, walletFor } from '@/lib/freehold/bank-db'
import { listWallets } from '@/lib/freehold/wallet-db'
import { randomUUID } from 'crypto'
import {
  decideCampaignAction, routerBlocks, routerWarns, duplicateRefusal, duplicateWarning,
  type CampaignIntent, type RouterDecision,
} from '@/lib/meta/campaign-router'
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

  // ── Money: A GATE, NOT A CHARGE ─────────────────────────────────────────────
  //
  // This used to debit the DAILY BUDGET before launching. A budget is a ceiling,
  // not a price: a campaign set to AED 300 that delivered AED 40 charged the
  // broker AED 300, and one that ran three weeks charged them once. Neither
  // figure had anything to do with money leaving the company.
  //
  // The bill is now the platform's own reported spend, settled every AED 10 out
  // of the launcher's wallet by the settlement sync (ad-settlement.ts). NOTHING
  // IS RESERVED HERE, and nothing may be — charging at launch AND on delivery
  // would bill the same campaign twice, out of two different ledgers.
  //
  // What remains is a gate. A campaign whose owner cannot cover its first two
  // days will be paused by the sync within hours, after Meta has already
  // charged the company for the impressions it bought; refusing now is both
  // kinder and cheaper than that.
  let walletBalance = 0
  if (brokerId) {
    await ensureBankWallets()
    const walletId = await walletFor(brokerId, sessionUser.name || brokerId)
    walletBalance = (await listWallets()).find((w) => w.id === walletId)?.balance ?? 0
    const gate = canLaunch(walletBalance, body.dailyBudgetAED)
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: 'Not enough Cash to run this campaign.',
          balance: gate.haveAed,
          required: gate.needAed,
          // Said explicitly, because the number is no longer the daily budget
          // and a broker comparing the two will otherwise think it is a bug.
          reason: `Ads are billed on what they actually spend. Starting one needs ${LAUNCH_FLOOR_DAYS} days of budget in your wallet.`,
        },
        { status: 402 },
      )
    }
  }

  /**
   * Nothing is reserved, so nothing is released.
   *
   * Kept as a named call rather than deleted from seven branches: each of those
   * branches is a path where the campaign does NOT serve, and they should go on
   * saying so out loud. Under the old model they returned held credits; under
   * this one there is nothing to return, because a campaign that never served
   * never spent and therefore was never billed.
   */
  async function releaseReservation(): Promise<boolean> { return true }

  // Persist broker↔campaign attribution (best-effort link). This is what tells
  // the settlement sync WHOSE wallet pays for the spend this campaign delivers,
  // so it is the only money-relevant thing the launch still writes.
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
  // ── IS ANYTHING ACTUALLY THERE ──────────────────────────────────────────
  //
  // The only check on the landing URL was that it EXISTED as a string. But
  // app/lp/[slug] returns a 404 to anonymous visitors outside the publish
  // window, and every paid click is an anonymous visitor — so a campaign could
  // be launched, approved by Meta, and spend its whole daily budget delivering
  // people to a 404, with no symptom anywhere except that no leads arrive.
  // Which reads exactly like a bad audience, and gets debugged as one.
  //
  // Same shape as the permit gate below: a permit NUMBER says nothing about
  // today, and a page's STATUS says nothing about tomorrow.
  //
  // Refused only where the click CANNOT work. A page closing mid-flight, or a
  // destination that is not ours at all, are real choices somebody may be
  // making deliberately — those come back as warnings on a successful launch.
  const landingWarnings: string[] = []
  {
    const slug = landingSlugOf(body.creative.landingUrl, BRAND.domain)
    const state = slug ? await getLandingPublishState(slug).catch(() => null) : null
    const pre = preflightLanding(body.creative.landingUrl, state, { domain: BRAND.domain })
    if (blocksLaunch(pre.verdict)) {
      return NextResponse.json({
        error: pre.verdict === 'noSuchPage'
          ? `There is no landing page at /lp/${pre.slug}. Every click on this campaign would land on a 404.`
          : pre.verdict === 'windowClosed'
            ? `The landing page /lp/${pre.slug} stopped publishing on ${String(pre.closesOn).slice(0, 10)}. Publish it again before spending on it.`
            : `The landing page /lp/${pre.slug} is not published, so every paid click would land on a 404.`,
        type: 'validation',
      }, { status: 400 })
    }
    if (pre.verdict === 'closesSoon') {
      landingWarnings.push(`The landing page /lp/${pre.slug} stops publishing on ${String(pre.closesOn).slice(0, 10)} — this campaign will still be running.`)
    }
    if (pre.verdict === 'notOurs') {
      landingWarnings.push('This campaign points off our own site, so its leads cannot reach the CRM and will not appear against it.')
    }
  }

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
  // ALWAYS. NOT OPT-IN. This was `if (body.excludeCrmAudience)` — the browser
  // had to ask, so any caller that forgot the flag, and every launch made
  // before the switch existed, paid to advertise to people already in the
  // pipeline.
  //
  // There is no campaign for which "show this to somebody we are already
  // talking to" is the right answer. They are not a new lead; if they fill the
  // form again they are a duplicate the CRM then spends effort undoing. The
  // operator's instruction was explicit — always, and it should be a rule —
  // and a rule that depends on a checkbox is a preference.
  //
  // Built on demand when it does not exist yet, because "always" that silently
  // does nothing on a fresh account is the same as not having it.
  let excludeAudienceIds: string[] = []
  let crmExclusionApplied = false
  {
    let id = await crmExclusionAudienceId().catch(() => null)
    if (!id) id = (await syncCrmExclusionAudience().catch(() => null))?.audienceId ?? null
    if (id) { excludeAudienceIds = [id]; crmExclusionApplied = true }
    else {
      // Never pretend it applied. A launch that could not exclude is a fact
      // worth finding in the log when the duplicates start arriving.
      console.error('[launch] CRM exclusion could not be applied — no audience and none could be built')
    }
  }
  // THE OTHER EXCLUSION, and the one a broker's own judgment built.
  //
  // Always applied, not opt-in: it is the list of people this company's own
  // brokers rated worthless, and there is no campaign for which "show it to
  // the people we already called junk" is the right answer. It rides ALONGSIDE
  // the CRM exclusion rather than instead of it — that one stops paying twice
  // for somebody you already have, this one stops paying at all for the ones
  // you did not want.
  //
  // Meta has no negative event to receive (see rating-audiences), so this list
  // IS the negative half of the rating loop.
  const avoidId = await avoidAudienceId().catch(() => null)
  if (avoidId && !excludeAudienceIds.includes(avoidId)) excludeAudienceIds.push(avoidId)

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
  /** The campaign this launch would compete with, by name, for the sentence. */
  let rivalName: string | null = null
  try {
    const structure = await buildProjectAdStructure(projectSlug)
    decision = decideCampaignAction(intent, structure)
    rivalName = decision.targetCampaignId
      ? await getCampaign(decision.targetCampaignId).then((c) => c.name ?? null).catch(() => null)
      : null

    // ── THE ROUTER NOW DECIDES SOMETHING ────────────────────────────────────
    //
    // It has computed the healthiest structural action since the day it
    // shipped and nothing ever acted on it: the only branch with an effect was
    // the autonomy-3 hold below, and getAutonomyLevel() defaults to 1 and fails
    // closed to 1. Every other verdict went into the decision log as "the
    // intent router recommended X — fold the arms via Campaign Groups", which
    // tells somebody afterwards what should have happened.
    //
    // Refused at ANY autonomy level, because the autonomy gate governs the
    // machine SPENDING on its own. Declining to create a second campaign that
    // would bid against the first is the machine NOT acting — the same class as
    // the permit gate and the landing-404 gate above, both of which refuse
    // whatever the autonomy level is.
    //
    // And always overridable: a genuine campaign-level test of two concepts is
    // a real thing to want, and a refusal with no way through is a wall people
    // route around.
    if (routerBlocks(decision) && body.confirmDuplicate !== true) {
      await releaseReservation()
      await recordDecision({
        projectSlug, campaignId: decision.targetCampaignId ?? null, brokerId: intent.brokerId,
        action: 'hold', outcome: 'auto', reason: decision.reason,
      })
      return NextResponse.json({
        error: duplicateRefusal(decision, rivalName),
        type: 'duplicate',
        // The wizard offers "launch anyway", which re-posts with
        // confirmDuplicate — so the refusal is a question, not a wall.
        confirmable: true,
        targetCampaignId: decision.targetCampaignId ?? null,
        targetCampaignName: rivalName,
        alternatives: decision.alternatives,
      }, { status: 409 })
    }

    const autonomy = await getAutonomyLevel()
    if (autonomy === 3 && decision.action === 'hold') {
      // No new campaign serves on this path, so nothing will ever be billed for
      // it — said out loud because that is the fact the caller cares about.
      await releaseReservation()
      await recordDecision({
        projectSlug, campaignId: decision.targetCampaignId ?? null, brokerId: intent.brokerId,
        action: 'hold', outcome: 'auto', reason: decision.reason,
      })
      // Point the wizard's success screen at the live campaign already serving
      // this objective — no new (competing) campaign, no credits spent.
      return NextResponse.json(
        {
          campaignId: decision.targetCampaignId, held: true, decision, brokerId,
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
        : `Launched a new campaign after the operator confirmed it. The intent router recommended "${decision.action}": ${decision.reason} ${decision.adminNote}`,
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

    // ── CAN AN AD BE CREATED FROM THIS PAGE AT ALL ──────────────────────────
    //
    // The check above only asked whether the Page was IN the list. The list
    // has said all along whether the login may ADVERTISE with it, and nothing
    // read that — so Meta refused instead, at the far end, with subcode
    // 1487202, after the campaign and its ad sets already existed.
    //
    // Asked with NO posted Page too, which is the common case and was never
    // checked at all: a launch that names no Page runs from the configured
    // one, and that Page was appended to the list with the permission
    // hardcoded true.
    //
    // 'unknown' proceeds. Meta omits `tasks` for some token scopes, and
    // refusing on a field we did not receive would block real campaigns over
    // our own blind spot — the position landing-preflight and the permit gate
    // already take about missing evidence.
    {
      const ads = await checkPageAds(launchPageId).catch(() => null)
      if (ads && blocksPageAds(ads.verdict)) {
        // Nothing has been created yet, so nothing will be billed. A refusal
        // that also cost the broker money would be a second failure on top of
        // the first.
        await releaseReservation()
        return NextResponse.json({
          error: pageAdsRefusal(ads.pageName),
          type: 'validation',
          subcode: 1487202,
          pageId: ads.pageId,
          }, { status: 400 })
      }
    }

    // Arms = the ad sets this launch will create. The learning floor is per ad
    // set, so a launch splitting across six placements has to clear it six
    // times over before qualified leads are a goal it can sustain.
    const armsForLaunch = Array.isArray(body.manualPlacements) && body.manualPlacements.length > 0
      ? body.manualPlacements.length : 1
    const launchPixelId = typeof body.pixelId === 'string' && body.pixelId.trim() ? body.pixelId.trim() : null
    const qualifiedGoal = await readQualifiedGoal({
      objective: body.objective,
      destination: body.destination,
      pixelId: launchPixelId,
      arms: armsForLaunch,
    }).catch(() => null) ?? { goal: 'lead' as const, reason: 'noConversion' as const, perArmPerWeek: null, neededPerWeek: 0 }
    const qualifiedConversion = qualifiedGoal.goal === 'qualified'
      ? await qualifiedConversionId(launchPixelId).catch(() => null)
      : null

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
      // WHAT THIS AD SET IS TOLD TO BUY. Qualified leads when the account can
      // prove it produces enough of them per arm to leave learning, and form
      // fills otherwise — lib/meta/qualified-goal.ts owns the test. A failed
      // read leaves it undefined, which is exactly the behaviour every launch
      // had before this existed.
      qualifiedConversionId: qualifiedGoal.goal === 'qualified'
        ? (qualifiedConversion ?? undefined)
        : undefined,
      placementMode:    body.placementMode === 'manual' ? 'manual' : undefined,
      manualPlacements: Array.isArray(body.manualPlacements) ? body.manualPlacements.map(String) : undefined,
      leadLanguages:    Array.isArray(body.leadLanguages) ? body.leadLanguages.map(String) : undefined,
      // The permit window, applied to every ad set this launch creates.
      endTimeIso:       permitEndTime,
    })

    // Launch succeeded → the ad WILL serve. From here the settlement sync bills
    // it against what it actually delivers; this route's job with money is over.
    try {
      await attributeCampaign(result.campaignId)
      // The request's receipt: it is a campaign now.
      if (fulfilsRequest) await markRequestLaunched(fulfilsRequest.id, result.campaignId).catch(() => {})
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

    // Warnings ride WITH the success, never instead of it. A launch that
    // worked and has a caveat is not a failure, and refusing it would train
    // people to route around this route.
    //
    // The router's 'increase_budget' verdict lands here: the exact setup is
    // already running and past learning, so a parallel campaign is worse than
    // a budget raise but it is not self-harm. Said, not refused — and it is
    // SAID, which is the whole difference from the log line it replaces.
    const warnings = [
      ...landingWarnings,
      ...(routerWarns(decision) ? [duplicateWarning(decision as RouterDecision, rivalName)] : []),
      // A launch that could NOT exclude the CRM is a launch that will pay to
      // re-advertise to people already in the pipeline. It is not a failure —
      // the campaign is live and correct in every other respect — but it must
      // never pass silently, because the symptom arrives weeks later as
      // duplicates and looks like a CRM problem rather than a targeting one.
      ...(crmExclusionApplied ? [] : ['This campaign is running WITHOUT the "already in your CRM" exclusion — Meta is not connected for audiences, or the list could not be built. It may pay to reach people you already have.']),
    ]
    return NextResponse.json(
      { ...result, brokerId, decision, ...(warnings.length ? { warnings } : {}) },
      { status: 201 },
    )
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
      return NextResponse.json(
        {
          ...local, brokerId, demo: true, decision,
          },
        { status: 201 },
      )
    }
    // A real launch failed → nothing serves → nothing is ever billed for it.
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
