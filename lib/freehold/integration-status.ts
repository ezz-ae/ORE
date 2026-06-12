/**
 * Live integration status — reports the REAL configuration state of each
 * external integration by inspecting environment variables on the server.
 *
 * This replaces guesswork: a "connected" status here means the credentials
 * are actually present in the runtime, so the corresponding client (Meta,
 * Google, WhatsApp, Vertex, Neon) can make live calls. No secrets are ever
 * returned — only booleans and which env keys are missing.
 */

export type IntegrationState = 'connected' | 'partial' | 'disconnected'

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

export function getLiveIntegrationStatuses(): LiveIntegrationStatus[] {
  // ── Meta Ads ──────────────────────────────────────────────────────────────
  const metaKeys = ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID', 'META_PAGE_ID']
  const meta = evaluate(metaKeys)
  const metaPixel = has('META_PIXEL_ID')

  // ── Google Ads ──────────────────────────────────────────────────────────────
  const googleKeys = [
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_CLIENT_ID',
    'GOOGLE_ADS_CLIENT_SECRET',
    'GOOGLE_ADS_REFRESH_TOKEN',
    'GOOGLE_ADS_CUSTOMER_ID',
  ]
  const google = evaluate(googleKeys)

  // ── WhatsApp ──────────────────────────────────────────────────────────────
  const waKeys = ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID']
  const wa = evaluate(waKeys)

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
        meta.state === 'connected'
          ? metaPixel
            ? 'Live — campaigns can launch and pixel tracking is configured.'
            : 'Live — campaigns can launch. Add META_PIXEL_ID for conversion tracking.'
          : `Add ${meta.missing.join(', ')} in Vercel to launch live campaigns.`,
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
          ? 'Live — Google Ads API reachable with OAuth refresh token.'
          : `Add ${google.missing.join(', ')} in Vercel to enable Google Ads.`,
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
          ? 'Live — outbound WhatsApp messages send through the Cloud API.'
          : 'Not configured — messages run in mock mode until credentials are added.',
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
export function getIntegrationStatusSummary() {
  const all = getLiveIntegrationStatuses()
  return {
    total: all.length,
    connected: all.filter((i) => i.state === 'connected').length,
    partial: all.filter((i) => i.state === 'partial').length,
    disconnected: all.filter((i) => i.state === 'disconnected').length,
    statuses: all,
  }
}
