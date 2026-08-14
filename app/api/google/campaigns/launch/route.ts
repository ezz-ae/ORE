import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { launchSearchCampaign } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError, type LaunchGoogleCampaignPayload } from '@/lib/google/types'
import { createLocalCampaign } from '@/lib/google/local-store'
import { canLaunch, LAUNCH_FLOOR_DAYS } from '@/lib/freehold/ad-settlement'
import { ensureBankWallets, walletFor } from '@/lib/freehold/bank-db'
import { listWallets } from '@/lib/freehold/wallet-db'

export async function POST(req: Request) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  const body = await req.json().catch(() => null) as LaunchGoogleCampaignPayload | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  if (!body.campaignName?.trim()) {
    return NextResponse.json({ error: 'campaignName is required' }, { status: 400 })
  }
  if (!body.finalUrl?.trim()) {
    return NextResponse.json({ error: 'finalUrl is required' }, { status: 400 })
  }
  // Must be a real number BEFORE it becomes money: a non-numeric budget makes
  // the credit derivation meaningless, and a falsy-but-passing value would
  // reserve nothing and launch funded ad spend for free.
  if (typeof body.dailyBudgetAED !== 'number' || !Number.isFinite(body.dailyBudgetAED)) {
    return NextResponse.json({ error: 'Daily budget must be a number in AED' }, { status: 400 })
  }
  if (body.dailyBudgetAED < 50) {
    return NextResponse.json({ error: 'Minimum daily budget is AED 50' }, { status: 400 })
  }
  if (!body.headlines || body.headlines.length < 3) {
    return NextResponse.json({ error: 'At least 3 headlines required' }, { status: 400 })
  }
  if (!body.descriptions || body.descriptions.length < 2) {
    return NextResponse.json({ error: 'At least 2 descriptions required' }, { status: 400 })
  }

  // Identify the creating broker (if any) from the verified session.
  const sessionUser = __auth.user
  const brokerId    = sessionUser.role === 'broker'
    ? (sessionUser.brokerId ?? sessionUser.email)
    : undefined

  // ── Money: A GATE, NOT A CHARGE ─────────────────────────────────────────────
  //
  // Mirrors app/api/meta/launch, and must: a Google campaign burns the same
  // wallet as a Meta one, so it is billed the same way — on what the platform
  // actually spends, settled every AED 10 by the settlement sync, never on the
  // daily budget at launch. NOTHING IS RESERVED HERE and nothing may be:
  // charging at launch AND on delivery bills the same campaign twice.
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
          reason: `Ads are billed on what they actually spend. Starting one needs ${LAUNCH_FLOOR_DAYS} days of budget in your wallet.`,
        },
        { status: 402 },
      )
    }
  }

  /** Nothing is reserved, so nothing is released — see the Meta route. */
  async function releaseReservation(): Promise<boolean> { return true }

  try {
    const result = await launchSearchCampaign(body)

    // Launch succeeded → the ad WILL serve, so the reservation is now committed.
    // Clearing the flag FIRST is the lesson the Meta route learned the hard way:
    // everything below is bookkeeping, and a throw in bookkeeping must never
    // fall into the catch and refund a live campaign.
    try {
    } catch (bookkeepingErr) {
      console.error('[google/campaigns/launch] post-launch bookkeeping failed', bookkeepingErr)
    }

    return NextResponse.json({ success: true, ...result, brokerId })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      // Not connected → persist the campaign locally (created paused) so the
      // wizard completes and the new campaign appears in the list. A local
      // campaign never serves an ad, so the reservation goes back.
      await releaseReservation()
      const campaign = await createLocalCampaign(body, brokerId)
      return NextResponse.json({
        success: true, campaign, campaignId: campaign.id, demo: true, brokerId,
      })
    }
    // A real launch failed → nothing serves → nothing is ever billed for it.
    await releaseReservation()
    if (e instanceof GoogleApiError) {
      return NextResponse.json(
        {
          error: e.message, details: e.details,
        },
        { status: e.status },
      )
    }
    return NextResponse.json(
      {
        error: 'Unexpected error',
      },
      { status: 500 },
    )
  }
}
