import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listAdGroups } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError } from '@/lib/google/types'

export async function GET(req: Request) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaignId') ?? undefined
    const adGroups = await listAdGroups(campaignId)
    return NextResponse.json({ adGroups })
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
