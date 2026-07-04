import { query } from '@/lib/db'

// Read-only bridge to the Entrestate multi-tenant data platform that lives in
// this same Neon database (schemas: api / canonical / raw, auth via neon_auth).
// `api.client_configs` is the tenant registry: each client has a tier, a set of
// data views it may read (allowed_views), optional per-view column allow-lists,
// and a rate limit. This module resolves a client; the gateway enforces access.

export interface EntrestateClient {
  clientId: string
  clientName: string
  tier: string
  /** Fully-qualified view names this client may read, e.g. "api.listings_feed". */
  allowedViews: string[]
  /** Optional per-view column allow-list. Empty ⇒ all columns allowed. */
  allowedColumns: Record<string, string[]>
  rateLimit: number
  isActive: boolean
}

export interface EntrestateConnector {
  id: string
  tenantId: string
  type: string
  name: string
  config: Record<string, unknown>
}

// jsonb usually arrives already parsed; tolerate a JSON string just in case.
const asStringArray = (v: unknown): string[] => {
  let raw: unknown = v
  if (typeof v === 'string') { try { raw = JSON.parse(v) } catch { return [] } }
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
}

const asColumnMap = (v: unknown): Record<string, string[]> => {
  let raw: unknown = v
  if (typeof v === 'string') { try { raw = JSON.parse(v) } catch { return {} } }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, string[]> = {}
  for (const [k, val] of Object.entries(raw as Record<string, unknown>)) out[k] = asStringArray(val)
  return out
}

const mapClient = (r: Record<string, unknown>): EntrestateClient => ({
  clientId: String(r.client_id ?? ''),
  clientName: String(r.client_name ?? ''),
  tier: String(r.tier ?? 'free'),
  allowedViews: asStringArray(r.allowed_views),
  allowedColumns: asColumnMap(r.allowed_columns),
  rateLimit: Number(r.rate_limit ?? 100) || 100,
  isActive: r.is_active !== false,
})

const SELECT = `client_id, client_name, tier, allowed_views, allowed_columns, rate_limit, is_active`

/** All registered white-label clients (tenants). Read-only. */
export async function listClients(): Promise<EntrestateClient[]> {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT ${SELECT} FROM api.client_configs ORDER BY client_name`,
    )
    return rows.map(mapClient)
  } catch {
    return []
  }
}

/** Resolve one client by id (e.g. 'gc', 'mashroi', 'entrestate_site'). */
export async function getClientConfig(clientId: string): Promise<EntrestateClient | null> {
  if (!clientId) return null
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT ${SELECT} FROM api.client_configs WHERE client_id = $1 AND is_active IS NOT FALSE LIMIT 1`,
      [clientId],
    )
    return rows[0] ? mapClient(rows[0]) : null
  } catch {
    return null
  }
}

/** Data sources wired to a tenant (public.connectors). */
export async function getClientConnectors(tenantId: string): Promise<EntrestateConnector[]> {
  try {
    const rows = await query<Record<string, unknown>>(
      `SELECT id, tenant_id, type, name, config FROM public.connectors WHERE tenant_id = $1 ORDER BY name`,
      [tenantId],
    )
    return rows.map((r) => ({
      id: String(r.id ?? ''),
      tenantId: String(r.tenant_id ?? ''),
      type: String(r.type ?? ''),
      name: String(r.name ?? ''),
      config: (r.config && typeof r.config === 'object' ? r.config : {}) as Record<string, unknown>,
    }))
  } catch {
    return []
  }
}
