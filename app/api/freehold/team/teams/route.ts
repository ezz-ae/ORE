/**
 * Teams — a leader plus the people who report to them.
 *
 * This is the org chart the fairness rules read. When a reassignment is refused
 * with "that person is not on your team", the answer traces back to a row here,
 * not to a guess.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireSession } from '@/lib/freehold/api-auth'
import { MGMT_ROLES, TEAM_APP_ROLES } from '@/lib/freehold/apps'
import { listTeams, createTeam, setTeamLeader } from '@/lib/freehold/teams'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  // Leaders may read the team list — they need to see which team they run.
  const auth = await requireSession(TEAM_APP_ROLES)
  if ('res' in auth) return auth.res
  try {
    return NextResponse.json({ teams: await listTeams() })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load teams' },
      { status: 500 },
    )
  }
}

/** Creating a team and naming its leader is management's call, not a leader's. */
export async function POST(req: NextRequest) {
  const auth = await requireSession(MGMT_ROLES)
  if ('res' in auth) return auth.res

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'A team needs a name' }, { status: 400 })
  const leaderUserId = body.leaderUserId ? String(body.leaderUserId) : null

  try {
    const team = await createTeam(`team_${randomUUID()}`, name, leaderUserId)
    return NextResponse.json({ team }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create team' },
      { status: 500 },
    )
  }
}

/** Move the leadership of an existing team. */
export async function PATCH(req: NextRequest) {
  const auth = await requireSession(MGMT_ROLES)
  if ('res' in auth) return auth.res

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const teamId = String(body.teamId ?? '').trim()
  if (!teamId) return NextResponse.json({ error: 'teamId is required' }, { status: 400 })

  try {
    await setTeamLeader(teamId, body.leaderUserId ? String(body.leaderUserId) : null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to set the leader' },
      { status: 500 },
    )
  }
}
