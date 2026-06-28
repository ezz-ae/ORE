import { NextResponse } from 'next/server'
import { launchSearchCampaign } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError, type LaunchGoogleCampaignPayload } from '@/lib/google/types'
import { createLocalCampaign } from '@/lib/google/local-store'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as LaunchGoogleCampaignPayload | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  if (!body.campaignName?.trim()) {
    return NextResponse.json({ error: 'campaignName is required' }, { status: 400 })
  }
  if (!body.finalUrl?.trim()) {
    return NextResponse.json({ error: 'finalUrl is required' }, { status: 400 })
  }
  if (!body.dailyBudgetAED || body.dailyBudgetAED < 50) {
    return NextResponse.json({ error: 'Minimum daily budget is AED 50' }, { status: 400 })
  }
  if (!body.headlines || body.headlines.length < 3) {
    return NextResponse.json({ error: 'At least 3 headlines required' }, { status: 400 })
  }
  if (!body.descriptions || body.descriptions.length < 2) {
    return NextResponse.json({ error: 'At least 2 descriptions required' }, { status: 400 })
  }

  try {
    const result = await launchSearchCampaign(body)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      // Not connected → persist the campaign locally (created paused) so the
      // wizard completes and the new campaign appears in the list.
      const campaign = await createLocalCampaign(body)
      return NextResponse.json({ success: true, campaign, campaignId: campaign.id, demo: true })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message, details: e.details }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
