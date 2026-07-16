import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { getDataSecurityConfig, updateDataSecurityConfig, type DataSecurityConfig } from '@/lib/freehold/data-security-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSession([...MANAGEMENT_ROLES])
  if ('res' in auth) return auth.res
  const config = await getDataSecurityConfig()
  return NextResponse.json({ config })
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession([...MANAGEMENT_ROLES])
  if ('res' in auth) return auth.res
  const body = await req.json().catch(() => null) as Partial<DataSecurityConfig> | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const patch: Partial<DataSecurityConfig> = {}
  if (typeof body.networkBenchmarksOptOut === 'boolean') patch.networkBenchmarksOptOut = body.networkBenchmarksOptOut
  if (typeof body.maskBenchmarkNumbers === 'boolean') patch.maskBenchmarkNumbers = body.maskBenchmarkNumbers
  const config = await updateDataSecurityConfig(patch)
  return NextResponse.json({ ok: true, config })
}
