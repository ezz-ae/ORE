import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import {
  getCampaignGroup, renameCampaignGroup, addGroupMember, removeGroupMember, deleteCampaignGroup,
} from '@/lib/meta/campaign-groups'
import { listCampaigns, getCampaignInsights, MetaConfigError } from '@/lib/meta/client'
import { listLocalCampaigns } from '@/lib/meta/local-store'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'
import type { MetaInsights } from '@/lib/meta/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type CampaignLite = { name: string; status: string; objective: string; insights: MetaInsights | null }

// Resolve every campaign the account can see (Meta live, else the local store)
// into a lite map, with insights attached for the active ones.
async function campaignMap(): Promise<Map<string, CampaignLite>> {
  const map = new Map<string, CampaignLite>()
  try {
    const campaigns = await listCampaigns()
    for (const c of campaigns) map.set(c.id, { name: c.name, status: c.status, objective: c.objective, insights: null })
    await Promise.all(
      [...map.entries()].map(async ([id, entry]) => {
        if (entry.status === 'ACTIVE') {
          try { entry.insights = await getCampaignInsights(id) } catch { /* leave null */ }
        }
      }),
    )
  } catch (err) {
    if (err instanceof MetaConfigError) {
      for (const c of await listLocalCampaigns()) {
        map.set(c.id, { name: c.name, status: c.status, objective: c.objective, insights: null })
      }
    }
  }
  return map
}

const metaLeads = (ins: MetaInsights | null) =>
  (ins?.actions ?? []).filter((a) => a.action_type.includes('lead')).reduce((s, a) => s + (Number(a.value) || 0), 0)

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
      const quality = await getCampaignQuality(m.campaignId, name)
      return {
        campaignId: m.campaignId,
        label: m.label,
        objective: m.objective || c?.objective || '',
        name,
        status: c?.status || 'UNKNOWN',
        running: c?.status === 'ACTIVE',
        spendAED, leads, cpl,
        quality,
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
