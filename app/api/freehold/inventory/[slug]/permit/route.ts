import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { setProjectPermit } from '@/lib/freehold/inventory-write'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = [...MANAGEMENT_ROLES, 'marketing'] as const

/**
 * THE TRAKHEESI PERMIT, ON THE PROPERTY IT BELONGS TO.
 *
 * Until now a permit could only arrive with ingested project data. There was
 * no way to type one anywhere that stuck to the property — the number entered
 * at launch review is stored on the CAMPAIGN PLAN, so the property itself
 * still had nothing.
 *
 * That is not cosmetic. The launch reads the property's expiry to set the ad
 * set's end_time, and the Ads Machine reads it to decide whether a campaign
 * may keep running. On a manually added listing both read null, so the permit
 * stop had nothing to stop on and the compliance gate had nothing to gate.
 *
 * Merged into the project payload rather than written to a column: that is
 * where every other extracted field lives, and it is what the readers read.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res

  const { slug } = await params
  const body = (await req.json().catch(() => ({}))) as { permitNumber?: unknown; permitExpiry?: unknown }

  // The rules and the write live in lib/freehold/inventory-write.ts, because
  // the assistant sets permits through the same function — a permit typed into
  // the chat has to be validated exactly as one typed into the form.
  const result = await setProjectPermit(slug, body)
  if (!result.ok) {
    const { status, ok: _ok, ...rest } = result
    return NextResponse.json(rest, { status })
  }
  const { ok: _done, ...payload } = result
  return NextResponse.json({ ok: true, ...payload })
}
