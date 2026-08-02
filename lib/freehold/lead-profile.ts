import { randomUUID } from 'node:crypto'
import { query } from '@/lib/db'
import { ensureLeadsTable, ensureLeadActivityTable } from '@/lib/data'
import { geminiGenerate, geminiText } from '@/lib/gemini-rest'

/**
 * Smart profile completion — a research agent per lead.
 *
 * Given what a lead submitted (name, email, phone, interest), a grounded
 * Gemini call (google_search tool — the deep-search pattern, on the same
 * Gemini stack the expert chat uses) looks the person up on the public web
 * and returns ONLY what it actually found. The profile is dynamic: a fact
 * that was not found does not exist as a cell. One lead can have a workplace
 * cell while the next has none — because we don't have it, and this platform
 * never pretends to.
 *
 * Honesty is enforced mechanically, not by prompt alone:
 *  - a reply with NO groundingMetadata means no search actually ran → every
 *    claimed fact is discarded (that is the fabrication tripwire);
 *  - facts must carry evidence + a source URL, junk values are dropped;
 *  - nationality/family facts are kept only with an explicit source — never
 *    inferred from a name.
 */

// Fixed key catalog so the UI can label and translate cells. 'other' is the
// escape hatch and renders with the agent's own label.
export const PROFILE_FACT_KEYS = [
  'workplace',
  'job_title',
  'company_industry',
  'linkedin',
  'social_profile',
  'location_city',
  'nationality',
  'education',
  'business_interests',
  'family',
  'marital_status',
  'age_range',
  'other',
] as const
export type ProfileFactKey = (typeof PROFILE_FACT_KEYS)[number]

export interface ProfileFact {
  id: string
  leadId: string
  factKey: string
  /** Free label for 'other' facts; empty for catalog keys. */
  factLabel: string | null
  factValue: string
  evidence: string | null
  sourceUrl: string | null
  confidence: 'high' | 'medium' | 'low'
  updatedAt: string
}

let tableEnsured: Promise<void> | null = null
function ensureProfileTable(): Promise<void> {
  if (!tableEnsured) {
    tableEnsured = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS freehold_lead_profile_facts (
          id text PRIMARY KEY,
          lead_id text NOT NULL,
          fact_key text NOT NULL,
          -- '' (not NULL) for catalog keys: a NULL here would make the UNIQUE
          -- constraint useless (NULLs never conflict) and every re-enrichment
          -- would duplicate the whole profile.
          fact_label text NOT NULL DEFAULT '',
          fact_value text NOT NULL,
          evidence text,
          source_url text,
          confidence text NOT NULL DEFAULT 'low',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now(),
          UNIQUE (lead_id, fact_key, fact_label)
        )
      `)
    })().catch((e) => { tableEnsured = null; throw e })
  }
  return tableEnsured
}

function mapRow(r: Record<string, unknown>): ProfileFact {
  const conf = r.confidence === 'high' || r.confidence === 'medium' ? r.confidence : 'low'
  return {
    id: String(r.id),
    leadId: String(r.lead_id),
    factKey: String(r.fact_key),
    factLabel: r.fact_label ? String(r.fact_label) : null,
    factValue: String(r.fact_value),
    evidence: r.evidence ? String(r.evidence) : null,
    sourceUrl: r.source_url ? String(r.source_url) : null,
    confidence: conf as ProfileFact['confidence'],
    updatedAt: String(r.updated_at ?? ''),
  }
}

export async function listProfileFacts(leadId: string): Promise<ProfileFact[]> {
  await ensureProfileTable()
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM freehold_lead_profile_facts WHERE lead_id = $1 ORDER BY fact_key`,
    [leadId],
  )
  return rows.map(mapRow)
}

// Values that mean "the agent found nothing" dressed up as a value.
const JUNK_VALUE = /^(unknown|not\s+found|n\/?a|none|no\s+information|unavailable|unclear|-|—|null|undefined)\.?$/i

interface RawFact {
  key?: unknown
  label?: unknown
  value?: unknown
  evidence?: unknown
  source_url?: unknown
  confidence?: unknown
}

/** Parse the agent's JSON (fenced or bare) into candidate facts. */
function parseFacts(text: string): RawFact[] {
  const stripped = text.replace(/```(?:json)?/gi, '').trim()
  const start = stripped.indexOf('[')
  const end = stripped.lastIndexOf(']')
  if (start === -1 || end <= start) return []
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1))
    return Array.isArray(parsed) ? (parsed as RawFact[]) : []
  } catch {
    return []
  }
}

export interface EnrichmentResult {
  ok: boolean
  /** Facts now on the profile (all of them, not just new ones). */
  facts: ProfileFact[]
  found: number
  /** Honest note when the run produced nothing usable. */
  note: string | null
}

export async function enrichLeadProfile(leadId: string, byEmail: string): Promise<EnrichmentResult> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return { ok: false, facts: await listProfileFacts(leadId).catch(() => []), found: 0, note: 'GEMINI_API_KEY is not configured — the research agent cannot run.' }
  }

  await ensureLeadsTable()
  const [lead] = await query<{ name: string | null; phone: string | null; email: string | null; interest: string | null; country: string | null; source: string | null }>(
    `SELECT name, phone, email, interest, country, source FROM freehold_site_leads WHERE id = $1`,
    [leadId],
  )
  if (!lead) return { ok: false, facts: [], found: 0, note: 'Lead not found.' }

  const emailDomain = (lead.email || '').split('@')[1] || ''
  const identity = [
    lead.name ? `Name: ${lead.name}` : null,
    lead.email ? `Email: ${lead.email}` : null,
    emailDomain && !/gmail|hotmail|outlook|yahoo|icloud|proton/i.test(emailDomain) ? `Email domain (possibly their employer): ${emailDomain}` : null,
    lead.phone ? `Phone: ${lead.phone}` : null,
    lead.country ? `Country: ${lead.country}` : null,
    lead.interest ? `Property interest: ${lead.interest}` : null,
  ].filter(Boolean).join('\n')

  const prompt = `You are a lead-research agent for a Dubai real-estate brokerage. Research this person on the public web using search, and report ONLY facts you actually found in the search results.

${identity}

Search BOTH sides of their life:
1. Professional — employer, role, industry, education, business interests.
2. Personal & social — their public profiles (LinkedIn, Instagram, Facebook, X: put the profile URL as the value of a "linkedin"/"social_profile" fact), marital status (married/unmarried), family, where they live. A salesperson preparing the first call needs the person, not just the job title — search their name with the city, with the employer, with "wedding", "wife", "husband", "family" where appropriate.

Return a JSON array (and nothing else). Each element:
{"key": one of ${JSON.stringify(PROFILE_FACT_KEYS)}, "label": short label ONLY when key is "other", "value": the fact, "evidence": one sentence saying what the source shows, "source_url": the URL it came from, "confidence": "high"|"medium"|"low"}

ABSOLUTE RULES — a single false fact on this profile destroys trust in the whole system:
- A fact with no real source from your search results must NOT be included. No source, no fact.
- NEVER infer nationality, religion, marital status, family, or age from a name or a photo. Those keys require an explicit written source that states it.
- If you cannot confidently match this exact person (common name, no distinguishing link to the email/phone/domain), return [] — an empty profile is correct, a wrong person's profile is a disaster.
- If two candidate people both partially match, include ONLY facts that hold for the one anchored to the given email/phone/employer domain — or return [].
- Do not include facts already given above (name, email, phone).
- Maximum 12 facts. Values under 200 characters.`

  let resp
  try {
    resp = await geminiGenerate(
      apiKey,
      [{ role: 'user', parts: [{ text: prompt }] }],
      { temperature: 0.1, maxOutputTokens: 2048 },
      [{ google_search: {} }],
    )
  } catch (e) {
    console.error('[lead-profile] research call failed', e)
    return { ok: false, facts: await listProfileFacts(leadId).catch(() => []), found: 0, note: 'The research agent could not run. Try again.' }
  }

  const candidate = resp.candidates?.[0]
  const grounded = Boolean(candidate?.groundingMetadata?.groundingChunks?.length || candidate?.groundingMetadata?.webSearchQueries?.length)
  const raw = parseFacts(geminiText(resp))

  // THE TRIPWIRE: facts claimed without a single search having run are
  // fabrications by definition — discard them all and say so.
  if (raw.length > 0 && !grounded) {
    console.error(`[lead-profile] discarded ${raw.length} ungrounded facts for lead ${leadId} — model returned facts without searching`)
    return { ok: true, facts: await listProfileFacts(leadId), found: 0, note: 'The agent returned unverified claims and they were discarded. Nothing was added.' }
  }

  const validKeys = new Set<string>(PROFILE_FACT_KEYS)
  const clean = raw
    .map((f) => ({
      key: typeof f.key === 'string' && validKeys.has(f.key) ? f.key : null,
      label: typeof f.label === 'string' ? f.label.trim().slice(0, 60) : '',
      value: typeof f.value === 'string' ? f.value.trim().slice(0, 200) : '',
      evidence: typeof f.evidence === 'string' ? f.evidence.trim().slice(0, 300) : '',
      sourceUrl: typeof f.source_url === 'string' && /^https?:\/\//i.test(f.source_url) ? f.source_url.trim().slice(0, 500) : '',
      confidence: f.confidence === 'high' || f.confidence === 'medium' ? f.confidence : 'low',
    }))
    .filter((f): f is typeof f & { key: string } => f.key !== null)
    .filter((f) => f.value.length > 0 && !JUNK_VALUE.test(f.value))
    // No source, no fact — the rule the prompt states, enforced in code.
    .filter((f) => f.sourceUrl.length > 0)
    .slice(0, 12)

  await ensureProfileTable()
  for (const f of clean) {
    await query(
      `INSERT INTO freehold_lead_profile_facts (id, lead_id, fact_key, fact_label, fact_value, evidence, source_url, confidence)
       VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), NULLIF($7, ''), $8)
       ON CONFLICT (lead_id, fact_key, fact_label)
       DO UPDATE SET fact_value = EXCLUDED.fact_value, evidence = EXCLUDED.evidence,
                     source_url = EXCLUDED.source_url, confidence = EXCLUDED.confidence, updated_at = now()`,
      [randomUUID(), leadId, f.key, f.key === 'other' ? f.label : '', f.value, f.evidence, f.sourceUrl, f.confidence],
    ).catch((e) => console.error('[lead-profile] fact upsert failed', e))
  }

  await query(`ALTER TABLE freehold_site_leads ADD COLUMN IF NOT EXISTS profile_enriched_at timestamptz`).catch(() => undefined)
  await query(`UPDATE freehold_site_leads SET profile_enriched_at = now() WHERE id = $1`, [leadId]).catch(() => undefined)

  // The timeline records the run either way — a search that found nothing is
  // itself information the next broker should see.
  try {
    await ensureLeadActivityTable()
    await query(
      `INSERT INTO freehold_site_lead_activity (id, lead_id, activity_type, description, created_by)
       VALUES ($1, $2, 'note', $3, $4)`,
      [randomUUID(), leadId, clean.length ? `Smart profile: ${clean.length} verified fact${clean.length === 1 ? '' : 's'} added from public sources` : 'Smart profile: research ran, nothing verifiable found', byEmail],
    )
  } catch (e) {
    console.error('[lead-profile] activity write failed', e)
  }

  return {
    ok: true,
    facts: await listProfileFacts(leadId),
    found: clean.length,
    note: clean.length ? null : 'Research ran but found nothing verifiable for this person. The profile is unchanged — that is the honest answer.',
  }
}
