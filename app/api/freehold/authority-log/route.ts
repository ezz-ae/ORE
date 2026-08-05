/**
 * The authority log, read back.
 *
 * "logs are a must on that type of systems — it always has a day when it will
 * be the word between 2." This endpoint is that day. It returns who did what,
 * to whom, and whether the system permitted it — including the attempts it
 * refused, which are usually the interesting ones.
 *
 * Management reads the whole log. A team leader reads only their own actions:
 * enough to answer "what did I do and when", not enough to audit a colleague.
 * A broker reads nothing — the log is about authority over people, and reading
 * it is itself an act of authority.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MGMT_ROLES, TEAM_APP_ROLES } from '@/lib/freehold/apps'
import { listAuthorityLog } from '@/lib/freehold/authority-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireSession(TEAM_APP_ROLES)
  if ('res' in auth) return auth.res
  const { user } = auth

  const url = new URL(req.url)
  const isManagement = MGMT_ROLES.includes(user.role)

  try {
    const rows = await listAuthorityLog({
      targetType: url.searchParams.get('targetType') ?? undefined,
      targetId: url.searchParams.get('targetId') ?? undefined,
      // A leader's view is pinned to themselves regardless of what they ask
      // for — the filter is not a suggestion.
      actorEmail: isManagement ? (url.searchParams.get('actor') ?? undefined) : user.email,
      action: url.searchParams.get('action') ?? undefined,
      decision: url.searchParams.get('decision') === 'allowed' ? 'allowed'
              : url.searchParams.get('decision') === 'denied' ? 'denied'
              : undefined,
      limit: Number(url.searchParams.get('limit') ?? 100),
    })
    return NextResponse.json({ entries: rows, scope: isManagement ? 'all' : 'self' })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to read the log' },
      { status: 500 },
    )
  }
}
