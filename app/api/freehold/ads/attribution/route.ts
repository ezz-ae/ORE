/**
 * THE CAMPAIGNS NOBODY IS BEING BILLED FOR, AND THE WAY TO FIX THAT.
 *
 * GET  lists every campaign on the ad account with no wallet behind it,
 *      biggest spender first, with what attaching one would cost.
 * POST attaches a wallet.
 *
 * The settlement job bills a campaign only when meta_campaign_brokers carries
 * it, and that row is written by our launch route. On the live account, 8 of 9
 * campaigns were built in Ads Manager and had no row: AED 39,332 of delivered
 * spend that no wallet was charged for, no balance reflected, and the funding
 * brake could never engage on. This route is how that gets closed without
 * relaunching anything.
 *
 * ── SPEND IS READ FROM META, NEVER FROM THE CLIENT ───────────────────────
 *
 * The seeded high-water mark is computed from what the campaign has actually
 * spent, and that figure decides whether the broker is charged nothing or
 * charged thousands. A client-supplied number would let the browser choose how
 * much somebody owes. So it is fetched here, and if Meta cannot be read the
 * attach is refused rather than seeded from a guess — a failed read would
 * otherwise become a zero, and zero means "bill the entire history".
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { listCampaigns, getAccountCampaignInsights } from '@/lib/meta/client'
import { attachWallet, ownerOf } from '@/lib/freehold/campaign-attribution-db'
import {
  BILLING_STARTS, immediateCharge, type BillingStart,
} from '@/lib/freehold/campaign-attribution'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REFUSAL_STATUS: Record<string, number> = {
  insufficient_role: 403,
  no_such_campaign: 404,
  no_such_broker: 404,
  already_attributed: 409,
  spend_unknown: 502,
}

export async function GET() {
  const auth = await requireSession([...MANAGEMENT_ROLES])
  if ('res' in auth) return auth.res

  let campaigns: Awaited<ReturnType<typeof listCampaigns>> = []
  let insights: Awaited<ReturnType<typeof getAccountCampaignInsights>> = new Map()
  try {
    ;[campaigns, insights] = await Promise.all([listCampaigns(), getAccountCampaignInsights()])
  } catch {
    return NextResponse.json({ error: 'Could not read Meta' }, { status: 502 })
  }

  const rows = []
  for (const c of campaigns) {
    if (await ownerOf(c.id)) continue
    const spendAed = Number(insights.get(c.id)?.spend ?? 0)
    rows.push({
      campaignId: c.id,
      name: c.name ?? c.id,
      status: String(c.status ?? ''),
      spendAed: Math.round(spendAed),
      // What attaching WOULD cost under each option, so the screen can say it
      // before the button rather than after.
      chargeIfFromBeginning: immediateCharge('beginning', spendAed),
    })
  }
  rows.sort((a, b) => b.spendAed - a.spendAed)

  return NextResponse.json({
    unattributed: rows.length,
    unattributedAed: rows.reduce((n, r) => n + r.spendAed, 0),
    campaigns: rows,
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession([...MANAGEMENT_ROLES])
  if ('res' in auth) return auth.res

  const body = (await req.json().catch(() => ({}))) as {
    campaignId?: unknown; brokerId?: unknown; start?: unknown
  }
  const campaignId = String(body.campaignId ?? '').trim()
  const brokerId = String(body.brokerId ?? '').trim()
  // DEFAULTS TO 'now'. A missing or unrecognised value must never fall through
  // to charging somebody the whole history of a campaign.
  const start: BillingStart =
    (BILLING_STARTS as readonly string[]).includes(String(body.start)) && body.start === 'beginning'
      ? 'beginning' : 'now'

  if (!campaignId || !brokerId) {
    return NextResponse.json({ error: 'campaignId and brokerId are required' }, { status: 400 })
  }

  // Read the spend HERE. Never accept it from the caller: it decides what the
  // broker owes.
  let spendAed: number | null = null
  try {
    const insights = await getAccountCampaignInsights()
    const found = insights.get(campaignId)
    spendAed = found ? Number(found.spend ?? 0) : 0
  } catch {
    spendAed = null
  }

  const result = await attachWallet(campaignId, brokerId, spendAed, start, {
    email: auth.user.email, role: auth.user.role,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: 'refused', refusal: result.verdict.refusal },
      { status: REFUSAL_STATUS[result.verdict.refusal ?? ''] ?? 400 },
    )
  }

  return NextResponse.json({
    ok: true,
    // The two numbers that matter: where billing now starts, and what the next
    // settlement run will take. Zero on the default, and said either way.
    mark: result.mark,
    chargeOnNextRun: result.charge ?? 0,
  })
}
