/**
 * IS OUR TARGETING STILL VALID — checked against live Meta, not assumed.
 *
 * Every interest/behaviour id the system ships with (the real-estate anchor
 * that rides on every audience, the motive/money mappings, the AI targeting
 * catalog) is a literal id someone copied down once. Meta deprecates and
 * merges targeting nodes on its own schedule, silently — the first sign is
 * a launch failing on whatever ad set Meta happens to validate first. That
 * already happened once: the real-estate anchor had a dead id in it, and
 * every campaign failed until the error was read and traced by hand.
 *
 * This route re-runs that check on demand, against the live account, so it
 * can be caught before a client's campaign does the catching.
 */
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { isMetaConfigured, verifyEntityIds } from '@/lib/meta/client'
import { allCatalogEntities } from '@/lib/freehold/audience-pattern'
import { UAE_INTERESTS } from '@/lib/meta/targeting-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

export async function GET() {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  if (!(await isMetaConfigured())) {
    return NextResponse.json({ error: 'Meta is not connected. Connect Meta Ads under Integrations first.' }, { status: 409 })
  }

  // One combined, deduplicated list — the pattern kitchen's own catalog plus
  // the AI targeting catalog the wizard's recommendations pick from. Not the
  // old decorative template file: that one is gone (see the commit that
  // removed it — its own ids didn't even agree on what they named).
  const seen = new Map<string, { id: string; name: string }>()
  for (const e of [...allCatalogEntities(), ...UAE_INTERESTS]) {
    if (e.id && !seen.has(e.id)) seen.set(e.id, e)
  }
  const catalog = [...seen.values()]

  const results = await verifyEntityIds(catalog)
  const dead = results.filter((r) => !r.valid)
  const renamed = results.filter((r) => r.valid && r.liveName && r.liveName !== r.claimedName)

  return NextResponse.json({
    checked: results.length,
    dead: dead.length,
    renamed: renamed.length,
    results,
  })
}
