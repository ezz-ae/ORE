import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listBrokerPermissions, saveBrokerPermissions } from '@/lib/freehold/broker-permissions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MANAGEMENT = ['admin', 'ceo', 'director', 'sales_manager']

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const perms = await listBrokerPermissions()
  return NextResponse.json({ perms })
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  if (!MANAGEMENT.includes(auth.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = (await req.json().catch(() => ({}))) as { brokerId?: string; perms?: Record<string, boolean> }
  if (!body.brokerId) return NextResponse.json({ error: 'brokerId is required' }, { status: 400 })
  const perms = body.perms && typeof body.perms === 'object' ? body.perms : {}
  await saveBrokerPermissions(body.brokerId, perms)
  return NextResponse.json({ ok: true })
}
