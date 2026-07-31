import { listRules, updateRule, evaluateRules, type RuleMetrics } from '@/lib/freehold/campaign-rules'
import { getCampaignQuality } from '@/lib/freehold/campaign-quality'
import {
  listCampaigns, getCampaignInsights, updateCampaignStatus,
  listAdSets, updateAdSet,
} from '@/lib/meta/client'
import { getAutoEnhanceModes } from '@/lib/meta/campaign-prefs'
import { saveLibraryItem } from '@/lib/freehold/library'
import { metaLeadCount } from '@/lib/meta/lead-count'

/**
 * AUTOPILOT PASS (Autonomy Level 3) — one optimization pass over the live
 * account, acting as `email` (rules, audit log and rule-trigger bookkeeping
 * are all owner-scoped). Shared by the manual trigger
 * (POST /api/freehold/agent/autopilot) and the nightly cron
 * (GET /api/cron/autopilot).
 *
 * For each ACTIVE campaign: compute REAL metrics (Meta insights + the CRM-
 * grounded lead-quality score), evaluate the account's automation rules
 * ("if quality < 60 pause", "if quality > 95 budget_up 200%"…), and APPLY the
 * matched actions — with the hard server guardrail that a budget move is
 * clamped to ±15% of the current daily budget per pass, exactly the cap the
 * autonomy policy promises. Every applied action is written to the Library
 * audit log. Callers gate on autonomy level 3 BEFORE calling; MetaConfigError
 * propagates so each trigger renders it appropriately.
 */
export async function runAutopilotPass(email: string): Promise<{ applied: Array<Record<string, unknown>>; note?: string }> {
  const rules = await listRules(email)
  const enabled = rules.filter((r) => r.enabled)
  if (enabled.length === 0) return { applied: [], note: 'No enabled automation rules.' }

  const actions: Array<Record<string, unknown>> = []
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
    const leads = metaLeadCount(insights?.actions)
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
          // NOT marked triggered — nothing was applied yet.
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
          // actionValue is user-authored: a non-numeric value must fall back to
          // 10, never poison the math (NaN would ride through min/max/round
          // and reach the live account as an NaN budget).
          const rawPct = Number(rule.actionValue)
          const requestedPct = Number.isFinite(rawPct) ? Math.abs(rawPct) : 10
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
        await updateRule(rule.id, email, { triggered: true }).catch(() => false)
      } catch (err) {
        actions.push({ campaign: campaign.name, rule: rule.id, error: err instanceof Error ? err.message : 'apply failed' })
      }
    }
  }

  // The manager-visible audit record of this pass — readable lines, not JSON.
  if (actions.length > 0) {
    const lines = actions.map((a) => {
      const name = String(a.campaign ?? 'campaign')
      if (a.error) return `• ${name}: action failed — ${String(a.error)}`
      if (a.action === 'skipped') return `• ${name}: skipped (${String(a.reason ?? 'auto-enhancement off')})`
      if (a.needsApproval) return `• ${name}: "${String(a.action)}" matched but is WAITING FOR YOUR APPROVAL (metric ${String(a.metric)} = ${String(a.value)})`
      if (a.action === 'budget_up' || a.action === 'budget_down') {
        return `• ${name} / ${String(a.adSet ?? 'ad set')}: budget ${a.action === 'budget_up' ? 'increased' : 'decreased'} AED ${String(a.fromAED)} → AED ${String(a.toAED)} (${String(a.appliedPct)}% applied)`
      }
      if (a.action === 'pause') return `• ${name}: paused (metric ${String(a.metric)} = ${String(a.value)})`
      if (a.action === 'resume') return `• ${name}: resumed (metric ${String(a.metric)} = ${String(a.value)})`
      return `• ${name}: ${String(a.action)} (metric ${String(a.metric)} = ${String(a.value)})`
    })
    await saveLibraryItem(email, {
      kind: 'note',
      title: `Autopilot pass — ${actions.length} action${actions.length === 1 ? '' : 's'}`,
      content: `The autopilot reviewed your active campaigns and did the following:\n\n${lines.join('\n')}`.slice(0, 8000),
    }).catch(() => null)
  }

  return { applied: actions }
}
