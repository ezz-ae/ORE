/**
 * Self-serve trial onboarding — everything that happens between "Create my
 * workspace" and the broker standing inside their own branded instance.
 *
 * The signup request arrives on the APEX host, but the instance lives on
 * {sub}.TENANT_BASE_DOMAIN — and session cookies are host-only by design. So
 * instead of setting a cookie the tenant host would never see, signup returns
 * a short-lived HMAC claim token; /api/wl/claim on the TENANT host verifies
 * it (host must match the token's tenant), mints the real session cookie
 * there, and lands the admin on their home screen.
 */

import { randomUUID } from 'node:crypto'
import { runWithSchema } from '@/lib/db'
import { signSession } from '@/lib/freehold/auth-edge'
import { hashPassword } from '@/lib/auth'
import { upsertUserProfile } from '@/lib/data'
import type { SessionUser } from '@/lib/freehold/session-types'
import { createTenant, type SaasTenant } from './store'
import { provisionTenantSchema } from './provision'

/** Claim tokens are single-purpose and near-immediate — keep them short. */
export const CLAIM_TOKEN_TTL_MS = 2 * 60 * 1000

export type SignupResult =
  | { ok: true; tenant: SaasTenant; claimToken: string }
  | { ok: false; reason: 'invalid_subdomain' | 'reserved' | 'taken' }

const initialsOf = (name: string, email: string): string =>
  (name || email).split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'WS'

/**
 * Create the tenant, provision its schema, create its first (owner) account
 * inside that schema, and mint the claim token that logs them in on their
 * own subdomain.
 */
export async function signupTenant(input: {
  subdomain: string
  company: string
  product?: string
  accent?: string
  logo?: string
  adminName: string
  adminEmail: string
  password: string
}): Promise<SignupResult> {
  const created = await createTenant({
    subdomain: input.subdomain,
    company: input.company,
    product: input.product,
    accent: input.accent,
    logo: input.logo,
  })
  if (!created.ok) return { ok: false, reason: created.reason }
  const tenant = created.tenant

  // Private catalogue copy — non-fatal (idempotent; lazy DDL covers the rest,
  // and an operator retry can finish it).
  await provisionTenantSchema(tenant.schemaName).catch(() => {})

  // The owner account lives INSIDE the tenant schema: their users table,
  // their roster, their login.
  const email = input.adminEmail.trim().toLowerCase()
  const name = input.adminName.trim() || tenant.company
  await runWithSchema(tenant.schemaName, async () => {
    await upsertUserProfile({
      id: `user_${randomUUID()}`,
      name,
      email,
      role: 'ceo',
      password_hash: await hashPassword(input.password),
    })
  })

  const owner: SessionUser = {
    email,
    name,
    initials: initialsOf(name, email),
    role: 'ceo',
    home: '/freehold-intelligence',
    tenant: tenant.subdomain,
  }
  const claimToken = await signSession(owner, CLAIM_TOKEN_TTL_MS)

  return { ok: true, tenant, claimToken }
}
