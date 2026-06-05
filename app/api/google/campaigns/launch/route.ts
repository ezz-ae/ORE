import { NextResponse } from 'next/server'
import { launchSearchCampaign } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError, type LaunchGoogleCampaignPayload } from '@/lib/google/types'

export async function POST(req: Request) {
  try {
    const body = await req.json() as LaunchGoogleCampaignPayload

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

    const result = await launchSearchCampaign(body)
    return NextResponse.json({ success: true, ...result })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      return NextResponse.json({ error: e.message, type: 'config' }, { status: 503 })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message, details: e.details }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
