import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { generateAdPreview, MetaApiError, MetaConfigError } from '@/lib/meta/client'
import type { CampaignCreative, MetaAdFormat } from '@/lib/meta/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const body = (await req.json()) as { creative: CampaignCreative; adFormat?: MetaAdFormat }
    if (!body.creative) {
      return NextResponse.json({ error: 'Missing required field: creative' }, { status: 400 })
    }

    // `body` here is trusted iframe HTML from graph.facebook.com — returned
    // as-is for the client to render inside a sandboxed container.
    const { body: preview } = await generateAdPreview({ creative: body.creative, adFormat: body.adFormat })
    return NextResponse.json({ body: preview })
  } catch (err) {
    // Not connected → honest demo state, never a fabricated iframe.
    if (err instanceof MetaConfigError)
      return NextResponse.json({ body: '', demo: true })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}
