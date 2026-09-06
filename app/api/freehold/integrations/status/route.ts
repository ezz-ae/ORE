import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { getIntegrationStatusSummary, metaConnectionHeartbeat } from '@/lib/freehold/integration-status'

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

  // This page exists to answer "is it actually working?", so it pays for the
  // real check. Presence-only status is what let a rejected Meta token read as
  // green here while every campaign call failed.
  // TWO DIFFERENT QUESTIONS, ANSWERED SEPARATELY.
  //
  // The probe says whether the token works right now. The heartbeat says when
  // the machine last actually reached the account — and a green probe beside a
  // stale heartbeat means the cron stopped, not the connection. Those need
  // opposite fixes, so they are never merged into one "connected" light.
  const [summary, heartbeat] = await Promise.all([
    getIntegrationStatusSummary({ probe: true }),
    metaConnectionHeartbeat(),
  ])
  return NextResponse.json({ ...summary, metaHeartbeat: heartbeat })
}
