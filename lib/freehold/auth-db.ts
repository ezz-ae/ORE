// DB-backed user authentication — queries freehold_site_users
// Falls back gracefully if table doesn't exist or user not found
import { query } from '@/lib/db'
import type { SessionUser } from './session-types'
import { createHash, scryptSync, timingSafeEqual } from 'node:crypto'

interface DbUser {
  id: string
  name: string
  email: string
  role: string
  password_hash: string | null
  ai_access: boolean
}

// Hash a plaintext password to compare with DB hash
// DB stores passwords as: scrypt:salt:hash OR bcrypt:$2b$... OR plain:sha256hash
function verifyPassword(plaintext: string, stored: string | null): boolean {
  if (!stored) return false
  // Support plain SHA-256 (legacy) — stored as hex
  if (!stored.includes(':')) {
    const hash = createHash('sha256').update(plaintext).digest('hex')
    return timingSafeEqual(Buffer.from(hash), Buffer.from(stored))
  }
  // Support scrypt format: "scrypt:salt:hash"
  const parts = stored.split(':')
  if (parts[0] === 'scrypt' && parts.length === 3) {
    const [, salt, hashHex] = parts
    try {
      const derivedKey = scryptSync(plaintext, salt, 32)
      return timingSafeEqual(derivedKey, Buffer.from(hashHex, 'hex'))
    } catch { return false }
  }
  return false
}

const ROLE_HOME: Record<string, string> = {
  broker: '/freehold-intelligence/agent',
  admin: '/freehold-intelligence',
  sales_manager: '/freehold-intelligence',
  director: '/freehold-intelligence',
  ceo: '/freehold-intelligence',
  marketing: '/freehold-intelligence',
}

export async function authenticateFromDB(email: string, password: string): Promise<SessionUser | null> {
  try {
    const rows = await query<DbUser>(
      `SELECT id, name, email, role, password_hash, ai_access
       FROM freehold_site_users
       WHERE email = $1 LIMIT 1`,
      [email.trim().toLowerCase()]
    )
    if (rows.length === 0) return null
    const u = rows[0]
    if (!verifyPassword(password, u.password_hash)) return null
    const role = u.role as SessionUser['role']
    return {
      email: u.email,
      name: u.name ?? u.email,
      initials: (u.name ?? u.email).split(' ').map((p: string) => p[0]).slice(0,2).join('').toUpperCase(),
      role,
      home: ROLE_HOME[role] ?? '/freehold-intelligence',
      ...(role === 'broker' ? { brokerId: `bc_${u.id}` } : {}),
    }
  } catch {
    return null
  }
}
