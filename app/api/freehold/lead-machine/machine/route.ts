import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { getAutonomyLevel } from '@/lib/freehold/agent-autonomy'
import { listMachineActions, recordMachineAction } from '@/lib/freehold/machine-log'
import { updateCampaignStatus as metaUpdateStatus, getAdSet, updateAdSet } from '@/lib/meta/client'
import { updateCampaignStatus as googleUpdateStatus } from '@/lib/google/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Only marketing + management may move live ad spend — the same gate the proxy
// puts on /api/meta|google writes, enforced here in-handler.
const ADS_ROLES = new Set<string>([...MANAGEMENT_ROLES, 'marketing'])

export async function GET() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const [actions, autonomy] = await Promise.all([
    listMachineActions(20).catch(() => []),
    getAutonomyLevel().catch(() => 1 as const),
  ])
  return NextResponse.json({ actions, autonomy, canApply: ADS_ROLES.has(user.role) })
}

export async function POST(request: NextRequest) {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ADS_ROLES.has(user.role)) {
    return NextResponse.json({ error: 'Only marketing and management can move ad spend.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({})) as {
    action?: string; platform?: string; campaignId?: string; campaignName?: string
    adSetId?: string; dailyBudgetAED?: number
  }
  const action = body.action
  const platform = body.platform === 'meta' || body.platform === 'google' ? body.platform : null
  const campaignId = String(body.campaignId ?? '').trim()
  const campaignName = String(body.campaignName ?? '').trim() || campaignId
  if (!platform || !campaignId) {
    return NextResponse.json({ error: 'platform and campaignId are required' }, { status: 400 })
  }

  // Pause/resume an underperformer — fully reversible status flips.
  if (action === 'pause' || action === 'resume') {
    try {
      if (platform === 'meta') await metaUpdateStatus(campaignId, action === 'pause' ? 'PAUSED' : 'ACTIVE')
      else await googleUpdateStatus(campaignId, action === 'pause' ? 'PAUSED' : 'ENABLED')
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : `${action} failed at the ad platform.` }, { status: 502 })
    }
    await recordMachineAction({
      action, platform, campaignId, campaignName,
      detail: action === 'pause' ? 'Paused the highest cost-per-lead campaign.' : 'Resumed the campaign.',
      by: user.email,
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  }

  // Budget shift — the recommendation the optimizer could never execute. Meta
  // ad sets only, and the server clamps to ±30% of the CURRENT budget (min
  // AED 50) against a fresh read, the same guardrail the advisor promises —
  // a stale or malicious client cannot move more.
  if (action === 'set_budget') {
    const adSetId = String(body.adSetId ?? '').trim()
    const requested = Math.round(Number(body.dailyBudgetAED))
    if (platform !== 'meta' || !adSetId || !Number.isFinite(requested) || requested <= 0) {
      return NextResponse.json({ error: 'set_budget needs platform=meta, adSetId and a positive dailyBudgetAED' }, { status: 400 })
    }
    let currentAED = 0
    try {
      const set = await getAdSet(adSetId)
      currentAED = set.daily_budget ? Math.round(Number(set.daily_budget) / 100) : 0
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not read the ad set.' }, { status: 502 })
    }
    if (currentAED <= 0) {
      return NextResponse.json({ error: 'This ad set has no daily budget to adjust (campaign-level budget).' }, { status: 400 })
    }
    const lo = Math.max(50, Math.round(currentAED * 0.7))
    const hi = Math.round(currentAED * 1.3)
    const applied = Math.min(hi, Math.max(lo, requested))
    if (applied === currentAED) {
      return NextResponse.json({ ok: true, appliedAED: currentAED, unchanged: true })
    }
    try {
      await updateAdSet(adSetId, { dailyBudgetAED: applied })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Budget update failed at the ad platform.' }, { status: 502 })
    }
    await recordMachineAction({
      action: 'set_budget', platform, campaignId, campaignName,
      detail: `Ad set budget AED ${currentAED} → AED ${applied}${applied !== requested ? ` (requested ${requested}, clamped ±30%)` : ''}.`,
      by: user.email,
    }).catch(() => {})
    return NextResponse.json({ ok: true, appliedAED: applied, clamped: applied !== requested })
  }

  return NextResponse.json({ error: 'action must be pause, resume or set_budget' }, { status: 400 })
}
