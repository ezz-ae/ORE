import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { decideCampaignAction, type CampaignIntent } from '@/lib/meta/campaign-router'
import { buildProjectAdStructure } from '@/lib/meta/campaign-structure'
import { evaluateSpendAuthority } from '@/lib/meta/spend-authority'
import { getApplicableSpendRules } from '@/lib/meta/spend-rules'
import { readCampaignIntent } from '@/lib/meta/intent-reader'
import { getCampaignInsights } from '@/lib/meta/client'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'
import type { MetaInsights } from '@/lib/meta/types'
import { metaLeadCount } from '@/lib/meta/lead-count'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const metaLeads = (ins: MetaInsights | null) => metaLeadCount(ins?.actions)

// Advisory (no Meta writes): given a broker's intent, return the healthy action
// the system WOULD take, and — for a budget move — how much of it the AI could
// fund autonomously under the admin's spend rules. The wizard shows this before
// the broker commits; the launch route makes the real change.
export async function POST(req: NextRequest) {
  const auth = await requireSession()
  if ('res' in auth) return auth.res
  const body = (await req.json().catch(() => ({}))) as Partial<CampaignIntent> & { projectSlug?: string; text?: string }
  const projectSlug = String(body.projectSlug ?? '').trim()
  if (!projectSlug) return NextResponse.json({ error: 'projectSlug is required.' }, { status: 400 })

  const structure = await buildProjectAdStructure(projectSlug)

  // Freeform ask → structured intent, grounded in what's already running. If the
  // objective is genuinely unclear, ask ONE question instead of guessing.
  let objectiveKey = String(body.objectiveKey ?? '')
  let language = String(body.language ?? '')
  let hasNewCreative = body.hasNewCreative !== false
  let dailyBudgetAED = Number(body.dailyBudgetAED) || 0
  let read: Awaited<ReturnType<typeof readCampaignIntent>> | null = null
  if (typeof body.text === 'string' && body.text.trim()) {
    read = await readCampaignIntent(body.text, {
      projectSlug,
      runningObjectives: [...new Set(structure.campaigns.map((c) => c.objectiveKey).filter(Boolean))],
    })
    if (!read.objective && read.needsClarification) {
      return NextResponse.json({ clarification: read.needsClarification, read })
    }
    objectiveKey = read.objective || objectiveKey
    language = read.language || language
    hasNewCreative = read.hasNewCreative
    if (read.dailyBudgetAED) dailyBudgetAED = read.dailyBudgetAED
  }

  const intent: CampaignIntent = {
    projectSlug,
    objectiveKey,
    language,
    audienceKey: String(body.audienceKey ?? ''),
    hasNewCreative,
    dailyBudgetAED,
    brokerId: auth.user.brokerId ?? auth.user.email,
    brokerExperience: body.brokerExperience,
  }

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
    const current = target?.dailyBudgetAED ?? 0
    spend = evaluateSpendAuthority(
      // The broker's requested daily budget is an ADD to the running campaign,
      // so the target total the governor evaluates is current + requested.
      { projectSlug, campaignId: decision.targetCampaignId, requestedDailyBudgetAED: current + intent.dailyBudgetAED },
      {
        currentDailyBudgetAED: current,
        cplAED: leads > 0 ? spendAED / leads : null,
        qualityScore: quality?.score ?? null,
        leads,
      },
      rules,
    )
  }

  // The spend authorization exposes admin-only governor internals (rule ids,
  // thresholds) in its reason — redact for non-management callers (brokers).
  const isManagement = (MANAGEMENT_ROLES as readonly string[]).includes(auth.user.role)
  const safeSpend = spend && !isManagement
    ? { decision: spend.decision, approvedDailyBudgetAED: spend.approvedDailyBudgetAED }
    : spend

  return NextResponse.json({ decision, spend: safeSpend, read })
}
