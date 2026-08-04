/**
 * Server-side resolution of the current SaaS tenant from the request Host
 * header. Mirrors lib/whitelabel/server.ts: returns null everywhere except a
 * live tenant host on a tenancy-enabled deployment, so callers can fall back
 * to the WL demo cookie and then the static BRAND.
 *
 * Node runtime only (uses next/headers + the control-plane store). headers()
 * is called only when tenancy is enabled, so the Freehold deployment keeps
 * its static rendering behaviour untouched.
 */

import { headers } from 'next/headers'
import { SAAS_TENANCY, tenantSubdomainFromHost } from './config'
import { getTenantBySubdomain, type SaasTenant } from './store'
import type { BrandSnapshot } from '@/components/whitelabel/brand-provider'

/** The tenant the current request's host resolves to, or null. */
export async function getTenantForRequestHost(): Promise<SaasTenant | null> {
  if (!SAAS_TENANCY) return null
  const sub = tenantSubdomainFromHost((await headers()).get('host'))
  if (!sub) return null
  // DB hiccups must degrade to the default brand, never crash the layout.
  return getTenantBySubdomain(sub).catch(() => null)
}

/** Brand snapshot for the current tenant host — feeds the BrandProvider. */
export async function getTenantBrand(): Promise<BrandSnapshot | null> {
  const tenant = await getTenantForRequestHost()
  if (!tenant || tenant.status === 'suspended') return null
  return {
    company: tenant.company,
    product: tenant.product,
    accent: tenant.accent,
    logo: tenant.logo ? '/api/wl/logo' : '',
  }
}
