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
import { listTeams, createTeam, setTeamLeader, renameTeam, deleteTeam } from '@/lib/freehold/teams'

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

/** Rename a team, or move its leadership. Both are management's call. */
export async function PATCH(req: NextRequest) {
  const auth = await requireSession(MGMT_ROLES)
  if ('res' in auth) return auth.res

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const teamId = String(body.teamId ?? '').trim()
  if (!teamId) return NextResponse.json({ error: 'teamId is required' }, { status: 400 })

  // `leaderUserId: null` is a real instruction (leave the team leaderless), so
  // presence of the KEY decides, not truthiness of the value.
  const setsLeader = Object.prototype.hasOwnProperty.call(body, 'leaderUserId')
  const name = body.name === undefined ? null : String(body.name).trim()
  if (name !== null && !name) {
    return NextResponse.json({ error: 'A team needs a name' }, { status: 400 })
  }
  if (!setsLeader && name === null) {
    return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
  }

  try {
    if (name !== null) await renameTeam(teamId, name)
    if (setsLeader) await setTeamLeader(teamId, body.leaderUserId ? String(body.leaderUserId) : null)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update the team' },
      { status: 500 },
    )
  }
}

/**
 * Disband a team. Management, not the owner-only rule: a team is an
 * organisational grouping, not a lead or a campaign — nobody's work is
 * destroyed and every member survives with their record intact.
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireSession(MGMT_ROLES)
  if ('res' in auth) return auth.res

  const teamId = (new URL(req.url).searchParams.get('teamId') ?? '').trim()
  if (!teamId) return NextResponse.json({ error: 'teamId is required' }, { status: 400 })

  try {
    await deleteTeam(teamId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to disband the team' },
      { status: 500 },
    )
  }
}
