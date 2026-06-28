import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/lib/freehold/auth-edge'
import { query } from '@/lib/db'
import { queryServerAgent } from '@/lib/freehold/server-ai'
import { gatherTeamMetrics } from '@/lib/freehold/team-metrics'
import { getFinanceTotals } from '@/lib/deals'
import { getMarketStats } from '@/lib/market-stats'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED = new Set(['admin', 'ceo', 'director'])

let ensured: Promise<void> | null = null
const ensureOnce = async () => {
  if (!ensured) ensured = query(`
    CREATE TABLE IF NOT EXISTS freehold_site_notebook_outputs (
      id text PRIMARY KEY, title text NOT NULL, type text NOT NULL DEFAULT 'note',
      content text NOT NULL, created_by text, created_at timestamptz NOT NULL DEFAULT now()
    )`).then(() => undefined).catch((e) => { ensured = null; throw e })
  await ensured
}

async function leadSummary() {
  const [row] = await query<{ total: string; last_30d: string; closed: string; new_count: string }>(`
    SELECT COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days')::text AS last_30d,
      COUNT(*) FILTER (WHERE status = 'closed')::text AS closed,
      COUNT(*) FILTER (WHERE status = 'new')::text AS new_count
    FROM freehold_site_leads`).catch(() => [])
  const sources = await query<{ source: string; count: string }>(`
    SELECT COALESCE(source,'direct') AS source, COUNT(*)::text AS count
    FROM freehold_site_leads GROUP BY source ORDER BY COUNT(*) DESC LIMIT 8`).catch(() => [])
  return { totals: row ?? null, sources }
}

const SYSTEM_PROMPT = `You are the Chief of Staff for a Dubai freehold real-estate brokerage.
Produce a board-ready company report as a SINGLE HTML fragment (no <html>, <head> or <body> tags —
just content divs). Use inline styles only, dark-friendly (light text on transparent), with <h2>/<h3>
headings, <table> for figures, and concise prose. Ground every number in the provided live data; never
invent figures. Structure:
  1. Executive summary (3-4 sentences).
  2. KPIs by period (this month vs all-time) as a small table.
  3. Top 10 strategic decisions — a numbered list, each: the decision, the data-backed rationale,
     expected impact, and a suggested owner/role.
  4. Team performance highlights (top performers, retention/effort watch-outs).
  5. Market context (areas, pricing, yields).
  6. Seasonal marketing calendar — how spend & messaging should shift across the next quarters
     (Dubai real-estate seasonality: Q4/Q1 peak, summer slow).
  7. Key risks.
Return ONLY the HTML fragment, no markdown fences, no commentary.`

export async function POST() {
  const user = await verifySession((await cookies()).get(SESSION_COOKIE)?.value)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED.has(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const [finance, team, market, leads] = await Promise.all([
      getFinanceTotals().catch(() => null),
      gatherTeamMetrics().catch(() => []),
      getMarketStats().catch(() => null),
      leadSummary().catch(() => ({ totals: null, sources: [] })),
    ])

    const raw = await queryServerAgent('Generate the company report now from the live data in context.', {
      sessionId: `report-${crypto.randomUUID()}`,
      systemPrompt: SYSTEM_PROMPT,
      context: { finance, team, market, leads, generatedFor: user.name },
      temperature: 0.5,
      maxOutputTokens: 4096,
    })

    const html = raw.trim().replace(/^```(?:html)?/i, '').replace(/```$/, '').trim()
    if (!html) return NextResponse.json({ error: 'Empty report' }, { status: 502 })

    const now = new Date()
    const title = `Company report — ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    const id = crypto.randomUUID()
    await ensureOnce()
    await query(
      `INSERT INTO freehold_site_notebook_outputs (id, title, type, content, created_by, created_at)
       VALUES ($1, $2, 'report', $3, $4, $5)`,
      [id, title, html, user.email, now.toISOString()],
    )

    return NextResponse.json({ output: { id, title, type: 'report', content: html } }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: `Report failed: ${msg}` }, { status: 500 })
  }
}
