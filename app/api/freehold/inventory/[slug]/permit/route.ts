import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { normalizePermit, normalizePermitExpiry, permitState } from '@/lib/freehold/trakheesi'

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

  // Blank clears the field. Anything that is not a real permit or a real
  // calendar date is refused outright — a compliance record with a plausible
  // but wrong value in it is worse than an empty one, because it reads as done.
  const rawNumber = typeof body.permitNumber === 'string' ? body.permitNumber.trim() : ''
  const rawExpiry = typeof body.permitExpiry === 'string' ? body.permitExpiry.trim() : ''

  const permitNumber = rawNumber ? normalizePermit(rawNumber) : null
  if (rawNumber && !permitNumber) {
    return NextResponse.json({ error: 'That does not look like a Trakheesi permit number.' }, { status: 400 })
  }
  const permitExpiry = rawExpiry ? normalizePermitExpiry(rawExpiry) : null
  if (rawExpiry && !permitExpiry) {
    return NextResponse.json({ error: 'The expiry must be a real date (YYYY-MM-DD).' }, { status: 400 })
  }

  try {
    const rows = await query<{ slug: string }>(
      `UPDATE freehold_site_projects
          SET payload = coalesce(payload, '{}'::jsonb)
                        || jsonb_build_object('permitNumber', $2::text, 'permitExpiry', $3::text),
              updated_at = now()
        WHERE lower(slug) = lower($1)
        RETURNING slug`,
      [slug, permitNumber, permitExpiry],
    )
    if (rows.length === 0) return NextResponse.json({ error: 'No such listing' }, { status: 404 })
    return NextResponse.json({
      ok: true,
      permitNumber,
      permitExpiry,
      // The same classification the launch gate and the alert strip use, so
      // the screen can never disagree with what the machine will actually do.
      state: permitState(permitNumber, permitExpiry),
    })
  } catch {
    return NextResponse.json({ error: 'Could not save the permit' }, { status: 500 })
  }
}
