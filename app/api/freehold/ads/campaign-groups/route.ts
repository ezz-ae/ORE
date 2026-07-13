import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { listCampaignGroups, createCampaignGroup, filterOwnedCampaigns } from '@/lib/meta/campaign-groups'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  → the caller's campaign groups (each with its member arms).
export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  return NextResponse.json({ groups: await listCampaignGroups(auth.user.email) })
}

// POST → create a group. Body: { name, projectSlug?, members?: [{campaignId, objective?, label?}] }
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    projectSlug?: string
    members?: Array<{ campaignId?: string; objective?: string; label?: string }>
  }
  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'A group name is required.' }, { status: 400 })
  const members = (body.members ?? [])
    .filter((m) => m && typeof m.campaignId === 'string' && m.campaignId.trim())
    .map((m) => ({ campaignId: String(m.campaignId).trim(), objective: m.objective, label: m.label }))
  // A broker may only fold in campaigns attributed to them (managers: any).
  const isManager = (MANAGEMENT_ROLES as readonly string[]).includes(auth.user.role)
  if (!isManager && members.length) {
    const owned = await filterOwnedCampaigns(auth.user.brokerId ?? auth.user.email, members.map((m) => m.campaignId))
    const foreign = members.find((m) => !owned.has(m.campaignId))
    if (foreign) return NextResponse.json({ error: 'You can only group your own campaigns.' }, { status: 403 })
  }
  const group = await createCampaignGroup(auth.user.email, { name, projectSlug: body.projectSlug, members })
  if (!group) return NextResponse.json({ error: 'Could not create the group.' }, { status: 500 })
  return NextResponse.json({ group }, { status: 201 })
}
