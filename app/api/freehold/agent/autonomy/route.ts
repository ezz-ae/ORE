import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { getAutonomyLevel, setAutonomyLevel } from '@/lib/freehold/agent-autonomy'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Read the agent autonomy level (any signed-in user — the UI shows it). */
export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  return NextResponse.json({ level: await getAutonomyLevel() })
}

/** Set the level — management only. 1 advisory · 2 semi-autonomous · 3 autopilot. */
export async function PUT(req: NextRequest) {
  const auth = await requireSession(MANAGEMENT_ROLES)
  if ('res' in auth) return auth.res
  const body = await req.json().catch(() => ({})) as { level?: number }
  const level = body.level === 2 || body.level === 3 ? body.level : body.level === 1 ? 1 : null
  if (level === null) return NextResponse.json({ error: 'level must be 1, 2 or 3' }, { status: 400 })
  await setAutonomyLevel(level, auth.user.email)
  return NextResponse.json({ ok: true, level })
}
