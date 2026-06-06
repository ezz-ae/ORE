/**
 * Credential store — SERVER ONLY.
 * Imported solely by the /api/server/login route handler. Never import this
 * from a client component (it would leak password hashes into the bundle).
 *
 * NOTE: plaintext demo credentials. Replace with a real user table + hashed
 * passwords (e.g. bcrypt/argon2) before production.
 */

import type { SessionUser } from './session-types'

interface Account {
  password: string
  user: SessionUser
}

const ACCOUNTS: Record<string, Account> = {
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

/** Verify credentials; returns the matching user or null. */
export function authenticate(email: string, password: string): SessionUser | null {
  const acct = ACCOUNTS[email.trim().toLowerCase()]
  if (!acct || acct.password !== password) return null
  return acct.user
}
