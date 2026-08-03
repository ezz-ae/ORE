/**
 * SaaS tenancy — configuration and hostname parsing.
 *
 * The whole multi-tenant subsystem is DORMANT unless
 * `NEXT_PUBLIC_TENANT_BASE_DOMAIN` is set (e.g. "entrestate.com"). The
 * Freehold production deployment leaves it unset and behaves exactly as
 * before — the same dormancy convention as NEXT_PUBLIC_WHITE_LABEL.
 *
 * When set, `{broker}.{base-domain}` resolves to that broker's tenant: their
 * brand, their users, their data (schema-per-tenant in Postgres — see
 * lib/db.ts). The apex and www stay non-tenant (marketing/ops surfaces).
 *
 * This module is PURE string parsing (no Node APIs, no DB) so the edge proxy
 * can import it as safely as the Node runtime. The variable is NEXT_PUBLIC_*
 * and build-time inlined, so client components can branch on SAAS_TENANCY
 * too (e.g. the signup surface).
 *
 * Local development: set NEXT_PUBLIC_TENANT_BASE_DOMAIN=localhost and open
 * http://{sub}.localhost:3000 — browsers resolve *.localhost to loopback, and
 * parsing here is port-agnostic.
 */

import { SUBDOMAIN_RE, RESERVED_SUBDOMAINS } from './reserved'

/** Base domain tenants hang off, e.g. "entrestate.com". Empty ⇒ disabled. */
export const TENANT_BASE_DOMAIN = (process.env.NEXT_PUBLIC_TENANT_BASE_DOMAIN || '')
  .trim()
  .toLowerCase()
  .replace(/^\.+|\.+$/g, '')

/** True when this deployment serves per-subdomain SaaS tenants. */
export const SAAS_TENANCY = TENANT_BASE_DOMAIN.length > 0

/**
 * Extract the tenant subdomain from a Host header, or null when the host is
 * not a tenant host (apex, www, other domains, malformed or reserved labels,
 * nested labels). Null means "behave exactly as before" — only a non-null
 * return switches a request onto the tenant path.
 */
export function tenantSubdomainFromHost(rawHost: string | null | undefined): string | null {
  if (!SAAS_TENANCY || !rawHost) return null
  const host = rawHost.trim().toLowerCase().split(':')[0]
  if (!host) return null
  if (host === TENANT_BASE_DOMAIN || host === `www.${TENANT_BASE_DOMAIN}`) return null
  if (!host.endsWith(`.${TENANT_BASE_DOMAIN}`)) return null
  const label = host.slice(0, -(TENANT_BASE_DOMAIN.length + 1))
  // One level only — "a.b.entrestate.com" is not a tenant host.
  if (!label || label.includes('.')) return null
  if (!SUBDOMAIN_RE.test(label)) return null
  if (RESERVED_SUBDOMAINS.has(label)) return null
  return label
}

/**
 * Postgres schema name for a tenant subdomain. Hyphens become underscores;
 * the subdomain grammar forbids underscores, so the mapping is injective
 * ("a-b" and a hypothetical "a_b" can never collide). Result always matches
 * ^t_[a-z0-9_]{1,40}$ — safe to embed as an identifier.
 */
export function schemaNameForSubdomain(sub: string): string {
  return `t_${sub.replace(/-/g, '_')}`
}
