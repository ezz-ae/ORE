/**
 * MERGE TWO REGISTRATIONS BY THE SAME PERSON.
 *
 * "we dont do replacement — we do merge, so we get any new info added to the
 *  second registration, it could be valuable."
 *
 * The Duplicates page used to call PATCH { status: 'lost' } on the second
 * record and call that a merge. It copied nothing.
 *
 * ── THE CLIENT NAMES TWO LEADS; THE SERVER DECIDES WHAT MERGING MEANS ────
 *
 * The obvious alternative — let the page compute the merged profile and PATCH
 * the fields — would mean widening LEAD_WRITABLE_FIELDS to cover email, name,
 * budget and phone, so that ANY caller could rewrite a lead's identity through
 * the ordinary update path. This route takes two ids, re-reads both rows
 * itself, and applies only what lib/freehold/lead-merge.ts says may move. The
 * body cannot carry a value.
 *
 * ── THE SECOND RECORD IS KEPT, NOT DELETED ───────────────────────────────
 *
 * It is stamped `merged_into` and moved out of the working pipeline. The row
 * stays, so the merge is auditable, reversible, and — the reason that matters
 * on this account — the second registration remains a countable EVENT. It was
 * a real form fill on a real ad, and deleting it would quietly credit that ad
 * with one lead fewer than it produced.
 */
import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { brokerOwnerKeys } from '@/lib/freehold/lead-access'
import { query } from '@/lib/db'
import { ensureLeadsTable, ensureLeadActivityTable } from '@/lib/data'
import { planMerge, mergePatch, MERGEABLE_FIELDS, type MergeRow } from '@/lib/freehold/lead-merge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SELECT_FIELDS = `id, created_at::text, name, phone, email, country,
  budget_aed, interest, project_slug, message, assigned_broker_id, value_rating`

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const cookieStore = await cookies()
  const user = await verifySession(cookieStore.get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { duplicateId?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Bad request' }, { status: 400 }) }
  const duplicateId = String(body.duplicateId ?? '')
  if (!duplicateId) return NextResponse.json({ error: 'duplicateId required' }, { status: 400 })
  if (duplicateId === id) return NextResponse.json({ error: 'A lead cannot merge into itself' }, { status: 400 })

  try {
    await ensureLeadsTable()

    const rows = await query<MergeRow & { assigned_broker_id: string | null }>(
      `SELECT ${SELECT_FIELDS} FROM freehold_site_leads WHERE id = ANY($1::uuid[])`,
      [[id, duplicateId]],
    )
    if (rows.length < 2) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // A broker may merge only leads that are already theirs — merging is a
    // write to somebody's book, and doing it across owners would move a
    // record out of another broker's pipeline without a reassignment.
    if (user.role === 'broker') {
      const mine = brokerOwnerKeys({ email: user.email, brokerId: user.brokerId ?? null })
      if (!rows.every((r) => mine.includes(r.assigned_broker_id ?? ''))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // THE BASE IS DECIDED BY ARRIVAL, NOT BY THE URL. A page that had them
    // the wrong way round would otherwise make the newer record the base and
    // destroy the older one's rating and owner.
    const plan = planMerge(rows)
    if (!plan) return NextResponse.json({ error: 'Nothing to merge' }, { status: 400 })

    const patch = mergePatch(plan)
    const fields = Object.keys(patch).filter((f) => (MERGEABLE_FIELDS as readonly string[]).includes(f))
    if (fields.length) {
      const sets = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
      await query(
        `UPDATE freehold_site_leads SET ${sets}, updated_at = NOW() WHERE id = $1`,
        [plan.baseId, ...fields.map((f) => patch[f])],
      )
    }

    // The duplicate leaves the working pipeline but stays on the table.
    await query(
      `UPDATE freehold_site_leads
          SET merged_into = $2, merged_at = NOW(), status = 'lost', updated_at = NOW()
        WHERE id = ANY($1::uuid[])`,
      [plan.mergedIds, plan.baseId],
    )

    // THE TIMELINE FOLLOWS THE PERSON. The Duplicates page has promised this
    // on screen since it shipped — "all calls, notes, WhatsApp events and
    // stage changes from both records are combined into one timeline" — and
    // nothing did it. A broker who merged and then looked for the call they
    // logged last week would not find it. Best-effort: a merge that happened
    // is not undone by history that did not move.
    try {
      await ensureLeadActivityTable()
      await query(
        `UPDATE freehold_site_lead_activity SET lead_id = $2 WHERE lead_id = ANY($1::uuid[])`,
        [plan.mergedIds, plan.baseId],
      )
    } catch {
      // The merge stands; the note below records what was combined.
    }

    // WHAT MOVED, IN WORDS, ON THE LEAD'S OWN TIMELINE — including the
    // disagreements, which are the half a merge usually loses. Never fatal:
    // a merge that happened is not undone by a note that did not.
    const said = [
      `Merged registration ${plan.mergedIds.join(', ')} into ${plan.baseId} (${plan.registrations} registrations).`,
      fields.length ? `Added: ${fields.join(', ')}.` : 'Added: nothing new.',
      plan.conflicts.length
        ? `Also answered differently: ${plan.conflicts.map((c) => `${c.field} "${String(c.later)}" (kept "${String(c.base)}")`).join('; ')}.`
        : '',
      'Rating, owner and stage kept from the first registration.',
    ].filter(Boolean).join(' ')
    try {
      await ensureLeadActivityTable()
      await query(
        `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), plan.baseId, 'merge', said, user.email],
      )
    } catch {
      // Best-effort: the merge already happened.
    }

    return NextResponse.json({
      ok: true,
      baseId: plan.baseId,
      registrations: plan.registrations,
      added: fields,
      conflicts: plan.conflicts,
    })
  } catch {
    return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })
  }
}
