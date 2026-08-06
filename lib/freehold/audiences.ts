import { randomUUID } from 'node:crypto'
import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'
import type { CampaignTargeting } from '@/lib/meta/types'

// ─── Saved audiences ──────────────────────────────────────────────────────────
// The persistent home for audience work. Everything a marketer builds — a
// behavioral segment, a narrow AND-stacked definition, a lookalike seeded from
// an uploaded lead list — lives here as a named, reusable asset that the
// campaign wizard attaches in one click. Nothing is UI-only state anymore.

export type AudienceKind = 'behavioral' | 'narrow' | 'lookalike' | 'custom_list'

export interface SavedAudience {
  id: string
  name: string
  description: string
  kind: AudienceKind
  /** Full targeting definition (geo/age/gender/language/interests/behaviors/narrowing/exclusions/customAudienceIds). */
  spec: CampaignTargeting
  /** Meta ids when this audience has a server-side counterpart. */
  metaSourceAudienceId: string | null
  metaLookalikeId: string | null
  /** How many seed contacts were uploaded (lookalikes only). */
  uploadedCount: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

const KINDS = new Set<AudienceKind>(['behavioral', 'narrow', 'lookalike', 'custom_list'])

const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_audiences (
      id                       text PRIMARY KEY,
      name                     text NOT NULL,
      description              text NOT NULL DEFAULT '',
      kind                     text NOT NULL DEFAULT 'behavioral',
      spec                     jsonb NOT NULL DEFAULT '{}'::jsonb,
      meta_source_audience_id  text,
      meta_lookalike_id        text,
      uploaded_count           int NOT NULL DEFAULT 0,
      created_by               text NOT NULL DEFAULT '',
      created_at               timestamptz NOT NULL DEFAULT now(),
      updated_at               timestamptz NOT NULL DEFAULT now()
    )
  `)
}
const ensureOnce = () => dbEnsureOnce('freehold_site_audiences', ensure)

const DEFAULT_SPEC: CampaignTargeting = {
  countries: ['AE'],
  cityKeys: [],
  ageMin: 25,
  ageMax: 55,
  publisherPlatforms: ['facebook', 'instagram'],
  interests: [],
}

// Sanitize a stored/user-provided spec into a valid CampaignTargeting — bad
// entries are dropped, never guessed.
export function normalizeSpec(raw: unknown): CampaignTargeting {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 30) : []
  const entities = (v: unknown): { id: string; name: string }[] =>
    Array.isArray(v)
      ? v
          .filter((x): x is { id: unknown; name: unknown } => !!x && typeof x === 'object')
          .map((x) => ({ id: String(x.id ?? ''), name: String(x.name ?? '') }))
          .filter((x) => x.id && x.name)
          .slice(0, 25)
      : []
  const groups = (v: unknown) =>
    Array.isArray(v)
      ? v
          .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
          .map((g) => ({ interests: entities(g.interests), behaviors: entities(g.behaviors) }))
          .filter((g) => g.interests.length + g.behaviors.length > 0)
          .slice(0, 3)
      : []
  const num = (v: unknown, min: number, max: number, dflt: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : dflt
  }
  const exclusionsRaw = (r.exclusions && typeof r.exclusions === 'object' ? r.exclusions : {}) as Record<string, unknown>
  const exclusions = { interests: entities(exclusionsRaw.interests), behaviors: entities(exclusionsRaw.behaviors) }
  return {
    countries: strings(r.countries).length ? strings(r.countries) : DEFAULT_SPEC.countries,
    cityKeys: strings(r.cityKeys),
    ageMin: num(r.ageMin, 18, 65, DEFAULT_SPEC.ageMin),
    ageMax: num(r.ageMax, 18, 65, DEFAULT_SPEC.ageMax),
    publisherPlatforms: strings(r.publisherPlatforms).length ? strings(r.publisherPlatforms) : DEFAULT_SPEC.publisherPlatforms,
    interests: entities(r.interests),
    genders: Array.isArray(r.genders) ? r.genders.map(Number).filter((n) => n === 1 || n === 2) : undefined,
    locales: Array.isArray(r.locales) ? r.locales.map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 10) : undefined,
    // Only the three languages the landing pages actually serve. An audience
    // narrowed to a language we cannot then show a page in would spend money
    // to deliver a worse experience than no narrowing at all.
    leadLanguages: Array.isArray(r.leadLanguages)
      ? Array.from(new Set(r.leadLanguages.map(String).filter((c) => c === 'en' || c === 'ar' || c === 'ru')))
      : undefined,
    behaviors: entities(r.behaviors),
    narrowing: groups(r.narrowing),
    exclusions: exclusions.interests.length + exclusions.behaviors.length > 0 ? exclusions : undefined,
    customAudienceIds: strings(r.customAudienceIds),
  }
}

const mapRow = (r: Record<string, unknown>): SavedAudience => ({
  id: String(r.id ?? ''),
  name: String(r.name ?? ''),
  description: String(r.description ?? ''),
  kind: KINDS.has(r.kind as AudienceKind) ? (r.kind as AudienceKind) : 'behavioral',
  spec: normalizeSpec(typeof r.spec === 'string' ? JSON.parse(r.spec) : r.spec),
  metaSourceAudienceId: r.meta_source_audience_id ? String(r.meta_source_audience_id) : null,
  metaLookalikeId: r.meta_lookalike_id ? String(r.meta_lookalike_id) : null,
  uploadedCount: Number(r.uploaded_count ?? 0) || 0,
  createdBy: String(r.created_by ?? ''),
  createdAt: String(r.created_at ?? ''),
  updatedAt: String(r.updated_at ?? ''),
})

export async function listAudiences(): Promise<SavedAudience[]> {
  await ensureOnce()
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM freehold_site_audiences ORDER BY updated_at DESC LIMIT 200`,
  )
  return rows.map(mapRow)
}

export async function getAudience(id: string): Promise<SavedAudience | null> {
  await ensureOnce()
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM freehold_site_audiences WHERE id = $1 LIMIT 1`,
    [id],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function createAudience(params: {
  name: string
  description?: string
  kind: AudienceKind
  spec: unknown
  metaSourceAudienceId?: string | null
  metaLookalikeId?: string | null
  uploadedCount?: number
  createdBy: string
}): Promise<SavedAudience> {
  await ensureOnce()
  const id = `aud-${randomUUID()}`
  const kind = KINDS.has(params.kind) ? params.kind : 'behavioral'
  const spec = normalizeSpec(params.spec)
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO freehold_site_audiences
       (id, name, description, kind, spec, meta_source_audience_id, meta_lookalike_id, uploaded_count, created_by)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
     RETURNING *`,
    [
      id,
      params.name.trim().slice(0, 120),
      (params.description ?? '').trim().slice(0, 500),
      kind,
      JSON.stringify(spec),
      params.metaSourceAudienceId ?? null,
      params.metaLookalikeId ?? null,
      Math.max(0, Math.round(params.uploadedCount ?? 0)),
      params.createdBy.slice(0, 200),
    ],
  )
  return mapRow(rows[0])
}

export async function updateAudience(
  id: string,
  patch: { name?: string; description?: string; spec?: unknown },
): Promise<SavedAudience | null> {
  await ensureOnce()
  const current = await getAudience(id)
  if (!current) return null
  const rows = await query<Record<string, unknown>>(
    `UPDATE freehold_site_audiences
     SET name = $2, description = $3, spec = $4::jsonb, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      (patch.name ?? current.name).trim().slice(0, 120),
      (patch.description ?? current.description).trim().slice(0, 500),
      JSON.stringify(patch.spec !== undefined ? normalizeSpec(patch.spec) : current.spec),
    ],
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function deleteAudience(id: string): Promise<boolean> {
  await ensureOnce()
  const rows = await query<{ id: string }>(
    `DELETE FROM freehold_site_audiences WHERE id = $1 RETURNING id`,
    [id],
  )
  return rows.length > 0
}
