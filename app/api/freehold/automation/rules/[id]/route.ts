import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { updateRule, deleteRule } from '@/lib/automation/db'
import { RULE_TRIGGERS } from '@/lib/automation/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MANAGEMENT = ['admin', 'ceo', 'director', 'sales_manager']

async function requireManager() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!MANAGEMENT.includes(String(user.role))) return { error: NextResponse.json({ error: 'Management only' }, { status: 403 }) }
  return { user }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManager()
  if (auth.error) return auth.error
  const { id } = await params
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  if (body.trigger !== undefined && !(RULE_TRIGGERS as readonly string[]).includes(String(body.trigger))) {
    return NextResponse.json({ error: 'Invalid trigger' }, { status: 400 })
  }
  try {
    const patch: Record<string, unknown> = {}
    if (body.name !== undefined) patch.name = String(body.name)
    if (body.enabled !== undefined) patch.enabled = body.enabled === true
    if (body.trigger !== undefined) patch.trigger = String(body.trigger)
    if (body.combinator !== undefined) patch.combinator = body.combinator === 'any' ? 'any' : 'all'
    if (body.conditions !== undefined) patch.conditions = Array.isArray(body.conditions) ? body.conditions : []
    if (body.actions !== undefined) patch.actions = Array.isArray(body.actions) ? body.actions : []
    if (body.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder)
    if (body.stopOnMatch !== undefined) patch.stopOnMatch = body.stopOnMatch === true
    const rule = await updateRule(id, patch)
    if (!rule) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ rule })
  } catch (e) {
    console.error('[automation/rules] update failed', e)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireManager()
  if (auth.error) return auth.error
  const { id } = await params
  try {
    const ok = await deleteRule(id)
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[automation/rules] delete failed', e)
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
  }
}
