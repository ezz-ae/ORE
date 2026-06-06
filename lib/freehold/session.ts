'use client'

/**
 * Client session helpers. Authentication state now lives in a signed, httpOnly
 * cookie set by /api/server/login and enforced by middleware — the client can
 * never read or forge it. These helpers only talk to the auth API.
 */

export type { Role, SessionUser } from './session-types'
import type { SessionUser } from './session-types'

/** Sign in. Returns the user on success, or null on bad credentials. */
export async function login(
  email: string,
  password: string,
  remember: boolean,
): Promise<SessionUser | null> {
  try {
    const res = await fetch('/api/server/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { user: SessionUser }
    return data.user
  } catch {
    return null
  }
}

/** Read the current session from the server (verified cookie). */
export async function fetchSession(): Promise<SessionUser | null> {
  try {
    const res = await fetch('/api/server/me', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { user: SessionUser | null }
    return data.user
  } catch {
    return null
  }
}

/** Sign out — clears the httpOnly cookie on the server. */
export async function clearSession(): Promise<void> {
  try {
    await fetch('/api/server/logout', { method: 'POST' })
  } catch {
    /* ignore network errors on logout */
  }
}
