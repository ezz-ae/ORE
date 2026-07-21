import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { getMachine, listMachineCampaigns } from '@/lib/freehold/ads-machine'
import { getMachineDeliveryMap } from '@/lib/freehold/campaign-delivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const OPERATOR_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

/**
 * Live per-campaign delivery/learning state for a machine's trials. Split out
 * of the main GET so the dashboard stays fast: it makes one platform call per
 * campaign (Meta effective_status + learning phase, Google primary_status),
 * fail-soft, and the client merges the result into the trials table.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(OPERATOR_ROLES)
  if ('res' in auth) return auth.res
  const { id } = await params

  const machine = await getMachine(id)
  if (!machine) return NextResponse.json({ error: 'Machine not found' }, { status: 404 })

  const campaigns = await listMachineCampaigns(id)
  const delivery = await getMachineDeliveryMap(campaigns)
  return NextResponse.json({ delivery })
}
