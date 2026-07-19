import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { listMyUnansweredVerdicts, submitVerdictAnswer } from '@/lib/freehold/ads-machine'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The session user's own Ads Machine feedback queue, across ALL machines —
// the surface a broker answers "would this lead buy?" from. Management also
// sees the unassigned queue (rows whose owner could not be resolved).

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const isManagement = MANAGEMENT_ROLES.includes(auth.user.role)
  const verdicts = await listMyUnansweredVerdicts(auth.user.email, isManagement)
  return NextResponse.json({ verdicts, includesUnassigned: isManagement })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  let body: { verdictRowId?: unknown; verdict?: unknown; score?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const rowId = typeof body.verdictRowId === 'string' ? body.verdictRowId : ''
  if (!rowId) return NextResponse.json({ error: 'verdictRowId is required' }, { status: 400 })

  const answered = await submitVerdictAnswer({
    rowId,
    verdict: body.verdict,
    score: body.score,
    byEmail: auth.user.email,
    isManagement: MANAGEMENT_ROLES.includes(auth.user.role),
  })
  if (!answered.ok) return NextResponse.json({ error: answered.error }, { status: answered.status })
  return NextResponse.json({ verdict: answered.row })
}
