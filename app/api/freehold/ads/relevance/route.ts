/**
 * What the registration events have established — behaviour by behaviour,
 * placement by placement, creative by creative.
 *
 * Read-only and recomputed on every call, which is what makes it a standing
 * measurement rather than a study someone ran once. Costs nothing: the
 * experiment already happened, this only reads it.
 */
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { snapshotOutcomes } from '@/lib/freehold/audience-snapshot'
import { assessEvents, soloBehaviourRows, MIN_LEADS_WITH_ATTRIBUTE } from '@/lib/freehold/relevance'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const READ_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET() {
  const auth = await requireSession(READ_ROLES)
  if ('res' in auth) return auth.res

  const rows = await snapshotOutcomes()
  const solo = soloBehaviourRows(rows)

  return NextResponse.json({
    events: rows.length,
    minLeads: MIN_LEADS_WITH_ATTRIBUTE,
    // Every dimension, over every event.
    all: assessEvents(rows),
    // The unconfounded read: only leads whose ad set carried ONE behaviour.
    // Returned separately rather than blended, because these two answer
    // different questions and averaging them would hide which is which.
    solo: { events: solo.length, behavior: assessEvents(solo).behavior },
    note: rows.length === 0
      ? 'No registration event has been snapshotted yet. Relevance fills in as leads arrive through launched ad sets.'
      : 'Behaviour and interest readings credit every segment an ad set carried, so a strong segment lifts its neighbours. The solo read is the clean one where it exists.',
  })
}
