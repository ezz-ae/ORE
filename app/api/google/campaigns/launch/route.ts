import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { launchSearchCampaign } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError, type LaunchGoogleCampaignPayload } from '@/lib/google/types'
import { createLocalCampaign } from '@/lib/google/local-store'
import {
  deductCreditsForCampaign, refundCredits, settleCampaignReservation, getCreditBalance,
} from '@/lib/freehold/credits-db'
import { creditsForDailyBudget } from '@/lib/freehold/credits-shared'
import { randomUUID } from 'crypto'

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

  // Same rate as Meta, from the same shared derivation: 1 credit per AED 10 of
  // funded daily budget. A Google campaign burns the broker's ad budget exactly
  // like a Meta one, so it costs exactly the same credits.
  const creditsToSpend = brokerId ? creditsForDailyBudget(body.dailyBudgetAED) : 0

  // ── Money: RESERVE credits BEFORE launching (fail-closed) ────────────────────
  // Mirrors app/api/meta/launch: the debit is atomic (row-locked, balance
  // re-derived under the lock) and booked under a placeholder reference, so two
  // concurrent launches serialise and neither can overspend. The balance check
  // below is only the fast, friendly 402 — the reservation is the authority. If
  // the launch then fails, or falls back to a local campaign that never serves,
  // the reservation is released.
  const reservationRef = `res-${randomUUID()}`
  let reserved = false
  if (brokerId && creditsToSpend > 0) {
    // Friendly pre-check ONLY. A null balance means "no account yet" OR "the
    // read failed" — telling a broker they are out of credits because a query
    // errored is a lie.
    const bal = await getCreditBalance(brokerId)
    if (bal && bal.balance < creditsToSpend) {
      return NextResponse.json(
        { error: 'Insufficient credits to launch this campaign.', balance: bal.balance, required: creditsToSpend },
        { status: 402 },
      )
    }
    const reservation = await deductCreditsForCampaign(brokerId, reservationRef, body.campaignName, creditsToSpend)
    if (!reservation.ok) {
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

  // Give the reserved credits back when a launch does NOT actually serve an ad.
  // Returns false when the ledger write failed — the credits are then still
  // held, and the caller must say so rather than report a clean outcome.
  async function releaseReservation(): Promise<boolean> {
    if (!reserved || !brokerId) return true
    const refund = await refundCredits(
      brokerId, reservationRef, creditsToSpend, 'Refund: campaign did not launch/serve',
    ).catch(() => ({ ok: false as const }))
    if (!refund.ok) {
      // Keep `reserved` true so a later attempt in this request retries, and
      // leave a trace an operator can reconcile the ledger from.
      console.error(
        '[google/campaigns/launch] credit refund FAILED — broker credits are still held',
        { brokerId, reservationRef, credits: creditsToSpend },
      )
      return false
    }
    reserved = false
    return true
  }

  try {
    const result = await launchSearchCampaign(body)

    // Launch succeeded → the ad WILL serve, so the reservation is now committed.
    // Clearing the flag FIRST is the lesson the Meta route learned the hard way:
    // everything below is bookkeeping, and a throw in bookkeeping must never
    // fall into the catch and refund a live campaign.
    reserved = false
    try {
      await settleCampaignReservation(brokerId ?? '', reservationRef, result.campaignId)
    } catch (bookkeepingErr) {
      console.error('[google/campaigns/launch] post-launch bookkeeping failed', bookkeepingErr)
    }

    return NextResponse.json({ success: true, ...result, brokerId })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      // Not connected → persist the campaign locally (created paused) so the
      // wizard completes and the new campaign appears in the list. A local
      // campaign never serves an ad, so the reservation goes back.
      const refunded = await releaseReservation()
      const campaign = await createLocalCampaign(body, brokerId)
      return NextResponse.json({
        success: true, campaign, campaignId: campaign.id, demo: true, brokerId,
        ...(refunded ? {} : { creditsRefunded: false, creditsHeld: creditsToSpend }),
      })
    }
    // A real launch failed → nothing serves → return the reserved credits.
    const refunded = await releaseReservation()
    if (e instanceof GoogleApiError) {
      return NextResponse.json(
        {
          error: e.message, details: e.details,
          ...(refunded ? {} : { creditsRefunded: false, creditsHeld: creditsToSpend }),
        },
        { status: e.status },
      )
    }
    return NextResponse.json(
      {
        error: 'Unexpected error',
        ...(refunded ? {} : { creditsRefunded: false, creditsHeld: creditsToSpend }),
      },
      { status: 500 },
    )
  }
}
