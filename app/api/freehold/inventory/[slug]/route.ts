/**
 * ONE LISTING — read it, change it, take it down, or destroy it.
 *
 * Until this route existed the inventory API could create and list, and that
 * was all. Removing a project from the public site required somebody with the
 * production database credentials to write the DELETE by hand: not a
 * permission model, the absence of one. Nobody without database access could
 * remove anything; anybody with it could remove everything; and either way no
 * record was kept.
 *
 * The rules are in lib/freehold/content-authority.ts (pure) and the work is in
 * content-admin-db.ts. This file only reads the request and reports the answer.
 *
 * DELETE takes ?mode=archive to mean "take it off the site but keep the row".
 * That is the honest default for the request people actually make, and it is
 * what a refused hard delete offers as the next step — a refusal with nowhere
 * to go is what sends people back to asking for database access.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import {
  getProject, projectAttachments, updateProject, archiveProject, deleteProject,
} from '@/lib/freehold/content-admin-db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES = [...MANAGEMENT_ROLES, 'marketing'] as const

/** A refusal is a 409, not a 403: the caller had the right, the CONTENT said
 *  no. 403 would send them to ask for a bigger role, which would not help. */
const REFUSAL_STATUS: Record<string, number> = {
  not_found: 404,
  insufficient_role: 403,
  has_leads: 409,
  has_deals: 409,
  has_campaigns: 409,
  has_projects: 409,
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await requireSession([...ROLES])
  if ('res' in auth) return auth.res
  const { slug } = await ctx.params

  const project = await getProject(slug)
  if (!project) return NextResponse.json({ error: 'No listing with that slug' }, { status: 404 })

  // The attachment counts ride along so the screen can say WHY a delete will
  // be refused before the person presses it, rather than after.
  return NextResponse.json({ project, attachments: await projectAttachments(slug) })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await requireSession([...ROLES])
  if ('res' in auth) return auth.res
  const { slug } = await ctx.params

  const patch = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const result = await updateProject(slug, patch, { email: auth.user.email, role: auth.user.role })
  if (!result.ok) {
    return NextResponse.json(
      { error: 'refused', refusal: result.verdict.refusal },
      { status: REFUSAL_STATUS[result.verdict.refusal ?? ''] ?? 400 },
    )
  }
  return NextResponse.json({ ok: true, project: await getProject(slug) })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await requireSession([...ROLES])
  if ('res' in auth) return auth.res
  const { slug } = await ctx.params
  const mode = req.nextUrl.searchParams.get('mode')
  const actor = { email: auth.user.email, role: auth.user.role }

  if (mode === 'archive' || mode === 'restore') {
    const result = await archiveProject(slug, actor, mode === 'restore')
    if (!result.ok) {
      return NextResponse.json(
        { error: 'refused', refusal: result.verdict.refusal },
        { status: REFUSAL_STATUS[result.verdict.refusal ?? ''] ?? 400 },
      )
    }
    return NextResponse.json({ ok: true, mode })
  }

  const result = await deleteProject(slug, actor)
  if (!result.ok) {
    return NextResponse.json({
      error: 'refused',
      refusal: result.verdict.refusal,
      // The two things that turn a dead end into a next step: what is holding
      // it, and the fact that archiving is available instead.
      attachments: result.attachments,
      archiveInstead: result.verdict.archiveInstead ?? false,
    }, { status: REFUSAL_STATUS[result.verdict.refusal ?? ''] ?? 400 })
  }
  return NextResponse.json({ ok: true, deleted: slug, alsoRemoved: result.attachments?.landingPages ?? 0 })
}
