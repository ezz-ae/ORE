/**
 * THE PERMIT WRITE, WHERE BOTH CALLERS CAN REACH IT.
 *
 * This was the body of PATCH /api/freehold/inventory/[slug]/permit — reachable
 * only over HTTP with a session cookie, which is the same reason the CRM could
 * not be worked from the chat (see crm-write.ts). The listing half of the
 * assistant could read a project and change nothing about it.
 *
 * A Trakheesi permit is the sharpest example of why that mattered. The launch
 * reads the property's expiry to set the ad set's end_time, and the Ads Machine
 * reads it to decide whether a campaign may keep running. On a manually added
 * listing both read null — so the permit stop has nothing to stop on. That is
 * an ad running without a permit, and the person most likely to notice it is
 * the assistant, which could name the problem and not fix it.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ────────────────────────────────────────
 *
 * Deleting a project. `deleteProject` destroys the row and the landing pages
 * that belong to it, it is owner-only, and it is not reversible. Archiving
 * covers the request people actually make — take it off the site, keep the
 * record — and it is what a refused delete already offers as the next step.
 * A machine that can be talked into an irreversible act is a machine somebody
 * will eventually talk into one, so the irreversible one stays a human's.
 */
import { query } from '@/lib/db'
import { normalizePermit, normalizePermitExpiry, permitState } from '@/lib/freehold/trakheesi'

export type PermitWriteResult =
  | { ok: true; permitNumber: string | null; permitExpiry: string | null; state: ReturnType<typeof permitState> }
  /** `status` is the HTTP code the route should answer with. */
  | { ok: false; status: number; error: string }

/**
 * Record a Trakheesi permit against a listing.
 *
 * Blank clears the field. Anything that is not a real permit number or a real
 * calendar date is REFUSED rather than stored: a compliance record holding a
 * plausible but wrong value is worse than an empty one, because it reads as
 * done and nobody looks again.
 *
 * Merged into the project payload rather than written to a column — that is
 * where every other extracted field lives, and it is what the launch gate and
 * the machine actually read.
 */
export async function setProjectPermit(
  slug: string,
  input: { permitNumber?: unknown; permitExpiry?: unknown },
): Promise<PermitWriteResult> {
  const rawNumber = typeof input.permitNumber === 'string' ? input.permitNumber.trim() : ''
  const rawExpiry = typeof input.permitExpiry === 'string' ? input.permitExpiry.trim() : ''

  const permitNumber = rawNumber ? normalizePermit(rawNumber) : null
  if (rawNumber && !permitNumber) {
    return { ok: false, status: 400, error: 'That does not look like a Trakheesi permit number.' }
  }
  const permitExpiry = rawExpiry ? normalizePermitExpiry(rawExpiry) : null
  if (rawExpiry && !permitExpiry) {
    return { ok: false, status: 400, error: 'The expiry must be a real date (YYYY-MM-DD).' }
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
    if (rows.length === 0) return { ok: false, status: 404, error: 'No such listing' }
    return {
      ok: true,
      permitNumber,
      permitExpiry,
      // The same classification the launch gate and the alert strip use, so no
      // caller can disagree with what the machine will actually do.
      state: permitState(permitNumber, permitExpiry),
    }
  } catch {
    return { ok: false, status: 500, error: 'Could not save the permit' }
  }
}
