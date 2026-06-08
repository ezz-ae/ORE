import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { allocateCredits } from '@/lib/freehold/credits-db'

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

  if (!body.brokerId || !body.amount || body.amount <= 0) {
    return NextResponse.json({ error: 'brokerId and positive amount required' }, { status: 400 })
  }

  const result = await allocateCredits(body.brokerId, body.amount, body.note ?? 'Manual allocation', user.email)
  if (!result.ok) return NextResponse.json({ error: 'Allocation failed' }, { status: 500 })
  return NextResponse.json({ ok: true, brokerId: body.brokerId, amount: body.amount })
}
