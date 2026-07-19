import { randomUUID } from 'node:crypto'
import { query } from '@/lib/db'
import { ensureLeadsTable } from '@/lib/data'
import { getFormLeads } from '@/lib/meta/client'
import { listLeadFormsMerged } from '@/lib/meta/form-registry'
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

/**
 * Map a Meta field key to a CRM contact slot. Exact aliases first (unchanged
 * behavior), then tolerant matching on the normalized key — custom/localized
 * question keys like "Phone number (WhatsApp)", "work-email" or
 * "your_full_name" used to miss the exact table, making the lead look
 * contact-less and silently dropping it from the CRM.
 */
function classifyFieldKey(rawKey: string): 'name' | 'phone' | 'email' | null {
  const lower = rawKey.toLowerCase()
  const exact = FIELD_ALIASES[lower]
  if (exact) return exact
  const norm = lower.replace(/[^a-z]/g, '')
  if (/(phone|mobile|whatsapp|tel)/.test(norm)) return 'phone'
  if (norm.includes('mail')) return 'email'
  if (norm.includes('name')) return 'name'
  return null
}

function extractContact(lead: MetaFormLead) {
  const contact: { name?: string; phone?: string; email?: string } = {}
  for (const field of lead.field_data ?? []) {
    const key = classifyFieldKey(field.name ?? '')
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

  // Campaign attribution: the Graph lead object carries campaign_id — store it
  // as utm_id so form leads match the SAME attribution every quality/verdict
  // read uses (utm_id = campaign id). Without this, instant-form leads were
  // invisible to campaign quality and the Ads Machine feedback loop.
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_id text`)

  let synced = 0
  for (const lead of leads) {
    const contact = extractContact(lead)
    if (!contact.phone && !contact.email) {
      // A contact-less lead is unusable in the CRM — but the skip must be
      // observable, not a silent undercount.
      console.warn(
        `[meta-leads] skipping lead ${lead.id} on form ${formId} — no phone/email found in field keys: ` +
        (lead.field_data ?? []).map((f) => f.name).join(', '),
      )
      continue
    }
    const inserted = await query<{ id: string }>(
      `INSERT INTO freehold_site_leads (
         id, name, phone, email, source, status, meta_lead_id, meta_form_id, utm_id, created_at, updated_at
       )
       SELECT $1, $2, $3, NULLIF($4, ''), $5, 'new', $6, $7, NULLIF($9, ''), COALESCE($8::timestamptz, now()), now()
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
        lead.campaign_id || '',
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
  // Merged source (paginated Meta list + locally-registered draft forms) so
  // the sweep covers every form we know about, not just Meta's first page.
  // Registry entries confirmed deleted on Meta have no leads edge to poll.
  const forms = (await listLeadFormsMerged()).filter((f) => f.status !== 'DELETED')
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
