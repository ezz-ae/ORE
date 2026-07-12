import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { normalizeSpec } from '@/lib/freehold/audiences'
import { isMetaConfigured, getReachEstimate } from '@/lib/meta/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST {spec} — live Meta reach band for an UNSAVED audience definition, so the
// builder shows real numbers while composing. Not connected ⇒ honest null.
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const connected = await isMetaConfigured()
  if (!connected) return NextResponse.json({ connected: false, reach: null })
  const reach = await getReachEstimate(normalizeSpec(body.spec))
  return NextResponse.json({ connected: true, reach })
}
