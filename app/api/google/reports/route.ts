import { NextResponse } from 'next/server'
import { getReportSummary } from '@/lib/google/client'
import { GoogleConfigError, GoogleApiError } from '@/lib/google/types'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const range = (searchParams.get('range') ?? '30d') as '7d' | '30d' | '90d'
    if (!['7d', '30d', '90d'].includes(range)) {
      return NextResponse.json({ error: 'range must be 7d, 30d, or 90d' }, { status: 400 })
    }
    const report = await getReportSummary(range)
    return NextResponse.json({ report })
  } catch (e) {
    if (e instanceof GoogleConfigError) {
      return NextResponse.json({ error: e.message, type: 'config' }, { status: 503 })
    }
    if (e instanceof GoogleApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
