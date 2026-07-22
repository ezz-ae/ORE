import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { getSpendRules, setSpendRules } from '@/lib/freehold/spend-governor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rules = await getSpendRules()
  return NextResponse.json({ rules, canEdit: MANAGEMENT_ROLES.includes(user.role) })
}

// Only management sets the spend rule — the deterministic guardrail can never be
// escalated by a marketer or the model.
export async function PUT(request: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!MANAGEMENT_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Only management can set the spend rule.' }, { status: 403 })
  }
  const body = await request.json().catch(() => ({})) as { enabled?: boolean; maxDailyAed?: number; cplCeilingAed?: number }
  await setSpendRules(
    { enabled: !!body.enabled, maxDailyAed: Number(body.maxDailyAed) || 0, cplCeilingAed: Number(body.cplCeilingAed) || 0 },
    user.email,
  )
  return NextResponse.json({ rules: await getSpendRules() })
}
