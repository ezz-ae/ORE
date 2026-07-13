// Broker landing-page edit requests — the "propose a draft, a manager publishes
// it" workflow. Landing pages are editable directly only by the non-broker
// accounts (Cor / Bashar / Yamen). A broker instead opens a DRAFT copy in the
// editor, saves it here, and sends it for approval; any of the three approvers
// then publishes it (applying the proposal to the live page) or sends it back.
//
// The proposal never touches the live page until an approver publishes it —
// nothing on the site changes on a broker's word alone (honest-state rule).

import { query } from '@/lib/db'
import { getLandingPageForEditor } from '@/lib/landing-pages'

export type EditRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected'

export interface ProposedSection {
  type: string
  data: Record<string, unknown>
}

export interface LandingEditRequest {
  id: string
  landingSlug: string
  projectSlug: string | null
  landingHeadline: string | null
  requestedBy: string
  requestedByName: string | null
  status: EditRequestStatus
  proposedFields: Record<string, unknown>
  proposedSections: ProposedSection[] | null
  note: string | null
  reviewNote: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

type Row = {
  id: string
  landing_slug: string
  project_slug: string | null
  landing_headline: string | null
  requested_by: string
  requested_by_name: string | null
  status: string
  proposed_fields: Record<string, unknown> | null
  proposed_sections: ProposedSection[] | null
  note: string | null
  review_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

function mapRow(r: Row): LandingEditRequest {
  return {
    id: r.id,
    landingSlug: r.landing_slug,
    projectSlug: r.project_slug,
    landingHeadline: r.landing_headline,
    requestedBy: r.requested_by,
    requestedByName: r.requested_by_name,
    status: (['draft', 'pending', 'approved', 'rejected'].includes(r.status) ? r.status : 'draft') as EditRequestStatus,
    proposedFields: r.proposed_fields ?? {},
    proposedSections: Array.isArray(r.proposed_sections) ? r.proposed_sections : null,
    note: r.note,
    reviewNote: r.review_note,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

let ensured: Promise<void> | null = null
export function ensureLandingEditSchema(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      try {
        await query(
          `CREATE TABLE IF NOT EXISTS freehold_site_landing_edit_requests (
            id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            landing_slug      TEXT NOT NULL,
            project_slug      TEXT,
            requested_by      TEXT NOT NULL,
            requested_by_name TEXT,
            status            TEXT NOT NULL DEFAULT 'draft',
            proposed_fields   JSONB NOT NULL DEFAULT '{}',
            proposed_sections JSONB,
            note              TEXT,
            review_note       TEXT,
            reviewed_by       TEXT,
            reviewed_at       TIMESTAMPTZ,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
          )`,
          [],
        )
        await query(`CREATE INDEX IF NOT EXISTS idx_le_reqs_status ON freehold_site_landing_edit_requests(status)`, [])
        await query(`CREATE INDEX IF NOT EXISTS idx_le_reqs_by ON freehold_site_landing_edit_requests(requested_by)`, [])
        await query(`CREATE INDEX IF NOT EXISTS idx_le_reqs_slug ON freehold_site_landing_edit_requests(landing_slug)`, [])
      } catch {
        ensured = null // allow a retry on the next call
      }
    })()
  }
  return ensured
}

const cleanSections = (v: unknown): ProposedSection[] | null =>
  Array.isArray(v)
    ? v
        .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && typeof (s as Record<string, unknown>).type === 'string')
        .map((s) => ({ type: String(s.type), data: s.data && typeof s.data === 'object' ? (s.data as Record<string, unknown>) : {} }))
    : null

const SELECT = `
  r.id, r.landing_slug, r.project_slug, r.requested_by, r.requested_by_name, r.status,
  r.proposed_fields, r.proposed_sections, r.note, r.review_note, r.reviewed_by,
  r.reviewed_at::text, r.created_at::text, r.updated_at::text,
  lp.headline AS landing_headline`

/** The broker's current, still-open (draft or pending) request for a landing. */
export async function getOpenRequest(landingSlug: string, requestedBy: string): Promise<LandingEditRequest | null> {
  await ensureLandingEditSchema()
  try {
    const rows = await query<Row>(
      `SELECT ${SELECT}
       FROM freehold_site_landing_edit_requests r
       LEFT JOIN freehold_site_project_landing_pages lp ON lower(lp.slug) = lower(r.landing_slug)
       WHERE lower(r.landing_slug) = lower($1) AND r.requested_by = $2 AND r.status IN ('draft','pending')
       ORDER BY r.updated_at DESC LIMIT 1`,
      [landingSlug, requestedBy],
    )
    return rows[0] ? mapRow(rows[0]) : null
  } catch { return null }
}

export async function getRequest(id: string): Promise<LandingEditRequest | null> {
  await ensureLandingEditSchema()
  try {
    const rows = await query<Row>(
      `SELECT ${SELECT}
       FROM freehold_site_landing_edit_requests r
       LEFT JOIN freehold_site_project_landing_pages lp ON lower(lp.slug) = lower(r.landing_slug)
       WHERE r.id = $1 LIMIT 1`,
      [id],
    )
    return rows[0] ? mapRow(rows[0]) : null
  } catch { return null }
}

export async function listRequests(opts: { statuses?: EditRequestStatus[]; requestedBy?: string; limit?: number } = {}): Promise<LandingEditRequest[]> {
  await ensureLandingEditSchema()
  const where: string[] = []
  const args: unknown[] = []
  if (opts.statuses && opts.statuses.length) { args.push(opts.statuses); where.push(`r.status = ANY($${args.length})`) }
  if (opts.requestedBy) { args.push(opts.requestedBy); where.push(`r.requested_by = $${args.length}`) }
  args.push(Math.min(Math.max(opts.limit ?? 100, 1), 500))
  try {
    const rows = await query<Row>(
      `SELECT ${SELECT}
       FROM freehold_site_landing_edit_requests r
       LEFT JOIN freehold_site_project_landing_pages lp ON lower(lp.slug) = lower(r.landing_slug)
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY r.updated_at DESC LIMIT $${args.length}`,
      args,
    )
    return rows.map(mapRow)
  } catch { return [] }
}

/**
 * Create or update the broker's open draft for a landing. One open row per
 * (landing, broker): editing an already-submitted request pulls it back to draft
 * so the broker can keep working before re-sending.
 */
export async function saveDraft(input: {
  landingSlug: string
  projectSlug?: string | null
  requestedBy: string
  requestedByName?: string | null
  proposedFields?: Record<string, unknown>
  proposedSections?: unknown
  note?: string | null
  submit?: boolean
}): Promise<LandingEditRequest | null> {
  await ensureLandingEditSchema()
  const status: EditRequestStatus = input.submit ? 'pending' : 'draft'
  const fields = input.proposedFields && typeof input.proposedFields === 'object' ? input.proposedFields : {}
  const sections = cleanSections(input.proposedSections)
  try {
    const open = await getOpenRequest(input.landingSlug, input.requestedBy)
    if (open) {
      const rows = await query<{ id: string }>(
        `UPDATE freehold_site_landing_edit_requests
         SET proposed_fields = $2::jsonb,
             proposed_sections = $3::jsonb,
             note = COALESCE($4, note),
             status = $5,
             updated_at = now()
         WHERE id = $1 RETURNING id`,
        [open.id, JSON.stringify(fields), sections ? JSON.stringify(sections) : null, input.note ?? null, status],
      )
      return rows[0] ? getRequest(rows[0].id) : null
    }
    const rows = await query<{ id: string }>(
      `INSERT INTO freehold_site_landing_edit_requests
         (landing_slug, project_slug, requested_by, requested_by_name, status, proposed_fields, proposed_sections, note)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
       RETURNING id`,
      [
        input.landingSlug, input.projectSlug ?? null, input.requestedBy, input.requestedByName ?? null,
        status, JSON.stringify(fields), sections ? JSON.stringify(sections) : null, input.note ?? null,
      ],
    )
    return rows[0] ? getRequest(rows[0].id) : null
  } catch { return null }
}

/** Owner submits their draft for approval (draft → pending). */
export async function submitDraft(id: string, requestedBy: string): Promise<{ ok: boolean }> {
  await ensureLandingEditSchema()
  try {
    const rows = await query<{ id: string }>(
      `UPDATE freehold_site_landing_edit_requests
       SET status = 'pending', updated_at = now()
       WHERE id = $1 AND requested_by = $2 AND status = 'draft' RETURNING id`,
      [id, requestedBy],
    )
    return { ok: !!rows[0] }
  } catch { return { ok: false } }
}

/** Apply the proposal's fields + sections to the live landing and publish it. */
async function applyProposal(req: LandingEditRequest, reviewerName: string): Promise<boolean> {
  const existing = await getLandingPageForEditor(req.landingSlug)
  if (!existing) return false
  const f = req.proposedFields || {}
  const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() ? v : fallback)
  const headline = str(f.headline, existing.headline)
  if (!headline) return false
  const subheadline = str(f.subheadline, existing.subheadline)
  const heroImage = str(f.heroImage, existing.heroImage)
  const ctaText = str(f.ctaText, existing.ctaText)
  const seoTitle = str(f.seoTitle, existing.seoTitle)
  const seoDescription = str(f.seoDescription, existing.seoDescription)
  const slug = req.landingSlug.trim().toLowerCase()
  const nowIso = new Date().toISOString()

  await query(
    `UPDATE freehold_site_project_landing_pages
     SET headline = $2, title = $2,
         subheadline = $3, subtitle = $3,
         hero_image = $4, cta_text = $5,
         seo_title = $6, meta_title = $6,
         seo_description = $7, meta_description = $7,
         status = 'published', publish_status = 'published',
         authorized_by = $8, authorized_at = $9,
         updated_at = now()
     WHERE lower(slug) = $1`,
    [slug, headline, subheadline, heroImage, ctaText, seoTitle, seoDescription, reviewerName, nowIso],
  )
  if (req.proposedSections && req.proposedSections.length) {
    await query(
      `UPDATE freehold_site_project_landing_pages
       SET sections_json = $2::jsonb, sections = $2::jsonb, updated_at = now()
       WHERE lower(slug) = $1`,
      [slug, JSON.stringify(req.proposedSections)],
    )
  }
  return true
}

/** Approver publishes a pending proposal: apply it live, mark approved. */
export async function approveRequest(id: string, reviewerName: string): Promise<{ ok: boolean; reason?: string }> {
  await ensureLandingEditSchema()
  try {
    const req = await getRequest(id)
    if (!req) return { ok: false, reason: 'not_found' }
    if (req.status !== 'pending') return { ok: false, reason: 'not_pending' }
    const applied = await applyProposal(req, reviewerName)
    if (!applied) return { ok: false, reason: 'landing_missing' }
    const rows = await query<{ id: string }>(
      `UPDATE freehold_site_landing_edit_requests
       SET status = 'approved', reviewed_by = $2, reviewed_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'pending' RETURNING id`,
      [id, reviewerName],
    )
    return { ok: !!rows[0] }
  } catch { return { ok: false, reason: 'error' } }
}

/** Approver sends a pending proposal back with a note (pending → rejected). */
export async function rejectRequest(id: string, reviewerName: string, note: string): Promise<{ ok: boolean }> {
  await ensureLandingEditSchema()
  try {
    const rows = await query<{ id: string }>(
      `UPDATE freehold_site_landing_edit_requests
       SET status = 'rejected', review_note = $3, reviewed_by = $2, reviewed_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'pending' RETURNING id`,
      [id, reviewerName, note || null],
    )
    return { ok: !!rows[0] }
  } catch { return { ok: false } }
}

/** Count of pending requests — for the approvals inbox badge. */
export async function countPendingRequests(): Promise<number> {
  await ensureLandingEditSchema()
  try {
    const rows = await query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM freehold_site_landing_edit_requests WHERE status = 'pending'`,
      [],
    )
    return Number(rows[0]?.n ?? 0) || 0
  } catch { return 0 }
}
