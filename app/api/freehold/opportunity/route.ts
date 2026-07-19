import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { readOpportunityScores, recomputeOpportunityScores } from '@/lib/freehold/opportunity'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Opportunity Engine (Layer 3). GET serves the STORED scores (with their real
// computed_at — never recomputed on read); POST recomputes the whole table.
// Recompute is an operator capability — auth mirrors app/api/freehold/ads/machine.

const OPERATOR_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const scores = await readOpportunityScores()
  return NextResponse.json({ scores })
}

export async function POST() {
  const auth = await requireSession(OPERATOR_ROLES)
  if ('res' in auth) return auth.res
  try {
    const scores = await recomputeOpportunityScores()
    return NextResponse.json({ ok: true, computed: scores.length, scores })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Recompute failed' },
      { status: 500 },
    )
  }
}
