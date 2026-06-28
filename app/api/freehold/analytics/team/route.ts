import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { gatherTeamMetrics } from '@/lib/freehold/team-metrics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Team performance is management-only.
const ALLOWED = new Set(['admin', 'ceo', 'director', 'sales_manager'])

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED.has(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const agents = await gatherTeamMetrics()
    return NextResponse.json({ agents })
  } catch {
    return NextResponse.json({ agents: [] })
  }
}
