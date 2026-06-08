import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { getIntegrationStatusSummary } from '@/lib/freehold/integration-status'

export const dynamic = 'force-dynamic'

/**
 * Live integration status — reflects real env configuration at runtime.
 * Restricted to management roles (integrations expose operational posture).
 * Never returns secret values, only which keys are present/missing.
 */
export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  const user = await verifySession(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = ['admin', 'ceo', 'director', 'sales_manager', 'marketing']
  if (!allowed.includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const summary = getIntegrationStatusSummary()
  return NextResponse.json(summary)
}
