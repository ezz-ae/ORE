import { randomUUID } from 'node:crypto'
import { query, ensureOnce as dbEnsureOnce } from '@/lib/db'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'

// Real, DB-backed Notebook conversations. Replaces the demo seed that used to
// be served to every user. Each row is one AI research/drafting thread owned by
// the user who started it; management can read the whole team's threads.

export interface NotebookMessage { role: 'user' | 'assistant'; content: string; createdAt: string }

/** Shape the notebook UI expects for a saved output. Threads created via chat
 *  have none yet, but the type keeps the detail-page render well-typed. */
export interface StoredOutput {
  id: string
  type: string
  title: string
  content: string
  pinned: boolean
  tags: string[]
}

export interface StoredConversation {
  id: string
  userId: string
  title: string
  relatedProjectIds: string[]
  relatedLeadIds: string[]
  relatedCampaignIds: string[]
  messages: NotebookMessage[]
  savedOutputs: StoredOutput[]
  createdAt: string
  updatedAt: string
}

const isMgmt = (role?: Role | string | null) => MANAGEMENT_ROLES.includes(role as Role)

const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_notebook_conversations (
      id          text PRIMARY KEY,
      user_email  text NOT NULL,
      title       text NOT NULL DEFAULT 'Untitled',
      messages    jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    )
  `)
}
const ensureOnce = () => dbEnsureOnce('freehold_site_notebook_conversations', ensure)

const parseMessages = (v: unknown): NotebookMessage[] => {
  let raw: unknown = v
  if (typeof v === 'string') { try { raw = JSON.parse(v) } catch { raw = [] } }
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? ''),
      createdAt: String(m.createdAt ?? ''),
    }))
}

const mapRow = (r: Record<string, unknown>): StoredConversation => ({
  id: String(r.id),
  userId: String(r.user_email ?? ''),
  title: String(r.title ?? 'Untitled'),
  relatedProjectIds: [],
  relatedLeadIds: [],
  relatedCampaignIds: [],
  messages: parseMessages(r.messages),
  savedOutputs: [],
  createdAt: String(r.created_at ?? ''),
  updatedAt: String(r.updated_at ?? ''),
})

const titleFrom = (text: string): string => {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= 60 ? t || 'Untitled' : `${t.slice(0, 57)}…`
}

/** Recent threads. Management sees the whole team's; others see their own. */
export async function listConversations(email: string, role?: Role | string | null): Promise<StoredConversation[]> {
  try {
    await ensureOnce()
    const rows = isMgmt(role)
      ? await query<Record<string, unknown>>(
          `SELECT id, user_email, title, messages, created_at::text, updated_at::text
           FROM freehold_site_notebook_conversations ORDER BY updated_at DESC LIMIT 100`)
      : await query<Record<string, unknown>>(
          `SELECT id, user_email, title, messages, created_at::text, updated_at::text
           FROM freehold_site_notebook_conversations WHERE user_email = $1 ORDER BY updated_at DESC LIMIT 100`,
          [email])
    return rows.map(mapRow)
  } catch {
    return []
  }
}

/** One thread, scoped to the owner unless the caller is management. */
export async function getConversation(id: string, email: string, role?: Role | string | null): Promise<StoredConversation | null> {
  try {
    await ensureOnce()
    const rows = await query<Record<string, unknown>>(
      `SELECT id, user_email, title, messages, created_at::text, updated_at::text
       FROM freehold_site_notebook_conversations WHERE id = $1 LIMIT 1`, [id])
    if (!rows[0]) return null
    const conv = mapRow(rows[0])
    if (conv.userId !== email && !isMgmt(role)) return null
    return conv
  } catch {
    return null
  }
}

/**
 * Persist one Q&A turn. Creates the thread (titled from the first question) if
 * it doesn't exist yet, otherwise appends the two messages. Best-effort: a
 * failure here must never break the chat response.
 */
export async function appendTurn(
  conversationId: string | undefined,
  email: string,
  userMessage: string,
  assistantMessage: string,
): Promise<string> {
  const id = conversationId && conversationId.trim() ? conversationId : `notebook-${randomUUID()}`
  const at = new Date().toISOString()
  const turn: NotebookMessage[] = [
    { role: 'user', content: userMessage, createdAt: at },
    { role: 'assistant', content: assistantMessage, createdAt: at },
  ]
  try {
    await ensureOnce()
    await query(
      `INSERT INTO freehold_site_notebook_conversations (id, user_email, title, messages, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, now(), now())
       ON CONFLICT (id) DO UPDATE
         SET messages = freehold_site_notebook_conversations.messages || $4::jsonb,
             updated_at = now()`,
      [id, email, titleFrom(userMessage), JSON.stringify(turn)],
    )
  } catch {
    /* non-fatal — the chat answer is already returned to the user */
  }
  return id
}
