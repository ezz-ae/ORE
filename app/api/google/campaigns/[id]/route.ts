import { NextResponse } from 'next/server'
import { getCampaign, updateCampaignStatus } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError } from '@/lib/google/types'
import { getLocalCampaign, updateLocalCampaignStatus } from '@/lib/google/local-store'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
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
  const { id } = await params
  const body = await req.json().catch(() => ({})) as { status?: 'ENABLED' | 'PAUSED' }
  const { status } = body

  if (status && status !== 'ENABLED' && status !== 'PAUSED') {
    return NextResponse.json({ error: 'status must be ENABLED or PAUSED' }, { status: 400 })
  }

  try {
    if (status) await updateCampaignStatus(id, status)
    const campaign = await getCampaign(id)
    return NextResponse.json({ campaign })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      // Not connected → persist the status change in the local store.
      const campaign = status ? await updateLocalCampaignStatus(id, status) : await getLocalCampaign(id)
      if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      return NextResponse.json({ campaign, demo: true })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
