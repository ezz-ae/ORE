/**
 * The campaign's daily series — spend, leads, impressions, clicks per day.
 * Separate from the campaign detail route so a slow breakdown never delays
 * the numbers and the setup check that matter first.
 */
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getCampaignDailySeries } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  return NextResponse.json({ series: await getCampaignDailySeries(id) })
}
