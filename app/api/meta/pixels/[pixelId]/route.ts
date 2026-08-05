import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getPixelDetail, MetaApiError, MetaConfigError } from '@/lib/meta/client'

// One pixel including Meta's base-code install snippet (`code`) — needed only
// for sites this platform does not host; its own landing pages inject the
// pixel from the saved global id, with no snippet to paste anywhere.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pixelId: string }> },
) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const { pixelId } = await params
    const pixel = await getPixelDetail(pixelId)
    return NextResponse.json({ pixel })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}
