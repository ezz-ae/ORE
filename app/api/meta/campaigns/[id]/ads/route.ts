/**
 * THE DESIGNS REPORT — every ad (design) in a campaign with its own spend,
 * leads and cost per lead, plus pause/resume per design.
 *
 * Meta already moves the budget toward the design that converts; this route
 * makes that visible and gives the operator the one control that matters:
 * stop a design that spends without converting.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import {
  getAdResults, getAdDailyInsights, updateAdStatus, isMetaConfigured, MetaApiError,
} from '@/lib/meta/client'
import { readDecay } from '@/lib/freehold/creative-decay'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  if (!(await isMetaConfigured())) return NextResponse.json({ ads: [] })
  try {
    // IS IT STILL WORKING, not what did it average. Every figure on this
    // report is a total over a window, and a total cannot see a creative that
    // worked for a fortnight and has produced nothing since — both fortnights
    // are inside the same number. The day-by-day read is what makes the slope
    // visible; the judgement is pure and lives in creative-decay.ts.
    const [ads, daily] = await Promise.all([
      getAdResults(id),
      getAdDailyInsights().catch(() => new Map()),
    ])
    return NextResponse.json({
      ads: ads.map((a) => {
        const days = daily.get(a.id) ?? []
        const d = readDecay(days)
        return {
          ...a,
          // Counts and words only — the raw daily rows stay on the server. A
          // panel showing four ads has no business shipping thirty days of
          // per-ad numbers to the browser to draw one badge.
          decay: {
            verdict: d.verdict,
            p: d.p,
            survivingShare: d.survivingShare,
            frequencyRise: d.frequencyRise,
            earlyPerMillion: Math.round(d.early.ratePerMillion),
            recentPerMillion: Math.round(d.recent.ratePerMillion),
          },
        }
      }),
    })
  } catch {
    return NextResponse.json({ ads: [] })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(WRITE_ROLES)
  if ('res' in auth) return auth.res
  await params
  let body: { adId?: string; status?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const adId = typeof body.adId === 'string' ? body.adId : ''
  const status = body.status === 'ACTIVE' ? 'ACTIVE' : 'PAUSED'
  if (!adId) return NextResponse.json({ error: 'adId required' }, { status: 400 })
  try {
    await updateAdStatus(adId, status)
    return NextResponse.json({ ok: true, status })
  } catch (error) {
    if (error instanceof MetaApiError) return NextResponse.json({ error: error.message }, { status: 502 })
    return NextResponse.json({ error: 'Could not update the design.' }, { status: 500 })
  }
}
