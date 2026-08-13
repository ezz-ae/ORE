/**
 * WHAT THE VENDOR'S OWN HOSTS ARE ALLOWED TO SERVE.
 *
 * One deployment serves three different kinds of host:
 *
 *   {broker}.entrestate.com   a tenant's instance — the product, their brand
 *   entrestate.com            the vendor's own front door
 *   machine.entrestate.com    a product door, reserved and never a tenant
 *
 * Only the first was ever thought about. The other two fell through to the
 * property-marketing site that ships in this codebase, so entrestate.com and
 * machine.entrestate.com both answered with a Dubai property portal —
 * "Golden Visa", "off-plan", featured listings. The front door of the company
 * was advertising apartments.
 *
 * This module is the rule for those hosts, kept pure so it can be tested
 * without a server (see scripts/vendor-host-test.ts) and so the proxy stays
 * readable. It does nothing at all unless tenancy is enabled, so the Freehold
 * deployment is untouched.
 */

import { SAAS_TENANCY, tenantSubdomainFromHost, TENANT_BASE_DOMAIN } from './config'

export type VendorAction =
  | { kind: 'pass' }
  /** Change the address bar — used where one canonical URL should win. */
  | { kind: 'redirect'; to: string }
  /** Keep the short address, serve another page — used for product doors. */
  | { kind: 'rewrite'; to: string }

/**
 * A reserved subdomain that is a product's own entrance. Landing on
 * machine.entrestate.com should show the Lead Machine page while keeping the
 * short address, so the URL stays memorable on a business card. Each target
 * page already declares its canonical /business/... path, so serving it from
 * two hostnames cannot split it in search.
 */
export const PRODUCT_DOORS: Readonly<Record<string, string>> = {
  machine: '/business/lead-machine',
  leadmachine: '/business/lead-machine',
  'lead-machine': '/business/lead-machine',
  meta: '/business/meta-for-realtors',
  ads: '/business/meta-for-realtors',
  listing: '/business/listing-to-landing',
  listings: '/business/listing-to-landing',
  landing: '/business/listing-to-landing',
  landings: '/business/listing-to-landing',
}

/**
 * Surfaces that make sense on a vendor host. Everything outside this list is
 * the property-marketing site, which belongs to a brokerage and not to us.
 *
 * The application itself stays reachable: an operator has to be able to sign
 * in somewhere, and those routes are session-gated with the tenant fence
 * already applied above them in the proxy.
 */
const VENDOR_PREFIXES = [
  '/business',
  '/signup',
  '/server',
  '/freehold-intelligence',
  '/crm',
  '/privacy',
  '/terms',
  '/api',
]

/** Files (og-image.png, robots.txt, sitemap.xml…) are never page routes. */
const isFile = (pathname: string): boolean => {
  const last = pathname.split('/').pop() ?? ''
  return last.includes('.')
}

/** The subdomain of a vendor host, or '' for the apex. Null when not ours. */
function vendorSubdomain(rawHost: string): string | null {
  const host = rawHost.trim().toLowerCase().split(':')[0]
  if (!host) return null
  if (host === TENANT_BASE_DOMAIN) return ''
  if (host === `www.${TENANT_BASE_DOMAIN}`) return ''
  if (!host.endsWith(`.${TENANT_BASE_DOMAIN}`)) return null
  const label = host.slice(0, -(TENANT_BASE_DOMAIN.length + 1))
  return label.includes('.') ? null : label
}

/**
 * What to do with a request, given the host it arrived on.
 *
 * Returns `pass` for every request the vendor rules have no opinion about —
 * tenancy switched off, a tenant's own instance, an unrelated domain, or a
 * path that already belongs to the vendor surface.
 */
export function vendorHostAction(rawHost: string | null | undefined, pathname: string): VendorAction {
  if (!SAAS_TENANCY || !rawHost) return { kind: 'pass' }
  // A tenant's instance is governed by the tenancy rules, not these.
  if (tenantSubdomainFromHost(rawHost)) return { kind: 'pass' }

  const sub = vendorSubdomain(rawHost)
  if (sub === null) return { kind: 'pass' } // not one of ours (preview URL, custom domain)

  const door = sub ? PRODUCT_DOORS[sub] : undefined

  // The root of a product door serves that product, keeping the short address.
  if (door && (pathname === '/' || pathname === '')) return { kind: 'rewrite', to: door }

  // The apex root is the platform site. One canonical address for it.
  if (!door && (pathname === '/' || pathname === '')) return { kind: 'redirect', to: '/business' }

  if (isFile(pathname)) return { kind: 'pass' }
  if (VENDOR_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return { kind: 'pass' }

  // Anything else is the brokerage-facing property site. It does not belong on
  // the vendor's domain, so send the reader to the thing they were looking for
  // rather than showing them somebody else's apartments.
  return { kind: 'redirect', to: '/business' }
}
