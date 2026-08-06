import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import {
  importHistory, rebuildSignals, refreshLiveTenantSignals, getBaseStats, getBaseQuality, getNetworkBenchmarks,
  TENANT_ID, BASE_TENANT, type HistoryRow,
} from '@/lib/entrestate/targeting-base'
import { getDataSecurityConfig } from '@/lib/freehold/data-security-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Operator view: what's in the base + the current network benchmarks. */
export async function GET() {
  const auth = await requireSession([...MANAGEMENT_ROLES])
  if ('res' in auth) return auth.res
  const security = await getDataSecurityConfig()
  const excludeTenantIds = security.networkBenchmarksOptOut ? [TENANT_ID, `${TENANT_ID}-live`] : []
  const [stats, rawBenchmarks, baseQuality, thisQuality] = await Promise.all([
    getBaseStats(), getNetworkBenchmarks(15, excludeTenantIds),
    getBaseQuality(BASE_TENANT), getBaseQuality(TENANT_ID),
  ])
  // Masking used to happen HERE, behind a setting — which meant it happened
  // at ONE of four call sites and only when someone had switched it on. The
  // other three, including the two that feed an LLM prompt, shipped raw
  // cross-tenant counts. Bucketing now happens inside getNetworkBenchmarks
  // and cannot be turned off, so every caller gets the same guarantee whether
  // or not it remembered to ask for one.
  const benchmarks = rawBenchmarks
  return NextResponse.json({
    tenantId: TENANT_ID, baseTenant: BASE_TENANT, stats, benchmarks,
    quality: { base: baseQuality, this: thisQuality },
  })
}

/**
 * Bulk import historical lead rows into the base.
 * Body: { tenant?: 'base' | 'this', rows: HistoryRow[] } (≤ 2000 rows/call).
 * 'base'  → the operator's system-wide seed data (entrestate-base)
 * 'this'  → this deployment's own tenant (default)
 * After the insert, the tenant's signals rebuild and the live-CRM signals
 * refresh — the shared brain updates immediately.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession([...MANAGEMENT_ROLES])
  if ('res' in auth) return auth.res

  const body = await req.json().catch(() => null) as { tenant?: string; rows?: HistoryRow[] } | null
  if (!body || !Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: 'rows[] is required' }, { status: 400 })
  }
  if (body.rows.length > 2000) {
    return NextResponse.json({ error: 'Max 2000 rows per call — send in batches' }, { status: 400 })
  }
  const tenantId = body.tenant === 'base' ? BASE_TENANT : TENANT_ID

  try {
    const { inserted, sanitized } = await importHistory(tenantId, body.rows)
    await rebuildSignals(tenantId)
    await refreshLiveTenantSignals()
    return NextResponse.json({ ok: true, tenantId, inserted, sanitized }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Import failed' }, { status: 500 })
  }
}
