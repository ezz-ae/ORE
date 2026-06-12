import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { launchFullCampaign } from '@/lib/meta/client'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import type { LaunchCampaignPayload } from '@/lib/meta/types'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import { deductCreditsForCampaign } from '@/lib/freehold/credits-db'

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
  try {
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

    // Identify the creating broker (if any) from the session
    const cookieStore = await cookies()
    const token       = cookieStore.get(SESSION_COOKIE)?.value
    const sessionUser = await verifySession(token)
    const brokerId    = sessionUser?.role === 'broker'
      ? (sessionUser.brokerId ?? sessionUser.email)
      : undefined

    const result = await launchFullCampaign({
      campaignName:   body.campaignName,
      objective:      body.objective,
      listingName:    body.listingName,
      dailyBudgetAED: body.dailyBudgetAED,
      targeting:      body.targeting,
      creative:       body.creative,
      launchStatus:   body.launchStatus ?? 'PAUSED',
    })

    // Persist broker attribution so the campaigns list can filter by role
    if (brokerId) {
      try {
        await ensureBrokerTable()
        await query(
          `INSERT INTO meta_campaign_brokers (campaign_id, broker_id, campaign_name)
           VALUES ($1, $2, $3)
           ON CONFLICT (campaign_id) DO NOTHING`,
          [result.campaignId, brokerId, body.campaignName],
        )
      } catch {
        // Non-fatal — campaign was created in Meta; attribution log failed
      }
    }

    // Deduct credits for the campaign launch (1 credit per AED 10 of daily budget)
    if (brokerId) {
      const creditsToSpend = Math.round((body.dailyBudgetAED ?? 100) / 10)
      await deductCreditsForCampaign(brokerId, result.campaignId, body.campaignName, creditsToSpend)
    }

    return NextResponse.json({ ...result, brokerId }, { status: 201 })
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
