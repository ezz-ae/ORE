import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getCampaign, updateCampaignStatus, updateCampaignBudget } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError } from '@/lib/google/types'
import {
  getLocalCampaign,
  updateLocalCampaignStatus,
  updateLocalCampaignBudget,
} from '@/lib/google/local-store'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  const { id } = await params

  // Local drafts (local-*) never exist in Google Ads — serve the local row
  // even when the API is connected.
  if (id.startsWith('local-')) {
    const campaign = await getLocalCampaign(id)
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    return NextResponse.json({ campaign, demo: true })
  }

  try {
    const campaign = await getCampaign(id)
    return NextResponse.json({ campaign })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      // Not connected → read from the local store.
      const campaign = await getLocalCampaign(id)
      if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      return NextResponse.json({ campaign, demo: true })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  const { id } = await params
  const body = await req.json().catch(() => ({})) as { status?: 'ENABLED' | 'PAUSED'; dailyBudgetAED?: number }
  const { status, dailyBudgetAED } = body

  if (status && status !== 'ENABLED' && status !== 'PAUSED') {
    return NextResponse.json({ error: 'status must be ENABLED or PAUSED' }, { status: 400 })
  }
  if (dailyBudgetAED !== undefined && (!Number.isFinite(dailyBudgetAED) || dailyBudgetAED < 50)) {
    // Same floor as the launch route — Google minimums plus our own guard rail.
    return NextResponse.json({ error: 'Minimum daily budget is AED 50' }, { status: 400 })
  }

  // Local drafts (local-*) never exist in Google Ads — update the local row
  // even when the API is connected (honest: a draft stays a draft).
  const applyLocal = async () => {
    let campaign = status ? await updateLocalCampaignStatus(id, status) : await getLocalCampaign(id)
    if (dailyBudgetAED !== undefined && campaign) {
      campaign = await updateLocalCampaignBudget(id, dailyBudgetAED)
    }
    return campaign
  }

  if (id.startsWith('local-')) {
    const campaign = await applyLocal()
    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    return NextResponse.json({ campaign, demo: true })
  }

  try {
    if (status) await updateCampaignStatus(id, status)
    if (dailyBudgetAED !== undefined) await updateCampaignBudget(id, dailyBudgetAED)
    const campaign = await getCampaign(id)
    return NextResponse.json({ campaign })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      // Not connected → persist the change in the local store.
      const campaign = await applyLocal()
      if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      return NextResponse.json({ campaign, demo: true })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
