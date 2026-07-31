import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { getAutonomyLevel } from '@/lib/freehold/agent-autonomy'
import { MetaConfigError } from '@/lib/meta/client'
import { runAutopilotPass } from '@/lib/freehold/autopilot-pass'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Manual autopilot trigger — one optimization pass, on demand. The pass itself
 * lives in lib/freehold/autopilot-pass.ts and is shared with the nightly cron
 * (/api/cron/autopilot). It refuses to run below autonomy level 3 — the level
 * is stored server-side and management-set, so neither a client nor the model
 * can force it.
 */
export async function POST() {
  const auth = await requireSession(MANAGEMENT_ROLES)
  if ('res' in auth) return auth.res

  const level = await getAutonomyLevel()
  if (level < 3) {
    return NextResponse.json(
      { error: 'Autopilot requires autonomy level 3 (currently ' + level + '). Set it via /api/freehold/agent/autonomy.' },
      { status: 409 },
    )
  }
  try {
    return NextResponse.json(await runAutopilotPass(auth.user.email))
  } catch (err) {
    if (err instanceof MetaConfigError) {
      return NextResponse.json({ error: 'Meta is not connected — autopilot has nothing to optimize.' }, { status: 424 })
    }
    throw err
  }
}
