import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listPixels, MetaApiError, MetaConfigError } from '@/lib/meta/client'

export async function GET() {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const pixels = await listPixels()
    return NextResponse.json({ pixels })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ pixels: [], demo: true })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}
