/**
 * SAVED SMART VIEWS — list and create.
 *
 * The list is what appears in the views bar. Creating one saves the question,
 * not a report: the sheet is built separately and on a schedule, which is what
 * makes opening a view instant.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listSmartViews, createSmartView } from '@/lib/freehold/smart-view-db'
import {
  VIEW_TEMPLATES, VIEW_RANGES, VIEW_ACCESS, VIEW_SCHEDULES,
  type ViewTemplate, type ViewRange, type ViewAccess, type ViewSchedule,
} from '@/lib/freehold/smart-view'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const views = await listSmartViews(auth.user.email)
  return NextResponse.json({ views, me: auth.user.email })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const b = await req.json().catch(() => ({})) as Record<string, unknown>

  const name = String(b.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Give the view a name.' }, { status: 400 })

  // Anything not in the walkable list is rejected rather than coerced: a view
  // saved with a template nobody can render is a row that renders as a blank
  // card forever, and nothing on screen would say why.
  const template = String(b.template ?? '')
  if (!(VIEW_TEMPLATES as readonly string[]).includes(template)) {
    return NextResponse.json({ error: 'Choose what you want to see.' }, { status: 400 })
  }
  const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
    (list as readonly string[]).includes(String(v)) ? (v as T) : fallback

  const view = await createSmartView({
    name,
    description: String(b.description ?? ''),
    template: template as ViewTemplate,
    range: pick<ViewRange>(VIEW_RANGES, b.range, 'last30'),
    access: pick<ViewAccess>(VIEW_ACCESS, b.access, 'onlyMe'),
    schedule: pick<ViewSchedule>(VIEW_SCHEDULES, b.schedule, 'everyMorning'),
    projectSlug: String(b.projectSlug ?? ''),
    channel: b.channel === 'meta' || b.channel === 'google' ? b.channel : '',
    createdBy: auth.user.email,
  })
  if (!view) return NextResponse.json({ error: 'The view could not be saved. Try again.' }, { status: 500 })
  return NextResponse.json({ view }, { status: 201 })
}
