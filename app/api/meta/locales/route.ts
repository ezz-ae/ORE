import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { searchAdLocales, MetaApiError, MetaConfigError } from '@/lib/meta/client'

export async function GET(req: NextRequest) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  const q = req.nextUrl.searchParams.get('q') || ''
  if (!q.trim()) return NextResponse.json({ locales: [] })
  try {
    const locales = await searchAdLocales(q)
    return NextResponse.json({ locales })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ locales: [], demo: true })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}
