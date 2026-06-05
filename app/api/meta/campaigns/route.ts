import { NextResponse } from 'next/server'
import { listCampaigns, getCampaignInsights } from '@/lib/meta/client'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'

export async function GET() {
  try {
    const campaigns = await listCampaigns()

    // Attach insights for active campaigns (parallel)
    const withInsights = await Promise.all(
      campaigns.map(async (c) => {
        if (c.status === 'ACTIVE') {
          try {
            const insights = await getCampaignInsights(c.id)
            return { ...c, insights }
          } catch {
            return { ...c, insights: null }
          }
        }
        return { ...c, insights: null }
      }),
    )

    return NextResponse.json({ campaigns: withInsights })
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
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}
