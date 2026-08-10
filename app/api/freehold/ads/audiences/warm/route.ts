/**
 * The warm audiences — status and one-press build.
 *
 * GET reports the three rungs with Meta's live sizes and the launch verdict
 * from the same floor the arm planner enforces. POST ensures them: creates
 * whatever is missing, heals whatever was deleted, and never duplicates —
 * identity is the audience NAME on Meta's side, nothing local.
 */
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { ensureWarmAudiences } from '@/lib/freehold/warm-audiences'
import { isMetaConfigured } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

async function respond() {
  if (!(await isMetaConfigured())) {
    return NextResponse.json({ connected: false, statuses: [], created: [], errors: [] })
  }
  const result = await ensureWarmAudiences()
  return NextResponse.json({ connected: true, ...result })
}

export async function GET() {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res
  return respond()
}

export async function POST() {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res
  return respond()
}
