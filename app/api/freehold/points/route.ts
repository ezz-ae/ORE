/**
 * WHAT RATING HAS EARNED THIS BROKER, and what is still waiting to be judged.
 *
 * A scheme nobody can see the results of is a scheme nobody trusts. Every
 * verdict comes back by name — including the ones that paid nothing — because
 * "you earned 4 points" without "and 6 calls were wrong" is a scoreboard with
 * half the score missing.
 */
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { ratingEarnings } from '@/lib/freehold/points-db'
import { getCreditBalance } from '@/lib/freehold/credits-db'
import { refundCeiling, POINTS_PER_ACCURATE_RATING } from '@/lib/freehold/points'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const brokerId = auth.user.brokerId ?? auth.user.email

  const [earnings, balance] = await Promise.all([
    ratingEarnings(brokerId),
    getCreditBalance(brokerId).catch(() => null),
  ])

  const ceiling = refundCeiling(balance?.total_spent ?? 0)
  return NextResponse.json({
    ...earnings,
    perRating: POINTS_PER_ACCURATE_RATING,
    balance: balance?.balance ?? null,
    // What is left to earn this cycle. A broker who has hit the ceiling should
    // be told so rather than left wondering why accurate calls stopped paying.
    ceiling,
    remaining: Math.max(0, ceiling - earnings.paid),
  })
}
