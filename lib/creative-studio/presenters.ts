import { query } from '@/lib/db'
import { PRESENTER_PERSONAS } from './constants'

// ─── Presenter memory ─────────────────────────────────────────────────────────
// Each on-camera persona (Layla / Omar / Sara) gets ONE face generated and
// stored for the whole account. Every video reuses that saved face instead of
// generating a fresh character each time — the same presenter, and a big cut in
// generation cost. Account-scoped (the company's presenters), not per-user.

const TENANT = process.env.ENTRESTATE_TENANT_ID || 'freehold'

export interface SavedPresenter { personaId: string; faceUrl: string; createdAt: string }

let ensured: Promise<void> | null = null
const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_presenters (
      tenant_id  text NOT NULL,
      persona_id text NOT NULL,
      face_url   text NOT NULL,
      prompt     text,
      created_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, persona_id)
    )
  `)
}
const ensureOnce = async () => { if (!ensured) ensured = ensure().catch((e) => { ensured = null; throw e }); await ensured }

export const personaById = (id: string) => PRESENTER_PERSONAS.find((p) => p.id === id) || null

/** All saved faces for the account, keyed by persona id. */
export async function getSavedPresenters(): Promise<Record<string, SavedPresenter>> {
  try {
    await ensureOnce()
    const rows = await query<{ persona_id: string; face_url: string; created_at: string }>(
      `SELECT persona_id, face_url, created_at::text FROM freehold_presenters WHERE tenant_id = $1`, [TENANT])
    const map: Record<string, SavedPresenter> = {}
    for (const r of rows) map[r.persona_id] = { personaId: r.persona_id, faceUrl: r.face_url, createdAt: r.created_at }
    return map
  } catch { return {} }
}

export async function getPresenterFace(personaId: string): Promise<string | null> {
  const all = await getSavedPresenters()
  return all[personaId]?.faceUrl ?? null
}

export async function savePresenterFace(personaId: string, faceUrl: string, prompt: string, by: string): Promise<void> {
  await ensureOnce()
  await query(
    `INSERT INTO freehold_presenters (tenant_id, persona_id, face_url, prompt, created_by)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (tenant_id, persona_id)
     DO UPDATE SET face_url = EXCLUDED.face_url, prompt = EXCLUDED.prompt, created_by = EXCLUDED.created_by, created_at = now()`,
    [TENANT, personaId, faceUrl, prompt.slice(0, 2000), by],
  )
}

export async function deletePresenterFace(personaId: string): Promise<boolean> {
  try {
    await ensureOnce()
    await query(`DELETE FROM freehold_presenters WHERE tenant_id = $1 AND persona_id = $2`, [TENANT, personaId])
    return true
  } catch { return false }
}
