import { query } from '@/lib/db'

// Server-side storage for integration credentials connected through the UI.
// Env vars always win (ops override); this table is the fallback so the
// in-app "Connect" flow actually powers server-side API calls (pre-fix, the
// UI token lived only in the browser's localStorage and launches silently
// fell back to demo mode).
//
// Trust boundary: values live in the same production DB that already holds
// lead PII; column-level encryption is tracked as later hardening.

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
    const rows = await query<{ credentials: MetaStoredCreds }>(
      `SELECT credentials FROM freehold_site_integration_credentials WHERE provider = 'meta' LIMIT 1`,
    )
    const value = rows[0]?.credentials ?? null
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
    [JSON.stringify(creds), updatedBy],
  )
  cache = { value: creds, at: Date.now() }
}

export async function clearStoredMetaCreds(): Promise<void> {
  await ensureTable()
  await query(`DELETE FROM freehold_site_integration_credentials WHERE provider = 'meta'`)
  cache = { value: null, at: Date.now() }
}
