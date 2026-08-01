/**
 * Live integration status — reports the REAL configuration state of each
 * external integration by inspecting environment variables on the server.
 *
 * A "connected" status means the credentials are PRESENT in the runtime. That
 * is not the same as working, and the difference was actively misleading: a
 * Meta token can be stored and well-formed while the ad account has never
 * granted it permission, so this page showed green while every campaign read
 * failed. Pass { probe: true } to make one real call per integration that
 * supports it and report 'error' with the platform's own reason instead.
 *
 * Probing is opt-in because /api/health, the agent summary and the MCP tools
 * all call this on hot paths where an extra round-trip per integration is not
 * worth it — they only need to know whether anything is configured at all.
 *
 * No secrets are ever returned — only booleans and which env keys are missing.
 */

import { getStoredMetaCreds, getStoredCreds, type WhatsAppStoredCreds } from '@/lib/freehold/integration-credentials'
import { probeAdAccountAccess } from '@/lib/meta/client'
import type { GoogleStoredCreds } from '@/lib/google/client'
import type { HubspotStoredCreds } from '@/lib/hubspot/client'

export type IntegrationState =
  | 'connected'
  | 'partial'
  | 'disconnected'
  /** Credentials are present, but the platform rejected them when asked. Only
   *  reachable when probing is enabled — presence alone can never prove this. */
  | 'error'

export interface LiveIntegrationStatus {
  id: string
  name: string
  category: 'ads' | 'messaging' | 'ai' | 'data' | 'crm'
  state: IntegrationState
  /** Env keys this integration depends on (names only — never values). */
  requiredKeys: string[]
  /** Subset of requiredKeys that are currently missing. */
  missingKeys: string[]
  /** Human-readable note about what's working / what's needed. */
  note: string
}

const has = (key: string): boolean => {
  const v = process.env[key]
  return typeof v === 'string' && v.trim().length > 0
}

const hasAny = (...keys: string[]): boolean => keys.some(has)

function evaluate(
  required: string[],
  opts: { partialOk?: boolean } = {},
): { state: IntegrationState; missing: string[] } {
  const missing = required.filter((k) => !has(k))
  if (missing.length === 0) return { state: 'connected', missing }
  if (opts.partialOk && missing.length < required.length) {
    return { state: 'partial', missing }
  }
  return { state: 'disconnected', missing }
}

export async function getLiveIntegrationStatuses(
  opts: { probe?: boolean } = {},
): Promise<LiveIntegrationStatus[]> {
  // ── Meta Ads ──────────────────────────────────────────────────────────────
  const metaKeys = ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_PAGE_ID']
  let meta = evaluate(metaKeys)
  const metaPixel = has('META_PIXEL_ID')
  // A connection saved through Integrations → Meta Ads (stored server-side)
  // counts as connected even when env vars are unset.
  let metaSource: 'env' | 'db' | null = meta.state === 'connected' ? 'env' : null
  if (meta.state !== 'connected') {
    const stored = await getStoredMetaCreds().catch(() => null)
    if (stored?.accessToken && stored?.adAccountId && stored?.pageId) {
      meta = { state: 'connected', missing: [] }
      metaSource = 'db'
    }
  }

  // Presence proved nothing about capability. When asked to, make ONE real
  // read against the configured ad account: a token can be stored, valid in
  // shape, and still rejected because the account never granted it access.
  // That state showed green here while the campaigns page showed nothing.
  let metaProbeError: string | null = null
  if (opts.probe && meta.state === 'connected') {
    const probe = await probeAdAccountAccess().catch(() => ({ ok: false, message: 'Meta could not be reached' }))
    if (!probe.ok) {
      metaProbeError = probe.message ?? 'Meta rejected the connected credentials.'
      meta = { state: 'error', missing: [] }
    }
  }

  // ── Google Ads ──────────────────────────────────────────────────────────────
  const googleKeys = [
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'GOOGLE_ADS_CUSTOMER_ID',
  ]
  let google = evaluate(googleKeys)
  // A connection saved through Integrations → Google Ads counts as connected.
  let googleSource: 'env' | 'db' | null = google.state === 'connected' ? 'env' : null
  if (google.state !== 'connected') {
    const stored = await getStoredCreds<GoogleStoredCreds>('google').catch(() => null)
    if (stored?.developerToken && stored.clientId && stored.clientSecret && stored.refreshToken && stored.customerId) {
      google = { state: 'connected', missing: [] }
      googleSource = 'db'
    }
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  const waKeys = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID']
  let wa = evaluate(waKeys)
  let waSource: 'env' | 'db' | null = wa.state === 'connected' ? 'env' : null
  if (wa.state !== 'connected') {
    const stored = await getStoredCreds<WhatsAppStoredCreds>('whatsapp').catch(() => null)
    if (stored?.accessToken && stored?.phoneNumberId) { wa = { state: 'connected', missing: [] }; waSource = 'db' }
  }

  // ── HubSpot CRM (private-app token) ─────────────────────────────────────────
  const hubKeys = ['HUBSPOT_TOKEN']
  let hub = evaluate(hubKeys)
  // A token saved through Integrations → HubSpot counts as connected, matching
  // Meta/Google/WhatsApp — otherwise the Overview would report "not connected"
  // while the HubSpot page and sync are genuinely working.
  let hubSource: 'env' | 'db' | null = hub.state === 'connected' ? 'env' : null
  if (hub.state !== 'connected') {
    const stored = await getStoredCreds<HubspotStoredCreds>('hubspot').catch(() => null)
    if (stored?.token) { hub = { state: 'connected', missing: [] }; hubSource = 'db' }
  }

  // ── AI (Gemini API or Vertex service account) ──────────────────────────────
  const geminiOk = hasAny('GEMINI_API_KEY', 'Gemini_API_KEY', 'google_api_key')
  const vertexOk = has('VERTEX_AI_SERVICE_ACCOUNT_JSON')
  const aiState: IntegrationState =
    geminiOk && vertexOk ? 'connected' : geminiOk || vertexOk ? 'partial' : 'disconnected'
  const aiMissing = [
    ...(geminiOk ? [] : ['GEMINI_API_KEY']),
    ...(vertexOk ? [] : ['VERTEX_AI_SERVICE_ACCOUNT_JSON']),
  ]

  // ── Neon DB ──────────────────────────────────────────────────────────────
  const db = evaluate(['NEON_DATABASE_URL'])
  const dbAlt = hasAny('NEON_DATABASE_URL', 'DATABASE_URL')

  // ── Session secret ──────────────────────────────────────────────────────────
  const sessionOk = has('FH_SESSION_SECRET')

  return [
    {
      id: 'meta-ads',
      name: 'Meta Ads',
      category: 'ads',
      state: meta.state,
      requiredKeys: metaKeys,
      missingKeys: meta.missing,
      note:
        meta.state === 'error'
          ? `The credentials are saved, but Meta refuses them. ${metaProbeError ?? ''}`.trim()
          : meta.state === 'connected'
          ? (metaSource === 'db' ? 'Live (connected in-app) — campaigns can launch. ' : 'Live — campaigns can launch. ') +
            (metaPixel ? 'Pixel tracking is configured.' : 'Add META_PIXEL_ID for conversion tracking.')
          : `Add ${meta.missing.join(', ')} in Vercel, or connect in Integrations → Meta Ads, to launch live campaigns.`,
    },
    {
      id: 'google-ads',
      name: 'Google Ads',
      category: 'ads',
      state: google.state,
      requiredKeys: googleKeys,
      missingKeys: google.missing,
      note:
        google.state === 'connected'
          ? (googleSource === 'db' ? 'Live (connected in-app) — ' : 'Live — ') + 'Google Ads API reachable with OAuth refresh token.'
          : `Add ${google.missing.join(', ')} in Vercel, or connect in Integrations → Google Ads, to enable Google Ads.`,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      category: 'messaging',
      state: wa.state,
      requiredKeys: waKeys,
      missingKeys: wa.missing,
      note:
        wa.state === 'connected'
          ? (waSource === 'db' ? 'Live (connected in-app) — ' : 'Live — ') + 'outbound WhatsApp messages send through the Cloud API.'
          : 'Not configured — connect in Integrations → WhatsApp or set env keys; messages run in mock mode until then.',
    },
    {
      id: 'hubspot',
      name: 'HubSpot CRM',
      category: 'crm',
      state: hub.state,
      requiredKeys: hubKeys,
      missingKeys: hub.missing,
      note:
        hub.state === 'connected'
          ? (hubSource === 'db' ? 'Live (connected in-app) — ' : 'Live — ') + 'two-way contact↔lead sync available via the private-app token.'
          : 'Add HUBSPOT_TOKEN (a HubSpot private-app token) in Vercel, or connect in Integrations → HubSpot, to sync contacts and leads.',
    },
    {
      id: 'ai',
      name: 'AI (Gemini / Vertex)',
      category: 'ai',
      state: aiState,
      requiredKeys: ['GEMINI_API_KEY', 'VERTEX_AI_SERVICE_ACCOUNT_JSON'],
      missingKeys: aiMissing,
      note:
        aiState === 'connected'
          ? 'Live — Gemini API and Vertex service account both configured.'
          : aiState === 'partial'
            ? geminiOk
              ? 'Live via Gemini API. Add VERTEX_AI_SERVICE_ACCOUNT_JSON for Vertex models.'
              : 'Live via Vertex. Add GEMINI_API_KEY for direct Gemini access.'
            : 'No AI provider configured — chat will not generate responses.',
    },
    {
      id: 'neon',
      name: 'Neon PostgreSQL',
      category: 'data',
      state: dbAlt ? 'connected' : 'disconnected',
      requiredKeys: ['NEON_DATABASE_URL'],
      missingKeys: db.missing,
      note: dbAlt
        ? 'Live — application database connected (3,500+ projects + CRM).'
        : 'Critical — no database URL. App falls back to mock data.',
    },
    {
      id: 'session',
      name: 'Session Security',
      category: 'data',
      state: sessionOk ? 'connected' : 'partial',
      requiredKeys: ['FH_SESSION_SECRET'],
      missingKeys: sessionOk ? [] : ['FH_SESSION_SECRET'],
      note: sessionOk
        ? 'Live — sessions signed with a configured secret.'
        : 'Using an insecure dev fallback secret. Set FH_SESSION_SECRET before production.',
    },
  ]
}

/** Compact summary for dashboards: counts by state. */
export async function getIntegrationStatusSummary(opts: { probe?: boolean } = {}) {
  const all = await getLiveIntegrationStatuses(opts)
  return {
    total: all.length,
    connected: all.filter((i) => i.state === 'connected').length,
    partial: all.filter((i) => i.state === 'partial').length,
    disconnected: all.filter((i) => i.state === 'disconnected').length,
    /** Credentials saved but rejected by the platform — only ever non-zero
     *  when probing; that is the whole point of probing. */
    error: all.filter((i) => i.state === 'error').length,
    statuses: all,
  }
}
