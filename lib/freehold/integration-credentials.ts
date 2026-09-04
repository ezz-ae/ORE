import { ensureOnce, query, resolveActiveSchema } from '@/lib/db'
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
//
// Multi-tenant: the table lives in whichever schema the current request
// resolves to, so every tenant holds (and connects) its OWN provider
// credentials — and the read cache is keyed by that schema, so one tenant's
// cached token can never be served to another.

export interface MetaStoredCreds {
  accessToken: string
  adAccountId: string
  pageId: string
  /** The browser pixel — landing pages, page views. */
  pixelId?: string | null
  /**
   * The CRM dataset lead OUTCOMES are reported to (Events Manager → CRM
   * implementation). A DIFFERENT destination from the browser pixel, and the
   * one Conversion Leads optimisation reads: an outcome sent to the pixel
   * lands somewhere no ad set optimises against, which looks like success.
   */
  crmDatasetId?: string | null
}

const ensureTable = async (): Promise<void> => {
  await ensureOnce('freehold_site_integration_credentials', async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS freehold_site_integration_credentials (
        provider    text PRIMARY KEY,
        credentials jsonb NOT NULL,
        updated_by  text,
        updated_at  timestamptz NOT NULL DEFAULT now()
      )
    `)
  })
}

// Small cache so every Graph call doesn't hit Postgres — keyed by
// (schema, provider) so entries are strictly per-tenant.
const providerCache = new Map<string, { value: Record<string, unknown> | null; at: number }>()
const CACHE_MS = 60_000

export async function getStoredMetaCreds(): Promise<MetaStoredCreds | null> {
  return getStoredCreds<MetaStoredCreds>('meta')
}

export async function setStoredMetaCreds(creds: MetaStoredCreds, updatedBy: string): Promise<void> {
  await setStoredCreds('meta', creds as unknown as Record<string, unknown>, updatedBy)
}

export async function clearStoredMetaCreds(): Promise<void> {
  await clearStoredCreds('meta')
}

// ── Generic provider store (meta, whatsapp, hubspot, google, …) ──────────────

export async function getStoredCreds<T = Record<string, unknown>>(provider: string): Promise<T | null> {
  let cacheKey: string | null = null
  try {
    cacheKey = `${await resolveActiveSchema()}:${provider}`
    const c = providerCache.get(cacheKey)
    if (c && Date.now() - c.at < CACHE_MS) return c.value as T | null
    await ensureTable()
    const rows = await query<{ credentials: unknown }>(
      `SELECT credentials FROM freehold_site_integration_credentials WHERE provider = $1 LIMIT 1`,
      [provider],
    )
    const value = rows[0] ? open<Record<string, unknown>>(rows[0].credentials) : null
    providerCache.set(cacheKey, { value, at: Date.now() })
    return value as T | null
  } catch {
    return (cacheKey ? (providerCache.get(cacheKey)?.value ?? null) : null) as T | null
  }
}

export async function setStoredCreds(provider: string, creds: Record<string, unknown>, updatedBy: string): Promise<void> {
  const cacheKey = `${await resolveActiveSchema()}:${provider}`
  await ensureTable()
  await query(
    `INSERT INTO freehold_site_integration_credentials (provider, credentials, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (provider) DO UPDATE SET credentials = $2::jsonb, updated_by = $3, updated_at = now()`,
    [provider, JSON.stringify(seal(creds)), updatedBy],
  )
  providerCache.set(cacheKey, { value: creds, at: Date.now() })
}

export async function clearStoredCreds(provider: string): Promise<void> {
  const cacheKey = `${await resolveActiveSchema()}:${provider}`
  await ensureTable()
  await query(`DELETE FROM freehold_site_integration_credentials WHERE provider = $1`, [provider])
  providerCache.set(cacheKey, { value: null, at: Date.now() })
}

export interface WhatsAppStoredCreds { accessToken: string; phoneNumberId: string }
