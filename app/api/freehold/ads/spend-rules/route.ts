import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { listSpendRules, upsertSpendRule } from '@/lib/meta/spend-rules'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Admin-only: the autonomous-spend rules that bound what the AI may fund on its
// own ("up to X/day if CPL < Y, quality ≥ Z, leads ≥ N").
export async function GET() {
  const auth = await requireSession(MANAGEMENT_ROLES)
  if ('res' in auth) return auth.res
  return NextResponse.json({ rules: await listSpendRules() })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(MANAGEMENT_ROLES)
  if ('res' in auth) return auth.res
  const body = (await req.json().catch(() => ({}))) as {
    id?: string; enabled?: boolean; scope?: string
    maxDailyBudgetAED?: number; maxIncreasePerActionAED?: number
    requireCplBelowAED?: number; requireQualityAtLeast?: number; requireMinLeads?: number
  }
  const maxDaily = Number(body.maxDailyBudgetAED)
  const maxInc = Number(body.maxIncreasePerActionAED)
  if (!Number.isFinite(maxDaily) || maxDaily <= 0 || !Number.isFinite(maxInc) || maxInc <= 0) {
    return NextResponse.json({ error: 'A daily ceiling and a per-move ceiling (both > 0) are required.' }, { status: 400 })
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  const rule = await upsertSpendRule(
    {
      id: body.id,
      enabled: body.enabled ?? true,
      scope: body.scope && body.scope !== 'all' ? body.scope : 'all',
      maxDailyBudgetAED: maxDaily,
      maxIncreasePerActionAED: maxInc,
      requireCplBelowAED: num(body.requireCplBelowAED),
      requireQualityAtLeast: num(body.requireQualityAtLeast),
      requireMinLeads: num(body.requireMinLeads),
    },
    auth.user.email,
  )
  if (!rule) return NextResponse.json({ error: 'Could not save the rule.' }, { status: 500 })
  return NextResponse.json({ rule }, { status: 201 })
}
