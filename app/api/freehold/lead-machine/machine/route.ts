import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { getAutonomyLevel } from '@/lib/freehold/agent-autonomy'
import { listMachineActions, recordMachineAction } from '@/lib/freehold/machine-log'
import { getSpendRules, evaluateSpend } from '@/lib/freehold/spend-governor'
import { updateCampaignStatus as metaUpdateStatus } from '@/lib/meta/client'
import { updateCampaignStatus as googleUpdateStatus, updateCampaignBudget as googleUpdateBudget } from '@/lib/google/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Only marketing + management may move live ad spend — the same gate the proxy
// puts on /api/meta|google writes, enforced here in-handler.
const ADS_ROLES = new Set<string>([...MANAGEMENT_ROLES, 'marketing'])
const BUDGET_STEP = 0.2 // a raise nudges the daily budget +20%
const MIN_BUDGET_AED = 50 // Google's floor

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [actions, autonomy, rules] = await Promise.all([
    listMachineActions(20).catch(() => []),
    getAutonomyLevel().catch(() => 1 as const),
    getSpendRules().catch(() => null),
  ])
  return NextResponse.json({ actions, autonomy, rules, canApply: ADS_ROLES.has(user.role) })
}

export async function POST(request: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADS_ROLES.has(user.role)) {
    return NextResponse.json({ error: 'Only marketing and management can move ad spend.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    action?: string; platform?: string; campaignId?: string; campaignName?: string
    currentDailyAed?: number; currentCpl?: number
  }
  const action = body.action
  const platform = body.platform === 'meta' || body.platform === 'google' ? body.platform : null
  const campaignId = String(body.campaignId ?? '').trim()
  const campaignName = String(body.campaignName ?? '').trim() || campaignId
  if (!platform || !campaignId) {
    return NextResponse.json({ error: 'platform and campaignId are required' }, { status: 400 })
  }

  // ── Pause: reversible, spend-REDUCING, no Governor needed ────────────────────
  if (action === 'pause') {
    try {
      if (platform === 'meta') await metaUpdateStatus(campaignId, 'PAUSED')
      else await googleUpdateStatus(campaignId, 'PAUSED')
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Pause failed at the ad platform.' }, { status: 502 })
    }
    await recordMachineAction({
      action: 'pause', platform, campaignId, campaignName,
      detail: 'Paused the highest cost-per-lead campaign.', by: user.email,
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  }

  // ── Raise budget: spend-INCREASING → the Spend Governor must allow it ────────
  if (action === 'raise_budget') {
    if (platform !== 'google') {
      return NextResponse.json({ error: 'Budget raises are supported on Google campaigns only for now.' }, { status: 400 })
    }
    const currentDaily = Math.max(0, Number(body.currentDailyAed) || 0)
    const currentCpl = Math.max(0, Number(body.currentCpl) || 0)
    const newDaily = Math.max(MIN_BUDGET_AED, Math.round(currentDaily * (1 + BUDGET_STEP)))

    const rules = await getSpendRules()
    const verdict = evaluateSpend(rules, { newDailyAed: newDaily, currentCpl })
    if (!verdict.allowed) {
      // The Governor's refusal is recorded too — a plain-language audit trail.
      await recordMachineAction({
        action: 'raise_blocked', platform, campaignId, campaignName, detail: verdict.reason, by: user.email,
      }).catch(() => {})
      return NextResponse.json({ error: verdict.reason, blocked: true }, { status: 409 })
    }

    try {
      await googleUpdateBudget(campaignId, newDaily)
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Budget change failed at the ad platform.' }, { status: 502 })
    }
    await recordMachineAction({
      action: 'raise_budget', platform, campaignId, campaignName,
      detail: `Raised daily budget to AED ${newDaily}. ${verdict.reason}`, by: user.email,
    }).catch(() => {})
    return NextResponse.json({ ok: true, newDaily })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
