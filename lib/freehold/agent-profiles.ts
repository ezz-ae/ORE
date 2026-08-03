import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'

// Public agent "bio-link" profiles — a shareable page (/a/<handle>) an agent
// can put in their Instagram/WhatsApp bio: selected projects, contact buttons,
// and a lead-capture form that drops straight into the CRM assigned to them.

export interface AgentProfile {
  handle: string
  brokerId: string
  displayName: string
  title: string
  phone: string
  whatsapp: string
  email: string
  bio: string
  projectSlugs: string[]
  updatedAt: string | null
}

export interface AgentProfileInput {
  displayName?: string
  title?: string
  phone?: string
  whatsapp?: string
  email?: string
  bio?: string
  projectSlugs?: string[]
}

const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_agent_profiles (
      broker_id     text PRIMARY KEY,
      handle        text UNIQUE NOT NULL,
      display_name  text NOT NULL DEFAULT '',
      title         text NOT NULL DEFAULT '',
      phone         text NOT NULL DEFAULT '',
      whatsapp      text NOT NULL DEFAULT '',
      email         text NOT NULL DEFAULT '',
      bio           text NOT NULL DEFAULT '',
      project_slugs text[] NOT NULL DEFAULT '{}',
      updated_at    timestamptz NOT NULL DEFAULT now()
    )
  `)
}
const ensureOnce = () => dbEnsureOnce('freehold_site_agent_profiles', ensure)

const slugify = (s: string): string =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

const mapRow = (r: Record<string, unknown>): AgentProfile => ({
  handle: String(r.handle ?? ''),
  brokerId: String(r.broker_id ?? ''),
  displayName: String(r.display_name ?? ''),
  title: String(r.title ?? ''),
  phone: String(r.phone ?? ''),
  whatsapp: String(r.whatsapp ?? ''),
  email: String(r.email ?? ''),
  bio: String(r.bio ?? ''),
  projectSlugs: Array.isArray(r.project_slugs) ? (r.project_slugs as string[]) : [],
  updatedAt: r.updated_at ? String(r.updated_at) : null,
})

const SELECT = `broker_id, handle, display_name, title, phone, whatsapp, email, bio, project_slugs, updated_at::text`

export async function getProfileByHandle(handle: string): Promise<AgentProfile | null> {
  try {
    await ensureOnce()
    const rows = await query<Record<string, unknown>>(
      `SELECT ${SELECT} FROM freehold_site_agent_profiles WHERE handle = $1 LIMIT 1`, [handle.toLowerCase()])
    return rows[0] ? mapRow(rows[0]) : null
  } catch { return null }
}

export async function getProfileByBroker(brokerId: string): Promise<AgentProfile | null> {
  try {
    await ensureOnce()
    const rows = await query<Record<string, unknown>>(
      `SELECT ${SELECT} FROM freehold_site_agent_profiles WHERE broker_id = $1 LIMIT 1`, [brokerId])
    return rows[0] ? mapRow(rows[0]) : null
  } catch { return null }
}

/** Pick a unique handle derived from a base (name), avoiding collisions. */
async function uniqueHandle(base: string, brokerId: string): Promise<string> {
  const root = slugify(base) || `agent-${slugify(brokerId).slice(0, 8) || 'x'}`
  for (let i = 0; i < 12; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`
    const rows = await query<{ broker_id: string }>(
      `SELECT broker_id FROM freehold_site_agent_profiles WHERE handle = $1 LIMIT 1`, [candidate])
    if (!rows[0] || rows[0].broker_id === brokerId) return candidate
  }
  return `${root}-${Date.now().toString(36).slice(-4)}`
}

/** Create or update the signed-in agent's own profile. Handle is assigned once
 *  (from the display name) and then kept stable so shared links never break. */
export async function upsertProfile(
  brokerId: string,
  input: AgentProfileInput,
  fallbackName: string,
): Promise<AgentProfile> {
  await ensureOnce()
  const existing = await getProfileByBroker(brokerId)
  const displayName = (input.displayName ?? existing?.displayName ?? fallbackName ?? '').trim() || 'Agent'
  const handle = existing?.handle ?? await uniqueHandle(displayName, brokerId)
  const slugs = (input.projectSlugs ?? existing?.projectSlugs ?? []).filter(Boolean).slice(0, 24)

  const rows = await query<Record<string, unknown>>(
    `INSERT INTO freehold_site_agent_profiles
       (broker_id, handle, display_name, title, phone, whatsapp, email, bio, project_slugs, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (broker_id) DO UPDATE SET
       display_name = $3, title = $4, phone = $5, whatsapp = $6, email = $7, bio = $8,
       project_slugs = $9, updated_at = now()
     RETURNING ${SELECT}`,
    [
      brokerId, handle, displayName,
      (input.title ?? existing?.title ?? '').trim(),
      (input.phone ?? existing?.phone ?? '').trim(),
      (input.whatsapp ?? existing?.whatsapp ?? '').trim(),
      (input.email ?? existing?.email ?? '').trim(),
      (input.bio ?? existing?.bio ?? '').trim(),
      slugs,
    ],
  )
  return mapRow(rows[0])
}
