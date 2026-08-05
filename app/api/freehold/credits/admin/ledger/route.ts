import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { getBrokerCreditDetail, ensureCreditsSchema } from '@/lib/freehold/credits-db'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Management drill-down into one broker's credit ledger.
 *
 * Finance can allocate credits and see a balance; without this there was no way
 * to see what a broker actually spent them on, so a disputed balance could not
 * be reconciled from the product at all.
 *
 * Management-only — the same role gate as allocate/tier/balances.
 */
export async function GET(req: Request) {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowedRoles = ['admin', 'ceo', 'director', 'sales_manager']
  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const brokerId = new URL(req.url).searchParams.get('brokerId')?.trim()
  if (!brokerId) return NextResponse.json({ error: 'brokerId is required' }, { status: 400 })

  await ensureCreditsSchema()

  // Ledger rows were historically booked under either the user id or the login
  // email, so read under both identities — otherwise half a broker's history
  // silently disappears.
  const identities = new Set<string>([brokerId])
  const rows = await query<{ id: string; email: string }>(
    `SELECT id, email FROM freehold_site_users WHERE id = $1 OR email = $1 LIMIT 1`,
    [brokerId],
  ).catch(() => [])
  if (rows[0]) { identities.add(rows[0].id); identities.add(rows[0].email) }

  const { ledger, allocations } = await getBrokerCreditDetail([...identities])
  return NextResponse.json({ brokerId, ledger, allocations })
}
