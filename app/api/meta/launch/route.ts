import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { launchFullCampaign } from '@/lib/meta/client'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import { createLocalCampaign } from '@/lib/meta/local-store'
import type { LaunchCampaignPayload } from '@/lib/meta/types'
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

  // Identify the creating broker (if any) from the verified session.
  const sessionUser = __auth.user
  const brokerId    = sessionUser.role === 'broker'
    ? (sessionUser.brokerId ?? sessionUser.email)
    : undefined

  // Persist broker attribution + deduct launch credits. Best-effort: a failure
  // here never blocks the campaign (it already exists in Meta or the local store).
  async function recordBrokerSpend(campaignId: string) {
    if (!brokerId) return
    try {
      await ensureBrokerTable()
      await query(
        `INSERT INTO meta_campaign_brokers (campaign_id, broker_id, campaign_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (campaign_id) DO NOTHING`,
        [campaignId, brokerId, body.campaignName],
      )
      const creditsToSpend = Math.round((body.dailyBudgetAED ?? 100) / 10)
      await deductCreditsForCampaign(brokerId, campaignId, body.campaignName, creditsToSpend)
    } catch {
      // Non-fatal — attribution/credits logging failed.
    }
  }

  try {
    const result = await launchFullCampaign({
      campaignName:   body.campaignName,
      objective:      body.objective,
      listingName:    body.listingName,
      dailyBudgetAED: body.dailyBudgetAED,
      targeting:      body.targeting,
      creative:       body.creative,
      launchStatus:   body.launchStatus ?? 'PAUSED',
    })

    await recordBrokerSpend(result.campaignId)

    return NextResponse.json({ ...result, brokerId }, { status: 201 })
  } catch (err) {
    if (err instanceof MetaConfigError) {
      // Not connected → persist a local campaign (mirrors the Google flow) so
      // the wizard's success screen + detail page work end to end.
      const local = await createLocalCampaign(body, brokerId)
      await recordBrokerSpend(local.campaignId)
      return NextResponse.json({ ...local, brokerId, demo: true }, { status: 201 })
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
