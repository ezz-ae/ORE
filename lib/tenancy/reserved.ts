/**
 * Subdomain rules for SaaS tenants — shape and reserved names.
 *
 * Pure module (no imports, edge-safe): the proxy, the signup form and the
 * control-plane store all validate against the SAME rules, so a name that
 * passes in one place can never be rejected — or resolved differently — in
 * another.
 */

/**
 * Allowed tenant subdomain: 1–40 chars, lowercase letters/digits/hyphens,
 * must start and end alphanumeric (DNS label rules, capped well under the
 * 63-char DNS limit so the derived Postgres schema name also stays short).
 * No underscores — that keeps subdomain → schema-name derivation injective
 * (hyphens map to underscores).
 */
export const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

/**
 * Names a tenant may never claim: infrastructure hostnames, product surfaces
 * we may stand up on the base domain, and vendor/brand words. Checked at
 * signup AND at resolution time, so adding a name here immediately frees it
 * even if a row somehow exists.
 */
export const RESERVED_SUBDOMAINS = new Set([
  // infrastructure / protocol
  'www', 'api', 'mail', 'smtp', 'imap', 'pop', 'webmail', 'mx', 'ns', 'ns1',
  'ns2', 'dns', 'ftp', 'sftp', 'vpn', 'cdn', 'assets', 'static', 'files',
  'img', 'media',
  // environments
  'dev', 'staging', 'stage', 'test', 'preview', 'sandbox', 'demo', 'local',
  'localhost',
  // product / app surfaces
  'app', 'apps', 'admin', 'dashboard', 'portal', 'console', 'crm', 'account',
  'accounts', 'auth', 'login', 'signin', 'signup', 'sso', 'id', 'my',
  // commerce / comms
  'billing', 'pay', 'payments', 'checkout', 'shop', 'store', 'pricing',
  'support', 'help', 'docs', 'doc', 'guide', 'blog', 'news', 'press',
  'status', 'community', 'forum', 'careers', 'jobs', 'legal', 'security',
  'abuse', 'contact', 'info', 'team', 'internal', 'partners', 'affiliates',
  // vendor / brand / product doors — the three products live on their own
  // subdomains (machine.entrestate.com = LeadMachine; listing/landing =
  // Listing-to-Landing; meta/ads = Meta for Realtors), never tenants.
  'entrestate', 'freehold', 'ore', 'machine', 'leadmachine', 'lead-machine',
  'meta', 'ads', 'listing', 'listings', 'landing', 'landings',
])

/** True when `sub` is a well-formed, non-reserved tenant subdomain. */
export function isValidTenantSubdomain(sub: string): boolean {
  return SUBDOMAIN_RE.test(sub) && !RESERVED_SUBDOMAINS.has(sub)
}
