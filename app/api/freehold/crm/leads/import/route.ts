/**
 * BULK LEAD IMPORT — the thing that did not exist.
 *
 * Leads could be created one at a time through a modal, or arrive from a form
 * or a webhook. A brokerage moving in with twenty thousand historical leads
 * had nowhere to put them, so they went into the anonymised Data Pool, which
 * strips every contact by design and cannot ring anybody.
 *
 * These rows are PRIVATE TO THIS TENANT and always were: `freehold_site_leads`
 * is the tenant's own table, and nothing here crosses into the shared brain.
 * Only the Data Pool's dimension counts do that, and they carry no contact.
 */
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES, type Role } from '@/lib/freehold/session-types'
import { query } from '@/lib/db'
import { ensureLeadsTable } from '@/lib/data'
import { planLeadImport, normalisePhone, normaliseEmail, type RawLead } from '@/lib/freehold/lead-import'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES: Role[] = [...MANAGEMENT_ROLES, 'marketing']

/** Batches are bounded so one call cannot hold a connection for a minute. The
 *  client sends several; each is its own transaction and its own report. */
const MAX_ROWS = 2000

export async function POST(req: NextRequest) {
  const auth = await requireSession(ROLES)
  if ('res' in auth) return auth.res

  const body = await req.json().catch(() => null) as { rows?: RawLead[] } | null
  if (!body || !Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: 'rows[] is required' }, { status: 400 })
  }
  if (body.rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Max ${MAX_ROWS} rows per call — send in batches` }, { status: 400 })
  }

  const plan = planLeadImport(body.rows)
  if (plan.leads.length === 0) {
    return NextResponse.json({
      inserted: 0, skippedExisting: 0,
      unreachable: plan.unreachable, duplicatesInFile: plan.duplicatesInFile, empty: plan.empty,
    })
  }

  try {
    await ensureLeadsTable()

    // ALREADY HERE? A re-run of the same file must not double every lead —
    // that is how a broker ends up calling the same person twice and how a
    // "leads this month" number becomes fiction. Matched on the same
    // normalised phone/email the planner deduped the file by.
    const phones = plan.leads.map((l) => (l.phone ? normalisePhone(l.phone) : '')).filter(Boolean)
    const emails = plan.leads.map((l) => (l.email ? normaliseEmail(l.email) : '')).filter(Boolean)

    const existing = await query<{ p: string | null; e: string | null }>(
      `SELECT right(regexp_replace(COALESCE(phone,''), '\\D', '', 'g'), 9) AS p,
              lower(trim(COALESCE(email,''))) AS e
         FROM freehold_site_leads
        WHERE right(regexp_replace(COALESCE(phone,''), '\\D', '', 'g'), 9) = ANY($1)
           OR lower(trim(COALESCE(email,''))) = ANY($2)`,
      [phones.length ? phones : [''], emails.length ? emails : ['']],
    )
    const known = new Set<string>()
    for (const r of existing) {
      if (r.p) known.add(`p:${r.p}`)
      if (r.e) known.add(`e:${r.e}`)
    }

    const fresh = plan.leads.filter((l) => !known.has(l.dedupeKey))
    const skippedExisting = plan.leads.length - fresh.length

    let inserted = 0
    if (fresh.length > 0) {
      // One multi-row INSERT rather than a statement per lead: twenty thousand
      // round trips is the difference between an import and an afternoon.
      const cols = 10
      const values = fresh.map((_, i) => {
        const b = i * cols
        return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10})`
      }).join(',')
      const params = fresh.flatMap((l) => [
        randomUUID(), l.name, l.phone, l.email, l.source,
        l.status, 'warm', l.assignedTo, l.interest, l.budgetAed,
      ])
      const res = await query<{ id: string }>(
        `INSERT INTO freehold_site_leads
           (id, name, phone, email, source, status, priority, assigned_broker_id, interest, budget_aed)
         VALUES ${values}
         RETURNING id`,
        params,
      )
      inserted = res.length
    }

    return NextResponse.json({
      inserted,
      skippedExisting,
      unreachable: plan.unreachable,
      duplicatesInFile: plan.duplicatesInFile,
      empty: plan.empty,
    }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 },
    )
  }
}
