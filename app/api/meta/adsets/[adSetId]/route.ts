import { NextRequest, NextResponse } from 'next/server'
import { getAdSet, updateAdSet, MetaApiError, MetaConfigError } from '@/lib/meta/client'
import type { MetaCampaignStatus, CampaignTargeting } from '@/lib/meta/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ adSetId: string }> },
) {
  try {
    const { adSetId } = await params
    const adSet = await getAdSet(adSetId)
    return NextResponse.json({ adSet })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ adSetId: string }> },
) {
  try {
    const { adSetId } = await params
    const body = await req.json() as {
      status?: MetaCampaignStatus
      name?: string
      dailyBudgetAED?: number
      targeting?: CampaignTargeting
    }

    if (body.status && !['ACTIVE', 'PAUSED'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status — use ACTIVE or PAUSED' }, { status: 400 })
    }
    if (body.dailyBudgetAED !== undefined && body.dailyBudgetAED < 50) {
      return NextResponse.json({ error: 'Minimum daily budget is AED 50' }, { status: 400 })
    }

    const result = await updateAdSet(adSetId, body)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}
