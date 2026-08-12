/**
 * WHERE THIS CAMPAIGN'S LEADS GO — and whether they can come back.
 *
 * The campaign page has always shown spend, delivery, placements and results.
 * It has never shown the one thing that decides whether any of those numbers
 * mean anything: whether a person who fills something in at the other end
 * arrives in the CRM with this campaign's name attached.
 *
 * This account has already run that failure — 571 rows reading "General
 * enquiry" because the landing URLs carried no utm_id — so every per-campaign
 * number was computed against an attribution that silently was not happening.
 *
 * The judgement is pure and lives in lib/freehold/campaign-destination.ts.
 * This route only fetches: ad sets, their ads, and each ad's real creative.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listAdSets, listAds, getAdWithCreative, isMetaConfigured } from '@/lib/meta/client'
import { BRAND } from '@/lib/freehold/brand'
import { summariseDestinations, type AdDestination } from '@/lib/freehold/campaign-destination'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Most ads to open a creative for.
 *
 * One Graph call per ad, so this is a real cost on a wide campaign. Twenty-four
 * covers every campaign this product builds; past that the panel reports the
 * cap rather than quietly describing a subset as though it were everything.
 */
const MAX_ADS_READ = 24

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  if (!(await isMetaConfigured())) return NextResponse.json({ connected: false })

  try {
    const adSets = await listAdSets(id)
    const ads = (await Promise.all(adSets.map((s) => listAds(s.id).catch(() => [])))).flat()
    const capped = Math.max(0, ads.length - MAX_ADS_READ)

    const snaps = await Promise.all(
      ads.slice(0, MAX_ADS_READ).map(async (a): Promise<AdDestination> => {
        const snap = await getAdWithCreative(a.id).catch(() => null)
        return {
          adId: a.id,
          adName: a.name || a.id,
          url: snap?.creative?.landingUrl?.trim() || null,
          leadFormId: snap?.leadFormId ?? null,
          // The SERVING state, not the switch — a campaign-level ACTIVE with a
          // rejected ad is not a live destination, and calling it one would
          // raise an alarm about a leak that is not leaking.
          active: (a.effective_status ?? a.status) === 'ACTIVE',
        }
      }),
    )

    return NextResponse.json({
      connected: true,
      ...summariseDestinations(snaps, { campaignId: id, domain: BRAND.domain }),
      // Never silent: a cap that is not reported reads as "these are all of
      // them", which is the same class of quiet lie this panel exists to end.
      capped,
    })
  } catch (e) {
    return NextResponse.json(
      { connected: true, error: e instanceof Error ? e.message : 'Meta would not return the ads' },
      { status: 502 },
    )
  }
}
