'use client'

/**
 * Freehold Server — role-aware session (client-side gateway)
 * ──────────────────────────────────────────────────────────
 * The whole admin/broker product lives under one entry point: /server.
 * /server authenticates, infers the user's ROLE from their credentials, and
 * routes them to the landing built for that role. Admins land on the executive
 * management dashboard; brokers land on their agent workspace. Both roles can
 * open most of the same apps — the apps just scope their data to the role.
 *
 * NOTE: credentials are temporary client-side stubs. Replace ACCOUNTS with a
 * real server-side auth check before going live.
 */

export type Role = 'admin' | 'broker'

export interface SessionUser {
  email: string
  name: string
  initials: string
  role: Role
  /** Broker id linking the session to credit / lead data (brokers only). */
  brokerId?: string
  /** Where this role lands after login. */
  home: string
}

/** Legacy presence flag (kept so existing guards keep working). */
const AUTH_KEY = 'fh_mgmt_auth'
/** Serialized SessionUser. */
const USER_KEY = 'fh_session_user'

interface Account {
  password: string
  user: SessionUser
}

/** Temporary credential → role map. Replace with real auth. */
export const ACCOUNTS: Record<string, Account> = {
  'admin@freehold.ae': {
    password: 'FreeHold_in26',
    user: {
      email: 'admin@freehold.ae',
      name: 'Administrator',
      initials: 'AD',
      role: 'admin',
      home: '/management',
    },
  },
  'ahmad@freehold.ae': {
    password: 'Broker_in26',
    user: {
      email: 'ahmad@freehold.ae',
      name: 'Ahmad Khalil',
      initials: 'AK',
      role: 'broker',
      brokerId: 'bc_ahmed',
      home: '/freehold-intelligence/agent',
    },
  },
}

export function roleHome(role: Role): string {
  return role === 'admin' ? '/management' : '/freehold-intelligence/agent'
}

/** Verify credentials; returns the matching user or null. */
export function authenticate(email: string, password: string): SessionUser | null {
  const acct = ACCOUNTS[email.trim().toLowerCase()]
  if (!acct || acct.password !== password) return null
  return acct.user
}

/** Persist a session. `remember` survives browser restarts; otherwise tab-only. */
export function persistSession(user: SessionUser, remember: boolean) {
  if (typeof window === 'undefined') return
  const json = JSON.stringify(user)
  sessionStorage.setItem(AUTH_KEY, '1')
  sessionStorage.setItem(USER_KEY, json)
  if (remember) {
    localStorage.setItem(AUTH_KEY, '1')
    localStorage.setItem(USER_KEY, json)
  } else {
    localStorage.removeItem(AUTH_KEY)
    localStorage.removeItem(USER_KEY)
  }
}

/** Read the current session (session storage first, then "remember me"). */
export function getSession(): SessionUser | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY)
  if (!raw) {
    // Back-compat: an old auth flag with no user record → treat as admin.
    const legacy = sessionStorage.getItem(AUTH_KEY) || localStorage.getItem(AUTH_KEY)
    if (legacy) return ACCOUNTS['admin@freehold.ae'].user
    return null
  }
  try {
    return JSON.parse(raw) as SessionUser
  } catch {
    return null
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(AUTH_KEY)
  sessionStorage.removeItem(USER_KEY)
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem(USER_KEY)
}
