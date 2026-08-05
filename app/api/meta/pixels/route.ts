import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import type { Role } from '@/lib/freehold/session-types'
import {
  listPixels, createPixel, getConfiguredPixelId, MetaApiError, MetaConfigError,
} from '@/lib/meta/client'

// Same set proxy.ts enforces for /api/meta/* writes (ADS_ROLES) — repeated
// in-handler so the route defends itself if it is ever reached directly.
const WRITE_ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET() {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const pixels = await listPixels()
    // The pixel the SERVER-side Conversions API fires at. The Pixel tab
    // compares it against the landing pages' pixel; a mismatch silently breaks
    // Meta's browser/server dedup, and nothing else in the app would say so.
    const capiPixelId = await getConfiguredPixelId().catch(() => null)
    return NextResponse.json({ pixels, capiPixelId })
  } catch (err) {
    // `demo` is kept for the campaign wizard's picker (which treats it as "not
    // connected"); `configError` carries Meta's own sentence — naming the
    // missing env var — for surfaces that would rather show the truth.
    if (err instanceof MetaConfigError)
      return NextResponse.json({ pixels: [], demo: true, configError: err.message })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}

// POST — create a real pixel on the connected ad account.
export async function POST(req: NextRequest) {
  const __auth = await requireSession(WRITE_ROLES)
  if ('res' in __auth) return __auth.res
  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 })

  try {
    const pixel = await createPixel(name)
    return NextResponse.json({ pixel }, { status: 201 })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message, type: 'unknown' }, { status: 500 })
  }
}
