import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import {
  getCampaignGroup, renameCampaignGroup, addGroupMember, removeGroupMember, deleteCampaignGroup, filterOwnedCampaigns,
} from '@/lib/meta/campaign-groups'
import { listCampaigns, getCampaignInsights, getAccountCampaignInsights, listAdSets, listAds, MetaConfigError, MetaApiError } from '@/lib/meta/client'
import { listLocalCampaigns } from '@/lib/meta/local-store'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'
import type { MetaInsights } from '@/lib/meta/types'
import { metaLeadCount } from '@/lib/meta/lead-count'
import { deliveryOf } from '@/lib/meta/delivery-status'

// Run async work with a concurrency cap, so a big group doesn't fan out hundreds
// of simultaneous Meta insight calls and trip the rate limiter.
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return out
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CampaignLite = {
  name: string
  /** The switch somebody flipped. */
  status: string
  /** WHAT META IS DOING — the only honest source for an arm's badge. An arm
   *  reads ACTIVE while Meta has it in review, has rejected its ad, or is
   *  refusing to deliver it, and a group comparing arms on the wrong word
   *  compares a running arm against one that never ran. */
  effectiveStatus?: string
  /** Meta's own faults on this arm. Any entry means it will not deliver. */
  blocked: boolean
  objective: string
  insights: MetaInsights | null
  insightsError: boolean
}

/**
 * Resolve every campaign the account can see (Meta live, else the local store)
 * into a lite map, WITH ITS NUMBERS — every one of them, not just the active
 * ones.
 *
 * A group exists to compare arms. Attaching insights only to the ACTIVE arms
 * meant the arm somebody switched off — usually the LOSER, which is the whole
 * point of the comparison — showed nothing at all, so the group read as though
 * only the survivor had ever run. And the rolling 30-day window drains after
 * an arm stops, so even a recent loser trends to zero within the month.
 *
 * One account-level call at the lifetime window answers for all of them: the
 * same read the campaigns list and the campaign page use, so no two screens
 * disagree about what an arm did.
 */
async function campaignMap(): Promise<Map<string, CampaignLite>> {
  const map = new Map<string, CampaignLite>()
  try {
    const campaigns = await listCampaigns()
    for (const c of campaigns) {
      const issues = (c as { issues_info?: unknown[] }).issues_info
      map.set(c.id, {
        name: c.name,
        status: c.status,
        effectiveStatus: (c as { effective_status?: string }).effective_status,
        blocked: Array.isArray(issues) && issues.length > 0,
        objective: c.objective,
        insights: null,
        insightsError: false,
      })
    }
    // A FAILED insights read is not "AED 0" — the arms render "—"
    // (unavailable) rather than fabricating a zero as a real number.
    // getAccountCampaignInsights swallows its own errors and returns an empty
    // map, so an empty map after a SUCCESSFUL listCampaigns means the read
    // failed rather than that nothing has ever delivered.
    const byCampaign = await getAccountCampaignInsights()
    const readFailed = byCampaign.size === 0 && map.size > 0
    for (const [id, entry] of map) {
      if (readFailed) { entry.insightsError = true; continue }
      // Absent means this arm never delivered — null, not a zeroed row.
      entry.insights = byCampaign.get(id) ?? null
    }
  } catch (err) {
    if (err instanceof MetaConfigError) {
      for (const c of await listLocalCampaigns()) {
        map.set(c.id, { name: c.name, status: c.status, blocked: false, objective: c.objective, insights: null, insightsError: false })
      }
    }
  }
  return map
}

const metaLeads = (ins: MetaInsights | null) => metaLeadCount(ins?.actions)

const filsToAed = (v: string | undefined | null) => (v ? Number(v) / 100 : 0)
// Spend/leads/CPL for any node id (campaign, ad set, or ad) — the /{id}/insights
// endpoint is generic. Returns zeros when Meta is off or the node is inactive.
async function nodeMetrics(id: string): Promise<{ spendAED: number; leads: number; cpl: number }> {
  try {
    const ins = await getCampaignInsights(id)
    const spendAED = Number(ins?.spend) || 0
    const leads = metaLeads(ins)
    return { spendAED, leads, cpl: leads > 0 ? spendAED / leads : 0 }
  } catch {
    return { spendAED: 0, leads: 0, cpl: 0 }
  }
}

// The 3-level rollup for one campaign: ad sets (audience/language) → ads
// (creative). Live from Meta with a bounded fan-out. `error: true` distinguishes
// a Meta failure (show "unavailable") from a genuinely empty campaign.
async function campaignRollup(campaignId: string): Promise<{ adSets: unknown[]; error: boolean }> {
  try {
    const adSets = await listAdSets(campaignId)
    const rows = await mapLimit(adSets, 4, async (as) => {
      const [m, ads] = await Promise.all([nodeMetrics(as.id), listAds(as.id).catch(() => [])])
      const adRows = await mapLimit(ads, 4, async (ad) => ({
        id: ad.id, name: ad.name, status: ad.status, ...(await nodeMetrics(ad.id)),
      }))
      return { id: as.id, name: as.name, status: as.status, dailyBudgetAED: filsToAed(as.daily_budget), ...m, ads: adRows }
    })
    return { adSets: rows, error: false }
  } catch (err) {
    // Meta rate-limit / API / transport error is NOT "no ad sets" — flag it so the
    // UI says "unavailable" instead of implying the campaign is empty. Only a
    // genuine not-connected (MetaConfigError) is a legitimately empty structure
    // (e.g. a local/demo campaign), so everything ELSE is treated as a failure.
    return { adSets: [], error: !(err instanceof MetaConfigError) }
  }
}

// GET → the group plus a per-arm comparison (spend / leads / CPL from Meta,
// funnel + quality score from our CRM). No fabricated numbers: unattributed
// arms report null quality and 0 spend/leads.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  const group = await getCampaignGroup(id)
  if (!group || group.createdBy !== auth.user.email) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  const cmap = await campaignMap()
  const members = await Promise.all(
    group.members.map(async (m) => {
      const c = cmap.get(m.campaignId)
      const name = c?.name || m.campaignId
      const spendAED = Number(c?.insights?.spend) || 0
      const leads = metaLeads(c?.insights ?? null)
      const cpl = leads > 0 ? spendAED / leads : 0
      const [quality, rollup] = await Promise.all([
        getCampaignQuality(m.campaignId, name),
        campaignRollup(m.campaignId),
      ])
      return {
        campaignId: m.campaignId,
        label: m.label,
        objective: m.objective || c?.objective || '',
        name,
        status: c?.status || 'UNKNOWN',
        running: c?.status === 'ACTIVE',
        // Meta's real state travels with the arm so the group's badge cannot
        // say "running" about an arm Meta has stopped. A fault outranks the
        // status word, because a fault is what explains a zero.
        state: c?.blocked
          ? 'issue'
          : deliveryOf({
              effectiveStatus: c?.effectiveStatus,
              status: c?.status,
              impressions: Number(c?.insights?.impressions) || 0,
            }).state,
        spendAED, leads, cpl,
        metricsError: c?.insightsError ?? false, // true = Meta failure; show "—", not a real 0
        quality,
        adSets: rollup.adSets, // 3-level rollup: ad sets (audience/language) → ads (creative)
        rollupError: rollup.error, // true = Meta failure, not an empty campaign
      }
    }),
  )

  // Winners are computed, never guessed: cheapest real CPL, and best CRM quality.
  const withCpl = members.filter((m) => m.cpl > 0)
  const bestCplId = withCpl.length ? withCpl.reduce((a, b) => (a.cpl <= b.cpl ? a : b)).campaignId : null
  const withScore = members.filter((m) => m.quality.score !== null)
  const bestQualityId = withScore.length ? withScore.reduce((a, b) => ((a.quality.score ?? 0) >= (b.quality.score ?? 0) ? a : b)).campaignId : null

  return NextResponse.json({
    group: { id: group.id, name: group.name, projectSlug: group.projectSlug, createdAt: group.createdAt },
    members,
    totals: {
      spendAED: members.reduce((s, m) => s + m.spendAED, 0),
      leads: members.reduce((s, m) => s + m.leads, 0),
    },
    winners: { cpl: bestCplId, quality: bestQualityId },
  })
}

// PATCH → { action: 'rename' | 'addMember' | 'removeMember', ... }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  const group = await getCampaignGroup(id)
  if (!group || group.createdBy !== auth.user.email) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    action?: string; name?: string; campaignId?: string; objective?: string; label?: string
  }
  const action = String(body.action ?? '')
  try {
    if (action === 'rename') {
      const name = String(body.name ?? '').trim()
      if (!name) return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
      await renameCampaignGroup(id, name)
    } else if (action === 'addMember') {
      const campaignId = String(body.campaignId ?? '').trim()
      if (!campaignId) return NextResponse.json({ error: 'campaignId is required.' }, { status: 400 })
      // A broker may only fold in a campaign attributed to them (managers: any).
      const isManager = (MANAGEMENT_ROLES as readonly string[]).includes(auth.user.role)
      if (!isManager) {
        const owned = await filterOwnedCampaigns(auth.user.brokerId ?? auth.user.email, [campaignId])
        if (!owned.has(campaignId)) return NextResponse.json({ error: 'That campaign is not yours to add.' }, { status: 403 })
      }
      await addGroupMember(id, campaignId, String(body.objective ?? ''), String(body.label ?? ''))
    } else if (action === 'removeMember') {
      const campaignId = String(body.campaignId ?? '').trim()
      if (!campaignId) return NextResponse.json({ error: 'campaignId is required.' }, { status: 400 })
      await removeGroupMember(id, campaignId)
    } else {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Could not update the group.' }, { status: 500 })
  }
  return NextResponse.json({ group: await getCampaignGroup(id) })
}

// DELETE → remove the group (members are unlinked, campaigns are untouched).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  const group = await getCampaignGroup(id)
  if (!group || group.createdBy !== auth.user.email) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }
  await deleteCampaignGroup(id)
  return NextResponse.json({ ok: true })
}
