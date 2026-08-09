import { query } from '@/lib/db'
import { createCustomAudience, addHashedBuyers } from '@/lib/meta/client'
import { getStoredCreds, setStoredCreds } from '@/lib/freehold/integration-credentials'

/**
 * THE PEOPLE WE ARE ALREADY TALKING TO.
 *
 * Every dirham spent advertising a property to someone already in the pipeline
 * — already called, already qualified, already sold to — buys nothing. They
 * are not a new lead. If they fill the form again they are a duplicate, which
 * the CRM will spend more effort de-duplicating.
 *
 * The system could not do anything about it. `exclusions` in a targeting spec
 * takes interests and behaviours only; Meta keeps audience exclusion in its
 * own field, and that field appeared nowhere in this codebase. The targeting
 * advisor has meanwhile been recommending "exclude your existing CRM leads" in
 * plain English — advice with no mechanism behind it.
 *
 * This builds the mechanism: one Meta custom audience holding the hashed
 * contacts of everyone already in the CRM, refreshed on demand, excluded from
 * a campaign by one switch.
 *
 * NOTHING READABLE LEAVES. Emails and phones are SHA-256 hashed by the same
 * code that hashes a lookalike seed (addHashedBuyers) before anything is sent.
 * Meta matches on equality; it has no need of the plain values.
 */

/** Where the audience id is remembered between runs. */
const PROVIDER = 'meta_crm_exclusion'

interface StoredExclusion { audienceId: string; refreshedAt: string; size: number }

/**
 * Leads worth excluding.
 *
 * Everyone the CRM holds who is not archived — a lead that was never called is
 * still a lead we already have, and paying to acquire it twice is the waste
 * this exists to stop. Blocked leads are excluded from advertising for a
 * different and more obvious reason, and they are in here too.
 */
async function crmContacts(): Promise<Array<{ email?: string | null; phone?: string | null }>> {
  const rows = await query<{ email: string | null; phone: string | null }>(
    `SELECT email, phone FROM freehold_site_leads
      WHERE archived IS NOT TRUE AND (email IS NOT NULL OR phone IS NOT NULL)`,
  )
  return rows
}

/**
 * Create or refresh the "already in your CRM" audience, and return its id.
 *
 * Meta custom audiences are additive: uploading again adds the new people and
 * leaves the existing ones, so a refresh is an append rather than a rebuild.
 * That is the right shape here — somebody who entered the CRM last month
 * should stay excluded whether or not they appear in today's query.
 *
 * Returns null when Meta is not connected or the CRM has nobody to exclude.
 * Null means "no exclusion", never a silent partial one.
 */
export async function syncCrmExclusionAudience(): Promise<{ audienceId: string; uploaded: number } | null> {
  const contacts = await crmContacts().catch(() => [])
  if (contacts.length === 0) return null

  const stored = await getStoredCreds<StoredExclusion>(PROVIDER).catch(() => null)
  let audienceId = stored?.audienceId ?? ''

  if (!audienceId) {
    const made = await createCustomAudience(
      'Already in your CRM',
      'People this company is already talking to — excluded from new-buyer campaigns so the same person is not paid for twice.',
    )
    audienceId = made.id
  }

  const uploaded = await addHashedBuyers(audienceId, contacts)
  await setStoredCreds(
    PROVIDER,
    { audienceId, refreshedAt: new Date().toISOString(), size: uploaded },
    'system',
  ).catch(() => undefined)
  return { audienceId, uploaded }
}

/**
 * The id to exclude, if one has ever been built. Read-only and cheap — the
 * launch path must not upload a contact list while somebody waits.
 */
export async function crmExclusionAudienceId(): Promise<string | null> {
  const stored = await getStoredCreds<StoredExclusion>(PROVIDER).catch(() => null)
  return stored?.audienceId || null
}
