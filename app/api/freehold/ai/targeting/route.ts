import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { checkRateLimit } from '@/lib/freehold/rate-limit'
import { queryServerAgent } from '@/lib/freehold/server-ai'
import { listCampaigns, getCampaignInsights } from '@/lib/meta/client'
import { UAE_INTERESTS, UAE_CITIES, type TargetingRecommendation } from '@/lib/meta/targeting-catalog'
import { query } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The learning loop: Inventory → landing pages → campaigns → LEADS → this
// endpoint → better targeting for the NEXT campaign. It reads what actually
// happened (spend, CPL, and how each campaign's leads progressed in the CRM)
// and recommends the next round's targeting — constrained to the proven
// catalog so every recommendation can really launch.

const ALLOWED = ['admin', 'ceo', 'director', 'sales_manager', 'marketing'] as const

interface CampaignPerf {
  id: string
  name: string
  status: string
  spendAED: number
  metaLeads: number
  crm: { total: number; qualified: number; closed: number; lost: number }
  cpl: number | null
}

async function crmOutcomesByCampaign(): Promise<Map<string, CampaignPerf['crm']>> {
  const map = new Map<string, CampaignPerf['crm']>()
  try {
    const rows = await query<{ campaign_id: string; total: string; qualified: string; closed: string; lost: string }>(`
      SELECT campaign_id,
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE priority IN ('hot','priority') OR status IN ('qualified','viewing','negotiation'))::text AS qualified,
        COUNT(*) FILTER (WHERE status IN ('closed','converted'))::text AS closed,
        COUNT(*) FILTER (WHERE status = 'lost')::text AS lost
      FROM freehold_site_leads
      WHERE campaign_id IS NOT NULL AND campaign_id <> '' AND campaign_id <> 'organic'
      GROUP BY campaign_id
    `)
    for (const r of rows) {
      map.set(r.campaign_id, {
        total: parseInt(r.total, 10),
        qualified: parseInt(r.qualified, 10),
        closed: parseInt(r.closed, 10),
        lost: parseInt(r.lost, 10),
      })
    }
  } catch { /* empty map — the loop just has no history yet */ }
  return map
}

async function gatherPerformance(): Promise<{ connected: boolean; campaigns: CampaignPerf[] }> {
  try {
    const [campaigns, outcomes] = await Promise.all([listCampaigns(), crmOutcomesByCampaign()])
    const rows: CampaignPerf[] = await Promise.all(campaigns.slice(0, 15).map(async (c) => {
      let spend = 0
      let leads = 0
      try {
        const ins = await getCampaignInsights(c.id)
        spend = Number(ins?.spend) || 0
        leads = (ins?.actions ?? []).filter((a) => a.action_type.includes('lead')).reduce((s, a) => s + (Number(a.value) || 0), 0)
      } catch { /* insights unavailable for this campaign */ }
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        spendAED: spend,
        metaLeads: leads,
        crm: outcomes.get(c.id) ?? { total: 0, qualified: 0, closed: 0, lost: 0 },
        cpl: leads > 0 ? Math.round((spend / leads) * 10) / 10 : null,
      }
    }))
    return { connected: true, campaigns: rows }
  } catch {
    // Not connected — the loop can still advise from CRM lead outcomes alone.
    const outcomes = await crmOutcomesByCampaign()
    return {
      connected: false,
      campaigns: [...outcomes.entries()].map(([id, crm]) => ({
        id, name: id, status: 'UNKNOWN', spendAED: 0, metaLeads: crm.total, crm, cpl: null,
      })),
    }
  }
}

function clampRecommendation(raw: Record<string, unknown>): TargetingRecommendation {
  const ids = new Set(UAE_INTERESTS.map((i) => i.id))
  const cityKeys = new Set(UAE_CITIES.map((c) => c.key))
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
  const num = (v: unknown, d: number, lo: number, hi: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d
  }
  const interestIds = arr(raw.interestIds).filter((i) => ids.has(i))
  const cities = arr(raw.cityKeys).filter((c) => cityKeys.has(c))
  return {
    analysis: String(raw.analysis ?? '').slice(0, 800),
    interestIds: interestIds.length ? interestIds : [UAE_INTERESTS[0].id],
    ageMin: num(raw.ageMin, 28, 18, 60),
    ageMax: Math.max(num(raw.ageMax, 60, 25, 65), num(raw.ageMin, 28, 18, 60) + 5),
    cityKeys: cities.length ? cities : ['297928'],
    dailyBudgetAED: num(raw.dailyBudgetAED, 250, 50, 5000),
    rationale: String(raw.rationale ?? '').slice(0, 800),
    suggestedNewInterests: arr(raw.suggestedNewInterests).slice(0, 5).map((s) => s.slice(0, 60)),
  }
}

export async function GET() {
  const auth = await requireSession([...ALLOWED])
  if ('res' in auth) return auth.res

  const rl = await checkRateLimit(`ai-targeting:${auth.user.email}`, { limit: 20, windowSec: 3600 })
  if (!rl.ok) return NextResponse.json({ error: 'Try again shortly', retryAfterSec: rl.retryAfterSec }, { status: 429 })

  const perf = await gatherPerformance()

  const prompt = `You are the media buyer for a Dubai real-estate lead machine. Analyse the ACTUAL results below and recommend the targeting for the NEXT Meta lead campaign so it beats the previous round.

CAMPAIGN PERFORMANCE (real):
${JSON.stringify(perf.campaigns, null, 1)}

QUALITY SIGNAL: crm.qualified/closed vs crm.lost per campaign tells you which audiences produce REAL buyers, not just cheap form-fills. A campaign with low CPL but high "lost" is worse than a higher-CPL campaign whose leads qualify.

ALLOWED INTERESTS (you may ONLY recommend these ids):
${JSON.stringify(UAE_INTERESTS)}

ALLOWED CITY KEYS:
${JSON.stringify(UAE_CITIES)}

Return PURE JSON:
{"analysis":"<what the data says, 2-4 sentences>","interestIds":["..."],"ageMin":n,"ageMax":n,"cityKeys":["..."],"dailyBudgetAED":n,"rationale":"<why this beats the last round, 2-3 sentences>","suggestedNewInterests":["<interest NAMES worth researching in Meta's tool — no ids>"]}

If there is no performance history yet, recommend a sensible cold-start setup for Dubai real-estate investors and say so in the analysis.`

  const raw = await queryServerAgent(prompt, {
    systemPrompt: 'You are a precise performance-marketing analyst. Return only valid JSON matching the requested schema.',
    responseMimeType: 'application/json',
    maxOutputTokens: 700,
    temperature: 0.3,
    sessionId: `targeting-${auth.user.email}`,
  })

  let rec: TargetingRecommendation
  try {
    const jsonStart = raw.indexOf('{')
    rec = clampRecommendation(JSON.parse(jsonStart >= 0 ? raw.slice(jsonStart, raw.lastIndexOf('}') + 1) : raw))
  } catch {
    rec = clampRecommendation({})
    rec.analysis = 'AI is offline — this is the proven cold-start setup for Dubai real-estate investors.'
    rec.rationale = 'Connect the AI service for data-driven recommendations from your lead outcomes.'
  }

  return NextResponse.json({ recommendation: rec, performance: perf.campaigns, connected: perf.connected })
}
