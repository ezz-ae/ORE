import { query } from '@/lib/db'
import { PRESENTER_PERSONAS, GENDER_NOUN } from './constants'

// ─── Presenter memory ─────────────────────────────────────────────────────────
// Each on-camera persona (Layla / Omar / Sara) gets ONE face generated and
// stored for the whole account. Every video reuses that saved face instead of
// generating a fresh character each time — the same presenter, and a big cut in
// generation cost. Account-scoped (the company's presenters), not per-user.

const TENANT = process.env.ENTRESTATE_TENANT_ID || 'freehold'

export interface SavedPresenter {
  personaId: string
  faceUrl: string
  createdAt: string
  /** The prompt the face was generated FROM. Kept because it is the only
   *  evidence of whether a saved face predates the gender fix — see isStaleFace. */
  prompt: string | null
}

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
    const rows = await query<{ persona_id: string; face_url: string; created_at: string; prompt: string | null }>(
      `SELECT persona_id, face_url, created_at::text, prompt FROM freehold_presenters WHERE tenant_id = $1`, [TENANT])
    const map: Record<string, SavedPresenter> = {}
    for (const r of rows) map[r.persona_id] = { personaId: r.persona_id, faceUrl: r.face_url, createdAt: r.created_at, prompt: r.prompt }
    return map
  } catch { return {} }
}

export async function getPresenterFace(personaId: string): Promise<string | null> {
  const all = await getSavedPresenters()
  return all[personaId]?.faceUrl ?? null
}

/**
 * Was this face generated BEFORE the persona's gender was put into the prompt?
 *
 * This matters because a saved face is reused as the image reference for every
 * later creative. Fixing the prompt only fixes NEW faces — a face already saved
 * from the old genderless prompt (the one that rendered Layla as a man) keeps
 * being handed to the image model forever, so the output stays wrong no matter
 * how correct the new prompt is. The stored prompt is the only evidence we
 * have, and it is conclusive: if it never named the persona's gender, that face
 * was a coin flip and should be regenerated.
 *
 * Conservative by design — an unknown/missing prompt is NOT called stale. We
 * flag only what we can actually show is suspect, never guess a face is bad.
 */
export function isStaleFace(saved: SavedPresenter | undefined, gender: string): boolean {
  if (!saved?.prompt) return false
  const noun = GENDER_NOUN[gender]
  if (!noun) return false
  return !new RegExp(`\\b${noun}\\b`, 'i').test(saved.prompt)
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
