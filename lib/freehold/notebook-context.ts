import { query } from '@/lib/db'
import { listConversations } from '@/lib/freehold/notebook-conversations'
import { getNetworkBenchmarks } from '@/lib/entrestate/targeting-base'

/**
 * The Notebook's grounding engine. Builds the workspace-sources block the AI
 * answers from — real retrieval over the company's own data, not thin
 * summaries:
 *
 *  - live_projects   → message-aware retrieval on freehold_site_projects,
 *                      including the purpose-built per-project `llm_context`
 *                      RAG text for anything the user actually asked about,
 *                      plus a top-of-market overview.
 *  - crm_leads       → a pipeline the reader can act on: fresh counts, top
 *                      project interests, sources, and the newest leads —
 *                      role-scoped (brokers see their own book only).
 *  - market_intel    → area yields / median PSF / project counts and the
 *                      below-market opportunity list from priceIntelligence.
 *  - campaigns       → campaign truth from OUR lead attribution + stored Meta
 *                      campaigns + cross-tenant targeting benchmarks.
 *  - all_conversations, uploads → the user's own threads and files.
 */

export type NotebookSources = {
  live_projects?: boolean
  crm_leads?: boolean
  uploads?: boolean
  all_conversations?: boolean
  market_intel?: boolean
  campaigns?: boolean
}

export type NotebookUpload = { name: string; content?: string }

export interface NotebookContextOpts {
  /** The user's message — drives project retrieval (llm_context of matches). */
  message?: string
  /** Session role — brokers get their own pipeline, management the team's. */
  role?: string
  brokerId?: string | null
}

const fmtAED = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  const v = Number(n)
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `AED ${Math.round(v / 1_000)}K`
  return `AED ${v}`
}

// ─── Live projects: retrieval + overview ─────────────────────────────────────

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'about', 'what', 'which', 'that', 'this', 'from', 'have', 'best',
  'compare', 'comparison', 'write', 'draft', 'make', 'create', 'give', 'show', 'tell', 'list',
  'project', 'projects', 'property', 'properties', 'dubai', 'lead', 'leads', 'client', 'clients',
  'whatsapp', 'message', 'brochure', 'report', 'copy', 'investor', 'investment', 'yield', 'price',
])

function messageTokens(message: string): string[] {
  return Array.from(
    new Set(
      message
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
    ),
  ).slice(0, 8)
}

async function projectsBlock(message: string): Promise<string | null> {
  try {
    // 1 — retrieval: projects the user actually asked about, served as their
    // purpose-built llm_context (the RAG text maintained by the data agent).
    const tokens = messageTokens(message)
    let focused: string[] = []
    if (tokens.length) {
      const conds = tokens.map((_, i) => `(name ILIKE $${i + 1} OR area ILIKE $${i + 1} OR developer_name ILIKE $${i + 1})`)
      const rows = await query<{ name: string; llm_context: string | null }>(
        `SELECT name, llm_context FROM freehold_site_projects
         WHERE ${conds.join(' OR ')}
         ORDER BY market_score DESC NULLS LAST
         LIMIT 5`,
        tokens.map((tk) => `%${tk}%`),
      )
      focused = rows
        .filter((r) => r.llm_context && r.llm_context.trim())
        .map((r) => r.llm_context!.trim().slice(0, 1400))
    }

    // 2 — market overview: the strongest projects right now, with real numbers.
    const top = await query<{
      name: string; area: string | null; developer_name: string | null; status: string | null
      price_from_aed: number | null; rental_yield: number | null; market_score: number | null
      risk_class: string | null; golden_visa_eligible: boolean | null; handover_date: string | null
    }>(
      `SELECT name, area, developer_name, status, price_from_aed, rental_yield,
              market_score, risk_class, golden_visa_eligible, handover_date
       FROM freehold_site_projects
       WHERE status = 'selling' OR status IS NULL
       ORDER BY market_score DESC NULLS LAST
       LIMIT 12`,
    )
    const total = await query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM freehold_site_projects`)
      .then((r) => Number(r[0]?.n ?? 0)).catch(() => 0)
    if (!top.length && !focused.length) return null

    const lines = top.map((p) => {
      const bits = [
        p.area, p.developer_name,
        `from ${fmtAED(p.price_from_aed)}`,
        p.rental_yield ? `~${p.rental_yield}% yield` : null,
        p.market_score ? `score ${p.market_score}` : null,
        p.risk_class ? `risk ${p.risk_class}` : null,
        p.golden_visa_eligible ? 'Golden Visa' : null,
        p.handover_date ? `handover ${String(p.handover_date).slice(0, 7)}` : null,
      ].filter(Boolean)
      return `- ${p.name} — ${bits.join(' · ')}`
    })

    const parts: string[] = []
    if (focused.length) parts.push(`PROJECTS MATCHING THE QUESTION (full intelligence records):\n${focused.join('\n---\n')}`)
    parts.push(`MARKET OVERVIEW — top selling projects by market score (of ${total.toLocaleString()} in the live inventory):\n${lines.join('\n')}`)
    return parts.join('\n\n')
  } catch {
    return null
  }
}

// ─── CRM pipeline: substance, role-scoped ─────────────────────────────────────

async function leadsBlock(role?: string, brokerId?: string | null): Promise<string | null> {
  try {
    const isBroker = role === 'broker' || role === 'sales_agent'
    const scope = isBroker && brokerId ? `WHERE assigned_broker_id = $1` : ''
    const params = isBroker && brokerId ? [brokerId] : []

    const [statusRows, recentRows, interestRows, sourceRows] = await Promise.all([
      query<{ status: string; n: string }>(
        `SELECT COALESCE(status,'new') AS status, COUNT(*)::text AS n
         FROM freehold_site_leads ${scope} GROUP BY 1 ORDER BY COUNT(*) DESC`, params),
      query<{ name: string; status: string | null; interest: string | null; source: string | null; created_at: string }>(
        `SELECT name, status, COALESCE(NULLIF(interest,''), NULLIF(project_slug,'')) AS interest, source, created_at::text
         FROM freehold_site_leads ${scope} ORDER BY created_at DESC LIMIT 6`, params),
      query<{ interest: string; n: string }>(
        `SELECT COALESCE(NULLIF(project_slug,''), NULLIF(interest,''), 'unspecified') AS interest, COUNT(*)::text AS n
         FROM freehold_site_leads ${scope ? scope + ' AND' : 'WHERE'} created_at > now() - interval '60 days'
         GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 6`, params),
      query<{ source: string; n: string }>(
        `SELECT COALESCE(NULLIF(source,''),'unknown') AS source, COUNT(*)::text AS n
         FROM freehold_site_leads ${scope ? scope + ' AND' : 'WHERE'} created_at > now() - interval '30 days'
         GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 5`, params),
    ])

    const total = statusRows.reduce((s, r) => s + Number(r.n || 0), 0)
    if (total === 0) return `CRM PIPELINE${isBroker ? ' (your book)' : ''}: no leads yet.`

    const parts = [
      `CRM PIPELINE${isBroker ? ' (your own book only)' : ' (whole team)'} — ${total} leads. By status: ${statusRows.map((r) => `${r.status} ${r.n}`).join(', ')}.`,
    ]
    if (interestRows.length) parts.push(`Top demand last 60 days: ${interestRows.map((r) => `${r.interest} (${r.n})`).join(', ')}.`)
    if (sourceRows.length) parts.push(`Lead sources last 30 days: ${sourceRows.map((r) => `${r.source} ${r.n}`).join(', ')}.`)
    if (recentRows.length) {
      parts.push(`Newest leads:\n${recentRows.map((l) =>
        `- ${l.name} — ${l.status ?? 'new'}${l.interest ? `, interested in ${l.interest}` : ''}${l.source ? `, via ${l.source}` : ''} (${String(l.created_at).slice(0, 10)})`,
      ).join('\n')}`)
    }
    return parts.join('\n')
  } catch {
    return null
  }
}

// ─── Market intelligence: areas + below-market ────────────────────────────────

async function marketBlock(): Promise<string | null> {
  try {
    const [areas, belowMarket] = await Promise.all([
      query<{ name: string; avg_yield: number | null; median_price_aed: number | null; project_count: number | null }>(
        `SELECT name, avg_yield::float, median_price_aed::float, project_count
         FROM freehold_site_area_profiles
         WHERE avg_yield > 0
         ORDER BY avg_yield DESC LIMIT 8`,
      ).catch(() => []),
      query<{ name: string; area: string | null; price_from_aed: number | null; vs_cohort: number | null }>(
        `SELECT name, area, price_from_aed,
                (payload->'priceIntelligence'->>'vsCohortPct')::float AS vs_cohort
         FROM freehold_site_projects
         WHERE (payload->'priceIntelligence'->>'vsCohortPct')::float BETWEEN -50 AND -5
           AND price_from_aed > 0
         ORDER BY 4 ASC LIMIT 6`,
      ).catch(() => []),
    ])
    if (!areas.length && !belowMarket.length) return null
    const parts: string[] = []
    if (areas.length) {
      parts.push(`AREA INTELLIGENCE (live profiles):\n${areas.map((a) =>
        `- ${a.name}: ~${a.avg_yield}% avg yield${a.median_price_aed ? `, median ${fmtAED(a.median_price_aed)}/sqft` : ''}${a.project_count ? `, ${a.project_count} projects` : ''}`,
      ).join('\n')}`)
    }
    if (belowMarket.length) {
      parts.push(`BELOW-MARKET OPPORTUNITIES (priced under their area cohort):\n${belowMarket.map((p) =>
        `- ${p.name} (${p.area ?? '—'}) — from ${fmtAED(p.price_from_aed)}, ${Math.abs(Number(p.vs_cohort ?? 0)).toFixed(0)}% below cohort`,
      ).join('\n')}`)
    }
    return parts.join('\n\n')
  } catch {
    return null
  }
}

// ─── Campaign performance: our attribution + benchmarks ───────────────────────

async function campaignsBlock(): Promise<string | null> {
  try {
    const [attribution, stored, benchmarks] = await Promise.all([
      query<{ campaign: string; n: string }>(
        `SELECT COALESCE(NULLIF(utm_campaign,''), NULLIF(campaign_id,''), 'organic / direct') AS campaign, COUNT(*)::text AS n
         FROM freehold_site_leads
         WHERE created_at > now() - interval '90 days'
         GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 8`,
      ).catch(() => []),
      query<{ name: string; status: string | null; daily_budget_aed: number | null; created_at: string }>(
        `SELECT name, status, daily_budget_aed::float, created_at::text
         FROM freehold_site_meta_campaigns ORDER BY created_at DESC LIMIT 6`,
      ).catch(() => []),
      getNetworkBenchmarks(5).catch(() => []),
    ])
    if (!attribution.length && !stored.length && !benchmarks.length) return null
    const parts: string[] = []
    if (attribution.length) {
      parts.push(`LEADS BY CAMPAIGN (our own attribution, last 90 days):\n${attribution.map((r) => `- ${r.campaign}: ${r.n} leads`).join('\n')}`)
    }
    if (stored.length) {
      parts.push(`RECENT META CAMPAIGNS (this workspace):\n${stored.map((c) =>
        `- ${c.name} — ${c.status ?? 'unknown'}${c.daily_budget_aed ? `, ${fmtAED(c.daily_budget_aed)}/day` : ''} (${String(c.created_at).slice(0, 10)})`,
      ).join('\n')}`)
    }
    if (benchmarks.length) {
      parts.push(`NETWORK TARGETING BENCHMARKS (anonymized, cross-tenant):\n${benchmarks.map((b) =>
        `- ${[b.platform, b.interest, b.area, b.city].filter(Boolean).join(' / ') || 'general'}: ${b.leads} leads, ${b.qualifiedRate}% qualified, ${b.closeRate}% closed`,
      ).join('\n')}`)
    }
    return parts.join('\n\n')
  } catch {
    return null
  }
}

// ─── Threads + uploads ────────────────────────────────────────────────────────

async function conversationsBlock(email: string): Promise<string | null> {
  try {
    const convs = await listConversations(email)
    if (!convs.length) return null
    const lines = convs.slice(0, 8).map((c) => {
      const last = c.messages[c.messages.length - 1]
      const snippet = last ? ` — last: ${last.content.replace(/\s+/g, ' ').slice(0, 140)}` : ''
      return `- "${c.title}" (${c.messages.length} messages)${snippet}`
    })
    return `EARLIER NOTEBOOK THREADS (the user's own, most recent first):\n${lines.join('\n')}`
  } catch {
    return null
  }
}

function uploadsBlock(uploads: NotebookUpload[]): string | null {
  const clean = uploads.filter((u) => u?.name?.trim())
  if (!clean.length) return null
  const lines = clean.slice(0, 20).map((u) => {
    if (u.content && u.content.trim()) {
      const snippet = u.content.trim().slice(0, 4000)
      return `- ${u.name}:\n${snippet}`
    }
    return `- ${u.name} (attached — content not extracted; treat as a pointer the user may quote)`
  })
  return `ATTACHED SOURCES the user added:\n${lines.join('\n\n')}`
}

/**
 * Returns a context string to prepend to the system prompt, or '' when no
 * data-bearing source is selected.
 */
export async function buildNotebookContext(
  sources: NotebookSources | undefined,
  uploads: NotebookUpload[] = [],
  userEmail?: string,
  opts: NotebookContextOpts = {},
): Promise<string> {
  if (!sources) return ''
  const blocks: string[] = []
  const [proj, leads, market, camps, convs] = await Promise.all([
    sources.live_projects ? projectsBlock(opts.message ?? '') : Promise.resolve(null),
    sources.crm_leads ? leadsBlock(opts.role, opts.brokerId) : Promise.resolve(null),
    sources.market_intel ? marketBlock() : Promise.resolve(null),
    sources.campaigns ? campaignsBlock() : Promise.resolve(null),
    sources.all_conversations && userEmail ? conversationsBlock(userEmail) : Promise.resolve(null),
  ])
  if (proj) blocks.push(proj)
  if (leads) blocks.push(leads)
  if (market) blocks.push(market)
  if (camps) blocks.push(camps)
  if (convs) blocks.push(convs)
  if (sources.uploads) {
    const up = uploadsBlock(uploads)
    if (up) blocks.push(up)
  }
  if (!blocks.length) return ''
  return `\n\nThe user selected these workspace sources — ground your answer in this real data and cite specific projects/numbers where relevant:\n\n${blocks.join('\n\n')}`
}
