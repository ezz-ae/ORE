import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { deleteSpendRule } from '@/lib/meta/spend-rules'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(MANAGEMENT_ROLES)
  if ('res' in auth) return auth.res
  const { id } = await params
  await deleteSpendRule(id)
  return NextResponse.json({ ok: true })
}
