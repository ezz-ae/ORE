import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { listRules, evaluateRules, type RuleMetrics } from '@/lib/freehold/campaign-rules'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Evaluate a campaign's rules against the live metrics. SIDE-EFFECT FREE — this
 * returns which rules currently fire; applying an action is a separate, explicit
 * step in the UI. Quality is recomputed server-side (from our CRM) so it can't be
 * spoofed; the Meta delivery metrics (cpl/leads/spend/ctr) come from the client,
 * which already holds the live insights.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = (await req.json().catch(() => ({}))) as {
    campaignId?: string; campaignName?: string
    metrics?: { cpl?: number; leads?: number; spend?: number; ctr?: number }
  }
  const campaignId = String(body.campaignId ?? '')
  if (!campaignId) return NextResponse.json({ error: 'campaignId is required' }, { status: 400 })

  const quality = await getCampaignQuality(campaignId, String(body.campaignName ?? ''))
  const metrics: RuleMetrics = {
    quality: quality.score,
    cpl: Number(body.metrics?.cpl) || 0,
    leads: Number(body.metrics?.leads) || 0,
    spend: Number(body.metrics?.spend) || 0,
    ctr: Number(body.metrics?.ctr) || 0,
  }

  const rules = await listRules(auth.user.email, campaignId)
  const matches = evaluateRules(rules, metrics).map((m) => ({
    ruleId: m.rule.id, name: m.rule.name, metric: m.rule.metric, operator: m.rule.operator,
    threshold: m.rule.threshold, action: m.rule.action, actionValue: m.rule.actionValue,
    currentValue: m.currentValue,
  }))
  return NextResponse.json({ matches, metrics })
}
