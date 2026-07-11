import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/freehold/api-auth'
import { MANAGEMENT_ROLES } from '@/lib/freehold/session-types'
import { getAutonomyLevel } from '@/lib/freehold/agent-autonomy'
import { listRules, updateRule, evaluateRules, type RuleMetrics } from '@/lib/freehold/campaign-rules'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'
import {
  listCampaigns, getCampaignInsights, updateCampaignStatus,
  listAdSets, updateAdSet, MetaConfigError,
} from '@/lib/meta/client'
import { getAutoEnhanceModes } from '@/lib/meta/campaign-prefs'
import { saveLibraryItem } from '@/lib/freehold/library'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * AUTOPILOT (Autonomy Level 3) — one optimization pass over the live account.
 *
 * For each ACTIVE campaign: compute REAL metrics (Meta insights + the CRM-
 * grounded lead-quality score), evaluate the account's automation rules
 * ("if quality < 60 pause", "if quality > 95 budget_up 200%"…), and APPLY the
 * matched actions — with the hard server guardrail that a budget move is
 * clamped to ±15% of the current daily budget per pass, exactly the cap the
 * autonomy policy promises. Every applied action is written to the Library
 * audit log.
 *
 * Trigger explicitly (a button, a cron, or the coordinator itself). It
 * refuses to run below autonomy level 3 — the level is stored server-side
 * and management-set, so neither a client nor the model can force it.
 */
export async function POST() {
  const auth = await requireSession(MANAGEMENT_ROLES)
  if ('res' in auth) return auth.res

  const level = await getAutonomyLevel()
  if (level < 3) {
    return NextResponse.json(
      { error: 'Autopilot requires autonomy level 3 (currently ' + level + '). Set it via /api/freehold/agent/autonomy.' },
      { status: 409 },
    )
  }

  const rules = await listRules(auth.user.email)
  const enabled = rules.filter((r) => r.enabled)
  if (enabled.length === 0) return NextResponse.json({ applied: [], note: 'No enabled automation rules.' })

  const actions: Array<Record<string, unknown>> = []
  try {
    const campaigns = (await listCampaigns()).filter((c) => c.status === 'ACTIVE').slice(0, 10)
    // The wizard's per-campaign autopilot policy, persisted at launch:
    // 'off' → skip, 'approval' → record matches without mutating, 'on' → act.
    // Campaigns launched before the policy existed default to 'approval'.
    const enhanceModes = await getAutoEnhanceModes(campaigns.map((c) => c.id))

    for (const campaign of campaigns) {
      const mode = enhanceModes.get(campaign.id) ?? 'approval'
      if (mode === 'off') {
        actions.push({ campaign: campaign.name, action: 'skipped', reason: 'auto-enhancement is OFF for this campaign' })
        continue
      }
      const campaignRules = enabled.filter((r) => !r.campaignId || r.campaignId === campaign.id)
      if (campaignRules.length === 0) continue

      // REAL metrics: Meta delivery + the CRM-grounded quality score.
      const [insights, quality] = await Promise.all([
        getCampaignInsights(campaign.id).catch(() => null),
        getCampaignQuality(campaign.id, campaign.name),
      ])
      const impressions = Number(insights?.impressions ?? 0)
      const clicks = Number(insights?.clicks ?? 0)
      const spend = Number(insights?.spend ?? 0)
      const leads = (insights?.actions ?? [])
        .filter((a) => a.action_type.includes('lead'))
        .reduce((s, a) => s + Number(a.value || 0), 0)
      const metrics: RuleMetrics = {
        quality: quality.score,
        cpl: leads > 0 ? spend / leads : 0,
        leads, spend,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      }

      for (const match of evaluateRules(campaignRules, metrics)) {
        const rule = match.rule
        try {
          if (mode === 'approval' && rule.action !== 'notify') {
            // Approval mode: the match is real, the action waits for a human.
            actions.push({
              campaign: campaign.name, rule: rule.id, action: rule.action,
              metric: rule.metric, value: match.currentValue, needsApproval: true,
            })
            continue
          }
          if (rule.action === 'pause') {
            await updateCampaignStatus(campaign.id, 'PAUSED')
            actions.push({ campaign: campaign.name, rule: rule.id, action: 'pause', metric: rule.metric, value: match.currentValue })
          } else if (rule.action === 'resume') {
            await updateCampaignStatus(campaign.id, 'ACTIVE')
            actions.push({ campaign: campaign.name, rule: rule.id, action: 'resume', metric: rule.metric, value: match.currentValue })
          } else if (rule.action === 'budget_up' || rule.action === 'budget_down') {
            // Budgets live on ad sets. Requested % is clamped to ±15%/pass.
            const requestedPct = Math.abs(Number(rule.actionValue ?? 10))
            const pct = Math.min(15, requestedPct) * (rule.action === 'budget_up' ? 1 : -1)
            const sets = await listAdSets(campaign.id)
            for (const set of sets) {
              const cur = set.daily_budget ? Math.round(Number(set.daily_budget) / 100) : null
              if (!cur || cur <= 0) continue
              const next = Math.max(50, Math.round(cur * (1 + pct / 100)))
              if (next === cur) continue
              await updateAdSet(set.id, { dailyBudgetAED: next })
              actions.push({
                campaign: campaign.name, rule: rule.id, action: rule.action,
                adSet: set.name, fromAED: cur, toAED: next,
                requestedPct, appliedPct: Math.abs(pct),
              })
            }
          } else {
            // 'notify' — record only; the audit note below IS the notification.
            actions.push({ campaign: campaign.name, rule: rule.id, action: 'notify', metric: rule.metric, value: match.currentValue })
          }
          await updateRule(rule.id, auth.user.email, { triggered: true }).catch(() => false)
        } catch (err) {
          actions.push({ campaign: campaign.name, rule: rule.id, error: err instanceof Error ? err.message : 'apply failed' })
        }
      }
    }
  } catch (err) {
    if (err instanceof MetaConfigError) {
      return NextResponse.json({ error: 'Meta is not connected — autopilot has nothing to optimize.' }, { status: 424 })
    }
    throw err
  }

  // The manager-visible audit record of this pass.
  if (actions.length > 0) {
    await saveLibraryItem(auth.user.email, {
      kind: 'note',
      title: `Autopilot pass — ${actions.length} action${actions.length === 1 ? '' : 's'}`,
      content: JSON.stringify(actions, null, 2).slice(0, 8000),
    }).catch(() => null)
  }

  return NextResponse.json({ applied: actions })
}
