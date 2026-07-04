import { query } from '@/lib/db'
import { seal, open } from '@/lib/freehold/secure-store'

// Server-side storage for integration credentials connected through the UI.
// Env vars always win (ops override); this table is the fallback so the
// in-app "Connect" flow actually powers server-side API calls (pre-fix, the
// UI token lived only in the browser's localStorage and launches silently
// fell back to demo mode).
//
// At rest the credentials are encrypted (AES-256-GCM, see secure-store.ts) so a
// database-only compromise never exposes a usable token. Reads transparently
// decrypt, and legacy plaintext rows are re-encrypted on their next write.

export interface MetaStoredCreds {
  accessToken: string
  adAccountId: string
  pageId: string
  pixelId?: string | null
}

let ensured: Promise<void> | null = null
const ensureTable = async () => {
  if (!ensured) {
    ensured = query(`
      CREATE TABLE IF NOT EXISTS freehold_site_integration_credentials (
        provider    text PRIMARY KEY,
        credentials jsonb NOT NULL,
        updated_by  text,
        updated_at  timestamptz NOT NULL DEFAULT now()
      )
    `).then(() => undefined).catch((e) => { ensured = null; throw e })
  }
  await ensured
}

// Small cache so every Graph call doesn't hit Postgres.
let cache: { value: MetaStoredCreds | null; at: number } | null = null
const CACHE_MS = 60_000

export async function getStoredMetaCreds(): Promise<MetaStoredCreds | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value
  try {
    await ensureTable()
    const rows = await query<{ credentials: unknown }>(
      `SELECT credentials FROM freehold_site_integration_credentials WHERE provider = 'meta' LIMIT 1`,
    )
    const value = rows[0] ? open<MetaStoredCreds>(rows[0].credentials) : null
    cache = { value, at: Date.now() }
    return value
  } catch {
    return cache?.value ?? null
  }
}

export async function setStoredMetaCreds(creds: MetaStoredCreds, updatedBy: string): Promise<void> {
  await ensureTable()
  await query(
    `INSERT INTO freehold_site_integration_credentials (provider, credentials, updated_by, updated_at)
     VALUES ('meta', $1::jsonb, $2, now())
     ON CONFLICT (provider) DO UPDATE SET credentials = $1::jsonb, updated_by = $2, updated_at = now()`,
    [JSON.stringify(seal(creds)), updatedBy],
  )
  cache = { value: creds, at: Date.now() }
}

export async function clearStoredMetaCreds(): Promise<void> {
  await ensureTable()
  await query(`DELETE FROM freehold_site_integration_credentials WHERE provider = 'meta'`)
  cache = { value: null, at: Date.now() }
}

// ── Generic provider store (whatsapp, hubspot, google, …) ────────────────────
const providerCache = new Map<string, { value: Record<string, unknown> | null; at: number }>()

export async function getStoredCreds<T = Record<string, unknown>>(provider: string): Promise<T | null> {
  const c = providerCache.get(provider)
  if (c && Date.now() - c.at < CACHE_MS) return c.value as T | null
  try {
    await ensureTable()
    const rows = await query<{ credentials: unknown }>(
      `SELECT credentials FROM freehold_site_integration_credentials WHERE provider = $1 LIMIT 1`,
      [provider],
    )
    const value = rows[0] ? open<Record<string, unknown>>(rows[0].credentials) : null
    providerCache.set(provider, { value, at: Date.now() })
    return value as T | null
  } catch {
    return (providerCache.get(provider)?.value ?? null) as T | null
  }
}

export async function setStoredCreds(provider: string, creds: Record<string, unknown>, updatedBy: string): Promise<void> {
  await ensureTable()
  await query(
    `INSERT INTO freehold_site_integration_credentials (provider, credentials, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (provider) DO UPDATE SET credentials = $2::jsonb, updated_by = $3, updated_at = now()`,
    [provider, JSON.stringify(seal(creds)), updatedBy],
  )
  providerCache.set(provider, { value: creds, at: Date.now() })
}

export async function clearStoredCreds(provider: string): Promise<void> {
  await ensureTable()
  await query(`DELETE FROM freehold_site_integration_credentials WHERE provider = $1`, [provider])
  providerCache.set(provider, { value: null, at: Date.now() })
}

export interface WhatsAppStoredCreds { accessToken: string; phoneNumberId: string }
