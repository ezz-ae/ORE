import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getReportSummary } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError } from '@/lib/google/types'
import { demoReport } from '@/lib/google/demo-data'

export async function GET(req: Request) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  const { searchParams } = new URL(req.url)
  const range = (searchParams.get('range') ?? '30d') as '7d' | '30d' | '90d'
  if (!['7d', '30d', '90d'].includes(range)) {
    return NextResponse.json({ error: 'range must be 7d, 30d, or 90d' }, { status: 400 })
  }
  try {
    const report = await getReportSummary(range)
    return NextResponse.json({ report })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      return NextResponse.json({ report: demoReport(range), demo: true })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
