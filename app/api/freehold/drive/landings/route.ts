import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getLandingPagesForDashboard } from '@/lib/landing-pages'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Landing pages for the Drive home aggregation. Landings are not Library rows —
// they open in their own existing editor. Brokers don't manage landings, so
// they get an empty list (nav visibility ≠ authorization; the editor re-guards).
export async function GET() {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  if (auth.user.role === 'broker') return NextResponse.json({ landings: [] })
  try {
    const rows = await getLandingPagesForDashboard(60)
    const landings = rows.map((r) => ({
      slug: r.slug,
      title: r.headline || r.slug,
      status: r.isLiveNow ? 'published' : r.pendingPublish ? 'pending' : 'draft',
      updatedAt: r.updatedAt,
    }))
    return NextResponse.json({ landings })
  } catch {
    return NextResponse.json({ landings: [] })
  }
}
