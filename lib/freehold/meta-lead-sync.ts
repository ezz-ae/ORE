import { randomUUID } from 'node:crypto'
import { query } from '@/lib/db'
import { ensureLeadsTable } from '@/lib/data'
import { getFormLeads, listAccessiblePages, namesByIds } from '@/lib/meta/client'
import { listLeadFormsMerged } from '@/lib/meta/form-registry'
import type { MetaFormLead } from '@/lib/meta/types'
import { captureForLead } from '@/lib/freehold/snapshot-capture'
import { handleNewLead } from '@/lib/automation/engine'
import {
  getLeadershipLeadRecipients,
  sendInternalLeadAlertEmail,
  sendLeadWhatsAppAlert,
} from '@/lib/transactional-email'

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
 * What one form's sync actually did. `skipped` exists because a lead with no
 * phone AND no email cannot be used in the CRM, so it is dropped — previously
 * with nothing but a console.warn. That made "Meta says 30 leads, the CRM has
 * 0, and the sync reported no error" completely unexplainable from the UI.
 */
export interface SyncOutcome { synced: number; skipped: number }

/**
 * Pull-sync: insert any of a form's Meta leads that aren't already in the CRM
 * (deduped by meta_lead_id), then run each newly-inserted lead through the
 * SAME automation engine an on-site landing-page lead gets (broker
 * assignment / distribution rules) — a synced lead with no owner sits just
 * as invisibly as one that never arrived.
 */
// Once-per-instance: collapse any duplicate meta_lead_id rows a pre-index race
// already produced (keep the earliest), then enforce uniqueness going forward.
// Failure is tolerated — the WHERE NOT EXISTS guard still catches the common
// case; the index only upgrades the concurrent case from "duplicate row" to
// "caught insert error".
let metaLeadUniqueEnsured: Promise<void> | null = null
function ensureMetaLeadUnique(): Promise<void> {
  if (!metaLeadUniqueEnsured) {
    metaLeadUniqueEnsured = (async () => {
      await query(
        `DELETE FROM freehold_site_leads a
          USING freehold_site_leads b
          WHERE a.meta_lead_id IS NOT NULL
            AND a.meta_lead_id = b.meta_lead_id
            AND (a.created_at > b.created_at OR (a.created_at = b.created_at AND a.ctid > b.ctid))`,
      )
      await query(
        `CREATE UNIQUE INDEX IF NOT EXISTS freehold_site_leads_meta_lead_id_uidx
           ON freehold_site_leads (meta_lead_id) WHERE meta_lead_id IS NOT NULL`,
      )
    })().catch((e) => {
      metaLeadUniqueEnsured = null // let a later sweep retry
      console.error('[meta-leads] could not enforce meta_lead_id uniqueness (dedupe still applies per-row)', e)
    })
  }
  return metaLeadUniqueEnsured
}

export async function syncLeadsToCrm(
  formId: string,
  leads: MetaFormLead[],
  formName?: string | null,
): Promise<SyncOutcome> {
  if (!leads.length) return { synced: 0, skipped: 0 }
  await ensureLeadsTable()
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_lead_id text`)
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_form_id text`)

  // Campaign attribution: the Graph lead object carries campaign_id — store it
  // as utm_id so form leads match the SAME attribution every quality/verdict
  // read uses (utm_id = campaign id). Without this, instant-form leads were
  // invisible to campaign quality and the Ads Machine feedback loop.
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS utm_id text`)

  // AD attribution, one level below the campaign: which exact ad produced this
  // lead. The per-form analysis groups leads (and their value ratings) by ad —
  // "the same form fed by ad A averages 7, fed by ad B averages 2" is the ad
  // setup insight, and it is only computable if the ad id survives the sync.
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_ad_id text`)
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_adset_id text`)

  // THE NAMES, NOT THE NUMBERS.
  //
  // A lead arrived carrying `meta_form:120251…` and that is what the CRM
  // showed. Unreadable on its own, and useless in the case that matters: two
  // ads in one campaign, a different form on each, run that way deliberately so
  // the ads do not compete with each other. The campaign name then identifies
  // nothing and the id identifies nothing a person can say out loud.
  //
  // Resolved once at sync and STORED, rather than looked up when a screen
  // renders. A name fetched on read is a Meta call on every page load, and it
  // disappears the day the form is deleted — the lead outlives the form, and
  // the record of where it came from has to outlive it too.
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_form_name text`)
  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS meta_ad_name text`)

  // One request for every distinct ad in this batch, not one per lead.
  const adNames = await namesByIds(leads.map((l) => l.ad_id ?? '').filter(Boolean))

  // The dedupe guarantee. `INSERT ... WHERE NOT EXISTS` is not atomic: the cron
  // sweep and the on-view sync can both pass the check for the same Meta lead
  // and both insert — duplicate CRM rows, doubled broker assignment, doubled
  // alerts. A partial unique index makes the second insert fail instead (caught
  // below, counted as "already there"), which is the real fix. Best-effort and
  // once per instance: dedupe any rows an earlier race already created, then
  // build the index (it would refuse to build over existing duplicates).
  await ensureMetaLeadUnique()

  let synced = 0
  let skipped = 0
  for (const lead of leads) {
    const contact = extractContact(lead)
    if (!contact.phone && !contact.email) {
      skipped += 1
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
         id, name, phone, email, source, status, meta_lead_id, meta_form_id, utm_id,
         meta_ad_id, meta_adset_id, meta_form_name, meta_ad_name, created_at, updated_at
       )
       SELECT $1, $2, $3, NULLIF($4, ''), $5, 'new', $6, $7, NULLIF($9, ''),
              NULLIF($10, ''), NULLIF($11, ''), NULLIF($12, ''), NULLIF($13, ''),
              COALESCE($8::timestamptz, now()), now()
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
        lead.ad_id || '',
        lead.adset_id || '',
        formName || '',
        (lead.ad_id ? adNames.get(lead.ad_id) : '') || '',
      ],
    ).catch((error) => {
      console.error('[meta-leads] CRM sync insert failed', error)
      return [] as { id: string }[]
    })
    // Self-healing backfill: leads synced before the ad-id columns existed sit
    // in the CRM with no ad attribution. Every sweep quietly repairs them from
    // Meta's payload, so the per-ad analysis converges to complete on its own.
    if (!inserted.length && lead.ad_id) {
      await query(
        `UPDATE freehold_site_leads
            SET meta_ad_id = $2, meta_adset_id = NULLIF($3, ''), utm_id = COALESCE(utm_id, NULLIF($4, ''))
          WHERE meta_lead_id = $1 AND meta_ad_id IS NULL`,
        [lead.id, lead.ad_id, lead.adset_id || '', lead.campaign_id || ''],
      ).catch((error) => console.error('[meta-leads] ad-id backfill failed', error))
    }

    // The same self-healing sweep for the names. Every lead already in the CRM
    // predates these columns, so without this the fix would only apply to leads
    // that have not arrived yet — and the ones somebody is looking at today
    // would keep showing a number forever. COALESCE, so a name is filled once
    // and never overwritten by a later blank.
    if (!inserted.length) {
      const adName = (lead.ad_id ? adNames.get(lead.ad_id) : '') || ''
      if (formName || adName) {
        await query(
          `UPDATE freehold_site_leads
              SET meta_form_name = COALESCE(meta_form_name, NULLIF($2, '')),
                  meta_ad_name   = COALESCE(meta_ad_name,   NULLIF($3, ''))
            WHERE meta_lead_id = $1
              AND (meta_form_name IS NULL OR meta_ad_name IS NULL)`,
          [lead.id, formName || '', adName],
        ).catch((error) => console.error('[meta-leads] name backfill failed', error))
      }
    }
    if (inserted.length) {
      synced += 1
      // CATCH THE REGISTRATION EVENT. Freeze the ad set's targeting and the
      // ad's copy as they stand right now, against this lead. Awaited rather
      // than fired-and-forgotten because this is a background sync that owes
      // nobody a response, and losing the snapshot loses the only chance to
      // record what this person actually arrived through — the ad set can be
      // edited an hour from now. Instant-form leads carry no placement: there
      // is no landing URL for Meta's {{placement}} macro to ride on.
      await captureForLead({
        leadId: inserted[0].id,
        campaignId: lead.campaign_id || null,
        adsetId: lead.adset_id || null,
        adId: lead.ad_id || null,
      }).catch(() => false)
      await handleNewLead(inserted[0].id).catch((error) => {
        console.error('[meta-leads] automation handoff failed', error)
      })
      // TELL SOMEBODY. A lead arriving from the website triggers an internal
      // email and a WhatsApp alert (see app/api/leads). A lead arriving from a
      // Meta ad — the channel this company actually spends money on — landed in
      // the table and notified nobody. Same lead, same urgency, same team; only
      // the door differed. The alerting was fully built and simply never
      // reached from this path.
      //
      // Fire-and-forget: an alert failure must never cost us the lead we have
      // already stored, and never break the rest of the sweep.
      void alertTeamOfLead({
        name: contact.name || 'Meta lead',
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        source: `meta_form:${formId}`,
      })
    }
  }
  return { synced, skipped }
}


/**
 * Internal notification for a newly synced lead: the same email + WhatsApp
 * alert the website intake sends, on the same recipient configuration.
 *
 * Deliberately INTERNAL only. The website path also emails an acknowledgement
 * to the lead themselves; that is not replicated here, because messaging a
 * consumer is a business decision with its own consent and tone considerations
 * and should be turned on knowingly rather than inherited by a code change.
 */
async function alertTeamOfLead(lead: {
  name: string
  email: string | null
  phone: string | null
  source: string
}): Promise<void> {
  try {
    const recipients = await getLeadershipLeadRecipients()
    const tasks: Promise<unknown>[] = []
    if (recipients.emails.length) {
      tasks.push(
        sendInternalLeadAlertEmail({
          to: recipients.emails,
          subject: 'New lead from a Meta ad',
          headline: 'New lead from a Meta ad',
          lead: { ...lead, projectSlug: null, message: null },
          projects: [],
        }).catch((e) => console.error('[meta-leads] internal email failed', e)),
      )
    }
    if (recipients.whatsappTargets.length) {
      tasks.push(
        sendLeadWhatsAppAlert({
          recipients: recipients.recipients.map((r) => ({
            name: r.name, email: r.email, phone: r.phone, orgTitle: r.orgTitle,
          })),
          lead: { ...lead, projectSlug: null, message: null },
          projects: [],
        }).catch((e) => console.error('[meta-leads] whatsapp alert failed', e)),
      )
    }
    await Promise.allSettled(tasks)
  } catch (e) {
    console.error('[meta-leads] lead alert failed', e)
  }
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
  /** Forms actually processed this pass (may be < totalForms if the budget cut it short). */
  formsChecked: number
  /** Every form the sweep knows about. */
  totalForms: number
  /** True when the wall-clock budget stopped the sweep; the next run resumes
   *  from the updated watermarks, so nothing is lost — only deferred. */
  stoppedEarly: boolean
  totalSynced: number
  /** Leads Meta returned that had neither a phone nor an email. */
  totalSkipped: number
  /** Forms whose lead fetch FAILED — the count that matters most, because a
   *  sweep where every form errors reports "0 synced" and reads as success. */
  formsFailed: number
  perForm: Array<{ formId: string; formName: string; synced: number; skipped: number; error?: string }>
}> {
  // Merged source (paginated Meta list + locally-registered draft forms) so
  // the sweep covers every form we know about, not just Meta's first page.
  // Registry entries confirmed deleted on Meta have no leads edge to poll.
  const forms = (await listLeadFormsMerged()).filter((f) => f.status !== 'DELETED')
  // Each form's leads are read with ITS OWN Page's access token. Meta rejects
  // /{form}/leads for the generic connected token far more often than it
  // rejects the owning Page's token, and forms now come from every accessible
  // Page rather than only the configured one. A form with no page_id (locally
  // registered drafts) falls back to the connected token, as before.
  const pageTokens = new Map((await listAccessiblePages().catch(() => [])).map((p) => [p.id, p.token]))

  // ── Incremental sweep ───────────────────────────────────────────────────
  // This used to re-read EVERY form's entire lead history on every pass: with
  // a real account that is ~300 Graph calls, ~11s of CPU, and a run that
  // exceeded its 60s ceiling — production observability showed Timeout 100%,
  // i.e. the cron NEVER completed and no lead ever synced automatically. That
  // is the "leads arrive in the form but need a manual sync" report.
  //
  // The watermark is derived from data we already store (no new schema): the
  // newest created_at we hold per meta_form_id. A 10-minute overlap absorbs
  // clock skew and late arrivals; re-fetching is harmless because the insert
  // is deduped on meta_lead_id.
  const OVERLAP_MS = 10 * 60 * 1000
  const watermarks = new Map<string, number>()
  try {
    const rows = await query<{ meta_form_id: string; newest: string | null }>(
      `SELECT meta_form_id, MAX(created_at)::text AS newest
         FROM freehold_site_leads
        WHERE meta_form_id IS NOT NULL
        GROUP BY meta_form_id`,
    )
    for (const r of rows) {
      const t = r.newest ? Date.parse(r.newest) : NaN
      if (Number.isFinite(t)) watermarks.set(r.meta_form_id, Math.floor((t - OVERLAP_MS) / 1000))
    }
  } catch { /* no watermarks — fall back to a full read, as before */ }

  // Hard wall-clock budget. Finishing PART of the sweep and saying so beats
  // being killed mid-flight and recording nothing.
  const startedAt = Date.now()
  const BUDGET_MS = 45_000
  let stoppedEarly = false

  const perForm: Array<{ formId: string; formName: string; synced: number; skipped: number; error?: string }> = []
  let totalSynced = 0
  let totalSkipped = 0
  let formsFailed = 0
  let formsProcessed = 0
  for (const form of forms) {
    if (Date.now() - startedAt > BUDGET_MS) { stoppedEarly = true; break }
    formsProcessed += 1
    try {
      const leads = await getFormLeads(
        form.id,
        form.page_id ? pageTokens.get(form.page_id) : undefined,
        watermarks.get(form.id),
      )
      const { synced, skipped } = await syncLeadsToCrm(form.id, leads, form.name)
      perForm.push({ formId: form.id, formName: form.name, synced, skipped })
      totalSynced += synced
      totalSkipped += skipped
    } catch (error) {
      formsFailed += 1
      perForm.push({
        formId: form.id,
        formName: form.name,
        synced: 0,
        skipped: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  return {
    formsChecked: formsProcessed,
    totalForms: forms.length,
    totalSynced,
    totalSkipped,
    formsFailed,
    // True when the budget cut the sweep short — the next run resumes from the
    // updated watermarks, so progress is never lost, only deferred.
    stoppedEarly,
    perForm,
  }
}
