/**
 * WHEN THE GOOD LEADS ARRIVE — and whether a bad hour is a bad hour.
 *
 * Nothing in this product reads the clock. This route reads it once, over the
 * whole account rather than per campaign: an hour pattern is a property of the
 * market and the desk, not of one ad set, and slicing it per campaign would
 * leave every bucket too thin to say anything.
 *
 * The judgement is pure and lives in lib/freehold/hour-truth.ts. This route
 * only fetches.
 */
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { hourLeads, HOUR_LOOKBACK_DAYS } from '@/lib/freehold/hour-truth-db'
import { readDay, scheduleFrom, hoursOf, BLOCK_HOURS } from '@/lib/freehold/hour-truth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  const leads = await hourLeads()
  const readings = readDay(leads)
  const schedule = scheduleFrom(readings)

  return NextResponse.json({
    lookbackDays: HOUR_LOOKBACK_DAYS,
    total: leads.length,
    blocks: readings.map((r) => ({
      ...r,
      hours: BLOCK_HOURS[r.block],
      // A percentage is what the screen shows; the rate is what the test used.
      ratePct: r.rate === null ? null : Math.round(r.rate * 100),
    })),
    // null means RUN ALL DAY, not "no hours" — see scheduleFrom.
    schedule,
    scheduleHours: schedule ? hoursOf(schedule) : null,
  })
}
