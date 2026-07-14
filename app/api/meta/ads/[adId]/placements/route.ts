import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getAdPlacementCreative, updateAdPlacementCreative, MetaApiError, MetaConfigError } from '@/lib/meta/client'
import type { PlacementKey, PlacementCreativeOverride } from '@/lib/meta/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Decode a live ad's per-placement (asset_feed_spec) creative — the default
 * plus whatever each placement overrides — so the edit panel can hydrate. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ adId: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { adId } = await params
  try {
    const ad = await getAdPlacementCreative(adId)
    return NextResponse.json({ ad })
  } catch (err) {
    if (err instanceof MetaConfigError) return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError) return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}

/** Edit a live per-placement ad: new default fields plus a full replacement
 * set of per-placement overrides (image/headline/primary text per placement
 * — wherever this ad is actually displaying). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ adId: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { adId } = await params
  const body = await req.json().catch(() => ({})) as {
    headline?: string; primaryText?: string; landingUrl?: string; cta?: string
    imageUrl?: string; imageHash?: string
    overrides?: Partial<Record<PlacementKey, PlacementCreativeOverride>>
  }
  try {
    const result = await updateAdPlacementCreative(adId, {
      headline: body.headline?.trim() || undefined,
      primaryText: body.primaryText?.trim() || undefined,
      landingUrl: body.landingUrl?.trim() || undefined,
      cta: body.cta?.trim() || undefined,
      imageUrl: body.imageUrl?.trim() || undefined,
      imageHash: body.imageHash?.trim() || undefined,
      overrides: body.overrides ?? {},
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof MetaConfigError) return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError) return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}
