import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { updateRule, deleteRule } from '@/lib/freehold/campaign-rules'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { enabled?: boolean; triggered?: boolean }
  await updateRule(id, auth.user.email, body)
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  await deleteRule(id, auth.user.email)
  return NextResponse.json({ ok: true })
}
