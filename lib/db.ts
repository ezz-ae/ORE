import { Pool, type PoolClient, type QueryResultRow } from "pg"
import { AsyncLocalStorage } from "node:async_hooks"
import { SAAS_TENANCY, tenantSubdomainFromHost } from "@/lib/tenancy/config"

const rawConnectionString =
  process.env.NEON_DATABASE_URL || process.env.DATABASE_URL
const schema = process.env.DB_SCHEMA || "public"

/** The non-tenant schema — control plane, shared catalogue, Freehold itself. */
export const DEFAULT_SCHEMA = schema

const getConnectionString = () => {
  if (!rawConnectionString) {
    throw new Error("Missing NEON_DATABASE_URL or DATABASE_URL environment variable")
  }
  return rawConnectionString.includes("sslmode=")
    ? rawConnectionString.replace(/sslmode=[^&]+/, "sslmode=verify-full")
    : `${rawConnectionString}${rawConnectionString.includes("?") ? "&" : "?"}sslmode=verify-full`
}

const globalForPool = globalThis as unknown as { pgPool?: Pool }

// Last search_path each pooled connection was set to. Connections are reused
// across requests (and therefore across tenants), so every checkout compares
// the connection's recorded schema with the one the current request needs and
// re-points search_path only on mismatch — the common same-schema case costs
// nothing extra.
const clientSchema = new WeakMap<object, string>()

function getPool(): Pool {
  if (globalForPool.pgPool) return globalForPool.pgPool

  const pool = new Pool({
    connectionString: getConnectionString()
  })

  pool.on('connect', (client) => {
    // This is safe because 'schema' is from a trusted environment variable
    client.query(`SET search_path TO '${schema}'`)
    clientSchema.set(client, schema)
  })

  if (process.env.NODE_ENV !== "production") {
    globalForPool.pgPool = pool
  }
  return pool
}

// ── Tenant schema resolution ─────────────────────────────────────────────────
//
// Schema-per-tenant: on a tenant host ({sub}.TENANT_BASE_DOMAIN) every query
// in this module runs with search_path "tenant_schema, DEFAULT_SCHEMA", so
// business SQL resolves to the tenant's own tables first — isolation is
// enforced here, once, not in ~760 call sites. The DEFAULT_SCHEMA fallback
// exists for read-only platform content that is deliberately NOT provisioned
// per tenant (area/developer profiles, blog): those tables only exist in the
// shared schema, so tenant reads fall through to them and platform updates
// reach every tenant instantly. Unqualified CREATE TABLE and any table that
// DOES exist tenant-side always bind to the tenant schema (first in path),
// so tenant business tables shadow shared ones from the moment they are
// created. Resolution order:
//
//   1. An explicit runWithSchema()/runWithDefaultSchema() scope (provisioning,
//      control-plane modules, scripts).
//   2. The request's Host header (via next/headers) → saas_tenants lookup,
//      cached. Unknown or suspended tenant hosts THROW — a tenant host must
//      never silently fall through to the shared schema.
//   3. No tenancy / no request scope / non-tenant host → DEFAULT_SCHEMA:
//      behaves exactly as before this module knew about tenants.

/** Postgres identifier the tenancy layer generates: t_ + [a-z0-9_]. */
const SAFE_SCHEMA = /^[a-z0-9_]{1,63}$/

class TenantResolutionError extends Error {
  constructor(message: string) { super(message); this.name = 'TenantResolutionError' }
}

const schemaContext = new AsyncLocalStorage<{ schema: string }>()

function assertValidSchemaName(name: string): void {
  if (!SAFE_SCHEMA.test(name)) {
    throw new TenantResolutionError(`Invalid schema name "${name}".`)
  }
}

/** Run `fn` with every lib/db query pinned to `schemaName` (tenant provisioning, cross-tenant ops). */
export function runWithSchema<T>(schemaName: string, fn: () => Promise<T>): Promise<T> {
  assertValidSchemaName(schemaName)
  return schemaContext.run({ schema: schemaName }, fn)
}

/** Run `fn` pinned to the shared/default schema (control-plane tables), regardless of request host. */
export function runWithDefaultSchema<T>(fn: () => Promise<T>): Promise<T> {
  return schemaContext.run({ schema: DEFAULT_SCHEMA }, fn)
}

// next/headers is imported lazily so this module keeps working under plain
// tsx scripts (seeders, generators) that run outside a Next server.
let headersImport: Promise<typeof import("next/headers")> | null = null

async function getRequestHost(): Promise<string | null> {
  try {
    if (!headersImport) headersImport = import("next/headers")
    const { headers } = await headersImport
    return (await headers()).get("host")
  } catch (err) {
    // Next signals "make this route dynamic" by throwing from headers()
    // during static prerender — that control flow must keep propagating.
    const digest = (err as { digest?: string } | null)?.digest
    if (typeof digest === "string" &&
        (digest.startsWith("DYNAMIC_SERVER_USAGE") || digest.startsWith("NEXT_PRERENDER_INTERRUPTED"))) {
      throw err
    }
    // Outside any request scope (script, build, background work): no host.
    return null
  }
}

// Host → tenant schema cache. Small TTL so suspensions propagate quickly;
// short negative TTL so a burst of requests for a nonexistent subdomain
// doesn't hammer the control-plane table.
interface TenantCacheEntry { schema: string | null; suspended: boolean; expires: number }
const tenantCache = new Map<string, TenantCacheEntry>()
const TENANT_CACHE_TTL_MS = 60_000
const TENANT_NEGATIVE_TTL_MS = 10_000

async function lookupTenantSchema(subdomain: string): Promise<TenantCacheEntry> {
  const cached = tenantCache.get(subdomain)
  if (cached && cached.expires > Date.now()) return cached

  let entry: TenantCacheEntry
  try {
    const rows = await rawQuery<{ schema_name: string; status: string }>(
      DEFAULT_SCHEMA,
      `SELECT schema_name, status FROM saas_tenants WHERE subdomain = $1 LIMIT 1`,
      [subdomain],
    )
    const row = rows[0]
    entry = row
      ? {
          schema: SAFE_SCHEMA.test(row.schema_name) ? row.schema_name : null,
          suspended: row.status === 'suspended',
          expires: Date.now() + TENANT_CACHE_TTL_MS,
        }
      : { schema: null, suspended: false, expires: Date.now() + TENANT_NEGATIVE_TTL_MS }
  } catch {
    // Control-plane table missing or unreachable ⇒ treat as unknown tenant.
    // Callers on tenant hosts fail closed; non-tenant hosts never get here.
    entry = { schema: null, suspended: false, expires: Date.now() + TENANT_NEGATIVE_TTL_MS }
  }
  tenantCache.set(subdomain, entry)
  if (tenantCache.size > 5000) {
    const now = Date.now()
    for (const [k, v] of tenantCache) if (v.expires <= now) tenantCache.delete(k)
  }
  return entry
}

/** Drop a cached host→schema mapping (used right after provisioning a tenant). */
export function invalidateTenantSchemaCache(subdomain?: string): void {
  if (subdomain) tenantCache.delete(subdomain)
  else tenantCache.clear()
}

/**
 * The schema the current call must run in. Exported so cross-cutting stores
 * (ensureOnce below, per-schema caches) can key their state correctly.
 */
export async function resolveActiveSchema(): Promise<string> {
  const ctx = schemaContext.getStore()
  if (ctx) return ctx.schema
  if (!SAAS_TENANCY) return DEFAULT_SCHEMA
  const sub = tenantSubdomainFromHost(await getRequestHost())
  if (!sub) return DEFAULT_SCHEMA
  const entry = await lookupTenantSchema(sub)
  if (!entry.schema) {
    throw new TenantResolutionError(`No tenant is provisioned for "${sub}".`)
  }
  if (entry.suspended) {
    throw new TenantResolutionError(`Tenant "${sub}" is suspended.`)
  }
  return entry.schema
}

/**
 * Check out a connection with search_path pointed at `schemaName`. ALL reads
 * and writes in this module go through here — never pool.query() directly —
 * so a connection can never carry one tenant's search_path into another
 * tenant's (or the shared schema's) query.
 */
async function acquireClient(schemaName: string): Promise<PoolClient> {
  assertValidSchemaName(schemaName)
  // Tenant schemas resolve "tenant first, shared fallback"; the default
  // schema stays exactly itself.
  const searchPath = schemaName === DEFAULT_SCHEMA ? DEFAULT_SCHEMA : `${schemaName}, ${DEFAULT_SCHEMA}`
  const client = await getPool().connect()
  if (clientSchema.get(client) !== searchPath) {
    try {
      // set_config is parameterised — the schema name never enters SQL text.
      await client.query(`SELECT set_config('search_path', $1, false)`, [searchPath])
      clientSchema.set(client, searchPath)
    } catch (err) {
      client.release()
      throw err
    }
  }
  return client
}

async function rawQuery<T extends QueryResultRow = QueryResultRow>(
  schemaName: string,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = await acquireClient(schemaName)
  try {
    const result = await client.query<T>(text, params)
    return result.rows
  } finally {
    client.release()
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []) {
  if (!rawConnectionString) return [] as T[]
  return rawQuery<T>(await resolveActiveSchema(), text, params)
}

/** A single-connection query bound to an open transaction. */
export type TxQuery = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) => Promise<T[]>

/**
 * Run `fn` inside a single BEGIN/COMMIT transaction on one pooled connection,
 * so `SELECT ... FOR UPDATE` row locks hold for the whole callback. Rolls back
 * (and rethrows) on any error. Throws if no database is configured — callers
 * that must stay non-fatal should wrap this in their own try/catch.
 * The whole transaction runs in the current tenant's schema.
 */
export async function withTransaction<T>(fn: (q: TxQuery) => Promise<T>): Promise<T> {
  if (!rawConnectionString) {
    throw new Error("Missing NEON_DATABASE_URL or DATABASE_URL environment variable")
  }
  const client = await acquireClient(await resolveActiveSchema())
  const scoped: TxQuery = async (text, params = []) => (await client.query(text, params)).rows as never
  try {
    await client.query("BEGIN")
    const out = await fn(scoped)
    await client.query("COMMIT")
    return out
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

// ── Per-schema one-time setup ────────────────────────────────────────────────
//
// The app creates its tables lazily (CREATE TABLE IF NOT EXISTS on first use)
// and memoises that per module. A module-level `let ensured = false` is wrong
// under schema-per-tenant: the first tenant a warm process touches would mark
// the DDL "done" for every other tenant. ensureOnce() keys the memo by
// (active schema, caller key) instead — same lazy behaviour, correct per
// tenant. A failed attempt is forgotten so the next call retries.

const ensurePromises = new Map<string, Promise<void>>()

export async function ensureOnce(key: string, fn: () => Promise<void>): Promise<void> {
  const activeSchema = await resolveActiveSchema()
  const memoKey = `${activeSchema}:${key}`
  let p = ensurePromises.get(memoKey)
  if (!p) {
    p = fn()
    ensurePromises.set(memoKey, p)
    p.catch(() => ensurePromises.delete(memoKey))
  }
  return p
}
