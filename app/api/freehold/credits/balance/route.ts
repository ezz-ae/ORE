import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { readCreditBalance, ensureCreditsSchema } from '@/lib/freehold/credits-db'

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

  await ensureCreditsSchema()
  const result = await readCreditBalance(brokerId)
  // A failed read must not render as "no credits yet" — that is a wrong number
  // on a money screen. Fail loudly so the page can say it could not load.
  if (!result.ok) {
    return NextResponse.json({ error: 'Could not read the credit balance.' }, { status: 503 })
  }
  return NextResponse.json({ balance: result.balance, brokerId })
}
