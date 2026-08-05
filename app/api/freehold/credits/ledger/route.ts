import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { readCreditLedger, getAdSpendAllocations } from '@/lib/freehold/credits-db'

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

  const [ledgerResult, allocations] = await Promise.all([
    readCreditLedger(brokerId),
    getAdSpendAllocations(brokerId),
  ])
  // An empty history and a failed query must never look the same to the broker.
  if (!ledgerResult.ok) {
    return NextResponse.json({ error: 'Could not read the credit history.' }, { status: 503 })
  }
  return NextResponse.json({ ledger: ledgerResult.ledger, allocations, brokerId })
}
