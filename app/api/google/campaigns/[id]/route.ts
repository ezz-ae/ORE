import { NextResponse } from 'next/server'
import { getCampaign, updateCampaignStatus } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError } from '@/lib/google/types'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const campaign = await getCampaign(id)
    return NextResponse.json({ campaign })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      return NextResponse.json({ error: e.message, type: 'config' }, { status: 503 })
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
  try {
    const { id }     = await params
    const body       = await req.json() as { status?: 'ENABLED' | 'PAUSED' }
    const { status } = body

    if (status && status !== 'ENABLED' && status !== 'PAUSED') {
      return NextResponse.json({ error: 'status must be ENABLED or PAUSED' }, { status: 400 })
    }

    if (status) await updateCampaignStatus(id, status)

    const campaign = await getCampaign(id)
    return NextResponse.json({ campaign })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      return NextResponse.json({ error: e.message, type: 'config' }, { status: 503 })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
