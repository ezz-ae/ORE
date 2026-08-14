/**
 * BILLING THE ADS FOR WHAT THEY ACTUALLY SPENT.
 *
 * Nothing is reserved at launch any more (see app/api/meta/launch), so this job
 * is BOTH the bill and the brake. It reads what Meta says every campaign has
 * spent, moves that money out of the launcher's wallet in whole steps of AED 10,
 * and pauses any campaign whose owner can no longer cover what it is
 * delivering.
 *
 * It is safe to run on a timer nobody watches, because every figure it works
 * with is a TOTAL rather than a change: a missed run catches up on the next
 * one, a repeated run moves nothing, and a crash halfway is repaired by running
 * again. That property lives in ad-settlement.ts and is the only reason a job
 * like this can be trusted with a wallet.
 *
 * ── IT SHOULD RUN OFTEN ──────────────────────────────────────────────────
 *
 * Every unbilled dirham is money the company has already paid Meta. Hourly is
 * the intent; the exposure between runs is roughly what the account can spend
 * in that hour, which is the honest way to choose the interval.
 *
 * ── AND IT NEVER PAUSES FOR A READ FAILURE ───────────────────────────────
 *
 * A campaign is paused only when the settlement says the wallet came up short.
 * If Meta cannot be reached, or a wallet cannot be read, nothing is paused —
 * stopping a working campaign because our own query failed would cost a broker
 * their leads for a fault that was never theirs.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAccountCampaignInsights, listCampaigns, updateCampaignStatus } from '@/lib/meta/client'
import { settleCampaign, type SpendReport } from '@/lib/freehold/ad-settlement-db'
import { query } from '@/lib/db'
import type { Role } from '@/lib/freehold/session-types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** Who pays for a campaign — written by the launch route at attribution time. */
async function ownersByCampaign(): Promise<Map<string, string>> {
  try {
    const rows = await query<{ campaign_id: string; broker_id: string }>(
      `SELECT campaign_id, broker_id FROM meta_campaign_brokers`,
    )
    return new Map(rows.map((r) => [String(r.campaign_id), String(r.broker_id)]))
  } catch { return new Map() }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let campaigns: Awaited<ReturnType<typeof listCampaigns>> = []
  let insights: Awaited<ReturnType<typeof getAccountCampaignInsights>> = new Map()
  try {
    ;[campaigns, insights] = await Promise.all([listCampaigns(), getAccountCampaignInsights()])
  } catch {
    // Meta unreachable. Bill nothing, pause nothing, and say so — a run that
    // reports "0 settled" for a connection failure reads as a quiet night.
    return NextResponse.json({ error: 'Could not read Meta', settled: 0, paused: 0 }, { status: 502 })
  }

  const owners = await ownersByCampaign()
  const outcomes = []

  for (const c of campaigns) {
    const owner = owners.get(c.id)
    // UNATTRIBUTED CAMPAIGNS ARE THE COMPANY'S OWN. There is no wallet to bill
    // and no broker to pause, and inventing one would take money from whoever
    // happened to be first in the table.
    if (!owner) continue

    const spendAed = Number(insights.get(c.id)?.spend ?? 0)
    if (!Number.isFinite(spendAed) || spendAed <= 0) continue

    const report: SpendReport = {
      campaignId: c.id,
      platform: 'meta',
      campaignName: c.name,
      adAccountId: process.env.META_AD_ACCOUNT_ID ?? null,
      spendAed,
      ownerId: owner,
      // The wallet's owner is a broker by construction — attribution is written
      // from a broker session. Stated rather than looked up, because a role
      // read that failed would silently change what the settlement is allowed
      // to do.
      ownerRole: 'broker' as Role,
    }

    const outcome = await settleCampaign(report, async (r) => {
      // Only reached when the wallet came up short. Already-paused campaigns
      // are asked again and Meta answers idempotently, which is cheaper than
      // tracking whether we asked last hour.
      const res = await updateCampaignStatus(r.campaignId, 'PAUSED').catch(() => null)
      return !!res?.success
    }).catch(() => null)

    if (outcome) outcomes.push(outcome)
  }

  const moved = outcomes.reduce((n, o) => n + o.movedAed, 0)
  const short = outcomes.reduce((n, o) => n + o.shortfallAed, 0)

  return NextResponse.json({
    campaigns: outcomes.length,
    // What was billed, and — the number that matters more — what could not be.
    // Unbilled spend is money the company has already paid Meta, so a run that
    // reported only its successes would hide its own loss.
    settledAed: moved,
    unbilledAed: short,
    paused: outcomes.filter((o) => o.paused).length,
    restated: outcomes.filter((o) => o.verdict === 'restated').length,
    outcomes,
  })
}
