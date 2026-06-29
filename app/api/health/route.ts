import { NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getLiveIntegrationStatuses } from '@/lib/freehold/integration-status'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Lightweight health/readiness check — confirms the database is reachable and
 * which integrations are configured at runtime. Returns booleans/states only
 * (never secret values or which exact keys are missing), so it is safe to hit
 * without auth to verify a deployment before going live.
 */
export async function GET() {
  // DB ping
  let db = false
  try {
    await query('SELECT 1')
    db = true
  } catch { db = false }

  const integrations = getLiveIntegrationStatuses().map((i) => ({
    id: i.id,
    name: i.name,
    state: i.state, // 'connected' | 'partial' | 'disconnected'
  }))

  const allConnected = db && integrations.every((i) => i.state === 'connected')

  return NextResponse.json(
    {
      ok: db,
      status: allConnected ? 'ready' : db ? 'degraded' : 'db-unavailable',
      db,
      integrations,
      time: new Date().toISOString(),
    },
    { status: db ? 200 : 503 },
  )
}
