import { NextRequest, NextResponse } from 'next/server'
import { getAutonomyLevel } from '@/lib/freehold/agent-autonomy'
import { MetaConfigError } from '@/lib/meta/client'
import { runAutopilotPass } from '@/lib/freehold/autopilot-pass'
import { query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Nightly autopilot cron (vercel.json, 04:30 — after lead sync at 03:00 and
 * the Ads Machine cycle at 04:00). This is the piece that was always missing:
 * the rules engine existed, guardrails and all, but nothing called it.
 *
 * Auth mirrors app/api/cron/ads-machine: CRON_SECRET bearer token. The same
 * autonomy-level-3 gate applies — below it the pass is skipped, never forced.
 * One pass runs per distinct rule owner, so ownership and audit attribution
 * stay exactly as the manual trigger writes them.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get('authorization') || ''
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const level = await getAutonomyLevel()
  if (level < 3) {
    return NextResponse.json({ skipped: true, reason: `autonomy level ${level} < 3 — autopilot stays off` })
  }

  let owners: { owner_email: string }[] = []
  try {
    owners = await query<{ owner_email: string }>(
      `SELECT DISTINCT owner_email FROM freehold_campaign_rules WHERE enabled = true`,
    )
  } catch {
    return NextResponse.json({ ok: false, error: 'Rules store unavailable' }, { status: 500 })
  }
  if (owners.length === 0) return NextResponse.json({ ok: true, owners: 0, note: 'No enabled automation rules.' })

  const results: Record<string, unknown> = {}
  for (const { owner_email } of owners) {
    try {
      results[owner_email] = await runAutopilotPass(owner_email)
    } catch (err) {
      results[owner_email] = {
        error: err instanceof MetaConfigError
          ? 'Meta is not connected — autopilot has nothing to optimize.'
          : err instanceof Error ? err.message : 'pass failed',
      }
    }
  }
  return NextResponse.json({ ok: true, owners: owners.length, results })
}
