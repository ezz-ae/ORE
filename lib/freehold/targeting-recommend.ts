import { queryServerAgent } from '@/lib/freehold/server-ai'
import { listCampaigns, getCampaignInsights } from '@/lib/meta/client'
import { UAE_INTERESTS, UAE_CITIES, type TargetingRecommendation, type TargetingStrategy } from '@/lib/meta/targeting-catalog'
import { query } from '@/lib/db'
import { getNetworkBenchmarks, refreshLiveTenantSignals } from '@/lib/entrestate/targeting-base'
import { metaLeadCount } from '@/lib/meta/lead-count'
import { getUntrustedLeadIds } from '@/lib/freehold/training-integrity'
import { rank, junkInventory, type Ranking, type ArmReading } from '@/lib/freehold/inventory-quality'

// The learning loop's SHARED brain: reads what actually happened (spend, CPL,
// how each campaign's leads progressed in the CRM), folds in the network's
// anonymized benchmarks, and recommends the next round's targeting. Consumed
// by the /api/freehold/ai/targeting route AND the coordinator chat's
// ads_plan_campaign tool — one engine, no duplicates.

export type ListingCtx = { name?: string; area?: string; price?: number; type?: string }

interface CampaignPerf {
  id: string
  name: string
  status: string
  spendAED: number
  metaLeads: number
  crm: { total: number; qualified: number; closed: number; lost: number }
  cpl: number | null
  /** Delivery volume. These were fetched all along and dropped before the model
   *  saw them, which left the recommendation resting on `cpl` — a figure built
   *  from a handful of leads — while the hundreds of thousands of impressions
   *  that actually separate one audience from another went unread. */
  impressions: number
  clicks: number
  /** Cost per thousand impressions: what this audience costs to reach. */
  cpm: number | null
  /** Leads per million impressions: how well it converts once reached. This is
   *  the audience-quality number, and it is the one that reaches significance
   *  in days rather than months. */
  leadsPerMillion: number | null
}

async function crmOutcomesByCampaign(): Promise<Map<string, CampaignPerf['crm']>> {
  const map = new Map<string, CampaignPerf['crm']>()
  try {
    // Layer-10 training integrity: exclude leads quarantined by a mass-purge
    // burst, so a queue-purge can't poison the learning loop's outcome counts
    // (and the qualified/closed lookalike seed-pool sizes derived from them).
    const untrusted = await getUntrustedLeadIds().catch(() => new Set<string>())
    const exclude = Array.from(untrusted)
    const rows = await query<{ campaign_id: string; total: string; qualified: string; closed: string; lost: string }>(`
      SELECT campaign_id,
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE priority IN ('hot','priority') OR status IN ('qualified','viewing','negotiation'))::text AS qualified,
        COUNT(*) FILTER (WHERE status IN ('closed','converted'))::text AS closed,
        COUNT(*) FILTER (WHERE status = 'lost')::text AS lost
      FROM freehold_site_leads
      WHERE campaign_id IS NOT NULL AND campaign_id <> '' AND campaign_id <> 'organic'
        AND NOT (id = ANY($1::text[]))
      GROUP BY campaign_id
    `, [exclude])
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
      let impressions = 0
      let clicks = 0
      try {
        const ins = await getCampaignInsights(c.id)
        spend = Number(ins?.spend) || 0
        leads = metaLeadCount(ins?.actions)
        impressions = Number(ins?.impressions) || 0
        clicks = Number(ins?.clicks) || 0
      } catch { /* insights unavailable for this campaign */ }
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        spendAED: spend,
        metaLeads: leads,
        crm: outcomes.get(c.id) ?? { total: 0, qualified: 0, closed: 0, lost: 0 },
        cpl: leads > 0 ? Math.round((spend / leads) * 10) / 10 : null,
        impressions,
        clicks,
        cpm: impressions > 0 ? Math.round((spend / impressions) * 1000 * 100) / 100 : null,
        leadsPerMillion: impressions > 0 ? Math.round((leads / impressions) * 1_000_000) : null,
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
        impressions: 0, clicks: 0, cpm: null, leadsPerMillion: null,
      })),
    }
  }
}

const STRATEGIES: TargetingStrategy[] = ['advantage_broad', 'lookalike_qualified', 'retargeting_warm', 'interest_refined']

function clampRecommendation(raw: Record<string, unknown>): TargetingRecommendation {
  const ids = new Set(UAE_INTERESTS.map((i) => i.id))
  const cityKeys = new Set(UAE_CITIES.map((c) => c.key))
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
  const num = (v: unknown, d: number, lo: number, hi: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d
  }
  const txt = (v: unknown, max = 500) => String(v ?? '').slice(0, max)
  const strategy = (STRATEGIES.includes(raw.strategy as TargetingStrategy) ? raw.strategy : 'advantage_broad') as TargetingStrategy
  // Interests apply ONLY on the cold-start strategy; every other strategy runs
  // broad and lets Meta's algorithm hunt on our signals.
  const interestIds = strategy === 'interest_refined' ? arr(raw.interestIds).filter((i) => ids.has(i)) : []
  const seedRaw = String(raw.lookalikeSeed ?? '')
  const cities = arr(raw.cityKeys).filter((c) => cityKeys.has(c))
  return {
    strategy,
    analysis: txt(raw.analysis, 800),
    interestIds,
    lookalikeSeed: seedRaw === 'closed_leads' || seedRaw === 'qualified_leads' ? seedRaw : (strategy === 'lookalike_qualified' ? 'qualified_leads' : null),
    exclusions: arr(raw.exclusions).slice(0, 4).map((e) => e.slice(0, 120)),
    ageMin: num(raw.ageMin, 28, 18, 60),
    ageMax: Math.max(num(raw.ageMax, 60, 25, 65), num(raw.ageMin, 28, 18, 60) + 5),
    cityKeys: cities.length ? cities : ['297928'],
    dailyBudgetAED: num(raw.dailyBudgetAED, 250, 50, 5000),
    signalPlan: txt(raw.signalPlan),
    creativeAngle: txt(raw.creativeAngle),
    learningPhase: txt(raw.learningPhase, 300),
    rationale: txt(raw.rationale, 800),
    suggestedNewInterests: arr(raw.suggestedNewInterests).slice(0, 5).map((s) => s.slice(0, 60)),
  }
}


export async function recommendTargeting(listing: ListingCtx | null, sessionKey: string): Promise<{
  recommendation: TargetingRecommendation
  performance: CampaignPerf[]
  connected: boolean
  /** The computed evidence behind the recommendation. Returned, not just fed
   *  to the model — a system that establishes which audience is better and
   *  shows only the model's prose has kept the finding to itself. */
  evidence: { ranking: Ranking | null; junk: ArmReading[] }
}> {
  // Keep this tenant's contribution to the shared brain fresh, then read the
  // NETWORK's aggregated benchmarks — every system user's learning combined,
  // never any client's raw data.
  await refreshLiveTenantSignals().catch(() => {})
  const [perf, benchmarks] = await Promise.all([gatherPerformance(), getNetworkBenchmarks(15)])

  const qualifiedPool = perf.campaigns.reduce((n, c) => n + c.crm.qualified, 0)
  const closedPool = perf.campaigns.reduce((n, c) => n + c.crm.closed, 0)

  // WHAT THE DATA ACTUALLY ESTABLISHES. Handing a model eight rows of CPL and
  // asking which audience is best guarantees a confident answer, because a
  // 3.6× spread across 26 leads looks decisive and reads as a finding. This
  // computes the comparisons on IMPRESSIONS instead — the basis with 10,000×
  // more observations — and passes the verdicts in, so the model reasons from
  // established differences rather than rediscovering noise.
  const arms = perf.campaigns
    .filter((c) => c.impressions > 0)
    .map((c) => ({ id: c.id, name: c.name, spend: c.spendAED, leads: c.metaLeads, impressions: c.impressions, clicks: c.clicks }))
  const ranking = arms.length >= 2 ? rank(arms) : null
  const junk = arms.length >= 2 ? junkInventory(arms) : []
  const established = ranking ? ranking.comparisons.filter((c) => c.established) : []

  const establishedBlock = ranking
    ? [
        'ESTABLISHED DIFFERENCES (computed, not guessed — exact conditional binomial on impressions, p < 0.05):',
        established.length
          ? established.slice(0, 8).map((c) => `· ${c.sentence}`).join('\n')
          : '· NONE. No two campaigns have separated on audience quality yet.',
        ranking.undecided.length
          ? `NOT SEPARATED — do not rank or act on these against each other: ${ranking.undecided.map((r) => `"${r.name}"`).join(', ')}`
          : '',
        `SUMMARY: ${ranking.headline}`,
      ].filter(Boolean).join('\n')
    : 'ESTABLISHED DIFFERENCES: not enough campaigns with delivery to compare.'

  const junkBlock = junk.length
    ? `CHEAP JUNK INVENTORY (low cpm AND proven-low conversion — these buy impressions that do not convert, which is invisible in cpl): ${junk
        .map((r) => `"${r.name}" (cpm ${r.cpm?.toFixed(2)}, ${Math.round(r.lpm ?? 0)} leads/million)`)
        .join(', ')}. Recommend narrowing placements away from this inventory rather than changing the audience.`
    : ''

  const prompt = `You are the head of performance at a full-service marketing agency running a Dubai real-estate lead machine. Your doctrine is ALGORITHM vs ALGORITHM: Meta's delivery system finds the buyers — your job is to feed it better signals, seeds, exclusions and creative than the competition. You NEVER ship a lazy interest stack like "real estate + Dubai" as a strategy; that is what juniors do.

CAMPAIGN PERFORMANCE (real):
${JSON.stringify(perf.campaigns, null, 1)}

SEED POOLS AVAILABLE FOR LOOKALIKES: ${qualifiedPool} qualified leads, ${closedPool} closed buyers in the CRM.
${listing && listing.name ? `\nTHIS CAMPAIGN'S LISTING (tailor cities, age band, budget and the creative angle to THIS asset and its price band — a Marina short-let investor is not a Hills villa family):\n${JSON.stringify(listing)}` : ''}

QUALITY SIGNAL: crm.qualified/closed vs crm.lost per campaign shows which delivery produced REAL buyers. A cheap-CPL campaign whose leads mark "lost" is worse than a pricier one that closes.

HOW TO READ THESE NUMBERS — this is the part juniors get wrong:
· cpl is built from a handful of leads. A 3× spread in cpl across single-digit lead counts is usually noise. NEVER name a "winning" or "losing" audience on cpl alone, and never recommend a targeting change because one campaign's cpl looks high.
· leadsPerMillion (leads per million impressions) is the audience-QUALITY number. Impressions run to the hundreds of thousands, so differences here are real long before cpl moves.
· cpm is what the inventory COSTS. A very low cpm is not a bargain — it is the price of impressions nobody else bid for.
· The two combine: an audience with a high cpm and a high leadsPerMillion, and one with a low cpm and a low leadsPerMillion, can land on the SAME cpl while being completely different buys. Only leadsPerMillion tells them apart.

${establishedBlock}
${junkBlock}

Base your recommendation on the ESTABLISHED list. Where nothing is established, say so plainly in the "analysis" field and recommend gathering evidence — more spend on the current split, not a new audience. Inventing a targeting change to look decisive is the failure mode; "the data does not support a change yet" is a valid and often correct answer.

NETWORK BENCHMARKS (aggregated, anonymized signals from ALL tenants of the system — use them especially when this tenant's own history is thin):
${JSON.stringify(benchmarks)}

STRATEGY MENU (pick ONE):
- "advantage_broad": broad targeting + Advantage; the algorithm hunts using our conversion signals. Default when signal volume exists or nothing else is clearly better.
- "lookalike_qualified": seed a lookalike from the qualified/closed CRM cohort. Prefer this when the seed pool is ≥ 20.
- "retargeting_warm": re-engage engaged-but-unconverted leads/visitors. Only when there is meaningful volume to re-engage.
- "interest_refined": COLD START ONLY (no history, tiny pools). Even then, creative + landing page do the real selecting; interests come ONLY from this catalog: ${JSON.stringify(UAE_INTERESTS)}

ALLOWED CITY KEYS: ${JSON.stringify(UAE_CITIES)}

Return PURE JSON:
{"strategy":"<one of the four>","analysis":"<what the data says, 2-4 sentences>","interestIds":[],"lookalikeSeed":"qualified_leads|closed_leads|null","exclusions":["<who to exclude and why, e.g. existing CRM leads uploaded as a customer list>"],"ageMin":n,"ageMax":n,"cityKeys":["..."],"dailyBudgetAED":n,"signalPlan":"<how to feed the algorithm: which events, weekly qualified-lead feedback, optimization goal>","creativeAngle":"<the creative angle that self-selects the right buyer>","learningPhase":"<budget discipline: learning phase, when/how to scale without resets>","rationale":"<why this beats the last round, 2-3 sentences>","suggestedNewInterests":["<names only, for the catalog>"]}

If there is no history at all, choose interest_refined honestly, say so, and put the real weight on creativeAngle + signalPlan.`

  const raw = await queryServerAgent(prompt, {
    systemPrompt: 'You are a precise performance-marketing analyst. Return only valid JSON matching the requested schema.',
    responseMimeType: 'application/json',
    maxOutputTokens: 700,
    temperature: 0.3,
    sessionId: `targeting-${sessionKey}`,
  })

  let rec: TargetingRecommendation
  try {
    const jsonStart = raw.indexOf('{')
    rec = clampRecommendation(JSON.parse(jsonStart >= 0 ? raw.slice(jsonStart, raw.lastIndexOf('}') + 1) : raw))
  } catch {
    rec = clampRecommendation({ strategy: 'interest_refined', interestIds: [UAE_INTERESTS[0].id, UAE_INTERESTS[3].id] })
    rec.analysis = 'AI is offline — this is the proven cold-start setup for Dubai real-estate investors.'
    rec.signalPlan = 'Connect the pixel/CAPI and feed qualified-lead outcomes back weekly so the algorithm optimizes for quality.'
    rec.creativeAngle = 'ROI-first investor creative: real yield numbers and payment plan up front — the creative does the selecting.'
    rec.learningPhase = 'Hold the budget steady through the learning phase; scale by +20% steps, never mid-learning.'
    rec.rationale = 'Connect the AI service for data-driven recommendations from your lead outcomes.'
  }

  return {
    recommendation: rec,
    performance: perf.campaigns,
    connected: perf.connected,
    evidence: { ranking, junk },
  }
}
