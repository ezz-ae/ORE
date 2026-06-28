import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { listRules, createRule } from '@/lib/automation/db'
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

export async function GET() {
  const auth = await requireManager()
  if (auth.error) return auth.error
  try {
    return NextResponse.json({ rules: await listRules() })
  } catch (e) {
    console.error('[automation/rules] list failed', e)
    return NextResponse.json({ error: 'Failed to load rules' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireManager()
  if (auth.error) return auth.error
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = String(body.name || '').trim()
  const trigger = String(body.trigger || '')
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!(RULE_TRIGGERS as readonly string[]).includes(trigger)) {
    return NextResponse.json({ error: 'Invalid trigger' }, { status: 400 })
  }
  try {
    const rule = await createRule(
      {
        name,
        trigger,
        enabled: body.enabled !== false,
        combinator: body.combinator === 'any' ? 'any' : 'all',
        conditions: Array.isArray(body.conditions) ? body.conditions : [],
        actions: Array.isArray(body.actions) ? body.actions : [],
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
        stopOnMatch: body.stopOnMatch === true,
      },
      auth.user!.email,
    )
    return NextResponse.json({ rule }, { status: 201 })
  } catch (e) {
    console.error('[automation/rules] create failed', e)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}
