import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { recommendTargeting, type ListingCtx } from '@/lib/freehold/targeting-recommend'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The learning loop: Inventory → landing pages → campaigns → LEADS → this
// endpoint → better targeting for the NEXT campaign. The engine lives in
// lib/freehold/targeting-recommend (shared with the coordinator chat).

const ALLOWED = ['admin', 'ceo', 'director', 'sales_manager', 'marketing'] as const

export async function GET() {
  return respond(null)
}

/** POST { listing } — the wizard sends the SELECTED listing so the
 *  recommendation is tailored to that asset and its price band, not generic. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { listing?: ListingCtx }
  const l = body.listing
  const listing: ListingCtx | null = l && typeof l === 'object'
    ? {
        name: String(l.name ?? '').slice(0, 120),
        area: String(l.area ?? '').slice(0, 80),
        price: Number(l.price) || 0,
        type: String(l.type ?? '').slice(0, 60),
      }
    : null
  return respond(listing)
}

async function respond(listing: ListingCtx | null) {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res

  const rl = await checkRateLimit(`ai-targeting:${auth.user.email}`, { limit: 20, windowSec: 3600 })
  if (!rl.ok) return NextResponse.json({ error: 'Try again shortly', retryAfterSec: rl.retryAfterSec }, { status: 429 })

  const result = await recommendTargeting(listing, auth.user.email)
  return NextResponse.json(result)
}
