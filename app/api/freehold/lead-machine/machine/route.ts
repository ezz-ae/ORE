import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { getAutonomyLevel } from '@/lib/freehold/agent-autonomy'
import { listMachineActions, recordMachineAction } from '@/lib/freehold/machine-log'
import { updateCampaignStatus as metaUpdateStatus } from '@/lib/meta/client'
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
  }
  const action = body.action
  const platform = body.platform === 'meta' || body.platform === 'google' ? body.platform : null
  const campaignId = String(body.campaignId ?? '').trim()
  const campaignName = String(body.campaignName ?? '').trim() || campaignId
  if (action !== 'pause' || !platform || !campaignId) {
    return NextResponse.json({ error: 'action=pause, platform and campaignId are required' }, { status: 400 })
  }

  // The one action the Machine applies for real today: pause an underperformer.
  // Fully reversible (resume from the campaigns list), and it moves no money the
  // wrong way — it stops the worst spender. Budget re-allocation stays a
  // recommendation until scheduled autopilot (needs the cron) lands.
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
