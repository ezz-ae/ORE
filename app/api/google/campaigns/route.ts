import { NextResponse } from 'next/server'
import { listCampaigns } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError } from '@/lib/google/types'
import { demoCampaigns } from '@/lib/google/demo-data'

export async function GET() {
  try {
    const campaigns = await listCampaigns()
    return NextResponse.json({ campaigns })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      return NextResponse.json({ campaigns: demoCampaigns, demo: true })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message, details: e.details }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
