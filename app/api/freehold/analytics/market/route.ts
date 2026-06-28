import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { getMarketStats } from '@/lib/market-stats'

export const dynamic = 'force-dynamic'

// Market analytics is for management + marketing — not individual brokers.
const ALLOWED = new Set(['admin', 'ceo', 'director', 'marketing'])

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED.has(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const stats = await getMarketStats()
    return NextResponse.json({ stats })
  } catch {
    return NextResponse.json({ stats: null }, { status: 200 })
  }
}
