import { randomUUID } from 'node:crypto'
import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'
import type { CampaignTargeting } from '@/lib/meta/types'
import { REACHABLE_LEAD_LANGUAGES, SUPPORTED_LEAD_LANGUAGES, type LeadLanguage } from '@/lib/meta/lead-language'
import { planPattern, parsePattern, describePattern } from '@/lib/freehold/audience-pattern'

// ─── Saved audiences ──────────────────────────────────────────────────────────
// The persistent home for audience work. Everything a marketer builds — a
// behavioral segment, a narrow AND-stacked definition, a lookalike seeded from
// an uploaded lead list — lives here as a named, reusable asset that the
// campaign wizard attaches in one click. Nothing is UI-only state anymore.

export type AudienceKind = 'behavioral' | 'narrow' | 'lookalike' | 'custom_list' | 'pattern'

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
  /** For 'pattern' audiences: the person-description it was built from. */
  pattern: unknown | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

/** Meta accepts `flexible_spec` with a base plus additional narrowing groups.
 *  Five is comfortably inside what the Graph API takes and well past what any
 *  pattern produces; the point is that the ceiling is a platform limit rather
 *  than a number that silently eats a trait someone chose. */
export const MAX_NARROWING_GROUPS = 5

const KINDS = new Set<AudienceKind>(['behavioral', 'narrow', 'lookalike', 'custom_list', 'pattern'])

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
      -- The PATTERN a 'pattern' audience was built from. The spec beside it is
      -- the resolved targeting; this is the description of the person that
      -- produced it. Kept so the audience can be re-opened and re-tuned in the
      -- words it was created in — a saved spec alone can be launched but never
      -- edited, because nobody can read a narrowing group back into a person.
      pattern                  jsonb,
      created_by               text NOT NULL DEFAULT '',
      created_at               timestamptz NOT NULL DEFAULT now(),
      updated_at               timestamptz NOT NULL DEFAULT now()
    )
  `)
  // The table predates patterns. CREATE TABLE IF NOT EXISTS is a no-op on every
  // deployment that already has it, so the column above would never arrive.
  await query(`ALTER TABLE freehold_site_audiences ADD COLUMN IF NOT EXISTS pattern jsonb`)
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

/**
 * COMBINE several audiences into one campaign audience.
 *
 * The operator picks more than one saved audience and the machine merges them
 * silently — no split screen, no explanation. Union semantics: someone who
 * fits ANY of the picked audiences is in.
 *
 *  · countries, languages, base signals, Meta custom lists — union
 *  · age — the widest envelope any audience asked for
 *  · exclusions — union (excluded by one audience = excluded, full stop)
 *  · must-groups (narrowing) — only the groups EVERY audience carries stay
 *    hard (in practice, the property-interest group they all share). Each
 *    audience's own hard layers become base signals in the union: keeping
 *    them all hard would target the INTERSECTION, the opposite of combining.
 */
export function combineSpecs(specs: CampaignTargeting[]): CampaignTargeting {
  if (specs.length <= 1) return specs[0] ?? DEFAULT_SPEC
  type Ent = { id: string; name: string }
  const uniq = (xs: Ent[]): Ent[] => {
    const seen = new Map<string, Ent>()
    for (const x of xs) if (x?.id && !seen.has(x.id)) seen.set(x.id, x)
    return [...seen.values()]
  }
  const groupSig = (g: { interests?: Ent[]; behaviors?: Ent[] }) =>
    [...(g.interests ?? []), ...(g.behaviors ?? [])].map((e) => e.id).sort().join(',')

  // Must-groups present in every spec (matched by their exact member set).
  const sigCounts = new Map<string, number>()
  for (const s of specs) {
    for (const sig of new Set((s.narrowing ?? []).map(groupSig))) {
      sigCounts.set(sig, (sigCounts.get(sig) ?? 0) + 1)
    }
  }
  const sharedSigs = new Set([...sigCounts].filter(([, n]) => n === specs.length).map(([sig]) => sig))
  const sharedGroups: NonNullable<CampaignTargeting['narrowing']> = []
  const pooled: { interests: Ent[]; behaviors: Ent[] } = { interests: [], behaviors: [] }
  const seenShared = new Set<string>()
  for (const s of specs) {
    for (const g of s.narrowing ?? []) {
      const sig = groupSig(g)
      if (sharedSigs.has(sig)) {
        if (!seenShared.has(sig)) { seenShared.add(sig); sharedGroups.push(g) }
      } else {
        pooled.interests.push(...(g.interests ?? []))
        pooled.behaviors.push(...(g.behaviors ?? []))
      }
    }
  }

  // Language/locale narrowing survives only when EVERY audience narrows —
  // an audience with no language reaches everyone, and the union must too.
  const allLangs = specs.every((s) => (s.leadLanguages?.length ?? 0) > 0)
    ? [...new Set(specs.flatMap((s) => s.leadLanguages ?? []))]
    : undefined
  const allLocales = specs.every((s) => (s.locales?.length ?? 0) > 0)
    ? [...new Set(specs.flatMap((s) => s.locales ?? []))]
    : undefined
  const genderSet = new Set(specs.map((s) => (s.genders ?? []).join(',')))

  return {
    countries: [...new Set(specs.flatMap((s) => s.countries))],
    cityKeys: [...new Set(specs.flatMap((s) => s.cityKeys ?? []))],
    ageMin: Math.min(...specs.map((s) => s.ageMin)),
    ageMax: Math.max(...specs.map((s) => s.ageMax)),
    publisherPlatforms: [...new Set(specs.flatMap((s) => s.publisherPlatforms ?? []))],
    interests: uniq([...specs.flatMap((s) => s.interests ?? []), ...pooled.interests]),
    behaviors: uniq([...specs.flatMap((s) => s.behaviors ?? []), ...pooled.behaviors]),
    narrowing: sharedGroups,
    ...(genderSet.size === 1 && specs[0].genders?.length ? { genders: specs[0].genders } : {}),
    ...(allLangs ? { leadLanguages: allLangs as CampaignTargeting['leadLanguages'] } : {}),
    ...(allLocales ? { locales: allLocales } : {}),
    exclusions: (() => {
      const i = uniq(specs.flatMap((s) => s.exclusions?.interests ?? []))
      const b = uniq(specs.flatMap((s) => s.exclusions?.behaviors ?? []))
      return i.length + b.length > 0 ? { interests: i, behaviors: b } : undefined
    })(),
    customAudienceIds: [...new Set(specs.flatMap((s) => s.customAudienceIds ?? []))],
  }
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
          // Meta's own ceiling, not an arbitrary three. At strictness 100 a
          // pattern binds every trait, so four traits produced four groups and
          // the fourth was dropped on the way to storage — quietly breaking
          // the one promise `updateAudience` makes, that the stored pattern
          // still produces the stored spec.
          .slice(0, MAX_NARROWING_GROUPS)
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
    // Every language the ad can REACH, which is wider than the three the
    // landing pages are written in. Filtering to the page languages here was
    // silently deleting the second half of every language bundle: an audience
    // saved as "Arabic and Urdu speakers" came back Arabic-only, with nothing
    // on any screen saying it had been narrowed.
    leadLanguages: Array.isArray(r.leadLanguages)
      ? Array.from(new Set(r.leadLanguages.map(String))).filter((c): c is LeadLanguage =>
          (REACHABLE_LEAD_LANGUAGES as readonly string[]).includes(c))
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
  pattern: r.pattern == null ? null : typeof r.pattern === 'string' ? JSON.parse(r.pattern) : r.pattern,
  createdBy: String(r.created_by ?? ''),
  createdAt: String(r.created_at ?? ''),
  updatedAt: String(r.updated_at ?? ''),
})

/**
 * An audience as the BROWSER is allowed to see it.
 *
 * A pattern audience's spec is the recipe — the interest ids, the narrowing
 * groups, the locales that a description of a person was translated into. Ship
 * it to the client once and it lives in the network tab, and anyone who reads
 * it can rebuild the same audience in Ads Manager for nothing. So it does not
 * go. The pattern itself does: it is the operator's own words back, and it is
 * what re-opening the builder needs.
 *
 * Audiences the operator built by hand keep their spec — it is theirs, they
 * typed it, and the screens that show it are showing them their own work.
 */
export type PublicAudience = Omit<SavedAudience, 'spec'> & { spec?: CampaignTargeting }

export function forClient(a: SavedAudience): PublicAudience {
  if (a.kind !== 'pattern') return a
  const { spec: _spec, ...rest } = a
  return rest
}

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
  /** Only for kind 'pattern'. Stored verbatim so the audience stays editable
   *  in the vocabulary it was created in. */
  pattern?: unknown
  createdBy: string
}): Promise<SavedAudience> {
  await ensureOnce()
  const id = `aud-${randomUUID()}`
  const kind = KINDS.has(params.kind) ? params.kind : 'behavioral'
  const spec = normalizeSpec(params.spec)
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO freehold_site_audiences
       (id, name, description, kind, spec, meta_source_audience_id, meta_lookalike_id, uploaded_count, created_by, pattern)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb)
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
      params.pattern == null ? null : JSON.stringify(params.pattern),
    ],
  )
  return mapRow(rows[0])
}

export async function updateAudience(
  id: string,
  patch: { name?: string; description?: string; spec?: unknown; pattern?: unknown },
): Promise<SavedAudience | null> {
  await ensureOnce()
  const current = await getAudience(id)
  if (!current) return null

  // RE-TUNING REWRITES BOTH HALVES, HERE.
  //
  // A stored pattern that no longer produces the stored spec shows the
  // operator one person and launches a different one, and nothing on any
  // screen can reveal the gap — the card renders the pattern, the ad set uses
  // the spec. So the spec is REDERIVED from the pattern rather than trusted
  // from the caller.
  //
  // This lives in the writer, not in the route that happens to call it. The
  // route enforcing it was the same mistake this codebase keeps making: an
  // invariant stated in a comment and applied at one of the call sites, which
  // holds exactly until a second caller appears.
  let patched = patch
  if (current.kind === 'pattern') {
    // A posted spec is discarded outright on a pattern audience, whether or
    // not a pattern came with it. Honouring one would let a caller set
    // targeting the pattern never produced — the same drift by another route.
    // `!= null`, not `!== undefined`. A client that serialises its whole state
    // sends `pattern: null`, and treating that as "here is the new pattern"
    // reset the audience to the all-defaults person — overwriting its
    // targeting with generic UAE 18-65 and renaming its description, with no
    // error anywhere. A null means "unchanged", never "blank it".
    const next = parsePattern(patch.pattern != null ? patch.pattern : current.pattern)
    patched = {
      ...patch,
      spec: planPattern(next, [...SUPPORTED_LEAD_LANGUAGES]).targeting,
      description: patch.description ?? describePattern(next),
      pattern: next,
    }
  }

  const rows = await query<Record<string, unknown>>(
    `UPDATE freehold_site_audiences
     SET name = $2, description = $3, spec = $4::jsonb, pattern = $5::jsonb, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      (patched.name ?? current.name).trim().slice(0, 120),
      (patched.description ?? current.description).trim().slice(0, 500),
      JSON.stringify(patched.spec !== undefined ? normalizeSpec(patched.spec) : current.spec),
      (() => {
        const p = patched.pattern !== undefined ? patched.pattern : current.pattern
        return p == null ? null : JSON.stringify(p)
      })(),
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
