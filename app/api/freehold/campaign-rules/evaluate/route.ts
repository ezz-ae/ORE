import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listRules, evaluateRules, displayMetrics, type RuleMetrics } from '@/lib/freehold/campaign-rules'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Evaluate a campaign's rules against the live metrics. SIDE-EFFECT FREE — this
 * returns which rules currently fire; applying an action is a separate, explicit
 * step in the UI. Quality is recomputed server-side (from our CRM) so it can't be
 * spoofed; the Meta delivery counts come from the client, which already holds
 * the live insights.
 *
 * The client sends COUNTS (spend, leads, clicks, impressions), never rates.
 * That is not tidiness — it removes the possibility of a caller submitting
 * `cpl: 0` for a campaign that has produced nothing, which the previous
 * signature not only permitted but is exactly what both callers did.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = (await req.json().catch(() => ({}))) as {
    campaignId?: string; campaignName?: string
    metrics?: { leads?: number; spend?: number; clicks?: number; impressions?: number }
  }
  const campaignId = String(body.campaignId ?? '')
  if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })

  const quality = await getCampaignQuality(campaignId, String(body.campaignName ?? ''))
  const evidence: RuleMetrics = {
    spend: Number(body.metrics?.spend) || 0,
    leads: Number(body.metrics?.leads) || 0,
    clicks: Number(body.metrics?.clicks) || 0,
    impressions: Number(body.metrics?.impressions) || 0,
    attributed: quality.attributed,
    qualityScore: quality.score,
  }

  const rules = await listRules(auth.user.email, campaignId)
  const { matches, withheld } = evaluateRules(rules, evidence)
  return NextResponse.json({
    matches: matches.map((m) => ({
      ruleId: m.rule.id, name: m.rule.name, metric: m.rule.metric, operator: m.rule.operator,
      threshold: m.rule.threshold, action: m.rule.action, actionValue: m.rule.actionValue,
      currentValue: m.currentValue, pointValue: m.pointValue,
    })),
    // Every rule the evidence could not decide, and why. An operator who can
    // see this trusts the ones that DID fire.
    withheld: withheld.map((w) => ({
      ruleId: w.rule.id, name: w.rule.name, metric: w.metric, reason: w.reason,
    })),
    metrics: displayMetrics(evidence),
    evidence,
  })
}
