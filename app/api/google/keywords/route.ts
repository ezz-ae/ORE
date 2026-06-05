import { NextResponse } from 'next/server'
import { listKeywords, listNegativeKeywords } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError } from '@/lib/google/types'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaignId') ?? undefined
    const includeNegatives = searchParams.get('negatives') === 'true'

    const [keywords, negatives] = await Promise.all([
      listKeywords(campaignId),
      includeNegatives ? listNegativeKeywords(campaignId) : Promise.resolve([]),
    ])

    return NextResponse.json({ keywords, negatives })
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
