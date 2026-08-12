/**
 * WHAT WOULD STOP THIS LAUNCH — the half the browser cannot know.
 *
 * The wizard holds the budget, the copy, the picture and the audience. It does
 * NOT hold whether Meta is connected, which Page is selected, whether this
 * project's Trakheesi permit is still valid, or whether the landing page is
 * published right now — and every one of those can refuse the launch.
 *
 * That is why the wizard used to fail on the last click: those four facts were
 * only ever consulted inside the launch route, after the work was done.
 *
 * READ-ONLY, AND CHEAP ENOUGH TO CALL ON EVERY CHANGE. No Graph write, no
 * campaign created, nothing that costs money. The judgement itself is pure and
 * lives in lib/freehold/launch-readiness.ts — this route only fetches.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { isMetaConfigured, getAdIdentity } from '@/lib/meta/client'
import { getInventoryPropertyBySlug } from '@/lib/inventory-data'
import { getLandingPublishState } from '@/lib/landing-pages'
import { BRAND } from '@/lib/freehold/brand'
import { preflightLanding, landingSlugOf } from '@/lib/freehold/landing-preflight'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const listingId = req.nextUrl.searchParams.get('listingId')?.trim() || ''
  const landingUrl = req.nextUrl.searchParams.get('landingUrl')?.trim() || ''

  const metaConnected = await isMetaConfigured()

  // The Page is read from the stored identity rather than asked for, because
  // the wizard never had a Page picker — it inherits the connected one, and a
  // launch fails at Meta if that is missing.
  const pageId = metaConnected
    ? await getAdIdentity().then((i) => i.pageId || null).catch(() => null)
    : null

  // undefined means NOT LOOKED UP — the strip renders that as pending rather
  // than as a missing permit, which is a different and much louder claim.
  let permitExpiry: string | null | undefined
  if (listingId) {
    const listing = await getInventoryPropertyBySlug(listingId).catch(() => null)
    permitExpiry = listing ? (listing.permitExpiry ?? null) : undefined
  }

  let landingVerdict: string | null = null
  if (landingUrl) {
    const slug = landingSlugOf(landingUrl, BRAND.domain)
    const state = slug ? await getLandingPublishState(slug).catch(() => null) : null
    landingVerdict = preflightLanding(landingUrl, state, { domain: BRAND.domain }).verdict
  }

  return NextResponse.json({ metaConnected, pageId, permitExpiry, landingVerdict })
}
