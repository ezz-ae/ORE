import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Live lead-quality score for a campaign, computed from our CRM funnel. The
 * campaign name is passed by the client (it already holds it) so this works
 * whether or not Meta is connected. GET ?id=<campaignId>&name=<campaignName>
 */
export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const id = req.nextUrl.searchParams.get('id') ?? ''
  const name = req.nextUrl.searchParams.get('name') ?? ''
  if (!id && !name) return NextResponse.json({ error: 'id or name is required' }, { status: 400 })
  const quality = await getCampaignQuality(id, name)
  return NextResponse.json({ quality })
}
