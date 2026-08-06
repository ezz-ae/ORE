/**
 * Where a campaign's money actually went, placement by placement.
 *
 * READ ONLY. This endpoint never changes a placement — it says which ones are
 * draining the campaign and which are cropping the creative, and the operator
 * applies the change through the existing ad-set controls. Excluding a
 * placement is a real spend decision and stays an explicit human act.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getCampaignInsightsByPlacement } from '@/lib/meta/client'
import { auditPlacements, type CreativeAspect } from '@/lib/freehold/placement-audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ASPECTS: CreativeAspect[] = ['1:1', '4:5', '9:16', '16:9']

export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const campaignId = req.nextUrl.searchParams.get('campaignId')?.trim()
  if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })

  // The creative's aspect ratio, when the caller knows it. Absent = the
  // mismatch half of the audit is skipped rather than guessed.
  const raw = req.nextUrl.searchParams.get('aspect')
  const aspect = ASPECTS.includes(raw as CreativeAspect) ? (raw as CreativeAspect) : null

  try {
    const rows = await getCampaignInsightsByPlacement(campaignId)
    if (rows.length === 0) {
      // Distinguish "no breakdown available" from "no delivery" — an empty
      // panel that means the API refused reads as "everything is fine".
      return NextResponse.json({
        available: false,
        audit: auditPlacements([], aspect),
        note: 'Meta returned no placement breakdown for this campaign — it may not have delivered yet, or the ad account may not expose breakdowns.',
      })
    }
    return NextResponse.json({ available: true, audit: auditPlacements(rows, aspect), rows })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read placement delivery' },
      { status: 502 },
    )
  }
}
