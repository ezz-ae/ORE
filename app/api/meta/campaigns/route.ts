import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listCampaigns, getCampaignInsights } from '@/lib/meta/client'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import { listLocalCampaigns } from '@/lib/meta/local-store'

export async function GET() {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
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
      // Not connected → serve the local store (seeded from demo + any
      // campaigns launched in-app), so the list stays interactive.
      return NextResponse.json({ campaigns: await listLocalCampaigns(), demo: true })
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
