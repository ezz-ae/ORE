import { NextRequest, NextResponse } from 'next/server'
import { getCampaign, getCampaignInsights, listAdSets, listAds, updateCampaignStatus, deleteCampaign } from '@/lib/meta/client'
import { MetaApiError, MetaConfigError } from '@/lib/meta/client'
import type { MetaCampaignStatus } from '@/lib/meta/types'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const [campaign, insights, adSets] = await Promise.all([
      getCampaign(id),
      getCampaignInsights(id),
      listAdSets(id),
    ])

    // Get ads for each ad set
    const adSetsWithAds = await Promise.all(
      adSets.map(async (adSet) => {
        const ads = await listAds(adSet.id)
        return { ...adSet, ads }
      }),
    )

    return NextResponse.json({ campaign, insights, adSets: adSetsWithAds })
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const status = body.status as MetaCampaignStatus

    if (!['ACTIVE', 'PAUSED', 'DELETED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    if (status === 'DELETED') {
      const result = await deleteCampaign(id)
      return NextResponse.json(result)
    }

    const result = await updateCampaignStatus(id, status)
    return NextResponse.json(result)
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
