import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { syncFromBlob, cloudConfigured } from '@/lib/freehold/cloud'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Import Blob objects that aren't indexed in the Cloud yet (e.g. files added
// directly in the Vercel Blob dashboard). POST → { imported, scanned }.
export async function POST() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  if (!cloudConfigured()) {
    return NextResponse.json({ error: 'Cloud storage is not configured — set BLOB_READ_WRITE_TOKEN.' }, { status: 503 })
  }
  const rl = await checkRateLimit(`cloud-sync:${auth.user.email}`, { limit: 5, windowSec: 60 })
  if (!rl.ok) return NextResponse.json({ error: 'Slow down a moment.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } })

  try {
    const result = await syncFromBlob(auth.user.email)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 502 })
  }
}
