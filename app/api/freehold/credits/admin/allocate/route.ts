import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { allocateCredits } from '@/lib/freehold/credits-db'
import { isValidCreditAmount, MAX_CREDIT_AMOUNT } from '@/lib/freehold/credits-shared'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['admin', 'ceo', 'director', 'sales_manager']
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  let body: { brokerId?: string; amount?: number; note?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }

  // Whole positive credits only — a float would be silently rounded by the
  // INTEGER ledger column, and a negative "allocation" would remove credits
  // through a path labelled as granting them.
  if (!body.brokerId || !isValidCreditAmount(body.amount)) {
    return NextResponse.json(
      { error: `brokerId and a whole positive amount (1–${MAX_CREDIT_AMOUNT}) are required` },
      { status: 400 },
    )
  }

  const result = await allocateCredits(body.brokerId, body.amount, body.note ?? 'Manual allocation', user.email)
  if (!result.ok) {
    // Never report a success the ledger did not record — and say which failure
    // it was, so the caller knows whether retrying can help.
    return NextResponse.json(
      {
        error: result.reason === 'invalid'
          ? 'The allocation amount was rejected.'
          : 'The credits were not written to the ledger. Nothing was allocated.',
      },
      { status: result.reason === 'invalid' ? 400 : 500 },
    )
  }
  return NextResponse.json({ ok: true, brokerId: body.brokerId, amount: body.amount })
}
