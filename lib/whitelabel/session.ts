/**
 * White-label workspace session — a signed cookie carrying the brand snapshot
 * (name, product, accent, logo) a prospect chose at activation. Read on the
 * server (root layout + API routes, both Node runtime) and passed into the
 * client BrandProvider as props, so the cookie stays httpOnly.
 *
 * Signed with HMAC-SHA256 using the same FH_SESSION_SECRET as the platform
 * session, so a forged brand cookie is rejected. This is a demo skin, not an
 * authorization boundary — the platform session (`fh_session`) still gates the
 * app; this only decides which brand is painted.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { WL_SESSION_TTL_MS } from './config'

export interface WorkspaceBrand {
  /** Workspace id (row in wl_workspaces). */
  id: string
  /** Company display name, e.g. "Skyline". Replaces BRAND.company. */
  company: string
  /** Product word after the company name, e.g. "Intelligence". */
  product: string
  /** Brand accent hex, drives --color-gold. */
  accent: string
  /**
   * Logo URL for the brand mark — `/api/wl/logo` when the workspace uploaded a
   * logo (served from the DB row), or empty for the wordmark-only look. The
   * actual image bytes never enter the cookie (they would blow the 4 KB limit).
   */
  logo: string
}

interface Payload extends WorkspaceBrand {
  exp: number
}

function secret(): string {
  const s = process.env.FH_SESSION_SECRET
  if (s) return s
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FH_SESSION_SECRET is not set — refusing to sign white-label sessions insecurely in production.')
  }
  return 'dev-insecure-secret-change-me-in-prod'
}

const b64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

const sign = (body: string) => b64url(createHmac('sha256', secret()).update(body).digest())

/** Sign a workspace brand into a `body.signature` token valid for the WL TTL. */
export function signWorkspace(brand: WorkspaceBrand): string {
  const payload: Payload = { ...brand, exp: Date.now() + WL_SESSION_TTL_MS }
  const body = b64url(Buffer.from(JSON.stringify(payload)))
  return `${body}.${sign(body)}`
}

/** Verify a token → the workspace brand, or null when invalid/expired. */
export function verifyWorkspace(token?: string | null): WorkspaceBrand | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  try {
    const expected = sign(body)
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as Payload
    if (!payload.exp || payload.exp < Date.now()) return null
    const { exp: _exp, ...brand } = payload
    return brand
  } catch {
    return null
  }
}
