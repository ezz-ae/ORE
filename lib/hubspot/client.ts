/**
 * HubSpot CRM client (private-app token).
 *
 * Auth: a HubSpot private-app token (scopes crm.objects.contacts.read + write).
 * No OAuth/app-review needed — ideal for syncing a single company's own HubSpot.
 * Resolved env-first (`HUBSPOT_TOKEN`) then the in-app connection stored in
 * `freehold_site_integration_credentials` (provider = 'hubspot'), so connecting
 * HubSpot in the UI actually powers server-side sync.
 *
 * Fail-soft: when no token is present every call throws HubspotConfigError so
 * callers can degrade gracefully (the CRM keeps working on its own DB).
 */
import { getStoredCreds } from '@/lib/freehold/integration-credentials'

const BASE = 'https://api.hubapi.com'

export interface HubspotStoredCreds { token: string }

export class HubspotConfigError extends Error {
  constructor() {
    super('HubSpot not connected')
    this.name = 'HubspotConfigError'
  }
}
export class HubspotApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'HubspotApiError'
    this.status = status
  }
}

/** Env-only check (synchronous). Prefer hubspotConfiguredAsync for full state. */
export function hubspotConfigured(): boolean {
  return !!process.env.HUBSPOT_TOKEN
}

/** True when HubSpot is usable via env OR an in-app connection. */
export async function hubspotConfiguredAsync(): Promise<boolean> {
  if (process.env.HUBSPOT_TOKEN) return true
  const stored = await getStoredCreds<HubspotStoredCreds>('hubspot')
  return !!stored?.token
}

/** Resolve the active token: env wins, then the stored in-app connection. */
async function token(): Promise<string> {
  const envToken = process.env.HUBSPOT_TOKEN
  if (envToken) return envToken
  const stored = await getStoredCreds<HubspotStoredCreds>('hubspot')
  if (stored?.token) return stored.token
  throw new HubspotConfigError()
}

async function hs<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await token()}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => `HTTP ${res.status}`)
    throw new HubspotApiError(detail.slice(0, 300), res.status)
  }
  return res.json() as Promise<T>
}

export interface CrmLeadInput {
  name?: string | null
  email?: string | null
  phone?: string | null
  source?: string | null
  message?: string | null
}

function splitName(name?: string | null): { firstname: string; lastname: string } {
  const parts = (name || '').trim().split(/\s+/)
  return { firstname: parts[0] || '', lastname: parts.slice(1).join(' ') }
}

/**
 * Upsert a CRM lead into HubSpot as a contact, keyed by email. Leads without an
 * email are skipped (HubSpot requires a unique id property). Returns the
 * HubSpot contact id, or null when skipped.
 */
export async function upsertContact(lead: CrmLeadInput): Promise<string | null> {
  const email = (lead.email || '').trim().toLowerCase()
  if (!email) return null
  const { firstname, lastname } = splitName(lead.name)
  const properties: Record<string, string> = { email }
  if (firstname) properties.firstname = firstname
  if (lastname) properties.lastname = lastname
  if (lead.phone) properties.phone = lead.phone
  if (lead.source) properties.hs_lead_status = 'NEW'

  // Search for an existing contact by email, then PATCH or POST.
  const found = await hs<{ results: Array<{ id: string }> }>(
    '/crm/v3/objects/contacts/search',
    {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
        properties: ['email'],
        limit: 1,
      }),
    },
  )
  const existing = found.results?.[0]?.id
  if (existing) {
    await hs(`/crm/v3/objects/contacts/${existing}`, { method: 'PATCH', body: JSON.stringify({ properties }) })
    return existing
  }
  const created = await hs<{ id: string }>('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({ properties }),
  })
  return created.id
}

export interface HubspotContact {
  id: string
  email: string
  name: string
  phone: string
  createdAt: string
}

/**
 * Pull HubSpot contacts newest-first, following the search cursor until
 * `limit` contacts are fetched or HubSpot reports no next page — the old
 * single-page version silently capped every "sync" at 100 contacts.
 */
export async function listRecentContacts(limit = 1000): Promise<HubspotContact[]> {
  const out: HubspotContact[] = []
  let after: string | undefined
  while (out.length < limit) {
    const data = await hs<{
      results: Array<{ id: string; properties: Record<string, string>; createdAt: string }>
      paging?: { next?: { after?: string } }
    }>(
      '/crm/v3/objects/contacts/search',
      {
        method: 'POST',
        body: JSON.stringify({
          sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
          properties: ['email', 'firstname', 'lastname', 'phone'],
          limit: Math.min(limit - out.length, 100),
          ...(after ? { after } : {}),
        }),
      },
    )
    const batch = data.results || []
    for (const r of batch) {
      out.push({
        id: r.id,
        email: (r.properties.email || '').toLowerCase(),
        name: [r.properties.firstname, r.properties.lastname].filter(Boolean).join(' ').trim(),
        phone: r.properties.phone || '',
        createdAt: r.createdAt,
      })
    }
    after = data.paging?.next?.after
    if (!after || batch.length === 0) break
  }
  return out
}
