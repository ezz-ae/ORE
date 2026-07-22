// lib/freehold/api-tokens.ts
//
// Personal access tokens for the remote MCP / agent bridge. A token lets an
// EXTERNAL model (the user's own Claude, ChatGPT or Gemini) connect to this
// platform and act with EXACTLY the minting user's role — never more. RBAC,
// ad-budget and lead-PII gating all continue to apply because every tool call
// the token authorizes runs through the same executeTool role checks the app
// uses internally.
//
// Storage: only a SHA-256 hash of the token is persisted, so a database dump
// never reveals a usable credential. The raw token is shown to the user ONCE
// at mint time and never again.

import { createHash, randomBytes } from 'node:crypto'
import { query } from '@/lib/db'
import type { Role } from '@/lib/freehold/session-types'

export interface ApiToken {
  id: string
  name: string
  role: Role
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

export interface ApiTokenPrincipal {
  email: string
  name: string
  role: Role
  brokerId: string | null
}

const TOKEN_BYTES = 32
const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex')

let ensured = false
async function ensure() {
  if (ensured) return
  await query(`
    CREATE TABLE IF NOT EXISTS freehold_api_tokens (
      id          text PRIMARY KEY,
      user_email  text NOT NULL,
      user_name   text NOT NULL,
      role        text NOT NULL,
      broker_id   text,
      name        text NOT NULL,
      prefix      text NOT NULL,
      token_hash  text NOT NULL UNIQUE,
      created_at  timestamptz NOT NULL DEFAULT now(),
      last_used_at timestamptz,
      revoked_at  timestamptz
    )
  `)
  await query(`CREATE INDEX IF NOT EXISTS freehold_api_tokens_hash_idx ON freehold_api_tokens (token_hash) WHERE revoked_at IS NULL`)
  await query(`CREATE INDEX IF NOT EXISTS freehold_api_tokens_email_idx ON freehold_api_tokens (user_email)`)
  ensured = true
}

/**
 * Mint a token for a user. Returns the RAW token exactly once — the caller must
 * surface it to the user immediately; it can never be recovered afterwards.
 */
export async function createApiToken(
  principal: ApiTokenPrincipal,
  label: string,
): Promise<{ token: ApiToken; raw: string }> {
  await ensure()
  const id = randomBytes(12).toString('hex')
  const secret = randomBytes(TOKEN_BYTES).toString('base64url')
  const raw = `fh_${secret}`
  const prefix = raw.slice(0, 10) // "fh_" + 7 chars — enough to recognise, useless to replay
  const name = (label || '').trim().slice(0, 60) || 'Untitled connection'
  await query(
    `INSERT INTO freehold_api_tokens (id, user_email, user_name, role, broker_id, name, prefix, token_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, principal.email, principal.name, principal.role, principal.brokerId, name, prefix, hashToken(raw)],
  )
  return {
    raw,
    token: { id, name, role: principal.role, prefix, createdAt: new Date().toISOString(), lastUsedAt: null },
  }
}

/** Verify a raw token → the principal it authorizes, or null. Best-effort touches last_used_at. */
export async function verifyApiToken(raw: string | null | undefined): Promise<ApiTokenPrincipal | null> {
  const value = (raw || '').trim()
  // Accept current `fh_` tokens and legacy `ore_` tokens issued before the rebrand.
  if (!value.startsWith('fh_') && !value.startsWith('ore_')) return null
  await ensure()
  const rows = await query<{ user_email: string; user_name: string; role: string; broker_id: string | null }>(
    `SELECT user_email, user_name, role, broker_id
       FROM freehold_api_tokens
      WHERE token_hash = $1 AND revoked_at IS NULL
      LIMIT 1`,
    [hashToken(value)],
  )
  const row = rows[0]
  if (!row) return null
  // Fire-and-forget last-used stamp — never block the request on it.
  query(`UPDATE freehold_api_tokens SET last_used_at = now() WHERE token_hash = $1`, [hashToken(value)]).catch(() => {})
  return {
    email: row.user_email,
    name: row.user_name,
    role: row.role as Role,
    brokerId: row.broker_id,
  }
}

export async function listApiTokens(email: string): Promise<ApiToken[]> {
  await ensure()
  const rows = await query<{ id: string; name: string; role: string; prefix: string; created_at: string; last_used_at: string | null }>(
    `SELECT id, name, role, prefix, created_at, last_used_at
       FROM freehold_api_tokens
      WHERE user_email = $1 AND revoked_at IS NULL
      ORDER BY created_at DESC`,
    [email],
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role as Role,
    prefix: r.prefix,
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at,
  }))
}

/** Revoke a token the caller owns. Returns true if a live token was revoked. */
export async function revokeApiToken(email: string, id: string): Promise<boolean> {
  await ensure()
  const rows = await query<{ id: string }>(
    `UPDATE freehold_api_tokens SET revoked_at = now()
      WHERE id = $1 AND user_email = $2 AND revoked_at IS NULL
      RETURNING id`,
    [id, email],
  )
  return rows.length > 0
}
