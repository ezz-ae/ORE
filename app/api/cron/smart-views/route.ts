/**
 * BUILDING THE SHEETS BEFORE ANYBODY OPENS THEM.
 *
 * This is the half of Smart View that makes it worth having. A saved report
 * that recomputes on every visit is a loading spinner with a name; these are
 * built overnight so opening one is instant, and each sheet carries the moment
 * it was built so the screen can say how old the answer is.
 *
 * Only views whose schedule has come round are rebuilt. 'onOpen' views are
 * skipped entirely here — they are built by the request that opens them, and
 * building them on a cron would be work nobody asked for.
 */
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSmartView, putSheet, getSheet } from '@/lib/freehold/smart-view-db'
import { buildRows } from '@/lib/freehold/smart-view-build'
import { isDue } from '@/lib/freehold/smart-view'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/** How many sheets one run will build. Each is a real Meta read, so a big
 *  account cannot be allowed to run the function past its limit — and what was
 *  skipped is REPORTED rather than silently dropped. */
const MAX_PER_RUN = 20

export async function GET(req: NextRequest) {
  // Vercel Cron sends this header; anything else is refused. Matches the other
  // cron routes in this product rather than inventing a second convention.
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let ids: string[] = []
  try {
    const rows = await query<{ id: string }>(
      `SELECT id FROM freehold_smart_views WHERE schedule <> 'onOpen' ORDER BY created_at LIMIT 200`,
    )
    ids = rows.map((r) => r.id)
  } catch {
    return NextResponse.json({ built: 0, skipped: 0, note: 'no views yet' })
  }

  let built = 0
  let failed = 0
  let due = 0
  for (const id of ids) {
    const view = await getSmartView(id)
    if (!view) continue
    const sheet = await getSheet(id)
    if (!isDue(view.schedule, sheet?.builtAt ?? null)) continue
    due++
    if (built >= MAX_PER_RUN) continue
    const rows = await buildRows(view).catch(() => null)
    // A failed build leaves the previous sheet in place with its own older
    // timestamp — never an empty sheet stamped as fresh.
    if (!rows) { failed++; continue }
    if (await putSheet(id, rows)) built++
    else failed++
  }

  return NextResponse.json({
    built, failed,
    // Never silent: a cap that is not reported reads as "everything is fresh".
    deferred: Math.max(0, due - built - failed),
  })
}
