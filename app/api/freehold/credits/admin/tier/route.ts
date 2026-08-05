import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { setBrokerTier } from '@/lib/freehold/credits-db'
import { isCreditTier, CREDIT_TIERS } from '@/lib/freehold/credits-shared'

export const dynamic = 'force-dynamic'

export async function PATCH(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['admin', 'ceo', 'director', 'sales_manager']
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  let body: { brokerId?: string; tier?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }

  if (!body.brokerId || !isCreditTier(body.tier)) {
    return NextResponse.json(
      { error: `brokerId and a valid tier (${CREDIT_TIERS.join(' | ')}) are required` },
      { status: 400 }
    )
  }

  const result = await setBrokerTier(body.brokerId, body.tier)
  if (!result.ok) {
    return NextResponse.json({ error: 'The tier was not saved. Please try again.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, brokerId: body.brokerId, tier: body.tier })
}
