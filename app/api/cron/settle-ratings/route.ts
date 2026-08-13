/**
 * PAYING THE RATINGS THAT TURNED OUT RIGHT.
 *
 * A rating is a forecast, and a forecast cannot be judged the morning after.
 * This runs daily and settles the claims that have come of age — against the
 * ACCOUNT'S OWN sales cycle where it has one, because a brokerage whose leads
 * take six weeks to qualify should not have its forecasts marked in seven days.
 *
 * A claim that is simply not old enough stays open. It is a "come back later",
 * not a verdict, and marking it would deny somebody a point they had not yet
 * earned or lost.
 */
import { NextRequest, NextResponse } from 'next/server'
import { settleDueClaims } from '@/lib/freehold/points-db'
import { accountMoneyBasis } from '@/lib/freehold/money-truth-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // The account's own measured days-to-qualify, from its closed history. Falls
  // back to the stated default when it has not closed enough to measure one —
  // see money-truth.ts, which owns that number so a report and a payout cannot
  // disagree about how long a lead takes.
  const basis = await accountMoneyBasis().catch(() => null)
  const settled = await settleDueClaims({ seasonDays: basis?.cycle.daysToQualify })

  const paid = settled.filter((s) => s.points > 0)
  const byVerdict: Record<string, number> = {}
  for (const s of settled) byVerdict[s.verdict] = (byVerdict[s.verdict] ?? 0) + 1

  return NextResponse.json({
    settled: settled.length,
    pointsReturned: paid.reduce((n, s) => n + s.points, 0),
    brokersPaid: new Set(paid.map((s) => s.brokerId)).size,
    // Never a bare count: which way the settlements went is the whole story,
    // and "50 settled" reads as success whether or not anybody was paid.
    byVerdict,
    seasonDays: basis?.cycle.daysToQualify ?? null,
    measuredOn: basis?.cycle.measuredOn ?? 0,
  })
}
