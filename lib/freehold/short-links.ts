/**
 * Branded short links — the fhp.ae/l/{code} redirect service.
 *
 * Turns any long URL (a landing page, brochure, agent bio, tracked campaign
 * link) into a short, on-brand link that also counts clicks. Deliberately
 * simple and honest: a code resolves to exactly the target it was created with,
 * clicks are real counts, and an unknown code resolves to nothing (the route
 * sends it to the site home rather than inventing a destination).
 */
import { randomBytes } from 'node:crypto'
import { query } from '@/lib/db'

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

export interface ShortLink {
  code: string
  targetUrl: string
  createdBy: string | null
  clicks: number
  createdAt: string
}

let ensured: Promise<void> | null = null
function ensure(): Promise<void> {
  if (!ensured) {
    ensured = query(`
      CREATE TABLE IF NOT EXISTS freehold_short_links (
        code       text PRIMARY KEY,
        target_url text NOT NULL,
        created_by text,
        clicks     integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `).then(() => undefined)
  }
  return ensured
}

function genCode(len = 6): string {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

/** A code is a-z/A-Z/0-9/-/_ , 3–32 chars. Anything else is rejected. */
export function isValidCode(code: string): boolean {
  return /^[A-Za-z0-9_-]{3,32}$/.test(code)
}

/** Only genuine http(s) URLs are shortened — never a relative or junk value. */
export function normalizeTarget(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!/^https?:\/\//i.test(s)) return null
  try { return new URL(s).toString() } catch { return null }
}

function rowToLink(r: Record<string, unknown>): ShortLink {
  return {
    code: String(r.code),
    targetUrl: String(r.target_url),
    createdBy: r.created_by ? String(r.created_by) : null,
    clicks: Number(r.clicks ?? 0),
    createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date(0).toISOString(),
  }
}

export type CreateShortLinkResult =
  | { ok: true; link: ShortLink }
  | { ok: false; error: string }

export async function createShortLink(params: {
  targetUrl: string
  code?: string
  createdBy?: string | null
}): Promise<CreateShortLinkResult> {
  await ensure()
  const target = normalizeTarget(params.targetUrl)
  if (!target) return { ok: false, error: 'Enter a full http(s) URL to shorten.' }

  // Custom code: validate + ensure free. Auto code: retry until unique.
  if (params.code) {
    const code = params.code.trim()
    if (!isValidCode(code)) return { ok: false, error: 'Custom codes are 3–32 letters, numbers, - or _.' }
    const clash = await query(`SELECT 1 FROM freehold_short_links WHERE lower(code) = lower($1) LIMIT 1`, [code])
    if (clash[0]) return { ok: false, error: `The code "${code}" is already taken.` }
    const rows = await query<Record<string, unknown>>(
      `INSERT INTO freehold_short_links (code, target_url, created_by) VALUES ($1,$2,$3) RETURNING *`,
      [code, target, params.createdBy ?? null],
    )
    return { ok: true, link: rowToLink(rows[0]) }
  }

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = genCode(attempt < 3 ? 6 : 7)
    const clash = await query(`SELECT 1 FROM freehold_short_links WHERE code = $1 LIMIT 1`, [code])
    if (clash[0]) continue
    const rows = await query<Record<string, unknown>>(
      `INSERT INTO freehold_short_links (code, target_url, created_by) VALUES ($1,$2,$3) RETURNING *`,
      [code, target, params.createdBy ?? null],
    )
    return { ok: true, link: rowToLink(rows[0]) }
  }
  return { ok: false, error: 'Could not generate a free code — please try again.' }
}

/** Resolve a code to its target and count the click (fail-soft on the count). */
export async function resolveShortLink(code: string): Promise<string | null> {
  await ensure()
  const rows = await query<{ target_url: string }>(
    `UPDATE freehold_short_links SET clicks = clicks + 1 WHERE code = $1 RETURNING target_url`,
    [code],
  ).catch(() => [] as { target_url: string }[])
  return rows[0]?.target_url ?? null
}

export async function listShortLinks(limit = 100): Promise<ShortLink[]> {
  await ensure()
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM freehold_short_links ORDER BY created_at DESC LIMIT $1`, [Math.min(limit, 500)],
  )
  return rows.map(rowToLink)
}

export async function deleteShortLink(code: string): Promise<boolean> {
  await ensure()
  const rows = await query(`DELETE FROM freehold_short_links WHERE code = $1 RETURNING code`, [code])
  return rows.length > 0
}
