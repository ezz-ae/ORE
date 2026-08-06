/**
 * Registration-event snapshots: how many exist, and catch up the ones that
 * arrived before the capture wire did.
 *
 * GET  — coverage. How many paid leads have a snapshot and how many do not.
 * POST — backfill, bounded.
 *
 * The backfill is deliberately weaker than live capture and says so: it reads
 * each ad set's targeting as it stands TODAY, which for an old lead may not be
 * what it arrived through. It exists to seed the table, not to run it.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { query } from '@/lib/db'
import { backfillSnapshots } from '@/lib/freehold/snapshot-capture'
import { leadsAwaitingSnapshot } from '@/lib/freehold/audience-snapshot'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET() {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  let captured = 0
  try {
    const [row] = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM freehold_lead_audience_snapshot`,
    )
    captured = Number(row?.n ?? 0) || 0
  } catch { /* table not created yet — zero is the honest answer */ }

  const pending = await leadsAwaitingSnapshot(500)
  return NextResponse.json({
    captured,
    pending: pending.length,
    note: captured === 0 && pending.length === 0
      ? 'No paid lead has arrived yet. Snapshots begin the moment one does.'
      : pending.length > 0
      ? `${pending.length} paid leads have no snapshot. Backfilling reads each ad set as it stands today, which for an older lead may differ from what it arrived through.`
      : 'Every paid lead carries a snapshot.',
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  const body = (await req.json().catch(() => ({}))) as { limit?: number }
  const limit = Math.min(500, Math.max(1, Number(body.limit) || 100))

  try {
    const result = await backfillSnapshots(limit)
    return NextResponse.json({
      ...result,
      // The gap between attempted and written is not noise — it is leads whose
      // ad set Meta no longer returns, and naming it stops a partial backfill
      // reading as a complete one.
      skipped: result.attempted - result.written,
      note: result.attempted === 0
        ? 'Nothing to backfill.'
        : `${result.written} of ${result.attempted} captured. Any shortfall is leads whose ad set Meta could not return — usually deleted.`,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Backfill failed' },
      { status: 500 },
    )
  }
}
