/**
 * EDITING AND REMOVING LISTINGS — the write half the content APIs never had.
 *
 * Every rule lives in content-authority.ts, which is pure. This module only
 * gathers the facts those rules need, performs what they allow, and records
 * it. Nothing here decides anything.
 *
 * ── A COUNT THAT FAILED IS NOT A COUNT OF ZERO ───────────────────────────
 *
 * The delete refusals are built on counting what points at a project. This
 * product creates tables lazily, so a table that has never been written to
 * genuinely does not exist yet, and "no such table" honestly means zero rows.
 * A query that fails for any OTHER reason means we do not know — and reading
 * that as zero would clear the exact path the refusal exists to block, letting
 * a delete strand the leads it was meant to protect.
 *
 * So the two cases are separated: absence of the table is zero, failure of the
 * query is `null`, and any null refuses the delete. Same doctrine as the
 * targeting checker and the Advantage+ check — a system that cannot say "I do
 * not know" reports its own failure as your answer.
 */
import { query } from '@/lib/db'
import { logAuthority } from './authority-db'
import type { Role } from './session-types'
import {
  mayDeleteProject, mayDeleteDeveloper, mayArchiveProject, mayEdit,
  EDITABLE_PROJECT_FIELDS, EDITABLE_DEVELOPER_FIELDS,
  type ProjectAttachments, type ContentVerdict,
} from './content-authority'

export interface Actor { email: string; role: Role }

/**
 * Count rows, telling "the table is not there" apart from "the count failed".
 *
 * Returns 0 for a table that does not exist (lazily created, never written),
 * and null when the count itself failed — which the callers treat as a reason
 * to refuse rather than a reason to proceed.
 */
async function countBySlug(table: string, column: string, slug: string): Promise<number | null> {
  try {
    const exists = await query<{ reg: string | null }>(
      `SELECT to_regclass($1)::text AS reg`, [`public.${table}`],
    )
    if (!exists[0]?.reg) return 0
    const rows = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM ${table} WHERE ${column} = $1`, [slug],
    )
    return Number(rows[0]?.n ?? 0)
  } catch (err) {
    console.error('[content-admin] count failed — treated as UNKNOWN, not zero', { table, slug, err })
    return null
  }
}

export interface AttachmentReport extends ProjectAttachments {
  /** True when at least one count could not be taken. Blocks a hard delete. */
  unknown: boolean
}

/** Everything pointing at this project, for the delete rules to read. */
export async function projectAttachments(slug: string): Promise<AttachmentReport> {
  const [leads, deals, metaCampaigns, machineCampaigns, landingPages] = await Promise.all([
    countBySlug('freehold_site_leads', 'project_slug', slug),
    countBySlug('freehold_site_deals', 'project_slug', slug),
    countBySlug('meta_campaign_projects', 'project_slug', slug),
    countBySlug('freehold_site_ads_machine_campaigns', 'project_slug', slug),
    countBySlug('freehold_site_project_landing_pages', 'project_slug', slug),
  ])
  const unknown = [leads, deals, metaCampaigns, machineCampaigns, landingPages].some((n) => n === null)
  return {
    leads: leads ?? 0,
    deals: deals ?? 0,
    campaigns: (metaCampaigns ?? 0) + (machineCampaigns ?? 0),
    landingPages: landingPages ?? 0,
    unknown,
  }
}

export interface ProjectRow {
  id: string; slug: string; name: string; area: string | null
  developerId: string | null; developerName: string | null
  status: string | null; featured: boolean
}

export async function getProject(slug: string): Promise<ProjectRow | null> {
  const rows = await query<{
    id: string; slug: string; name: string; area: string | null
    developer_id: string | null; developer_name: string | null
    status: string | null; featured: boolean
  }>(
    `SELECT id, slug, name, area, developer_id, developer_name, status, featured
       FROM freehold_site_projects WHERE slug = $1 LIMIT 1`, [slug],
  )
  const r = rows[0]
  if (!r) return null
  return {
    id: r.id, slug: r.slug, name: r.name, area: r.area,
    developerId: r.developer_id, developerName: r.developer_name,
    status: r.status, featured: Boolean(r.featured),
  }
}

/** Record every content act, allowed or refused. A destructive power with no
 *  record is how "who deleted that listing?" becomes unanswerable. */
async function record(
  actor: Actor, action: Parameters<typeof logAuthority>[0]['action'],
  targetType: 'project' | 'developer', targetId: string,
  verdict: ContentVerdict, detail?: string,
): Promise<void> {
  await logAuthority({
    actorEmail: actor.email, actorRole: actor.role, action,
    targetType, targetId,
    decision: { allowed: verdict.allowed, reason: verdict.allowed ? 'management' : 'insufficient_role' },
    detail: detail ?? (verdict.refusal ? `refused: ${verdict.refusal}` : undefined),
  })
}

export interface ActionResult {
  ok: boolean
  verdict: ContentVerdict
  attachments?: AttachmentReport
}

/**
 * Take a project off the public site without destroying anything that points
 * at it. This is what "delete it from the website" nearly always means, and it
 * is the answer offered whenever a hard delete is refused.
 */
export async function archiveProject(slug: string, actor: Actor, restore = false): Promise<ActionResult> {
  const project = await getProject(slug)
  if (!project) return { ok: false, verdict: { allowed: false, refusal: 'not_found' } }

  const verdict = mayArchiveProject(actor.role)
  const action = restore ? 'project.restore' : 'project.archive'
  await record(actor, action, 'project', slug, verdict)
  if (!verdict.allowed) return { ok: false, verdict }

  await query(
    `UPDATE freehold_site_projects
        SET status = $2, featured = CASE WHEN $3 THEN featured ELSE false END,
            updated_at = now()
      WHERE slug = $1`,
    [slug, restore ? 'selling' : 'archived', restore],
  )
  return { ok: true, verdict }
}

/**
 * Destroy the project row and the landing pages that belong to it.
 *
 * Refused whenever a lead, a deal or a campaign points at the slug — those
 * belong to people, not to the listing, and would be stranded pointing at a
 * name that no longer resolves. Refused equally when any of those counts could
 * not be taken.
 */
export async function deleteProject(slug: string, actor: Actor): Promise<ActionResult> {
  const project = await getProject(slug)
  if (!project) return { ok: false, verdict: { allowed: false, refusal: 'not_found' } }

  const attachments = await projectAttachments(slug)
  // An unknown count is treated as the worst case it could be hiding. Naming
  // it `has_leads` would be a lie about which check failed, so the refusal
  // that reaches the screen is the one for the thing most likely stranded.
  const verdict: ContentVerdict = attachments.unknown
    ? { allowed: false, refusal: 'has_leads', archiveInstead: true }
    : mayDeleteProject(actor.role, attachments)

  await record(actor, 'project.delete', 'project', slug, verdict,
    `leads=${attachments.leads} deals=${attachments.deals} campaigns=${attachments.campaigns}`
      + (attachments.unknown ? ' (a count could not be taken)' : ''))
  if (!verdict.allowed) return { ok: false, verdict, attachments }

  // Landing pages belong to the project and carry nobody else's record, so
  // they go with it rather than blocking it.
  await query(`DELETE FROM freehold_site_project_landing_pages WHERE project_slug = $1`, [slug])
  await query(`DELETE FROM freehold_site_project_profiles WHERE project_slug = $1`, [slug]).catch(() => {})
  await query(`DELETE FROM freehold_site_project_microsites WHERE project_slug = $1`, [slug]).catch(() => {})
  await query(`DELETE FROM freehold_site_projects WHERE slug = $1`, [slug])
  return { ok: true, verdict, attachments }
}

/** Type over the presentation fields. Identity and the scraped payload are not
 *  reachable — an edit must not be able to orphan what a delete is refused for. */
export async function updateProject(
  slug: string, patch: Record<string, unknown>, actor: Actor,
): Promise<ActionResult> {
  const project = await getProject(slug)
  if (!project) return { ok: false, verdict: { allowed: false, refusal: 'not_found' } }
  if (!mayEdit(actor.role)) {
    const verdict: ContentVerdict = { allowed: false, refusal: 'insufficient_role' }
    await record(actor, 'project.edit', 'project', slug, verdict)
    return { ok: false, verdict }
  }

  const sets: string[] = []
  const params: unknown[] = [slug]
  for (const field of EDITABLE_PROJECT_FIELDS) {
    if (!(field in patch)) continue
    params.push(patch[field])
    sets.push(`${field} = $${params.length}`)
  }
  if (sets.length === 0) return { ok: true, verdict: { allowed: true } }

  await query(
    `UPDATE freehold_site_projects SET ${sets.join(', ')}, updated_at = now() WHERE slug = $1`,
    params,
  )
  await record(actor, 'project.edit', 'project', slug, { allowed: true },
    `changed: ${sets.map((s) => s.split(' = ')[0]).join(', ')}`)
  return { ok: true, verdict: { allowed: true } }
}

// ── DEVELOPERS ─────────────────────────────────────────────────────────────

export async function developerProjectCount(developerSlug: string): Promise<number | null> {
  try {
    const rows = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM freehold_site_projects p
         JOIN freehold_site_developer_profiles d ON d.id = p.developer_id
        WHERE d.slug = $1`, [developerSlug],
    )
    return Number(rows[0]?.n ?? 0)
  } catch (err) {
    console.error('[content-admin] developer project count failed — UNKNOWN, not zero', { developerSlug, err })
    return null
  }
}

export async function deleteDeveloper(slug: string, actor: Actor): Promise<ActionResult> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM freehold_site_developer_profiles WHERE slug = $1 LIMIT 1`, [slug],
  )
  if (!rows[0]) return { ok: false, verdict: { allowed: false, refusal: 'not_found' } }

  const count = await developerProjectCount(slug)
  // Unknown counts as "still owns projects" — the refusal that keeps a live
  // listing from pointing at a developer that no longer exists.
  const verdict = mayDeleteDeveloper(actor.role, count ?? 1)
  await record(actor, 'developer.delete', 'developer', slug, verdict,
    count === null ? 'project count could not be taken' : `projects=${count}`)
  if (!verdict.allowed) return { ok: false, verdict }

  await query(`DELETE FROM freehold_site_developer_profiles WHERE slug = $1`, [slug])
  return { ok: true, verdict }
}

export async function updateDeveloper(
  slug: string, patch: Record<string, unknown>, actor: Actor,
): Promise<ActionResult> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM freehold_site_developer_profiles WHERE slug = $1 LIMIT 1`, [slug],
  )
  if (!rows[0]) return { ok: false, verdict: { allowed: false, refusal: 'not_found' } }
  if (!mayEdit(actor.role)) {
    const verdict: ContentVerdict = { allowed: false, refusal: 'insufficient_role' }
    await record(actor, 'developer.edit', 'developer', slug, verdict)
    return { ok: false, verdict }
  }

  const sets: string[] = []
  const params: unknown[] = [slug]
  for (const field of EDITABLE_DEVELOPER_FIELDS) {
    if (!(field in patch)) continue
    params.push(patch[field])
    sets.push(`${field} = $${params.length}`)
  }
  if (sets.length === 0) return { ok: true, verdict: { allowed: true } }

  await query(
    `UPDATE freehold_site_developer_profiles SET ${sets.join(', ')} WHERE slug = $1`, params,
  )
  // A developer's display name is denormalised onto every project it owns, so
  // renaming here without following through leaves the listings showing the
  // old name — the exact drift this admin exists to stop.
  if ('name' in patch && typeof patch.name === 'string') {
    await query(
      `UPDATE freehold_site_projects SET developer_name = $2, updated_at = now()
        WHERE developer_id = $1`, [rows[0].id, patch.name],
    )
  }
  await record(actor, 'developer.edit', 'developer', slug, { allowed: true },
    `changed: ${sets.map((s) => s.split(' = ')[0]).join(', ')}`)
  return { ok: true, verdict: { allowed: true } }
}
