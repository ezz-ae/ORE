/**
 * White-label store — access keys and branded workspaces.
 *
 * Vendor mints keys (one key = one workspace). A prospect redeems a key once,
 * choosing a brand name + logo, which creates a workspace and marks the key
 * redeemed. Tables self-create on first use (same convention as the rest of the
 * app — no migration tool). Degrades to no-op arrays when no DB is configured.
 */

import { randomBytes, randomUUID } from 'node:crypto'
import { query, withTransaction } from '@/lib/db'
import { WL_DEFAULT_ACCENT } from './config'

export interface WlKey {
  key: string
  label: string
  status: 'active' | 'redeemed' | 'revoked'
  workspaceId: string | null
  expiresAt: string | null
  createdAt: string
}

export interface WlWorkspace {
  id: string
  company: string
  product: string
  accent: string
  logo: string
  createdAt: string
  lastSeenAt: string | null
}

let ensured = false
async function ensure(): Promise<void> {
  if (ensured) return
  await query(`
    CREATE TABLE IF NOT EXISTS wl_keys (
      key          text PRIMARY KEY,
      label        text NOT NULL DEFAULT '',
      status       text NOT NULL DEFAULT 'active',
      workspace_id text,
      expires_at   timestamptz,
      created_at   timestamptz NOT NULL DEFAULT now()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS wl_workspaces (
      id           text PRIMARY KEY,
      company      text NOT NULL,
      product      text NOT NULL DEFAULT 'Intelligence',
      accent       text NOT NULL DEFAULT '${WL_DEFAULT_ACCENT}',
      logo         text NOT NULL DEFAULT '',
      created_at   timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz
    )
  `)
  ensured = true
}

/** Mint `count` fresh access keys with an optional label + expiry. */
export async function mintKeys(count: number, label: string, expiresAt: string | null): Promise<string[]> {
  await ensure()
  const n = Math.max(1, Math.min(100, Math.floor(count) || 1))
  const keys: string[] = []
  for (let i = 0; i < n; i++) {
    // Human-friendly, unambiguous key: WL-XXXX-XXXX-XXXX.
    const raw = randomBytes(9).toString('base64url').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12)
    const key = `WL-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
    await query(
      `INSERT INTO wl_keys (key, label, expires_at) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
      [key, label.slice(0, 80), expiresAt],
    )
    keys.push(key)
  }
  return keys
}

/** All keys, newest first — for the vendor's key list. */
export async function listKeys(): Promise<WlKey[]> {
  await ensure()
  const rows = await query<{
    key: string; label: string; status: string; workspace_id: string | null; expires_at: string | null; created_at: string
  }>(`SELECT key, label, status, workspace_id, expires_at, created_at FROM wl_keys ORDER BY created_at DESC LIMIT 500`)
  return rows.map((r) => ({
    key: r.key, label: r.label, status: r.status as WlKey['status'],
    workspaceId: r.workspace_id, expiresAt: r.expires_at, createdAt: r.created_at,
  }))
}

export type RedeemResult =
  | { ok: true; workspace: WlWorkspace }
  | { ok: false; reason: 'not_found' | 'revoked' | 'expired' | 'already_used' }

/**
 * Redeem a key into a branded workspace. Atomic: locks the key row so a key
 * can only ever create one workspace, even under concurrent submits.
 */
export async function redeemKey(
  rawKey: string,
  brand: { company: string; product: string; accent: string; logo: string },
): Promise<RedeemResult> {
  await ensure()
  const key = rawKey.trim().toUpperCase()
  if (!key) return { ok: false, reason: 'not_found' }

  return withTransaction(async (q) => {
    const rows = await q<{ status: string; workspace_id: string | null; expires_at: string | null }>(
      `SELECT status, workspace_id, expires_at FROM wl_keys WHERE key = $1 FOR UPDATE`,
      [key],
    )
    const row = rows[0]
    if (!row) return { ok: false, reason: 'not_found' } as const
    if (row.status === 'revoked') return { ok: false, reason: 'revoked' } as const
    if (row.status === 'redeemed' || row.workspace_id) return { ok: false, reason: 'already_used' } as const
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      return { ok: false, reason: 'expired' } as const
    }

    const id = randomUUID()
    const company = brand.company.trim().slice(0, 40) || 'Your Company'
    const product = brand.product.trim().slice(0, 24) || 'Intelligence'
    const accent = /^#[0-9a-fA-F]{6}$/.test(brand.accent) ? brand.accent : WL_DEFAULT_ACCENT
    const logo = brand.logo.startsWith('data:image/') ? brand.logo : ''

    await q(
      `INSERT INTO wl_workspaces (id, company, product, accent, logo) VALUES ($1,$2,$3,$4,$5)`,
      [id, company, product, accent, logo],
    )
    await q(`UPDATE wl_keys SET status = 'redeemed', workspace_id = $2 WHERE key = $1`, [key, id])

    return {
      ok: true,
      workspace: { id, company, product, accent, logo, createdAt: new Date().toISOString(), lastSeenAt: null },
    } as const
  })
}

/** Fetch a workspace by id (used to refresh the brand snapshot). */
export async function getWorkspace(id: string): Promise<WlWorkspace | null> {
  await ensure()
  const rows = await query<{
    id: string; company: string; product: string; accent: string; logo: string; created_at: string; last_seen_at: string | null
  }>(`SELECT id, company, product, accent, logo, created_at, last_seen_at FROM wl_workspaces WHERE id = $1 LIMIT 1`, [id])
  const r = rows[0]
  if (!r) return null
  return {
    id: r.id, company: r.company, product: r.product, accent: r.accent, logo: r.logo,
    createdAt: r.created_at, lastSeenAt: r.last_seen_at,
  }
}
