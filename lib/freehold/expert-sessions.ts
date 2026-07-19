import { randomUUID } from 'node:crypto'
import { query } from '@/lib/db'
import type { ExpertBlock } from '@/lib/freehold/expert-blocks'

// Durable Expert conversations — the session memory behind the docked chat
// and the AI Suite. Each row is one conversation owned by an account: the
// side chat and the Suite read/write the SAME store, so a chat started on
// one page (or one device) continues anywhere.

export interface ExpertTurnMessage {
  role: 'user' | 'assistant'
  /** User turns carry `content`; assistant turns carry `blocks`. */
  content?: string
  blocks?: ExpertBlock[]
  createdAt: string
}

export interface ExpertSessionSummary {
  id: string
  title: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface ExpertSession extends ExpertSessionSummary {
  messages: ExpertTurnMessage[]
}

let ensured: Promise<void> | null = null
const ensure = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_site_expert_sessions (
      id          text PRIMARY KEY,
      user_email  text NOT NULL,
      title       text NOT NULL DEFAULT 'New chat',
      messages    jsonb NOT NULL DEFAULT '[]'::jsonb,
      created_at  timestamptz NOT NULL DEFAULT now(),
      updated_at  timestamptz NOT NULL DEFAULT now()
    )
  `)
}
const ensureOnce = async () => { if (!ensured) ensured = ensure().catch((e) => { ensured = null; throw e }); await ensured }

// A line that is nothing but snake_case identifiers is a leaked tool name
// ("ads_campaign_insights"), never a human answer. Conversations saved before
// the chat-route salvage filter existed still carry these — scrub them at
// read time so they neither render as bubbles nor replay into model history.
const isBareToolToken = (text: string): boolean => {
  const lines = text.trim().split(/\n+/).map((l) => l.trim()).filter(Boolean)
  return lines.length > 0 && lines.every((l) => /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(l))
}

const scrubBlocks = (blocks: ExpertBlock[] | undefined): ExpertBlock[] | undefined => {
  if (!blocks?.length) return blocks
  const clean = blocks.filter((b) => !(b?.type === 'text' && isBareToolToken(String(b.content ?? ''))))
  return clean.length > 0 ? clean : undefined
}

const parseMessages = (v: unknown): ExpertTurnMessage[] => {
  let raw: unknown = v
  if (typeof v === 'string') { try { raw = JSON.parse(v) } catch { raw = [] } }
  if (!Array.isArray(raw)) return []
  return raw
    .filter((m): m is ExpertTurnMessage => !!m && typeof m === 'object' && 'role' in m)
    .map((m) => (m.role === 'assistant' ? { ...m, blocks: scrubBlocks(m.blocks) } : m))
    .filter((m) => m.role === 'user' || (m.blocks?.length ?? 0) > 0)
}

const titleFrom = (text: string): string => {
  const t = text.trim().replace(/\s+/g, ' ')
  return t.length <= 60 ? t || 'New chat' : `${t.slice(0, 57)}…`
}

/** The account's recent conversations, newest first. */
export async function listExpertSessions(email: string): Promise<ExpertSessionSummary[]> {
  try {
    await ensureOnce()
    const rows = await query<Record<string, unknown>>(
      `SELECT id, title, jsonb_array_length(messages) AS n, created_at::text, updated_at::text
       FROM freehold_site_expert_sessions
       WHERE user_email = $1
       ORDER BY updated_at DESC
       LIMIT 50`,
      [email],
    )
    return rows.map((r) => ({
      id: String(r.id),
      title: String(r.title ?? 'New chat'),
      messageCount: Number(r.n ?? 0),
      createdAt: String(r.created_at ?? ''),
      updatedAt: String(r.updated_at ?? ''),
    }))
  } catch {
    return []
  }
}

/** One conversation with its full message history — owner-scoped. */
export async function getExpertSession(id: string, email: string): Promise<ExpertSession | null> {
  try {
    await ensureOnce()
    const rows = await query<Record<string, unknown>>(
      `SELECT id, user_email, title, messages, created_at::text, updated_at::text
       FROM freehold_site_expert_sessions WHERE id = $1 LIMIT 1`,
      [id],
    )
    const r = rows[0]
    if (!r || String(r.user_email) !== email) return null
    const messages = parseMessages(r.messages)
    return {
      id: String(r.id),
      title: String(r.title ?? 'New chat'),
      messages,
      messageCount: messages.length,
      createdAt: String(r.created_at ?? ''),
      updatedAt: String(r.updated_at ?? ''),
    }
  } catch {
    return null
  }
}

/**
 * Persist one Q&A turn. Creates the conversation (titled from the first
 * question) when it doesn't exist yet. Best-effort: a failure here must never
 * break the chat response. Message history is capped so a very long-running
 * conversation can't grow the row unbounded.
 */
export async function appendExpertTurn(
  sessionId: string | undefined,
  email: string,
  userMessage: string,
  blocks: ExpertBlock[],
): Promise<string> {
  const id = sessionId && sessionId.trim() ? sessionId : `expert-${randomUUID()}`
  const at = new Date().toISOString()
  const turn: ExpertTurnMessage[] = [
    { role: 'user', content: userMessage, createdAt: at },
    { role: 'assistant', blocks, createdAt: at },
  ]
  try {
    await ensureOnce()
    await query(
      `INSERT INTO freehold_site_expert_sessions (id, user_email, title, messages, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, now(), now())
       ON CONFLICT (id) DO UPDATE SET
         messages = (
           SELECT COALESCE(jsonb_agg(m ORDER BY ord), '[]'::jsonb)
           FROM jsonb_array_elements(freehold_site_expert_sessions.messages || $4::jsonb)
                WITH ORDINALITY AS t(m, ord)
           WHERE ord > GREATEST(0, jsonb_array_length(freehold_site_expert_sessions.messages || $4::jsonb) - 200)
         ),
         updated_at = now()
       WHERE freehold_site_expert_sessions.user_email = $2`,
      [id, email, titleFrom(userMessage), JSON.stringify(turn)],
    )
  } catch {
    /* non-fatal — the answer is already on its way to the user */
  }
  return id
}

/** Delete a conversation (owner only). */
export async function deleteExpertSession(id: string, email: string): Promise<boolean> {
  try {
    await ensureOnce()
    await query(`DELETE FROM freehold_site_expert_sessions WHERE id = $1 AND user_email = $2`, [id, email])
    return true
  } catch {
    return false
  }
}

/** Compact plain-text view of an assistant turn — for model history replay. */
export function blocksToText(blocks: ExpertBlock[] | undefined): string {
  if (!blocks?.length) return ''
  return blocks
    .map((b) => {
      if (b.type === 'text') return b.content
      if (b.type === 'plan') return `${b.title || 'Plan'}: ${b.steps.map((s) => s.step).join('; ')}`
      if (b.type === 'landing') return `${b.title}${b.subhead ? ` — ${b.subhead}` : ''}`
      if (b.type === 'media') return `${b.label}: ${b.prompt}`
      return ''
    })
    .filter(Boolean)
    .join('\n')
    .slice(0, 4000)
}
