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
  'm@freehold.ae': {
    password: 'CEO_in26',
    user: {
      email:    'm@freehold.ae',
      name:     'Mubarak',
      initials: 'MB',
      role:     'ceo',
      home:     '/freehold-intelligence',
    },
  },
  'director@freehold.ae': {
    password: 'Director_in26',
    user: {
      email:    'director@freehold.ae',
      name:     'Omar Al Rashid',
      initials: 'OR',
      role:     'director',
      home:     '/freehold-intelligence',
    },
  },
  'admin@freehold.ae': {
    password: 'FreeHold_in26',
    user: {
      email:    'admin@freehold.ae',
      name:     'Admin Desk',
      initials: 'AD',
      role:     'admin',
      home:     '/freehold-intelligence',
    },
  },
  'sales@freehold.ae': {
    password: 'Sales_in26',
    user: {
      email:    'sales@freehold.ae',
      name:     'Khalid Hassan',
      initials: 'KH',
      role:     'sales_manager',
      home:     '/freehold-intelligence',
    },
  },
  'marketing@freehold.ae': {
    password: 'Marketing_in26',
    user: {
      email:    'marketing@freehold.ae',
      name:     'Layla Nasser',
      initials: 'LN',
      role:     'marketing',
      home:     '/freehold-intelligence',
    },
  },
  'ahmad@freehold.ae': {
    password: 'Broker_in26',
    user: {
      email:    'ahmad@freehold.ae',
      name:     'Ahmad Khalil',
      initials: 'AK',
      role:     'broker',
      brokerId: 'bc_ahmed',
      home:     '/freehold-intelligence/agent',
    },
  },
}

/** Verify credentials; returns the matching user or null. */
export function authenticate(email: string, password: string): SessionUser | null {
  const acct = ACCOUNTS[email.trim().toLowerCase()]
  if (!acct || acct.password !== password) return null
  return acct.user
}

