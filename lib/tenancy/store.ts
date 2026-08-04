/**
 * SaaS tenant control plane — the registry behind {sub}.TENANT_BASE_DOMAIN.
 *
 * One row per tenant in `saas_tenants`, which lives in the DEFAULT (shared)
 * schema; every function here pins itself there explicitly with
 * runWithDefaultSchema, so the control plane stays reachable and consistent
 * no matter which tenant host the current request came in on.
 *
 * Creating a tenant creates its Postgres schema in the same transaction.
 * Filling that schema (tables + shared-catalogue copy) is provisioning's job
 * (see the tenant DDL generator), layered on top of this module.
 */

import { randomUUID } from 'node:crypto'
import { ensureOnce, query, runWithDefaultSchema, withTransaction, invalidateTenantSchemaCache } from '@/lib/db'
import { schemaNameForSubdomain } from './config'
import { isValidTenantSubdomain, RESERVED_SUBDOMAINS, SUBDOMAIN_RE } from './reserved'

/** Trial length granted to a self-served tenant. */
export const TRIAL_DAYS = 14

/** Max decoded logo size stored on the tenant row (same cap as the WL demo). */
export const TENANT_LOGO_MAX_BYTES = 256 * 1024

const DEFAULT_ACCENT = '#D4AF37'

export type TenantStatus = 'trial' | 'active' | 'suspended'

export interface SaasTenant {
  id: string
  subdomain: string
  schemaName: string
  company: string
  product: string
  accent: string
  logo: string
  status: TenantStatus
  trialEndsAt: string | null
  createdAt: string
}

interface TenantRow {
  id: string
  subdomain: string
  schema_name: string
  company: string
  product: string
  accent: string
  logo: string
  status: string
  trial_ends_at: string | null
  created_at: string
}

const SELECT_COLS = `id, subdomain, schema_name, company, product, accent, logo, status, trial_ends_at, created_at`

// Brand resolution hits this on every request of a tenant host — cache found
// tenants briefly. Misses are not cached (signup availability must stay live).
const bySubdomainCache = new Map<string, { tenant: SaasTenant; expires: number }>()
const BY_SUBDOMAIN_TTL_MS = 15_000

const mapTenant = (r: TenantRow): SaasTenant => ({
  id: r.id,
  subdomain: r.subdomain,
  schemaName: r.schema_name,
  company: r.company,
  product: r.product,
  accent: r.accent,
  logo: r.logo,
  status: (['trial', 'active', 'suspended'].includes(r.status) ? r.status : 'suspended') as TenantStatus,
  trialEndsAt: r.trial_ends_at,
  createdAt: r.created_at,
})

async function ensure(): Promise<void> {
  await ensureOnce('saas_tenants', async () => {
    await query(`
      CREATE TABLE IF NOT EXISTS saas_tenants (
        id            text PRIMARY KEY,
        subdomain     text NOT NULL UNIQUE,
        schema_name   text NOT NULL UNIQUE,
        company       text NOT NULL,
        product       text NOT NULL DEFAULT 'Intelligence',
        accent        text NOT NULL DEFAULT '${DEFAULT_ACCENT}',
        logo          text NOT NULL DEFAULT '',
        status        text NOT NULL DEFAULT 'trial',
        trial_ends_at timestamptz,
        created_at    timestamptz NOT NULL DEFAULT now(),
        last_seen_at  timestamptz
      )
    `)
  })
}

export type CreateTenantResult =
  | { ok: true; tenant: SaasTenant }
  | { ok: false; reason: 'invalid_subdomain' | 'reserved' | 'taken' }

/**
 * Why a subdomain cannot be claimed, or null when it is free. Used by the
 * signup availability check and re-checked inside createTenant.
 */
export async function subdomainUnavailableReason(
  raw: string,
): Promise<'invalid_subdomain' | 'reserved' | 'taken' | null> {
  const sub = raw.trim().toLowerCase()
  if (!SUBDOMAIN_RE.test(sub)) return 'invalid_subdomain'
  if (RESERVED_SUBDOMAINS.has(sub)) return 'reserved'
  return runWithDefaultSchema(async () => {
    await ensure()
    const rows = await query<{ id: string }>(`SELECT id FROM saas_tenants WHERE subdomain = $1 LIMIT 1`, [sub])
    return rows.length > 0 ? 'taken' : null
  })
}

/**
 * Create a tenant row AND its (empty) Postgres schema, atomically. The unique
 * constraint on subdomain is the arbiter under concurrent claims.
 */
export async function createTenant(input: {
  subdomain: string
  company: string
  product?: string
  accent?: string
  logo?: string
}): Promise<CreateTenantResult> {
  const sub = input.subdomain.trim().toLowerCase()
  if (!SUBDOMAIN_RE.test(sub)) return { ok: false, reason: 'invalid_subdomain' }
  if (!isValidTenantSubdomain(sub)) return { ok: false, reason: 'reserved' }

  const id = randomUUID()
  const schemaName = schemaNameForSubdomain(sub)
  const company = input.company.trim().slice(0, 40) || 'Your Company'
  const product = (input.product ?? '').trim().slice(0, 24) || 'Intelligence'
  const accent = /^#[0-9a-fA-F]{6}$/.test(input.accent ?? '') ? (input.accent as string) : DEFAULT_ACCENT
  const logo = (input.logo ?? '').startsWith('data:image/') ? (input.logo as string) : ''

  return runWithDefaultSchema(async () => {
    await ensure()
    return withTransaction(async (q) => {
      const rows = await q<TenantRow>(
        `INSERT INTO saas_tenants (id, subdomain, schema_name, company, product, accent, logo, status, trial_ends_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'trial', now() + make_interval(days => $8))
         ON CONFLICT (subdomain) DO NOTHING
         RETURNING ${SELECT_COLS}`,
        [id, sub, schemaName, company, product, accent, logo, TRIAL_DAYS],
      )
      const row = rows[0]
      if (!row) return { ok: false, reason: 'taken' } as const
      // schemaName is derived from the validated subdomain grammar
      // (^t_[a-z0-9_]+$), so it is safe to embed as a quoted identifier.
      await q(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`)
      invalidateTenantSchemaCache(sub)
      bySubdomainCache.delete(sub)
      return { ok: true, tenant: mapTenant(row) } as const
    })
  })
}

/** Fetch a tenant by subdomain (brand resolution, signup checks). */
export async function getTenantBySubdomain(raw: string): Promise<SaasTenant | null> {
  const sub = raw.trim().toLowerCase()
  if (!SUBDOMAIN_RE.test(sub)) return null
  const cached = bySubdomainCache.get(sub)
  if (cached && cached.expires > Date.now()) return cached.tenant
  return runWithDefaultSchema(async () => {
    await ensure()
    const rows = await query<TenantRow>(
      `SELECT ${SELECT_COLS} FROM saas_tenants WHERE subdomain = $1 LIMIT 1`,
      [sub],
    )
    if (!rows[0]) return null
    const tenant = mapTenant(rows[0])
    bySubdomainCache.set(sub, { tenant, expires: Date.now() + BY_SUBDOMAIN_TTL_MS })
    return tenant
  })
}

/** All tenants, newest first — for the vendor's admin surface. */
export async function listTenants(): Promise<SaasTenant[]> {
  return runWithDefaultSchema(async () => {
    await ensure()
    const rows = await query<TenantRow>(
      `SELECT ${SELECT_COLS} FROM saas_tenants ORDER BY created_at DESC LIMIT 500`,
    )
    return rows.map(mapTenant)
  })
}
