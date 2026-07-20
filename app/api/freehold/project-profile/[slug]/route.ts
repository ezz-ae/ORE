import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { getProjectProfile, generateProjectProfile } from '@/lib/freehold/project-profile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Project Intelligence Profile (Layer 2). GET serves the STORED profile with
// its real generated_at + staleness flag — never generated on read (an AI
// call is an explicit act). POST regenerates from the project's real record.
// Regeneration is an operator capability — auth mirrors app/api/freehold/opportunity.

const OPERATOR_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const { slug } = await params
  const { profile, stale } = await getProjectProfile(slug)
  return NextResponse.json({ profile, stale })
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireSession(OPERATOR_ROLES)
  if ('res' in auth) return auth.res
  const { slug } = await params
  const result = await generateProjectProfile(slug)
  if (!result.ok) {
    // Fail-soft but honest: no fake profile was stored — say why.
    return NextResponse.json({ ok: false, error: result.reason }, { status: 502 })
  }
  return NextResponse.json({ ok: true, profile: result.profile })
}
