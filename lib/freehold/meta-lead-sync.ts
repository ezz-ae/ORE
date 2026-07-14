import { randomUUID } from 'node:crypto'
import { query } from '@/lib/db'
import { ensureLeadsTable } from '@/lib/data'
import { getFormLeads, listLeadForms } from '@/lib/meta/client'
import type { MetaFormLead } from '@/lib/meta/types'
import { handleNewLead } from '@/lib/automation/engine'

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
 * Pull-sync: insert any of a form's Meta leads that aren't already in the CRM
 * (deduped by meta_lead_id), then run each newly-inserted lead through the
 * SAME automation engine an on-site landing-page lead gets (broker
 * assignment / distribution rules) — a synced lead with no owner sits just
 * as invisibly as one that never arrived.
 */
export async function syncLeadsToCrm(formId: string, leads: MetaFormLead[]): Promise<number> {
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
    if (inserted.length) {
      synced += 1
      await handleNewLead(inserted[0].id).catch((error) => {
        console.error('[meta-leads] automation handoff failed', error)
      })
    }
  }
  return synced
}

/**
 * Sweep every lead form on the connected ad account and sync any new leads.
 * This is the mechanism that makes ingestion NOT depend on a human opening
 * a form's page in the dashboard — see app/api/cron/sync-meta-leads, the
 * scheduled job that calls this on a timer. Before this existed, the ONLY
 * trigger for syncLeadsToCrm was a staff member viewing that exact form's
 * detail page, so a form nobody happened to click into could convert real
 * leads on Meta that never once landed in the CRM.
 */
export async function syncAllMetaLeads(): Promise<{
  formsChecked: number
  totalSynced: number
  perForm: Array<{ formId: string; formName: string; synced: number; error?: string }>
}> {
  const forms = await listLeadForms()
  const perForm: Array<{ formId: string; formName: string; synced: number; error?: string }> = []
  let totalSynced = 0
  for (const form of forms) {
    try {
      const leads = await getFormLeads(form.id)
      const synced = await syncLeadsToCrm(form.id, leads)
      perForm.push({ formId: form.id, formName: form.name, synced })
      totalSynced += synced
    } catch (error) {
      perForm.push({
        formId: form.id,
        formName: form.name,
        synced: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  return { formsChecked: forms.length, totalSynced, perForm }
}
