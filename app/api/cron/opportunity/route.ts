import { NextRequest, NextResponse } from 'next/server'
import { recomputeOpportunityScores } from '@/lib/freehold/opportunity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Daily Opportunity Engine refresh (Vercel Cron). Recomputes every project's
 * opportunity score from the platform's real stored data and rewrites the
 * freehold_site_opportunity_scores table, so dashboards serve a fresh
 * computed_at each morning. Auth mirrors app/api/cron/ads-machine:
 * CRON_SECRET bearer token.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get('authorization') || ''
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const scores = await recomputeOpportunityScores()
    return NextResponse.json({
      ok: true,
      computed: scores.length,
      scored: scores.filter((s) => s.score !== null).length,
      insufficientData: scores.filter((s) => s.score === null).length,
    })
  } catch (err) {
    // DB unreachable — an honest failure, not a fake success.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Recompute failed' },
      { status: 500 },
    )
  }
}
