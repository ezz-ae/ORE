import { cookies, headers } from "next/headers"
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { query } from "@/lib/db"
import { ensureUsersTable, type UserProfileRecord } from "@/lib/ore"

const scryptAsync = promisify(scrypt)

export const SESSION_COOKIE = "gc_session"
const SESSION_TTL_DAYS = 7

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
  org_title?: string | null
  phone?: string | null
  commission_rate?: number | null
  language?: string | null
  ai_tone?: string | null
  ai_verbosity?: string | null
  notifications?: Record<string, boolean> | null
}

export const normalizeCrmRole = (role?: string | null) =>
  String(role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")

const resolvePermissionRole = (role?: string | null, orgTitle?: string | null) =>
  normalizeCrmRole(orgTitle || role)

export const resolveStoredCrmRole = (role?: string | null) => {
  const normalized = normalizeCrmRole(role)
  if (normalized === "broker") return "broker"
  return "admin"
}

type UserAuthRecord = UserProfileRecord & {
  password_hash?: string | null
  password_reset_token_hash?: string | null
  password_reset_expires?: string | null
}

const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex")

export const isAdminRole = (role?: string | null) => {
  const normalized = normalizeCrmRole(role)
  return normalized !== "broker"
}

export const canManageCrmUsers = (role?: string | null, orgTitle?: string | null) => {
  const normalized = resolvePermissionRole(role, orgTitle)
  return normalized === "ceo" || normalized === "general_manager" || normalized === "admin"
}

export const canDeleteCrmUsers = (role?: string | null, orgTitle?: string | null) =>
  resolvePermissionRole(role, orgTitle) === "ceo"

export const canDeleteCrmRecords = (role?: string | null, orgTitle?: string | null) => {
  const normalized = resolvePermissionRole(role, orgTitle)
  return normalized === "ceo" || normalized === "admin"
}

export async function ensureAuthTables() {
  await ensureUsersTable()
  await query(`
    CREATE TABLE IF NOT EXISTS gc_user_sessions (
      id text PRIMARY KEY,
      user_id text REFERENCES gc_users(id) ON DELETE CASCADE,
      token_hash text NOT NULL,
      created_at timestamptz DEFAULT now(),
      expires_at timestamptz NOT NULL
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS gc_activity_log (
      id text PRIMARY KEY,
      user_id text,
      action text,
      metadata jsonb,
      created_at timestamptz DEFAULT now()
    )
  `)
  await query(`
    CREATE TABLE IF NOT EXISTS gc_ai_conversations (
      id text PRIMARY KEY,
      user_id text REFERENCES gc_users(id) ON DELETE CASCADE,
      title text,
      pinned boolean DEFAULT false,
      messages jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    )
  `)
}

export async function logActivity(action: string, userId?: string | null, metadata?: Record<string, unknown>) {
  await ensureAuthTables()
  await query(
    `INSERT INTO gc_activity_log (id, user_id, action, metadata)
     VALUES ($1, $2, $3, $4)`,
    [randomBytes(16).toString("hex"), userId || null, action, metadata || null],
  )
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex")
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return `${salt}:${derived.toString("hex")}`
}

export async function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":")
  if (!salt || !hash) return false
  const derived = (await scryptAsync(password, salt, 64)) as Buffer
  return timingSafeEqual(Buffer.from(hash, "hex"), derived)
}

export async function getUserByEmailForAuth(email: string) {
  await ensureUsersTable()
  const rows = await query<UserAuthRecord>(
    `SELECT id, name, email, role, phone, commission_rate, language, ai_tone, ai_verbosity,
            org_title, notifications, password_hash, password_reset_token_hash, password_reset_expires
     FROM gc_users
     WHERE email = $1
     LIMIT 1`,
    [email],
  )
  return rows[0] || null
}

export async function touchUserLogin(userId: string) {
  await ensureUsersTable()
  await query(`UPDATE gc_users SET last_login_at = now() WHERE id = $1`, [userId])
}

export async function setPasswordResetToken(userId: string, token: string, expiresAt: Date) {
  await ensureUsersTable()
  await query(
    `UPDATE gc_users
     SET password_reset_token_hash = $1,
         password_reset_expires = $2
     WHERE id = $3`,
    [hashToken(token), expiresAt.toISOString(), userId],
  )
}

export async function updatePasswordFromReset(token: string, passwordHash: string) {
  await ensureUsersTable()
  const tokenHash = hashToken(token)
  const rows = await query<UserAuthRecord>(
    `UPDATE gc_users
     SET password_hash = $1,
         password_reset_token_hash = NULL,
         password_reset_expires = NULL
     WHERE password_reset_token_hash = $2
       AND (password_reset_expires IS NULL OR password_reset_expires >= now())
     RETURNING id, name, email, role, phone, commission_rate, language, ai_tone, ai_verbosity, notifications`,
    [passwordHash, tokenHash],
  )
  return rows[0] || null
}

export async function createSession(userId: string) {
  await ensureAuthTables()
  const token = randomBytes(32).toString("hex")
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  await query(
    `INSERT INTO gc_user_sessions (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [randomBytes(16).toString("hex"), userId, tokenHash, expiresAt.toISOString()],
  )
  return { token, expiresAt }
}

export async function destroySession(token: string) {
  await ensureAuthTables()
  await query(`DELETE FROM gc_user_sessions WHERE token_hash = $1`, [hashToken(token)])
}

export async function getSessionUserFromToken(token?: string | null): Promise<SessionUser | null> {
  if (!token) return null
  await ensureAuthTables()
  const rows = await query<SessionUser & { expires_at: string }>(
    `SELECT u.id, u.name, u.email, u.role, u.org_title, u.phone, u.commission_rate, u.language, u.ai_tone, u.ai_verbosity,
            u.notifications, s.expires_at
     FROM gc_user_sessions s
     JOIN gc_users u ON u.id = s.user_id
     WHERE s.token_hash = $1
     LIMIT 1`,
    [hashToken(token)],
  )
  const row = rows[0]
  if (!row) return null
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    await destroySession(token)
    return null
  }
  const { expires_at, ...user } = row
  return user
}

const parseCookieHeader = (header: string | null | undefined, name: string) => {
  if (!header) return undefined
  const cookies = header.split(";").map((cookie) => cookie.trim())
  for (const cookie of cookies) {
    if (!cookie) continue
    const [key, ...rest] = cookie.split("=")
    if (key === name) {
      return decodeURIComponent(rest.join("="))
    }
  }
  return undefined
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const token =
    cookieStore.get(SESSION_COOKIE)?.value ??
    parseCookieHeader(headerStore.get("cookie"), SESSION_COOKIE)
  return getSessionUserFromToken(token)
}

const SESSION_COOKIE_DOMAIN = process.env.SESSION_COOKIE_DOMAIN?.trim() || (process.env.NODE_ENV === "production" ? ".orerealestate.ae" : undefined)

const cookieOptions = {
  name: SESSION_COOKIE,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  domain: SESSION_COOKIE_DOMAIN,
}

export const buildSessionCookie = (token: string) => ({
  ...cookieOptions,
  value: token,
  maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
})

export const clearSessionCookie = () => ({
  ...cookieOptions,
  value: "",
  maxAge: 0,
})
