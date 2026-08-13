/**
 * ONE SMART VIEW'S SHEET — served from the last build, rebuilt when it is due.
 *
 * Opening a view must be instant, so the stored sheet is returned as it is and
 * the screen says when it was built. A view whose schedule has come round —
 * or one that has never been built, or one set to rebuild on open — is built
 * here first.
 *
 * `?rebuild=1` forces it, for the person who just changed something and does
 * not want to wait until tomorrow morning to see it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getSmartView, getSheet, putSheet, deleteSmartView } from '@/lib/freehold/smart-view-db'
import { buildRows } from '@/lib/freehold/smart-view-build'
import { isDue, totalsOf, TEMPLATE_SPEC } from '@/lib/freehold/smart-view'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params

  const view = await getSmartView(id)
  if (!view) return NextResponse.json({ error: 'That view no longer exists.' }, { status: 404 })
  if (view.access === 'onlyMe' && view.createdBy !== auth.user.email) {
    return NextResponse.json({ error: 'That view is private to whoever made it.' }, { status: 403 })
  }

  let sheet = await getSheet(id)
  const forced = req.nextUrl.searchParams.get('rebuild') === '1'
  if (forced || isDue(view.schedule, sheet?.builtAt ?? null)) {
    const rows = await buildRows(view).catch(() => null)
    // A FAILED REBUILD KEEPS THE OLD SHEET. Yesterday's answer with yesterday's
    // timestamp on it is worth more than an empty screen, and the timestamp is
    // what stops it being mistaken for today's.
    if (rows) {
      const builtAt = await putSheet(id, rows)
      if (builtAt) sheet = { builtAt, rows }
    }
  }

  const rows = sheet?.rows ?? []
  return NextResponse.json({
    view, builtAt: sheet?.builtAt ?? null,
    columns: TEMPLATE_SPEC[view.template].columns,
    rows, totals: totalsOf(rows),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { id } = await params
  const gone = await deleteSmartView(id, auth.user.email)
  if (!gone) {
    return NextResponse.json(
      { error: 'Only the person who made a view can delete it.' }, { status: 403 },
    )
  }
  return NextResponse.json({ deleted: true })
}
