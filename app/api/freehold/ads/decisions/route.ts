import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { listDecisions } from '@/lib/meta/decision-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Admin-only: the AI decision feed — every autonomous structural/budget action
// the intent router took, with the reason and spend before/after.
export async function GET(req: NextRequest) {
  const auth = await requireSession(MANAGEMENT_ROLES)
  if ('res' in auth) return auth.res
  const projectSlug = req.nextUrl.searchParams.get('project') ?? undefined
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '100')
  return NextResponse.json({ decisions: await listDecisions({ projectSlug, limit: Number.isFinite(limit) ? limit : 100 }) })
}
