/**
 * Edge-safe session signing/verification (Web Crypto, HMAC-SHA256).
 * Used by both the middleware (Edge runtime) and the API route handlers.
 * Holds NO credentials — only signs/verifies an already-authenticated session.
 */

import type { SessionUser } from './session-types'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function getSecret(): string {
  return process.env.FH_SESSION_SECRET || 'dev-insecure-secret-change-me-in-prod'
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(str: string): Uint8Array {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0
  s += '='.repeat(pad)
  const bin = atob(s)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

// Web Crypto's DOM types want an ArrayBuffer-backed BufferSource; Uint8Array
// is fine at runtime, so normalize the type at the call boundary.
function buf(data: Uint8Array): BufferSource {
  return data as unknown as BufferSource
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    buf(encoder.encode(getSecret())),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

interface SessionPayload extends SessionUser {
  exp: number
}

/** Sign a session into a `payload.signature` token valid for `ttlMs`. */
export async function signSession(user: SessionUser, ttlMs: number): Promise<string> {
  const payload: SessionPayload = { ...user, exp: Date.now() + ttlMs }
  const body = b64urlEncode(encoder.encode(JSON.stringify(payload)))
  const key = await hmacKey()
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf(encoder.encode(body))))
  return `${body}.${b64urlEncode(sig)}`
}

/** Verify a token; returns the user if the signature is valid and unexpired. */
export async function verifySession(token?: string | null): Promise<SessionUser | null> {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  try {
    const key = await hmacKey()
    const ok = await crypto.subtle.verify('HMAC', key, buf(b64urlDecode(sig)), buf(encoder.encode(body)))
    if (!ok) return null
    const payload = JSON.parse(decoder.decode(b64urlDecode(body))) as SessionPayload
    if (!payload.exp || payload.exp < Date.now()) return null
    const { exp: _exp, ...user } = payload
    return user
  } catch {
    return null
  }
}

export const SESSION_COOKIE = 'fh_session'
