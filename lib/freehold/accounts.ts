/**
 * Credential store — SERVER ONLY.
 * Imported solely by the /api/server/login route handler. Never import this
 * from a client component (it would leak passwords into the bundle).
 *
 * NOTE: plaintext credentials. Replace with a real user table + hashed
 * passwords (e.g. bcrypt/argon2) before production.
 *
 * Default passwords by role:
 *   CEO       → FH_CEO_2026
 *   Director  → FH_Mgmt_2026
 *   Admin     → FH_Admin_2026
 *   Broker    → FH_Broker_2026
 */

import type { SessionUser } from './session-types'

interface Account {
  password: string
  user: SessionUser
}

const ACCOUNTS: Record<string, Account> = {
  // ── CEO ──────────────────────────────────────────────────────────────────
  'bashar@freeholdproperty.ae': {
    password: 'FH_CEO_2026',
    user: { email: 'bashar@freeholdproperty.ae', name: 'Bashar', initials: 'BS', role: 'ceo', home: '/freehold-intelligence' },
  },

  // ── Management (Director level) ───────────────────────────────────────────
  'yamen@freeholdproperty.ae': {
    password: 'FH_Mgmt_2026',
    user: { email: 'yamen@freeholdproperty.ae', name: 'Yamen', initials: 'YA', role: 'director', home: '/freehold-intelligence' },
  },
  'majd@freeholdproperty.ae': {
    password: 'FH_Mgmt_2026',
    user: { email: 'majd@freeholdproperty.ae', name: 'Majd', initials: 'MJ', role: 'director', home: '/freehold-intelligence' },
  },

  // ── Admin / Office ────────────────────────────────────────────────────────
  'admin@freeholdproperty.ae': {
    password: 'FH_Admin_2026',
    user: { email: 'admin@freeholdproperty.ae', name: 'Cor', initials: 'CO', role: 'admin', home: '/freehold-intelligence' },
  },
  'info@freeholdproperty.ae': {
    password: 'FH_Admin_2026',
    user: { email: 'info@freeholdproperty.ae', name: 'Office', initials: 'OF', role: 'admin', home: '/freehold-intelligence' },
  },

  // ── Brokers ───────────────────────────────────────────────────────────────
  'norelly@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'norelly@freeholdproperty.ae', name: 'Norelly', initials: 'NR', role: 'broker', brokerId: 'bc_norelly', home: '/freehold-intelligence/agent' },
  },
  'norelly1@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'norelly1@freeholdproperty.ae', name: 'Norelly (2)', initials: 'N2', role: 'broker', brokerId: 'bc_norelly1', home: '/freehold-intelligence/agent' },
  },
  'ali.javed@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'ali.javed@freeholdproperty.ae', name: 'Ali Javed', initials: 'AJ', role: 'broker', brokerId: 'bc_ali_javed', home: '/freehold-intelligence/agent' },
  },
  'talal@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'talal@freeholdproperty.ae', name: 'Talal', initials: 'TL', role: 'broker', brokerId: 'bc_talal', home: '/freehold-intelligence/agent' },
  },
  'laila@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'laila@freeholdproperty.ae', name: 'Laila', initials: 'LA', role: 'broker', brokerId: 'bc_laila', home: '/freehold-intelligence/agent' },
  },
  'milia@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'milia@freeholdproperty.ae', name: 'Milia', initials: 'MI', role: 'broker', brokerId: 'bc_milia', home: '/freehold-intelligence/agent' },
  },
  'taleen@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'taleen@freeholdproperty.ae', name: 'Taleen', initials: 'TN', role: 'broker', brokerId: 'bc_taleen', home: '/freehold-intelligence/agent' },
  },
  'ihab@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'ihab@freeholdproperty.ae', name: 'Ihab', initials: 'IH', role: 'broker', brokerId: 'bc_ihab', home: '/freehold-intelligence/agent' },
  },
  'ibrahim@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'ibrahim@freeholdproperty.ae', name: 'Ibrahim', initials: 'IB', role: 'broker', brokerId: 'bc_ibrahim', home: '/freehold-intelligence/agent' },
  },
  'fatemah@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'fatemah@freeholdproperty.ae', name: 'Fatemah', initials: 'FT', role: 'broker', brokerId: 'bc_fatemah', home: '/freehold-intelligence/agent' },
  },
  'pravin@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'pravin@freeholdproperty.ae', name: 'Pravin', initials: 'PV', role: 'broker', brokerId: 'bc_pravin', home: '/freehold-intelligence/agent' },
  },
  'shaima@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'shaima@freeholdproperty.ae', name: 'Shaima', initials: 'SH', role: 'broker', brokerId: 'bc_shaima', home: '/freehold-intelligence/agent' },
  },
  'maha@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'maha@freeholdproperty.ae', name: 'Maha', initials: 'MA', role: 'broker', brokerId: 'bc_maha', home: '/freehold-intelligence/agent' },
  },
  'wissam.farhat@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'wissam.farhat@freeholdproperty.ae', name: 'Wissam Farhat', initials: 'WF', role: 'broker', brokerId: 'bc_wissam', home: '/freehold-intelligence/agent' },
  },
  'hanna@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'hanna@freeholdproperty.ae', name: 'Hanna', initials: 'HN', role: 'broker', brokerId: 'bc_hanna', home: '/freehold-intelligence/agent' },
  },
  'ahmad@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'ahmad@freeholdproperty.ae', name: 'Ahmad', initials: 'AH', role: 'broker', brokerId: 'bc_ahmad', home: '/freehold-intelligence/agent' },
  },
  'julie@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'julie@freeholdproperty.ae', name: 'Julie', initials: 'JU', role: 'broker', brokerId: 'bc_julie', home: '/freehold-intelligence/agent' },
  },
  'kashif@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'kashif@freeholdproperty.ae', name: 'Kashif', initials: 'KF', role: 'broker', brokerId: 'bc_kashif', home: '/freehold-intelligence/agent' },
  },
  'samah@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'samah@freeholdproperty.ae', name: 'Samah', initials: 'SM', role: 'broker', brokerId: 'bc_samah', home: '/freehold-intelligence/agent' },
  },
  'meera@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'meera@freeholdproperty.ae', name: 'Meera', initials: 'ME', role: 'broker', brokerId: 'bc_meera', home: '/freehold-intelligence/agent' },
  },
  'manar@freeholdproperty.ae': {
    password: 'FH_Broker_2026',
    user: { email: 'manar@freeholdproperty.ae', name: 'Manar', initials: 'MN', role: 'broker', brokerId: 'bc_manar', home: '/freehold-intelligence/agent' },
  },
}

/** Verify credentials; returns the matching user or null. */
export function authenticate(email: string, password: string): SessionUser | null {
  const acct = ACCOUNTS[email.trim().toLowerCase()]
  if (!acct || acct.password !== password) return null
  return acct.user
}
