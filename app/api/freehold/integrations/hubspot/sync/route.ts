import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { query } from '@/lib/db'
import {
  hubspotConfigured, upsertContact, listRecentContacts,
  HubspotConfigError, HubspotApiError,
} from '@/lib/hubspot/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Two-way HubSpot sync.
 *   body.direction: 'push' | 'pull' | 'both' (default 'both')
 *   push → upsert CRM leads (with an email) into HubSpot contacts
 *   pull → import recent HubSpot contacts as CRM leads (new emails only)
 */
export async function POST(req: Request) {
  const auth = await requireSession(MANAGEMENT_ROLES)
  if ('res' in auth) return auth.res

  if (!hubspotConfigured()) {
    return NextResponse.json(
      { error: 'HubSpot not connected', configured: false, hint: 'Set HUBSPOT_TOKEN in the environment.' },
      { status: 409 },
    )
  }

  const body = await req.json().catch(() => ({})) as { direction?: 'push' | 'pull' | 'both'; limit?: number }
  const direction = body.direction ?? 'both'
  const limit = Math.min(Math.max(body.limit ?? 50, 1), 100)

  let pushed = 0, pulled = 0, skipped = 0

  try {
    // ── push: CRM leads → HubSpot ──────────────────────────────────────────
    if (direction === 'push' || direction === 'both') {
      const leads = await query<{ name: string | null; email: string | null; phone: string | null; source: string | null }>(
        `SELECT name, email, phone, source FROM freehold_site_leads
         WHERE email IS NOT NULL AND email <> '' ORDER BY created_at DESC LIMIT $1`,
        [limit],
      )
      for (const l of leads) {
        try {
          const id = await upsertContact(l)
          if (id) pushed++; else skipped++
        } catch { skipped++ }
      }
    }

    // ── pull: HubSpot contacts → CRM leads (new emails only) ───────────────
    if (direction === 'pull' || direction === 'both') {
      const contacts = await listRecentContacts(limit)
      const emails = contacts.map((c) => c.email).filter(Boolean)
      const existing = emails.length
        ? await query<{ email: string }>(
            `SELECT lower(email) AS email FROM freehold_site_leads WHERE lower(email) = ANY($1)`,
            [emails],
          )
        : []
      const known = new Set(existing.map((r) => r.email))
      for (const c of contacts) {
        if (!c.email || known.has(c.email)) { skipped++; continue }
        try {
          await query(
            `INSERT INTO freehold_site_leads (id, name, email, phone, source, status)
             VALUES ($1, $2, $3, $4, 'hubspot', 'new')`,
            [randomUUID(), c.name || 'HubSpot contact', c.email, c.phone || null],
          )
          known.add(c.email)
          pulled++
        } catch { skipped++ }
      }
    }

    return NextResponse.json({ ok: true, direction, pushed, pulled, skipped })
  } catch (err) {
    if (err instanceof HubspotConfigError) {
      return NextResponse.json({ error: 'HubSpot not connected', configured: false }, { status: 409 })
    }
    if (err instanceof HubspotApiError) {
      return NextResponse.json({ error: err.message, type: 'hubspot' }, { status: 502 })
    }
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
