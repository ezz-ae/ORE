import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { randomUUID } from 'node:crypto'
import { getFormLeads, MetaApiError, MetaConfigError } from '@/lib/meta/client'
import type { MetaFormLead } from '@/lib/meta/types'
import { query } from '@/lib/db'
import { ensureLeadsTable } from '@/lib/data'

const FIELD_ALIASES: Record<string, 'name' | 'phone' | 'email'> = {
  full_name: 'name',
  name: 'name',
  first_name: 'name',
  phone_number: 'phone',
  phone: 'phone',
  email: 'email',
}

function extractContact(lead: MetaFormLead) {
  const contact: { name?: string; phone?: string; email?: string } = {}
  for (const field of lead.field_data ?? []) {
    const key = FIELD_ALIASES[field.name?.toLowerCase?.() ?? '']
    const value = field.values?.[0]?.trim()
    if (key && value && !contact[key]) contact[key] = value
  }
  return contact
}

/**
 * Pull-sync: every fetch of a form's leads also lands new ones in the CRM
 * leads table (keyed by meta_lead_id so re-fetches never duplicate).
 */
async function syncLeadsToCrm(formId: string, leads: MetaFormLead[]): Promise<number> {
  if (!leads.length) return 0
  await ensureLeadsTable()
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_lead_id text`)
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_form_id text`)

  let synced = 0
  for (const lead of leads) {
    const contact = extractContact(lead)
    if (!contact.phone && !contact.email) continue
    const inserted = await query<{ id: string }>(
      `INSERT INTO freehold_site_leads (
         id, name, phone, email, source, status, meta_lead_id, meta_form_id, created_at, updated_at
       )
       SELECT $1, $2, $3, NULLIF($4, ''), $5, 'new', $6, $7, COALESCE($8::timestamptz, now()), now()
       WHERE NOT EXISTS (
         SELECT 1 FROM freehold_site_leads WHERE meta_lead_id = $6
       )
       RETURNING id`,
      [
        randomUUID(),
        contact.name || 'Meta lead',
        contact.phone || '',
        contact.email || '',
        `meta_form:${formId}`,
        lead.id,
        formId,
        lead.created_time || null,
      ],
    ).catch((error) => {
      console.error('[meta-leads] CRM sync insert failed', error)
      return [] as { id: string }[]
    })
    if (inserted.length) synced += 1
  }
  return synced
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ formId: string }> },
) {
  const __auth = await requireSession()
  if ('res' in __auth) return __auth.res
  try {
    const { formId } = await params
    const leads = await getFormLeads(formId)
    const synced = await syncLeadsToCrm(formId, leads).catch((error) => {
      console.error('[meta-leads] CRM sync failed', error)
      return 0
    })
    return NextResponse.json({ leads, total: leads.length, syncedToCrm: synced })
  } catch (err) {
    if (err instanceof MetaConfigError)
      return NextResponse.json({ error: err.message, type: 'config' }, { status: 503 })
    if (err instanceof MetaApiError)
      return NextResponse.json({ error: err.message, code: err.code, type: err.type }, { status: 400 })
    return NextResponse.json({ error: 'Unexpected error', type: 'unknown' }, { status: 500 })
  }
}
