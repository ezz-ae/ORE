import { NextRequest, NextResponse } from 'next/server'
import { getShare } from '@/lib/freehold/shares'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public share reader — no auth (under the /api/freehold/public/ allowlist).
// Resolves a token to the file's name + url + kind, or 404 if revoked/missing.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const share = await getShare(String(token || ''))
  if (!share) return NextResponse.json({ error: 'This link is no longer available.' }, { status: 404 })
  return NextResponse.json({ share })
}
