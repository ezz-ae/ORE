/**
 * ONE DEVELOPER — rename it, restyle it, or remove it.
 *
 * The sibling POST /api/freehold/developers has always created and updated by
 * name. What never existed was a way to remove one, or to change one without
 * knowing the exact create-shaped payload — so a developer added by mistake, or
 * a scrape that minted a company nobody sells for, stayed on the public site
 * until somebody opened the database.
 *
 * A developer holding projects is never deleted: its listings would keep a
 * developer_name pointing at nothing, which reads on the site as a property by
 * a company that does not exist. The refusal says how many projects are in the
 * way so the person can decide what to do about them.
 *
 * Rules: lib/freehold/content-authority.ts. Work: content-admin-db.ts.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import {
  deleteDeveloper, updateDeveloper, developerProjectCount,
} from '@/lib/freehold/content-admin-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES = [...MANAGEMENT_ROLES, 'marketing'] as const

const REFUSAL_STATUS: Record<string, number> = {
  not_found: 404,
  insufficient_role: 403,
  has_projects: 409,
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await requireSession([...ROLES])
  if ('res' in auth) return auth.res
  const { slug } = await ctx.params

  const patch = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const result = await updateDeveloper(slug, patch, { email: auth.user.email, role: auth.user.role })
  if (!result.ok) {
    return NextResponse.json(
      { error: 'refused', refusal: result.verdict.refusal },
      { status: REFUSAL_STATUS[result.verdict.refusal ?? ''] ?? 400 },
    )
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await requireSession([...ROLES])
  if ('res' in auth) return auth.res
  const { slug } = await ctx.params

  const result = await deleteDeveloper(slug, { email: auth.user.email, role: auth.user.role })
  if (!result.ok) {
    return NextResponse.json({
      error: 'refused',
      refusal: result.verdict.refusal,
      // Say how many are in the way. "Cannot delete" with no number is the
      // kind of refusal that gets worked around instead of answered.
      projects: result.verdict.refusal === 'has_projects'
        ? await developerProjectCount(slug) : undefined,
    }, { status: REFUSAL_STATUS[result.verdict.refusal ?? ''] ?? 400 })
  }
  return NextResponse.json({ ok: true, deleted: slug })
}
