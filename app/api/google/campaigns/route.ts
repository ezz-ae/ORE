import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listCampaigns } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError } from '@/lib/google/types'
import { listLocalCampaigns } from '@/lib/google/local-store'

export async function GET() {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const campaigns = await listCampaigns()
    return NextResponse.json({ campaigns })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      // Not connected → serve the local store (seeded from demo, includes any
      // campaigns created in-app) so the flow stays fully interactive.
      return NextResponse.json({ campaigns: await listLocalCampaigns(), demo: true })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message, details: e.details }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
