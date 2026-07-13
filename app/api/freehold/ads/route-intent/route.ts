import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { decideCampaignAction, type CampaignIntent } from '@/lib/meta/campaign-router'
import { buildProjectAdStructure } from '@/lib/meta/campaign-structure'
import { evaluateSpendAuthority } from '@/lib/meta/spend-authority'
import { getApplicableSpendRules } from '@/lib/meta/spend-rules'
import { getCampaignInsights } from '@/lib/meta/client'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'
import type { MetaInsights } from '@/lib/meta/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const metaLeads = (ins: MetaInsights | null) =>
  (ins?.actions ?? []).filter((a) => a.action_type.includes('lead')).reduce((s, a) => s + (Number(a.value) || 0), 0)

// Advisory (no Meta writes): given a broker's intent, return the healthy action
// the system WOULD take, and — for a budget move — how much of it the AI could
// fund autonomously under the admin's spend rules. The wizard shows this before
// the broker commits; the launch route makes the real change.
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = (await req.json().catch(() => ({}))) as Partial<CampaignIntent> & { projectSlug?: string }
  const projectSlug = String(body.projectSlug ?? '').trim()
  if (!projectSlug) return NextResponse.json({ error: 'projectSlug is required.' }, { status: 400 })

  const intent: CampaignIntent = {
    projectSlug,
    objectiveKey: String(body.objectiveKey ?? ''),
    language: String(body.language ?? ''),
    audienceKey: String(body.audienceKey ?? ''),
    hasNewCreative: body.hasNewCreative !== false, // a wizard launch always brings a creative
    dailyBudgetAED: Number(body.dailyBudgetAED) || 0,
    brokerId: auth.user.brokerId ?? auth.user.email,
    brokerExperience: body.brokerExperience,
  }

  const structure = await buildProjectAdStructure(projectSlug)
  const decision = decideCampaignAction(intent, structure)

  // For a budget move, compute how much the AI may fund autonomously right now.
  let spend = null as null | ReturnType<typeof evaluateSpendAuthority>
  if (decision.action === 'increase_budget' && decision.targetCampaignId) {
    const target = structure.campaigns.find((c) => c.id === decision.targetCampaignId)
    const [insights, quality, rules] = await Promise.all([
      getCampaignInsights(decision.targetCampaignId).catch(() => null),
      getCampaignQuality(decision.targetCampaignId, '').catch(() => null),
      getApplicableSpendRules(projectSlug),
    ])
    const leads = metaLeads(insights)
    const spendAED = Number(insights?.spend) || 0
    spend = evaluateSpendAuthority(
      { projectSlug, campaignId: decision.targetCampaignId, requestedDailyBudgetAED: intent.dailyBudgetAED },
      {
        currentDailyBudgetAED: target?.dailyBudgetAED ?? 0,
        cplAED: leads > 0 ? spendAED / leads : null,
        qualityScore: quality?.score ?? null,
        leads,
      },
      rules,
    )
  }

  return NextResponse.json({ decision, spend })
}
