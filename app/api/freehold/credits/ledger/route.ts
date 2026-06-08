import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { getCreditLedger, getAdSpendAllocations } from '@/lib/freehold/credits-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brokerId = user.role === 'broker'
    ? (user.brokerId ?? user.email)
    : null
  if (!brokerId) return NextResponse.json({ error: 'Not a broker account' }, { status: 403 })

  const [ledger, allocations] = await Promise.all([
    getCreditLedger(brokerId),
    getAdSpendAllocations(brokerId),
  ])
  return NextResponse.json({ ledger, allocations, brokerId })
}
