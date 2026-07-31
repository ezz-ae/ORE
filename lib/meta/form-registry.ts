/**
 * Local registry of lead forms created FROM this platform — the mirror of the
 * lib/meta/local-store.ts pattern (query() + CREATE TABLE IF NOT EXISTS).
 *
 * Why it exists: a form created via POST /{page}/leadgen_forms sits in Meta's
 * DRAFT state until an ad uses it, and Meta's /{page}/leadgen_forms edge does
 * not reliably return draft forms. Without a local record, a form the user
 * just created can silently vanish from the forms list. Fetching the form BY
 * ID does return drafts — so we remember every id we created and merge any
 * that Meta's list misses back in (see listLeadFormsMerged).
 *
 * Every call fails soft where possible: a registry problem must never break
 * form creation or listing.
 */
import { query } from '@/lib/db'
import { listLeadForms, getLeadForm } from '@/lib/meta/client'
import type { MetaLeadForm } from '@/lib/meta/types'

let ensured: Promise<void> | null = null
async function ensure(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS freehold_site_meta_forms (
          id          text PRIMARY KEY,
          name        text,
          created_by  text,
          created_at  timestamptz DEFAULT now()
        )`)
    })().catch((e) => { ensured = null; throw e })
  }
  await ensured
}

export interface RegisteredForm {
  id: string
  name: string | null
  created_by: string | null
  created_at: string | Date
}

/** Record a platform-created form. Throws on DB failure — callers that must
 *  stay non-fatal (the create route) attach their own .catch. */
export async function registerCreatedForm(
  id: string,
  name: string,
  createdBy: string | null,
): Promise<void> {
  await ensure()
  await query(
    `INSERT INTO freehold_site_meta_forms (id, name, created_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [id, name, createdBy],
  )
}

export async function listRegisteredForms(): Promise<RegisteredForm[]> {
  try {
    await ensure()
    return await query<RegisteredForm>(
      `SELECT id, name, created_by, created_at
       FROM freehold_site_meta_forms
       ORDER BY created_at DESC`,
    )
  } catch {
    return []
  }
}

/**
 * Meta's paginated form list, plus any registered (platform-created) form the
 * list edge missed — fetched individually by id, which DOES return DRAFT
 * forms. A registered id that can't be fetched at all (deleted on Meta) still
 * appears, as a minimal DELETED entry, so a created form can never silently
 * vanish. Meta connection errors (MetaConfigError / MetaApiError) propagate
 * exactly as listLeadForms' always have.
 */
export async function listLeadFormsMerged(): Promise<MetaLeadForm[]> {
  const [metaForms, registered] = await Promise.all([
    listLeadForms(),
    listRegisteredForms(),
  ])
  const known = new Set(metaForms.map((f) => f.id))
  const extras: MetaLeadForm[] = []
  for (const reg of registered) {
    if (known.has(reg.id)) continue
    try {
      extras.push(await getLeadForm(reg.id))
    } catch {
      // "We could not read this form" is NOT "this form was deleted". Calling
      // it DELETED both told the operator something false and excluded it from
      // the lead sweep (which skips DELETED), so a form that was merely
      // unreadable with the token we tried silently stopped syncing. A distinct
      // status renders honestly and keeps it in the sweep, where it may well
      // succeed now that each form is read with its own Page's token.
      extras.push({
        id: reg.id,
        name: reg.name ?? reg.id,
        status: 'UNAVAILABLE',
        leads_count: 0,
        created_time: reg.created_at instanceof Date
          ? reg.created_at.toISOString()
          : String(reg.created_at ?? ''),
      })
    }
  }
  return [...metaForms, ...extras]
}
