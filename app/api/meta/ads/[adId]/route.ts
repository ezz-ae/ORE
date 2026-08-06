import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getAdWithCreative, updateAdCreativeContent, MetaApiError, MetaConfigError, updateAdStatus } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The ad's current copy/creative — the "before" an edit form hydrates from. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ adId: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { adId } = await params
  try {
    const ad = await getAdWithCreative(adId)
    return NextResponse.json({ ad })
  } catch (err) {
    if (err instanceof MetaConfigError) return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError) return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}

/** Edit a live ad's copy/creative — headline, primary text, description,
 * landing URL, image, or CTA. Builds a new (immutable) creative and repoints
 * the ad at it; the ad's actual destination (lead form / WhatsApp / call) is
 * preserved automatically. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ adId: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { adId } = await params
  const body = await req.json().catch(() => ({})) as {
    primaryText?: string; headline?: string; description?: string
    landingUrl?: string; imageUrl?: string; imageHash?: string; cta?: string
    status?: 'ACTIVE' | 'PAUSED'
  }

  // Status is handled on its own and FIRST, because it is the one change that
  // must work when nothing else is being edited — turning a single ad off in a
  // working ad set, without pausing the ad set and losing its learning.
  if (body.status) {
    if (!['ACTIVE', 'PAUSED'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status — use ACTIVE or PAUSED' }, { status: 400 })
    }
    try {
      await updateAdStatus(adId, body.status)
      return NextResponse.json({ success: true, status: body.status })
    } catch (err) {
      if (err instanceof MetaConfigError) return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
      if (err instanceof MetaApiError) return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
      return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
    }
  }

  const changes = {
    primaryText: body.primaryText?.trim() || undefined,
    headline: body.headline?.trim() || undefined,
    description: body.description?.trim() || undefined,
    landingUrl: body.landingUrl?.trim() || undefined,
    imageUrl: body.imageUrl?.trim() || undefined,
    imageHash: body.imageHash?.trim() || undefined,
    cta: body.cta?.trim() || undefined,
  }
  if (!Object.values(changes).some(Boolean)) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
  }
  try {
    const result = await updateAdCreativeContent(adId, changes)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof MetaConfigError) return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError) return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}
