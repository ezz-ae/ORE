import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { getLeadResponseClocks, getResponseSlaMinutes } from '@/lib/freehold/response-time'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The response-time clock for the CRM: the admin-set SLA target (null when
 * none is set — honest default) plus per-lead first-response clocks for the
 * viewer's open leads (brokers see their own; management sees all).
 */
export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isBroker = user.role === 'broker'
  const brokerId = isBroker ? (user.brokerId ?? user.email) : null

  const [slaMinutes, clocks] = await Promise.all([
    getResponseSlaMinutes(),
    getLeadResponseClocks(brokerId),
  ])
  return NextResponse.json({ slaMinutes, clocks })
}
