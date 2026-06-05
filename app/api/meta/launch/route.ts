import { NextRequest, NextResponse } from 'next/server'
import { launchFullCampaign } from '@/lib/meta/client'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import type { LaunchCampaignPayload } from '@/lib/meta/types'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as LaunchCampaignPayload

    // Validate required fields
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

    const result = await launchFullCampaign({
      campaignName:   body.campaignName,
      objective:      body.objective,
      listingName:    body.listingName,
      dailyBudgetAED: body.dailyBudgetAED,
      targeting:      body.targeting,
      creative:       body.creative,
      launchStatus:   body.launchStatus ?? 'PAUSED',
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    if (err instanceof MetaConfigError) {
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
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
