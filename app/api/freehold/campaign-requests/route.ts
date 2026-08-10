/**
 * Campaign requests — the door between a broker's ask and the ads tools.
 *
 * A broker creates and reads their OWN requests; management reads all and
 * decides. The broker never needs ads-tool access: the request carries
 * everything the launcher needs, and the launch happens on the other side of
 * this door.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import {
  createCampaignRequest, listCampaignRequests, getCampaignRequest, decideCampaignRequest,
} from '@/lib/freehold/campaign-requests'
import { getCreditBalance } from '@/lib/freehold/credits-db'
import { creditsForDailyBudget } from '@/lib/freehold/credits-shared'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const isMgmt = (role: string) => (MANAGEMENT_ROLES as readonly string[]).includes(role)
const brokerIdOf = (u: { role: string; brokerId?: string | null; email: string }) =>
  u.role === 'broker' ? (u.brokerId ?? u.email) : u.email

export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { user } = auth
  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    const request = await getCampaignRequest(id)
    if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    // A broker may read their own request; management may read any.
    if (!isMgmt(user.role) && request.brokerId !== brokerIdOf(user)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ request })
  }

  const requests = isMgmt(user.role)
    ? await listCampaignRequests()
    : await listCampaignRequests(brokerIdOf(user))
  return NextResponse.json({ requests })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(['broker'])
  if ('res' in auth) return auth.res
  const { user } = auth
  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const title = String(body.title ?? '').trim()
  const dailyBudgetAed = Math.round(Number(body.dailyBudgetAed) || 0)
  if (!title) return NextResponse.json({ error: 'A campaign title is required' }, { status: 400 })
  if (dailyBudgetAed < 50) return NextResponse.json({ error: 'Daily budget must be at least AED 50' }, { status: 400 })

  // The Assets check. Nothing is charged here — the charge happens at launch
  // through the same rail every launch uses — but accepting a request the
  // balance cannot fund would promise a campaign the ledger will refuse.
  const brokerId = brokerIdOf(user)
  const needed = creditsForDailyBudget(dailyBudgetAed)
  const balance = await getCreditBalance(brokerId).catch(() => null)
  if (balance && balance.balance < needed) {
    return NextResponse.json({
      error: 'insufficient_assets', required: needed, balance: balance.balance,
    }, { status: 402 })
  }

  const request = await createCampaignRequest({
    brokerId,
    projectSlug: typeof body.projectSlug === 'string' && body.projectSlug ? body.projectSlug : null,
    projectName: typeof body.projectName === 'string' && body.projectName ? body.projectName : null,
    title,
    note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
    dailyBudgetAed,
  })
  return NextResponse.json({ request })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireSession(MANAGEMENT_ROLES)
  if ('res' in auth) return auth.res
  let body: { id?: string; action?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const action = body.action === 'approve' ? 'approved' : body.action === 'reject' ? 'rejected' : null
  if (!body.id || !action) {
    return NextResponse.json({ error: 'id and action (approve|reject) are required' }, { status: 400 })
  }
  const result = await decideCampaignRequest(body.id, action, auth.user.email)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json({ request: result.request })
}
