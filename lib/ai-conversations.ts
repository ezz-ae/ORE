import { randomUUID } from "node:crypto"
import { query } from "@/lib/db"
import { ensureAuthTables } from "@/lib/auth"

export interface AiMessageRecord {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export interface AiConversationRecord {
  id: string
  user_id: string
  title: string | null
  pinned: boolean
  messages: AiMessageRecord[] | null
  created_at: string
  updated_at: string
}

const trimMessages = (messages: AiMessageRecord[], limit = 60) =>
  messages.length > limit ? messages.slice(messages.length - limit) : messages

const buildTitle = (message?: string | null) => {
  if (!message) return "AI Conversation"
  const trimmed = message.trim().replace(/\s+/g, " ")
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed
}

export async function getLatestConversation(userId: string) {
  await ensureAuthTables()
  const rows = await query<AiConversationRecord>(
    `SELECT id, user_id, title, pinned, messages, created_at, updated_at
     FROM gc_ai_conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId],
  )
  return rows[0] || null
}

export async function getConversationById(id: string) {
  await ensureAuthTables()
  const rows = await query<AiConversationRecord>(
    `SELECT id, user_id, title, pinned, messages, created_at, updated_at
     FROM gc_ai_conversations
     WHERE id = $1
     LIMIT 1`,
    [id],
  )
  return rows[0] || null
}

export async function createConversation(userId: string, firstMessage?: AiMessageRecord) {
  await ensureAuthTables()
  const id = randomUUID()
  const messages = firstMessage ? [firstMessage] : []
  const title = buildTitle(firstMessage?.content)
  const rows = await query<AiConversationRecord>(
    `INSERT INTO gc_ai_conversations (id, user_id, title, pinned, messages)
     VALUES ($1, $2, $3, false, $4)
     RETURNING id, user_id, title, pinned, messages, created_at, updated_at`,
    [id, userId, title, JSON.stringify(messages)],
  )
  return rows[0]
}

export async function appendConversationMessage(conversationId: string, message: AiMessageRecord) {
  await ensureAuthTables()
  const conversation = await getConversationById(conversationId)
  if (!conversation) return null
  const updatedMessages = trimMessages([...(conversation.messages || []), message])
  const rows = await query<AiConversationRecord>(
    `UPDATE gc_ai_conversations
     SET messages = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, user_id, title, pinned, messages, created_at, updated_at`,
    [JSON.stringify(updatedMessages), conversationId],
  )
  return rows[0]
}

export async function upsertConversationMessage(userId: string, message: AiMessageRecord) {
  const latest = await getLatestConversation(userId)
  if (!latest) {
    return createConversation(userId, message)
  }
  return appendConversationMessage(latest.id, message)
}

export async function listConversations(userId: string, limit = 5) {
  await ensureAuthTables()
  return query<AiConversationRecord>(
    `SELECT id, user_id, title, pinned, messages, created_at, updated_at
     FROM gc_ai_conversations
     WHERE user_id = $1
     ORDER BY pinned DESC, updated_at DESC
     LIMIT $2`,
    [userId, limit],
  )
}

export async function setConversationPinned(conversationId: string, pinned: boolean) {
  await ensureAuthTables()
  const rows = await query<AiConversationRecord>(
    `UPDATE gc_ai_conversations
     SET pinned = $1
     WHERE id = $2
     RETURNING id, user_id, title, pinned, messages, created_at, updated_at`,
    [pinned, conversationId],
  )
  return rows[0] || null
}
