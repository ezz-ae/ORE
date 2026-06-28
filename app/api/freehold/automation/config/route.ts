import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { getWorkspaceConfig, saveWorkspaceConfig } from '@/lib/automation/db'
import { defaultConfig, type WorkspaceAutomationConfig } from '@/lib/automation/types'

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
    return NextResponse.json({ config: await getWorkspaceConfig() })
  } catch (e) {
    console.error('[automation/config] load failed', e)
    return NextResponse.json({ config: defaultConfig() })
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireManager()
  if (auth.error) return auth.error
  let body: Partial<WorkspaceAutomationConfig>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  try {
    // Merge the incoming patch over current config so partial saves are safe.
    const current = await getWorkspaceConfig()
    const merged: WorkspaceAutomationConfig = {
      ...current,
      ...body,
      steps: { ...current.steps, ...(body.steps || {}) },
      approvals: { ...current.approvals, ...(body.approvals || {}) },
      distribution: { ...current.distribution, ...(body.distribution || {}) },
    }
    await saveWorkspaceConfig(merged)
    return NextResponse.json({ ok: true, config: merged })
  } catch (e) {
    console.error('[automation/config] save failed', e)
    return NextResponse.json({ error: 'Failed to save config' }, { status: 500 })
  }
}
