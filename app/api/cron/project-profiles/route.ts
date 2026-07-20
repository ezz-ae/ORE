import { NextRequest, NextResponse } from 'next/server'
import { refreshStaleProjectProfiles } from '@/lib/freehold/project-profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Weekly Project Intelligence Profile freshness pass (Vercel Cron).
 * Regenerates ONLY profiles that are missing or STALE (the project's real
 * facts changed since generation) for projects that have a landing page,
 * capped at 25 generations per run so AI spend stays bounded — the honest
 * `remaining` count says what the next run will pick up. Auth mirrors
 * app/api/cron/opportunity: CRON_SECRET bearer token.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get('authorization') || ''
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const summary = await refreshStaleProjectProfiles(25)
    return NextResponse.json({
      ok: true,
      needed: summary.needed,
      generated: summary.generated,
      failed: summary.failed,
      remaining: summary.remaining,
    })
  } catch (err) {
    // DB unreachable — an honest failure, not a fake success.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Profile refresh failed' },
      { status: 500 },
    )
  }
}
