import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { getLandingPageForEditor } from '@/lib/landing-pages'
import { getOpenRequest } from '@/lib/freehold/landing-edit-requests'
import type { SessionUser } from '@/lib/freehold/session-types'
import { getSiteUrl } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const actorId = (u: SessionUser) => (u.role === 'broker' ? (u.brokerId ?? u.email) : u.email)

// The proposal editor's load: the landing's current editable content (so the
// broker proposes against the real page) plus the actor's own open draft to
// resume, if any. Any authenticated user may read this — it exposes only the
// same content the public page already shows, never a publish control.
export async function GET(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const slug = String(new URL(req.url).searchParams.get('slug') || '').trim()
  if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  const landing = await getLandingPageForEditor(slug)
  if (!landing) return NextResponse.json({ error: 'Landing not found' }, { status: 404 })
  const draft = await getOpenRequest(slug, actorId(auth.user))
  // Resolved server-side via getSiteUrl() (same helper the agent-profile QR
  // code uses) so the broker-proposal editor's trackable-QR link is correct
  // without depending on a client-inlined NEXT_PUBLIC_* var.
  return NextResponse.json({ landing, draft, siteUrl: getSiteUrl() })
}
