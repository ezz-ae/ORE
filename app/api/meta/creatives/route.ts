import { NextResponse } from 'next/server'
import { listAdCreatives, MetaApiError, MetaConfigError } from '@/lib/meta/client'

export async function GET() {
  try {
    const creatives = await listAdCreatives()
    return NextResponse.json({ creatives })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}
