'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Minus, Plus, Sparkles, Pause, Play, CheckCircle2, AlertTriangle, ArrowRight, Gauge, Zap, Trash2, Heart, MessageCircle, Share2, Eye, ChevronDown, Users, Pencil, X, Upload, FolderOpen, Copy, Lightbulb, RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { sendToExpert } from '@/lib/freehold/expert-bus'
import { computeOverlaps } from '@/lib/meta/audience-overlap'
import type { MetaCampaign, MetaAdSet, MetaInsights, PlacementKey, PlacementCreativeOverride } from '@/lib/meta/types'
import type { CampaignQuality } from '@/lib/freehold/campaign-quality'
import type { CampaignRule, RuleMetric, RuleOperator, RuleAction } from '@/lib/freehold/campaign-rules'
import { metaLeadCount } from '@/lib/meta/lead-count'

type AdSetRow = MetaAdSet & { ads?: { id: string; name: string; status: string }[] }
type Detail = { campaign: MetaCampaign; insights: MetaInsights | null; adSets: AdSetRow[]; demo?: boolean }
type Analysis = { working: string[]; blocking: string[]; actions: string[] }
type RuleMatch = { ruleId: string; name: string; metric: RuleMetric; operator: RuleOperator; threshold: number; action: RuleAction; actionValue: number | null; currentValue: number; pointValue: number | null }
import type { PlacementAudit } from '@/lib/freehold/placement-audit'

/** A rule the evidence could not decide yet — shown with its reason, so
 *  "nothing fired" never has to be taken on faith. */
type RuleWithheld = { ruleId: string; name: string; metric: RuleMetric; reason: string }

// AI Advisor (see /api/freehold/ads/advisor) — every value here is a real
// fetched/computed number or a real Gemini suggestion grounded in them.
type AdvisorArea = 'reach' | 'targeting' | 'placements' | 'budget' | 'creative' | 'quality'
type AdvisorAction =
  | { type: 'set_budget'; adSetId: string; dailyBudgetAED: number }
  | { type: 'pause_campaign' }
  | { type: 'resume_campaign' }
type AdvisorSuggestion = { area: AdvisorArea; title: string; detail: string; evidence: string; action?: AdvisorAction | null }
type AdvisorMetrics = {
  impressions: number; clicks: number; spend: number; leads: number; linkClicks: number | null
  ctrPct: number | null; cplAED: number | null; cpcAED: number | null; cpmAED: number | null
  dailyBudgetAED: number | null; avgDailySpendAED: number | null; spendPacePct: number | null
  daysElapsed: number | null; dateStart: string | null; dateStop: string | null
}
type AdvisorResult = { available: boolean; reason?: string; suggestions?: AdvisorSuggestion[]; metrics?: AdvisorMetrics; generatedAt?: string }

const ADVISOR_AREA_TONES: Record<AdvisorArea, string> = {
  reach: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  targeting: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
  placements: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  budget: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  creative: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  quality: 'border-gold/30 bg-gold/10 text-gold',
}

const fmtAED = (n: number) => `AED ${n.toLocaleString()}`
const scoreColor = (s: number) => (s >= 80 ? '#34D399' : s >= 60 ? '#D4AF37' : s >= 40 ? '#FBBF24' : '#F87171')
const overlapColor = (s: number) => (s >= 70 ? '#F87171' : s >= 55 ? '#FBBF24' : '#94A3B8')

// Client-safe rule vocab (the shared module pulls in the DB layer, so we inline
// the option lists here and import only its TYPES).
const METRIC_OPTS: RuleMetric[] = ['quality', 'cpl', 'leads', 'spend', 'ctr']
const OP_OPTS: RuleOperator[] = ['lt', 'gt']
const ACTION_OPTS: RuleAction[] = ['pause', 'resume', 'budget_up', 'budget_down', 'notify']
const isBudgetAction = (a: RuleAction) => a === 'budget_up' || a === 'budget_down'
const selCls = 'rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-slate-100 outline-none focus:border-gold/40'

// General link-type CTAs only — an ad whose destination is a lead form,
// WhatsApp, or a phone call keeps its real CTA automatically (see
// updateAdCreativeContent); these are what a plain landing-click ad can pick.
const EDIT_CTA_OPTIONS = ['LEARN_MORE', 'GET_QUOTE', 'SIGN_UP', 'CONTACT_US', 'BOOK_NOW', 'APPLY_NOW']
type LibImage = { id: string; title: string; url: string | null }
const PLACEMENT_KEYS: PlacementKey[] = ['igFeed', 'igStory', 'reels', 'fbFeed']

function leadsFrom(insights: MetaInsights | null): number {
  return metaLeadCount(insights?.actions)
}

// Budget nudge scales with the current budget (±20%, rounded to AED 10, floor 50)
// so the control stays meaningful whether the ad set spends 100 or 5,000 a day.
function nextBudget(current: number, dir: 'up' | 'down'): number {
  const factor = dir === 'up' ? 1.2 : 0.8
  return Math.max(50, Math.round((current * factor) / 10) * 10)
}

export default function CampaignCommandPage() {
  const t = useT()
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [data, setData] = useState<Detail | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)
  // One id at a time: two simultaneous status writes to the same campaign is
  // a race whose loser silently reverts the winner.
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const [openAds, setOpenAds] = useState<Set<string>>(new Set())
  const toggleAds = (id: string) => setOpenAds((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const [budgetBusy, setBudgetBusy] = useState<string | null>(null)
  const [quality, setQuality] = useState<CampaignQuality | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysisText, setAnalysisText] = useState('')
  const [refineBusy, setRefineBusy] = useState(false)
  // LITE: on phones the AI panel body is folded — daily use is one Analyse tap.
  const [aiOpen, setAiOpen] = useState(false)
  // LITE: phones show only the daily essentials (switch · results · AI); ad-set
  // budgets, previews, overlap and rules fold behind one disclosure.
  const [moreOpen, setMoreOpen] = useState(false)
  const [rules, setRules] = useState<CampaignRule[]>([])
  const [matches, setMatches] = useState<RuleMatch[] | null>(null)
  const [withheld, setWithheld] = useState<RuleWithheld[]>([])

  // WHERE THE MONEY WENT. The campaign rollup cannot distinguish "this
  // audience is weak" from "most of these impressions went to overflow
  // inventory" or "Stories cropped the ad" — all three read as one blended
  // number. Placements are one of the few things Meta still lets an
  // advertiser control outright, so the breakdown is worth its own call.
  const [placements, setPlacements] = useState<PlacementAudit | null>(null)
  const [placementsAvailable, setPlacementsAvailable] = useState(true)
  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetch(`/api/freehold/ads/placements?campaignId=${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        setPlacements(d.audit ?? null)
        setPlacementsAvailable(d.available !== false)
      })
      .catch(() => { /* panel simply does not render */ })
    return () => { cancelled = true }
  }, [id])
  const [checking, setChecking] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [form, setForm] = useState<{ metric: RuleMetric; operator: RuleOperator; threshold: string; action: RuleAction; actionValue: string }>({
    metric: 'quality', operator: 'lt', threshold: '60', action: 'pause', actionValue: '200',
  })
  const [advisor, setAdvisor] = useState<AdvisorResult | null>(null)
  const [advisorBusy, setAdvisorBusy] = useState(false)
  const [advisorError, setAdvisorError] = useState(false)
  const [advisorAutoRan, setAdvisorAutoRan] = useState(false)
  const [advisorApplying, setAdvisorApplying] = useState<number | null>(null)
  const [syncBusy, setSyncBusy] = useState(false)

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    // silent = refresh in place (Sync / after an accepted advisor action)
    // without flashing the whole page back to its loading spinner.
    if (!opts?.silent) setLoading(true)
    try {
      const res = await fetch(`/api/meta/campaigns/${encodeURIComponent(id)}`, { cache: 'no-store' })
      if (res.status === 404) { setNotFound(true); return }
      const d = await res.json()
      if (!res.ok || !d.campaign) { setNotFound(true); return }
      setData({ campaign: d.campaign, insights: d.insights ?? null, adSets: Array.isArray(d.adSets) ? d.adSets : [], demo: !!d.demo })
      // Lead-quality is computed from OUR CRM funnel (independent of Meta's connection).
      fetch(`/api/freehold/ads/campaign-quality?id=${encodeURIComponent(id)}&name=${encodeURIComponent(String(d.campaign.name ?? ''))}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null)).then((q) => { if (q?.quality) setQuality(q.quality) }).catch(() => {})
    } catch { setNotFound(true) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { if (id) load() }, [id, load])
  useEffect(() => {
    if (!id) return
    fetch(`/api/freehold/campaign-rules?campaignId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (Array.isArray(d?.rules)) setRules(d.rules) }).catch(() => {})
  }, [id])

  const kpis = useMemo(() => {
    const ins = data?.insights
    const spend = Number(ins?.spend) || 0
    const impressions = Number(ins?.impressions) || 0
    const clicks = Number(ins?.clicks) || 0
    const leads = leadsFrom(ins ?? null)
    return {
      spend, impressions, clicks, leads,
      cpl: leads > 0 ? Math.round((spend / leads) * 10) / 10 : 0,
      ctr: impressions > 0 ? Math.round((clicks / impressions) * 1000) / 10 : 0,
    }
  }, [data])

  const overlaps = useMemo(() => (data ? computeOverlaps(data.adSets) : []), [data])
  const active = data?.campaign.status === 'ACTIVE'

  // ── AI Advisor ──────────────────────────────────────────────────────────────
  const campaignName = data?.campaign.name ?? ''
  const runAdvisor = useCallback(async () => {
    if (!id) return
    setAdvisorBusy(true); setAdvisorError(false)
    try {
      const res = await fetch('/api/freehold/ads/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: id, campaignName }),
      })
      const d = (await res.json().catch(() => null)) as AdvisorResult | null
      if (!res.ok || !d || typeof d.available !== 'boolean') { setAdvisor(null); setAdvisorError(true); return }
      setAdvisor(d)
    } catch { setAdvisor(null); setAdvisorError(true) } finally { setAdvisorBusy(false) }
  }, [id, campaignName])

  // Auto-run once on load — only for ACTIVE (delivering) campaigns; a demo
  // campaign has no live Meta data so the button stays manual there.
  useEffect(() => {
    if (!data || data.demo || data.campaign.status !== 'ACTIVE' || advisorAutoRan) return
    setAdvisorAutoRan(true)
    runAdvisor()
  }, [data, advisorAutoRan, runAdvisor])

  // Accept a suggestion's validated action through the page's EXISTING
  // mutation handlers (setStatus / setAdSetBudget) — no new write path.
  async function acceptSuggestion(s: AdvisorSuggestion, idx: number) {
    const act = s.action
    if (!act || advisorApplying !== null) return
    setAdvisorApplying(idx)
    try {
      let ok = false
      if (act.type === 'pause_campaign') ok = await setStatus('PAUSED')
      else if (act.type === 'resume_campaign') ok = await setStatus('ACTIVE')
      else if (act.type === 'set_budget') {
        const adSet = data?.adSets.find((a) => a.id === act.adSetId)
        if (adSet) ok = await setAdSetBudget(adSet, act.dailyBudgetAED)
      }
      if (ok) {
        // Applied — drop the suggestion and refresh the campaign data in place.
        setAdvisor((a) => (a?.suggestions ? { ...a, suggestions: a.suggestions.filter((_, i) => i !== idx) } : a))
        await load({ silent: true })
      }
    } finally { setAdvisorApplying(null) }
  }

  // Sync: re-pull everything fresh from Meta + CRM (the page's own loader),
  // then re-run the advisor analysis on the fresh numbers.
  async function syncAdvisor() {
    if (syncBusy || advisorBusy) return
    setSyncBusy(true)
    try {
      await load({ silent: true })
      await runAdvisor()
    } finally { setSyncBusy(false) }
  }

  // The unified panel's single analyse control runs BOTH the refiner summary
  // and the advisor suggestions; each guards its own busy flag.
  function analyseAll() {
    runRefine()
    runAdvisor()
  }

  function discussSuggestion(s: AdvisorSuggestion) {
    if (!data) return
    sendToExpert(
      t('lm.cmd.advisorDiscussPrompt', {
        name: data.campaign.name,
        area: t(`lm.cmd.advisorArea.${s.area}`),
        title: s.title,
        detail: s.detail,
        evidence: s.evidence || '—',
      }),
      { kind: 'campaign', id, label: data.campaign.name, href: `/freehold-intelligence/ads-live/meta/${id}` },
    )
  }

  // Only metrics the response genuinely carries become chips — no invented rows.
  function advisorChips(m: AdvisorMetrics): { label: string; value: string }[] {
    const chips: { label: string; value: string }[] = []
    if (m.spend > 0) chips.push({ label: t('lm.meta.kpi.spend'), value: fmtAED(Math.round(m.spend)) })
    if (m.impressions > 0) chips.push({ label: t('lm.meta.kpi.impressions'), value: m.impressions.toLocaleString() })
    if (m.ctrPct !== null) chips.push({ label: t('lm.meta.kpi.ctr'), value: `${m.ctrPct}%` })
    if (m.leads > 0) chips.push({ label: t('lm.meta.kpi.leads'), value: String(m.leads) })
    if (m.cplAED !== null) chips.push({ label: t('lm.meta.kpi.cpl'), value: fmtAED(m.cplAED) })
    if (m.cpcAED !== null) chips.push({ label: t('lm.cmd.advisorKpi.cpc'), value: fmtAED(m.cpcAED) })
    if (m.dailyBudgetAED) chips.push({ label: t('lm.cmd.dailyBudget'), value: fmtAED(m.dailyBudgetAED) })
    if (m.spendPacePct !== null) chips.push({ label: t('lm.cmd.advisorPace'), value: t('lm.cmd.advisorPaceOfBudget', { pct: m.spendPacePct }) })
    return chips
  }

  async function setStatus(next: 'ACTIVE' | 'PAUSED'): Promise<boolean> {
    if (!data || statusBusy) return false
    const prev = data.campaign.status
    if (prev === next) return true
    setStatusBusy(true)
    // Optimistic — reflect the intent instantly, revert on failure.
    setData((d) => (d ? { ...d, campaign: { ...d.campaign, status: next } } : d))
    try {
      const res = await fetch(`/api/meta/campaigns/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }),
      })
      const dd = await res.json().catch(() => ({}))
      if (!res.ok || dd.error) throw new Error(dd.error || 'failed')
      toast.success(t('lm.cmd.statusUpdated'))
      return true
    } catch {
      setData((d) => (d ? { ...d, campaign: { ...d.campaign, status: prev } } : d))
      toast.error(t('lm.cmd.statusFailed'))
      return false
    } finally { setStatusBusy(false) }
  }
  function toggleStatus() { setStatus(active ? 'PAUSED' : 'ACTIVE') }

  // ── Rules ────────────────────────────────────────────────────────────────────
  async function addRule() {
    const threshold = Number(form.threshold)
    if (!Number.isFinite(threshold)) { toast.error(t('lm.rule.saveFailed')); return }
    try {
      const res = await fetch('/api/freehold/campaign-rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: id, metric: form.metric, operator: form.operator, threshold,
          action: form.action, actionValue: isBudgetAction(form.action) ? Number(form.actionValue) || 0 : null,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.rule) throw new Error()
      setRules((rs) => [d.rule, ...rs]); setShowAdd(false)
    } catch { toast.error(t('lm.rule.saveFailed')) }
  }

  function toggleRule(rule: CampaignRule) {
    setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)))
    fetch(`/api/freehold/campaign-rules/${encodeURIComponent(rule.id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !rule.enabled }),
    }).catch(() => {})
  }

  function removeRule(ruleId: string) {
    setRules((rs) => rs.filter((r) => r.id !== ruleId))
    setMatches((ms) => (ms ? ms.filter((x) => x.ruleId !== ruleId) : ms))
    fetch(`/api/freehold/campaign-rules/${encodeURIComponent(ruleId)}`, { method: 'DELETE' }).catch(() => {})
  }

  async function checkRules() {
    if (!data || checking) return
    setChecking(true); setMatches(null); setWithheld([])
    try {
      const res = await fetch('/api/freehold/campaign-rules/evaluate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // COUNTS, not rates — the server derives every rate behind the
        // minimum-evidence gate. Sending `cpl` from here is what let a
        // campaign with zero leads report a cost per lead of zero.
        body: JSON.stringify({
          campaignId: id, campaignName: data.campaign.name,
          metrics: { leads: kpis.leads, spend: kpis.spend, clicks: kpis.clicks, impressions: kpis.impressions },
        }),
      })
      const d = await res.json().catch(() => ({}))
      setMatches(Array.isArray(d.matches) ? d.matches : [])
      setWithheld(Array.isArray(d.withheld) ? d.withheld : [])
    } catch { setMatches([]) } finally { setChecking(false) }
  }

  async function applyBudgetPct(dir: 'up' | 'down', pct: number) {
    if (!data) return
    const factor = dir === 'up' ? 1 + pct / 100 : Math.max(0, 1 - pct / 100)
    for (const a of data.adSets) {
      const current = Math.round(Number(a.daily_budget) / 100) || 0
      if (!current) continue
      const target = Math.max(50, Math.round((current * factor) / 10) * 10)
      setData((d) => (d ? { ...d, adSets: d.adSets.map((x) => (x.id === a.id ? { ...x, daily_budget: String(target * 100) } : x)) } : d))
      try {
        await fetch(`/api/meta/adsets/${encodeURIComponent(a.id)}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dailyBudgetAED: target }),
        })
      } catch { /* keep going across ad sets */ }
    }
  }

  async function applyMatch(m: RuleMatch) {
    if (applyingId) return
    setApplyingId(m.ruleId)
    try {
      if (m.action === 'pause') await setStatus('PAUSED')
      else if (m.action === 'resume') await setStatus('ACTIVE')
      else if (m.action === 'budget_up') await applyBudgetPct('up', m.actionValue ?? 50)
      else if (m.action === 'budget_down') await applyBudgetPct('down', m.actionValue ?? 20)
      fetch(`/api/freehold/campaign-rules/${encodeURIComponent(m.ruleId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ triggered: true }),
      }).catch(() => {})
      toast.success(t('lm.rule.applied'))
      setMatches((ms) => (ms ? ms.filter((x) => x.ruleId !== m.ruleId) : ms))
    } finally { setApplyingId(null) }
  }

  function ruleText(r: { metric: RuleMetric; operator: RuleOperator; threshold: number; action: RuleAction; actionValue: number | null }) {
    const cond = `${t(`lm.rule.metric.${r.metric}`)} ${t(`lm.rule.op.${r.operator}`)} ${r.threshold}`
    const act = isBudgetAction(r.action) ? `${t(`lm.rule.action.${r.action}`)} ${t('lm.rule.byPct', { v: r.actionValue ?? 0 })}` : t(`lm.rule.action.${r.action}`)
    return `${cond} → ${act}`
  }

  // The ONE ad-set budget mutation path — used by the manual +/- steppers AND
  // by accepted advisor actions, so every budget change flows through the same
  // optimistic update + PATCH + revert-on-failure.
  /**
   * Turn one AD SET on or off.
   *
   * The control that was missing: the campaign could be paused and an ad set's
   * budget could be nudged, but there was no way to stop or start a single ad
   * set. Pausing the whole campaign to silence one audience takes the others
   * down with it.
   */
  async function setAdSetStatus(adSet: AdSetRow, next: 'ACTIVE' | 'PAUSED') {
    if (statusBusyId) return
    setStatusBusyId(adSet.id)
    // Optimistic, then reconciled from the server's answer — a toggle that
    // waits on a round trip feels broken even when it works.
    setData((d) => d ? { ...d, adSets: d.adSets.map((x) => x.id === adSet.id ? { ...x, status: next } : x) } : d)
    try {
      const res = await fetch(`/api/meta/adsets/${encodeURIComponent(adSet.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error()
      toast.success(next === 'ACTIVE' ? t('lm.cmd.adSetOn') : t('lm.cmd.adSetOff'))
    } catch {
      // Put the real state back rather than leave a lie on screen.
      setData((d) => d ? { ...d, adSets: d.adSets.map((x) => x.id === adSet.id ? { ...x, status: adSet.status } : x) } : d)
      toast.error(t('lm.cmd.statusFailed'))
    } finally { setStatusBusyId(null) }
  }

  /** Turn a single AD on or off, without touching its ad set's learning. */
  async function setAdStatus(adSetId: string, adId: string, current: string, next: 'ACTIVE' | 'PAUSED') {
    if (statusBusyId) return
    setStatusBusyId(adId)
    setData((d) => d ? { ...d, adSets: d.adSets.map((x) => x.id !== adSetId ? x
      : { ...x, ads: x.ads?.map((ad) => ad.id === adId ? { ...ad, status: next } : ad) }) } : d)
    try {
      const res = await fetch(`/api/meta/ads/${encodeURIComponent(adId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setData((d) => d ? { ...d, adSets: d.adSets.map((x) => x.id !== adSetId ? x
        : { ...x, ads: x.ads?.map((ad) => ad.id === adId ? { ...ad, status: current } : ad) }) } : d)
      toast.error(t('lm.cmd.statusFailed'))
    } finally { setStatusBusyId(null) }
  }

  async function setAdSetBudget(adSet: AdSetRow, target: number): Promise<boolean> {
    if (budgetBusy) return false
    const current = Math.round(Number(adSet.daily_budget) / 100) || 0
    if (target === current) return true
    setBudgetBusy(adSet.id)
    setData((d) => d ? { ...d, adSets: d.adSets.map((a) => a.id === adSet.id ? { ...a, daily_budget: String(target * 100) } : a) } : d)
    try {
      const res = await fetch(`/api/meta/adsets/${encodeURIComponent(adSet.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dailyBudgetAED: target }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) throw new Error(d.error || 'failed')
      toast.success(t('lm.cmd.budgetUpdated', { n: target }))
      return true
    } catch {
      setData((dd) => dd ? { ...dd, adSets: dd.adSets.map((a) => a.id === adSet.id ? { ...a, daily_budget: String(current * 100) } : a) } : dd)
      toast.error(t('lm.cmd.budgetFailed'))
      return false
    } finally { setBudgetBusy(null) }
  }

  async function nudgeBudget(adSet: AdSetRow, dir: 'up' | 'down') {
    if (budgetBusy) return
    const current = Math.round(Number(adSet.daily_budget) / 100) || 0
    const target = nextBudget(current, dir)
    if (target === current) { toast.info(t('lm.cmd.budgetMin')); return }
    await setAdSetBudget(adSet, target)
  }

  function openInExpert() {
    if (!data) return
    sendToExpert(t('lm.cmd.refinePrompt', { name: data.campaign.name }), {
      kind: 'campaign', id, label: data.campaign.name, href: `/freehold-intelligence/ads-live/meta/${id}`,
    })
  }

  // Plain-text dump of everything this page knows about the campaign — meant
  // to be pasted straight into an AI conversation (this app's Expert, or any
  // other tool). Only ever includes data already loaded on this page.
  function copyFullInfo() {
    if (!data) return
    const c = data.campaign
    const lines: string[] = []
    lines.push(`Meta Ads Campaign — ${c.name}`)
    lines.push(`ID: ${id}`)
    lines.push(`Status: ${active ? t('lm.cmd.live') : t('lm.cmd.paused')}`)
    if (c.objective) lines.push(`Objective: ${c.objective.replace(/_/g, ' ')}`)
    if (c.created_time) lines.push(`Created: ${new Date(c.created_time).toLocaleDateString()}`)
    lines.push('')
    lines.push('Performance')
    lines.push(`Spend: ${kpis.spend > 0 ? fmtAED(kpis.spend) : '—'}`)
    lines.push(`Impressions: ${kpis.impressions > 0 ? kpis.impressions.toLocaleString() : '—'}`)
    lines.push(`Clicks: ${kpis.clicks > 0 ? kpis.clicks.toLocaleString() : '—'}`)
    lines.push(`CTR: ${kpis.ctr > 0 ? `${kpis.ctr}%` : '—'}`)
    lines.push(`Leads: ${kpis.leads > 0 ? kpis.leads : '—'}`)
    lines.push(`Cost per lead: ${kpis.cpl > 0 ? fmtAED(kpis.cpl) : '—'}`)
    if (quality && quality.score !== null) {
      lines.push('')
      lines.push('Lead quality (CRM funnel)')
      lines.push(`Score: ${quality.score}/100`)
      lines.push(`Reached: ${quality.reached}`)
      lines.push(`Qualified: ${quality.qualified}`)
      lines.push(`Won: ${quality.won}`)
      lines.push(`Junk: ${quality.junk}`)
    }
    if (data.adSets.length > 0) {
      lines.push('')
      lines.push(`Ad sets (${data.adSets.length})`)
      for (const a of data.adSets) {
        const budget = Math.round(Number(a.daily_budget) / 100) || 0
        lines.push(`- ${a.name} — ${a.status}, daily budget ${budget > 0 ? fmtAED(budget) : '—'}, ${a.ads?.length ?? 0} ads`)
      }
    }
    const allAds = data.adSets.flatMap((a) => a.ads ?? [])
    if (allAds.length > 0) {
      lines.push('')
      lines.push(`Ads (${allAds.length})`)
      for (const ad of allAds) lines.push(`- ${ad.name} — ${ad.status}`)
    }
    const enabledRules = rules.filter((r) => r.enabled)
    if (enabledRules.length > 0) {
      lines.push('')
      lines.push(`Active rules (${enabledRules.length})`)
      for (const r of enabledRules) lines.push(`- ${ruleText(r)}`)
    }
    navigator.clipboard?.writeText(lines.join('\n'))
    toast.success(t('lm.cmd.copyInfoOk'))
  }

  async function runRefine() {
    if (!data || refineBusy) return
    setRefineBusy(true); setAnalysis(null); setAnalysisText('')
    try {
      const res = await fetch('/api/freehold/ads/refine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignName: data.campaign.name,
          objective: data.campaign.objective,
          metrics: kpis,
          quality: quality ? { score: quality.score, attributed: quality.attributed, reached: quality.reached, qualified: quality.qualified, won: quality.won, junk: quality.junk } : undefined,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (d.analysis) setAnalysis(d.analysis)
      else if (d.text) setAnalysisText(String(d.text))
      else toast.error(t('lm.cmd.refineFailed'))
    } catch { toast.error(t('lm.cmd.refineFailed')) } finally { setRefineBusy(false) }
  }

  if (loading) return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
  )
  if (notFound || !data) return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-sm text-slate-400">{t('lm.cmd.notFound')}</p>
      <Link href="/freehold-intelligence/ads-live/meta" className="text-sm text-gold hover:opacity-80">{t('lm.cmd.back')}</Link>
    </div>
  )

  const c = data.campaign
  const ads = data.adSets.flatMap((a) => a.ads ?? [])

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
      <Link href="/freehold-intelligence/ads-live/meta" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t('lm.cmd.back')}
      </Link>

      {/* Command header: name + the VISUAL pause control (the status IS the control) */}
      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-slate-100">{c.name}</h1>
          <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{c.objective?.replace(/_/g, ' ') || ''}</p>
        </div>

        <button
          type="button" onClick={toggleStatus} disabled={statusBusy}
          aria-label={active ? t('lm.cmd.pauseAction') : t('lm.cmd.resumeAction')}
          className="group flex shrink-0 items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-start transition hover:border-white/20 disabled:opacity-70"
        >
          <span className="relative grid h-11 w-11 place-items-center rounded-full"
            style={{ background: active ? 'rgba(52,211,153,0.14)' : 'rgba(148,163,184,0.12)' }}>
            {active && <span className="absolute inset-0 rounded-full bg-emerald-400/20 motion-safe:animate-ping" />}
            <span className="relative grid h-11 w-11 place-items-center rounded-full">
              {statusBusy
                ? <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
                : active ? <Pause className="h-4 w-4 text-emerald-300" /> : <Play className="h-4 w-4 text-slate-300" />}
            </span>
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: active ? '#6EE7B7' : '#CBD5E1' }}>
              <span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]' : 'bg-slate-500'}`} />
              {active ? t('lm.cmd.live') : t('lm.cmd.paused')}
            </span>
            <span className="mt-0.5 block text-[11px] text-slate-500">{active ? t('lm.cmd.statusHintLive') : t('lm.cmd.statusHintPaused')}</span>
          </span>
        </button>
      </div>

      {data.demo && (
        <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-2.5 text-[12px] leading-snug text-amber-200/90">
          {t('lm.cmd.demoNote')}
        </div>
      )}

      {/* Live KPIs — phones keep the daily trio (spend · leads · CPL) */}
      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
        {[
          { label: t('lm.meta.kpi.spend'),       value: kpis.spend > 0 ? fmtAED(kpis.spend) : '—' },
          { label: t('lm.meta.col.clicks'),      value: kpis.clicks > 0 ? kpis.clicks.toLocaleString() : '—', lite: false },
          { label: t('lm.meta.kpi.impressions'), value: kpis.impressions > 0 ? kpis.impressions.toLocaleString() : '—', lite: false },
          { label: t('lm.meta.kpi.leads'),       value: kpis.leads > 0 ? String(kpis.leads) : '—', gold: kpis.leads > 0 },
          { label: t('lm.meta.kpi.cpl'),         value: kpis.cpl > 0 ? fmtAED(kpis.cpl) : '—' },
          { label: t('lm.meta.kpi.ctr'),         value: kpis.ctr > 0 ? `${kpis.ctr}%` : '—', lite: false },
        ].map((k) => (
          <div key={k.label} className={`rounded-2xl border border-line bg-surface-2 p-3 sm:p-4 ${k.lite === false ? 'max-md:hidden' : ''}`}>
            <div className="truncate text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{k.label}</div>
            <div className={`mt-2 truncate text-lg font-semibold leading-none ${k.gold ? 'text-gold' : 'text-white'}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* LITE: one disclosure for everything beyond the daily essentials */}
      <button
        type="button"
        onClick={() => setMoreOpen((v) => !v)}
        className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:text-white md:hidden"
      >
        {moreOpen ? t('lm.cmd.moreControlsHide') : t('lm.cmd.moreControls')}
        <ChevronDown className={`h-3.5 w-3.5 transition ${moreOpen ? 'rotate-180' : ''}`} />
      </button>

      <div className={moreOpen ? '' : 'max-md:hidden'}>
      {/* Placement truth — off-platform share, drains, cropped creative */}
      {placements && placements.readings.length > 0 && (
        <section className="mt-8 rounded-2xl border border-line bg-surface-2 p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('lm.place.title')}</div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{placements.headline}</p>
          <div className="mt-3 divide-y divide-white/[0.05] overflow-hidden rounded-xl border border-line bg-surface">
            {placements.readings.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs">
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                  r.verdict === 'drain' ? 'border-red-400/30 bg-red-400/10 text-red-300'
                  : r.verdict === 'mismatch' ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
                  : r.verdict === 'strong' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                  : 'border-line bg-surface-2 text-slate-500'}`}>
                  {t(`lm.place.verdict.${r.verdict}`)}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-200">{r.name}</span>
                <span className="shrink-0 text-slate-400">{Math.round(r.impressionShare * 100)}% {t('lm.place.ofImpressions')}</span>
                <span className="shrink-0 text-slate-400">{Math.round(r.spendShare * 100)}% {t('lm.place.ofSpend')}</span>
                <span className="shrink-0 text-slate-500">{r.cpm !== null ? `CPM ${r.cpm.toFixed(2)}` : '—'}</span>
                <span className="shrink-0 text-slate-300">{r.lpm !== null ? `${Math.round(r.lpm)}/M` : '—'}</span>
              </div>
            ))}
          </div>
          {placements.cut.length > 0 && (
            <ul className="mt-3 space-y-1">
              {placements.cut.map((r) => (
                <li key={`cut-${r.id}`} className="text-[11px] leading-relaxed text-amber-100/85">· {r.sentence}</li>
              ))}
            </ul>
          )}
          {/* Read-only by design: excluding a placement is a real spend
              decision and stays an explicit act in the ad set. */}
          <p className="mt-3 text-xs leading-relaxed text-slate-400">{placements.recommendation}</p>
        </section>
      )}
      {!placementsAvailable && (
        <section className="mt-8 rounded-2xl border border-line bg-surface-2 px-5 py-4">
          <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('lm.place.title')}</div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{t('lm.place.unavailable')}</p>
        </section>
      )}

      {/* Designs — which one brings the leads. Money follows the winner. */}
      <DesignsBlock campaignId={id} />

      {/* Ad sets + budget steppers */}
      <section className="mt-8">
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-400">{t('lm.cmd.adSets')}</div>
        {data.adSets.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface-2 px-5 py-5 text-sm text-slate-400">{t('lm.cmd.noAdSets')}</div>
        ) : (
          <div className="space-y-2.5">
            {data.adSets.map((a) => {
              const budget = Math.round(Number(a.daily_budget) / 100) || 0
              const busy = budgetBusy === a.id
              const adSetLive = a.status === 'ACTIVE'
              const adsOpen = openAds.has(a.id)
              return (
                <div key={a.id} className="rounded-2xl border border-line bg-surface-2 px-4 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {/* The state, stated. Without it a toggle is a guess. */}
                        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          adSetLive ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                                    : 'border-line bg-surface text-slate-500'}`}>
                          {adSetLive ? t('lm.cmd.live') : t('lm.cmd.paused')}
                        </span>
                        <div className="truncate text-sm font-semibold text-slate-100">{a.name}</div>
                      </div>
                      {a.ads?.length ? (
                        <button type="button" onClick={() => toggleAds(a.id)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500 transition hover:text-slate-300">
                          {a.ads.length} {t('lm.cmd.adsLabel')}
                          <ChevronDown className={`h-3 w-3 transition ${adsOpen ? 'rotate-180' : ''}`} />
                        </button>
                      ) : <div className="mt-0.5 text-[11px] text-slate-500">—</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-end">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">{t('lm.cmd.dailyBudget')}</div>
                        <div className="text-sm font-semibold text-white">{budget > 0 ? fmtAED(budget) : '—'}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => nudgeBudget(a, 'down')} disabled={busy || budget <= 50} aria-label={t('lm.cmd.budgetDown')}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-slate-300 transition hover:border-gold/30 hover:text-white disabled:opacity-40">
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => nudgeBudget(a, 'up')} disabled={busy} aria-label={t('lm.cmd.budgetUp')}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-line text-slate-300 transition hover:border-gold/30 hover:text-white disabled:opacity-40">
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      {/* THE CONTROL THAT WAS MISSING — turn this ad set on or off. */}
                      <button type="button"
                        onClick={() => setAdSetStatus(a, adSetLive ? 'PAUSED' : 'ACTIVE')}
                        disabled={statusBusyId !== null}
                        title={adSetLive ? t('lm.cmd.turnOff') : t('lm.cmd.turnOn')}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition disabled:opacity-40 ${
                          adSetLive ? 'border-line-strong bg-surface text-slate-200 hover:border-red-400/40 hover:text-red-200'
                                    : 'border-gold/40 bg-gold/15 text-gold hover:bg-gold/25'}`}>
                        {statusBusyId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : adSetLive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        {adSetLive ? t('lm.cmd.turnOff') : t('lm.cmd.turnOn')}
                      </button>
                    </div>
                  </div>

                  {/* Per-AD control. Pausing an ad set to stop one bad creative
                      throws away the ad set's learning with it. */}
                  {adsOpen && a.ads?.length ? (
                    <div className="mt-3 divide-y divide-white/[0.05] rounded-xl border border-line bg-surface">
                      {a.ads.map((ad) => {
                        const adLive = ad.status === 'ACTIVE'
                        return (
                          <div key={ad.id} className="flex items-center gap-3 px-3.5 py-2">
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${adLive ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                            <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{ad.name}</span>
                            <button type="button"
                              onClick={() => setAdStatus(a.id, ad.id, ad.status, adLive ? 'PAUSED' : 'ACTIVE')}
                              disabled={statusBusyId !== null}
                              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-[10px] font-semibold text-slate-300 transition hover:border-gold/30 hover:text-white disabled:opacity-40">
                              {statusBusyId === ad.id ? <Loader2 className="h-3 w-3 animate-spin" />
                                : adLive ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                              {adLive ? t('lm.cmd.turnOff') : t('lm.cmd.turnOn')}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Real ad previews (Meta-rendered, across placements) + live post engagement */}
      {ads.length > 0 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-slate-400">
            <Eye className="h-3.5 w-3.5" /> {t('lm.cmd.previewTitle')}
          </div>
          <div className="space-y-2.5">
            {ads.map((ad) => <AdPreviewCard key={ad.id} ad={ad} />)}
          </div>
        </section>
      )}

      {/* Audience overlap — which ad sets may be competing (estimated from targeting) */}
      {data.adSets.length >= 2 && (
        <section className="mt-8 rounded-2xl border border-line bg-surface-2 p-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-gold/25 bg-gold/10"><Users className="h-4 w-4 text-gold" /></div>
            <div>
              <div className="text-sm font-semibold text-white">{t('lm.cmd.overlapTitle')}</div>
              <div className="text-xs text-slate-400">{t('lm.cmd.overlapSub')}</div>
            </div>
          </div>
          {overlaps.length === 0 ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3.5 py-2.5 text-xs text-emerald-200/90">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t('lm.cmd.overlapNone')}
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {overlaps.map((o) => (
                <div key={`${o.aId}-${o.bId}`} className="rounded-xl border border-line bg-surface p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-100">
                      <span className="truncate">{o.aName}</span><span className="text-slate-500">⇄</span><span className="truncate">{o.bName}</span>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: `${overlapColor(o.score)}22`, color: overlapColor(o.score) }}>
                      {o.score}%{o.score >= 70 ? ` · ${t('lm.cmd.overlapCompeting')}` : ''}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full" style={{ width: `${o.score}%`, background: overlapColor(o.score) }} />
                  </div>
                  {(o.countries.length > 0 || o.interests.length > 0 || o.ageOverlap) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {o.countries.map((c) => <span key={c} className="rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 text-[10px] text-slate-400">{c}</span>)}
                      {o.interests.map((i) => <span key={i} className="rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 text-[10px] text-slate-400">{i}</span>)}
                      {o.ageOverlap && <span className="rounded-full border border-line-strong bg-surface-2 px-2 py-0.5 text-[10px] text-slate-400">{t('lm.cmd.overlapAge')}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
      </div>

      {/* Live lead-quality — computed from OUR CRM funnel, not Meta */}
      <section className="mt-8 rounded-2xl border border-line bg-surface-2 p-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-gold/25 bg-gold/10"><Gauge className="h-4 w-4 text-gold" /></div>
          <div>
            <div className="text-sm font-semibold text-white">{t('lm.cmd.qualityTitle')}</div>
            <div className="text-xs text-slate-400">{t('lm.cmd.qualitySub')}</div>
          </div>
        </div>
        {quality && quality.score !== null ? (
          <>
            <div className="mt-4 flex items-center gap-4">
              <div className="text-4xl font-bold leading-none tabular-nums" style={{ color: scoreColor(quality.score) }}>{quality.score}</div>
              <div className="min-w-0 flex-1">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full transition-all" style={{ width: `${quality.score}%`, background: scoreColor(quality.score) }} />
                </div>
                <div className="mt-1.5 text-[11px] text-slate-500">{t('lm.cmd.attributedLeads', { n: quality.attributed })}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                { key: 'fReached', v: quality.reached, pct: quality.funnel.find((f) => f.key === 'reached')?.pct ?? 0 },
                { key: 'fQualified', v: quality.qualified, pct: quality.funnel.find((f) => f.key === 'qualified')?.pct ?? 0 },
                { key: 'fWon', v: quality.won, pct: quality.funnel.find((f) => f.key === 'won')?.pct ?? 0, tone: 'gold' as const },
                { key: 'fJunk', v: quality.junk, pct: quality.funnel.find((f) => f.key === 'junk')?.pct ?? 0, tone: 'warn' as const },
              ].map((f) => (
                <div key={f.key} className="rounded-xl border border-line bg-surface px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">{t(`lm.cmd.${f.key}`)}</div>
                  <div className={`mt-1 text-base font-semibold ${f.tone === 'warn' ? 'text-amber-300' : f.tone === 'gold' ? 'text-gold' : 'text-white'}`}>
                    {f.v} <span className="text-[11px] font-normal text-slate-500">· {f.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="mt-4 text-sm text-slate-400">{t('lm.cmd.qualityNone')}</p>
        )}
      </section>

      {/* Unified AI panel — the Refiner's working/blocking summary PLUS the
          Advisor's area-tagged, evidence-cited suggestions (with safe one-click
          actions where the numbers justify one). One AI card, not two. */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.08] via-gold/[0.02] to-transparent p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-gold/25 bg-gold/10"><Sparkles className="h-4 w-4 text-gold" /></div>
            <div>
              <div className="text-sm font-semibold text-white">{t('lm.cmd.refineTitle')}</div>
              <div className="text-xs text-slate-400">{t('lm.cmd.refineSubtitle')}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setAiOpen((v) => !v)}
              className="rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-xs font-semibold text-slate-200 md:hidden">
              {t('lm.cmd.aiDetails')}
            </button>
            <button type="button" onClick={copyFullInfo} className="hidden items-center gap-1.5 text-xs text-slate-400 transition hover:text-white md:inline-flex">
              <Copy className="h-3.5 w-3.5" /> {t('lm.cmd.copyInfo')}
            </button>
            <button type="button" onClick={openInExpert} className="hidden text-xs text-slate-400 transition hover:text-white md:inline">{t('lm.cmd.openInExpert')}</button>
            <button type="button" onClick={syncAdvisor} disabled={syncBusy || advisorBusy}
              className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 text-gold ${syncBusy ? 'animate-spin' : ''}`} /> {syncBusy ? t('lm.cmd.advisorSyncing') : t('lm.cmd.advisorSync')}
            </button>
            <button type="button" onClick={analyseAll} disabled={refineBusy || advisorBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60">
              {refineBusy || advisorBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {refineBusy || advisorBusy ? t('lm.cmd.refining') : t('lm.cmd.refineCta')}
            </button>
          </div>
        </div>

        {/* Folded on phones until Details or a fresh analysis opens it. */}
        <div className={aiOpen || analysis || analysisText ? '' : 'hidden md:block'}>
        {/* The REAL computed metrics the advisor's suggestions are grounded in. */}
        {advisor?.metrics && advisorChips(advisor.metrics).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {advisorChips(advisor.metrics).map((k) => (
              <div key={k.label} className="rounded-lg border border-line bg-surface px-2.5 py-1.5">
                <span className="text-[10px] uppercase tracking-wider text-slate-500">{k.label}</span>
                <span className="ms-2 text-xs font-semibold text-white">{k.value}</span>
              </div>
            ))}
          </div>
        )}

        {analysis && (
          <div className={`mt-4 grid gap-3 ${advisor?.available && (advisor.suggestions?.length ?? 0) > 0 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            <RefineCol icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />} title={t('lm.cmd.refineWorking')} items={analysis.working} />
            <RefineCol icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-400" />} title={t('lm.cmd.refineBlocking')} items={analysis.blocking} />
            {/* The plain-string actions column is replaced by the richer
                advisor suggestions below whenever those are available. */}
            {!(advisor?.available && (advisor.suggestions?.length ?? 0) > 0) && (
              <RefineCol icon={<ArrowRight className="h-3.5 w-3.5 text-gold" />} title={t('lm.cmd.refineActions')} items={analysis.actions} />
            )}
          </div>
        )}
        {!analysis && analysisText && (
          <p className="mt-4 whitespace-pre-wrap rounded-xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-slate-300">{analysisText}</p>
        )}

        {/* Advisor — honest states only; never fabricated advice. */}
        {advisorError && !advisorBusy && (
          <p className="mt-4 text-sm text-rose-300">{t('lm.cmd.advisorFailed')}</p>
        )}
        {advisor && !advisor.available && !advisorBusy && (
          <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-slate-400">
            {advisor.reason === 'not_connected' ? t('lm.cmd.advisorNotConnected')
              : advisor.reason === 'no_delivery' ? t('lm.cmd.advisorNoData')
              : advisor.reason === 'no_ai_key' ? t('lm.cmd.advisorNoKey')
              : t('lm.cmd.advisorAiError')}
          </p>
        )}
        {advisor?.available && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              <Lightbulb className="h-3.5 w-3.5 text-gold" /> {t('lm.cmd.advisorSuggestions')}
            </div>
            {(advisor.suggestions?.length ?? 0) === 0 ? (
              <p className="text-sm text-slate-400">{t('lm.cmd.advisorEmpty')}</p>
            ) : (
              <div className="space-y-2.5">
                {(advisor.suggestions ?? []).map((s, i) => (
                  <div key={`${s.area}-${i}`} className="rounded-xl border border-line bg-surface p-3.5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ADVISOR_AREA_TONES[s.area]}`}>
                            {t(`lm.cmd.advisorArea.${s.area}`)}
                          </span>
                          <span dir="auto" className="text-sm font-semibold text-slate-100">{s.title}</span>
                        </div>
                        <p dir="auto" className="mt-1.5 text-xs leading-relaxed text-slate-300">{s.detail}</p>
                        {s.evidence && <p dir="auto" className="mt-1 text-[11px] leading-snug text-slate-500">{s.evidence}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {s.action && (
                          <button type="button" onClick={() => acceptSuggestion(s, i)} disabled={advisorApplying !== null || statusBusy || !!budgetBusy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-60">
                            {advisorApplying === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {t('lm.cmd.advisorAccept')}
                          </button>
                        )}
                        <button type="button" onClick={() => discussSuggestion(s)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition hover:border-gold/30 hover:text-white">
                          <MessageCircle className="h-3 w-3" /> {t('lm.cmd.advisorDiscuss')}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {advisor.generatedAt && (
              <p className="mt-2 text-[10px] text-slate-600">{t('lm.cmd.advisorGenerated', { time: new Date(advisor.generatedAt).toLocaleTimeString() })}</p>
            )}
          </div>
        )}
        </div>
      </section>

      {/* Automation rules — watch a metric, act. The headline: rules on the
          lead-QUALITY score, which no ad platform can offer. Part of the
          folded "more controls" group on phones. */}
      <section className={`mt-6 rounded-2xl border border-line bg-surface-2 p-5 ${moreOpen ? '' : 'max-md:hidden'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-gold/25 bg-gold/10"><Zap className="h-4 w-4 text-gold" /></div>
            <div>
              <div className="text-sm font-semibold text-white">{t('lm.rule.title')}</div>
              <div className="text-xs text-slate-400">{t('lm.rule.subtitle')}</div>
            </div>
          </div>
          <button type="button" onClick={checkRules} disabled={checking || rules.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 text-gold" />} {checking ? t('lm.rule.checking') : t('lm.rule.check')}
          </button>
        </div>

        {matches !== null && (
          <div className="mt-4 space-y-2">
            {matches.length === 0 && (
              // "All clear" only when every rule could actually be judged.
              // A rule the evidence cannot decide is not a rule that passed.
              <div className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs ${
                withheld.length > 0
                  ? 'border-line-strong bg-surface text-slate-300'
                  : 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-200/90'}`}>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {withheld.length > 0 ? t('lm.rule.noneDecided') : t('lm.rule.allClear')}
              </div>
            )}
            {matches.map((m) => (
              <div key={m.ruleId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3.5 py-2.5">
                <div className="min-w-0 text-xs text-amber-100">
                  <span className="font-semibold">{ruleText(m)}</span>
                  <span className="ms-1 text-amber-200/70">· {t('lm.rule.now', { v: m.currentValue })}</span>
                </div>
                <button type="button" onClick={() => applyMatch(m)} disabled={applyingId === m.ruleId}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-60">
                  {applyingId === m.ruleId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} {t('lm.rule.apply')}
                </button>
              </div>
            ))}
            {withheld.map((w) => (
              <div key={`held-${w.ruleId}`} className="rounded-xl border border-line bg-surface-2/60 px-3.5 py-2.5">
                <p className="text-xs font-semibold text-slate-300">{t('lm.rule.held', { name: w.name || w.metric })}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{w.reason}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-2">
          {rules.length === 0 && !showAdd ? (
            <p className="text-sm text-slate-400">{t('lm.rule.none')}</p>
          ) : rules.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5">
              <div className="min-w-0 text-xs text-slate-200">{ruleText(r)}</div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => toggleRule(r)} role="switch" aria-checked={r.enabled}
                  className={`relative h-5 w-9 rounded-full transition ${r.enabled ? 'bg-gold' : 'bg-surface-3'}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${r.enabled ? 'start-[18px]' : 'start-0.5'}`} />
                </button>
                <button type="button" onClick={() => removeRule(r.id)} title={t('lm.rule.delete')} className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition hover:bg-red-400/10 hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {showAdd ? (
          <div className="mt-3 rounded-xl border border-gold/20 bg-surface p-3.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400">{t('lm.rule.if')}</span>
              <select value={form.metric} onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as RuleMetric }))} className={selCls}>
                {METRIC_OPTS.map((m) => <option key={m} value={m}>{t(`lm.rule.metric.${m}`)}</option>)}
              </select>
              <select value={form.operator} onChange={(e) => setForm((f) => ({ ...f, operator: e.target.value as RuleOperator }))} className={selCls}>
                {OP_OPTS.map((o) => <option key={o} value={o}>{t(`lm.rule.op.${o}`)}</option>)}
              </select>
              <input type="number" value={form.threshold} onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))} className={`${selCls} w-20`} />
              <span className="text-slate-400">{t('lm.rule.then')}</span>
              <select value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value as RuleAction }))} className={selCls}>
                {ACTION_OPTS.map((a) => <option key={a} value={a}>{t(`lm.rule.action.${a}`)}</option>)}
              </select>
              {isBudgetAction(form.action) && (
                <span className="flex items-center gap-1">
                  <input type="number" value={form.actionValue} onChange={(e) => setForm((f) => ({ ...f, actionValue: e.target.value }))} className={`${selCls} w-16`} />
                  <span className="text-slate-400">%</span>
                </span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={addRule} className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90">{t('lm.rule.save')}</button>
              <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:text-white">{t('lm.rule.cancel')}</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setShowAdd(true)} className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30">
            <Plus className="h-3.5 w-3.5 text-gold" /> {t('lm.rule.add')}
          </button>
        )}
      </section>
    </div>
  )
}

function RefineCol({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">{icon} {title}</div>
      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((s, i) => <li key={i} dir="auto" className="text-xs leading-snug text-slate-300">{s}</li>)}
        </ul>
      ) : <p className="text-xs text-slate-600">—</p>}
    </div>
  )
}

// Lazily fetches the REAL Meta-rendered previews (across placements) + the live
// post engagement for one ad. The preview `body` is Meta's own iframe HTML — the
// exact markup Ads Manager renders — injected as-is; a placement Meta declines is
// simply absent (never mocked).
type AdSnapshot = {
  id: string; name: string; status: string; usesAssetFeedSpec: boolean
  destination?: string
  creative: { primaryText: string; headline: string; description: string; landingUrl: string; ctaType: string; imageUrl: string; imageHash: string } | null
}
type EditForm = { primaryText: string; headline: string; description: string; landingUrl: string; cta: string; imageUrl: string; imageHash: string }

function AdPreviewCard({ ad }: { ad: { id: string; name: string; status: string } }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pdata, setPdata] = useState<{ previews: { format: string; body: string }[]; engagement: { likes: number; comments: number; shares: number } | null; demo?: boolean } | null>(null)
  const [fmt, setFmt] = useState(0)

  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [snapshot, setSnapshot] = useState<AdSnapshot | null>(null)
  const [form, setForm] = useState<EditForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [imgBusy, setImgBusy] = useState(false)
  const [libOpen, setLibOpen] = useState(false)
  const [libImages, setLibImages] = useState<LibImage[]>([])
  const [libLoading, setLibLoading] = useState(false)

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && !pdata && !loading) {
      setLoading(true)
      try {
        const res = await fetch(`/api/meta/ads/${encodeURIComponent(ad.id)}/preview`)
        const d = await res.json().catch(() => ({}))
        setPdata({ previews: Array.isArray(d.previews) ? d.previews : [], engagement: d.engagement ?? null, demo: !!d.demo })
      } catch { setPdata({ previews: [], engagement: null }) } finally { setLoading(false) }
    }
  }

  async function toggleEdit() {
    const next = !editOpen
    setEditOpen(next)
    if (next && !snapshot && !editLoading) {
      setEditLoading(true); setEditError('')
      try {
        const res = await fetch(`/api/meta/ads/${encodeURIComponent(ad.id)}`)
        const d = await res.json().catch(() => ({}))
        if (!res.ok || !d.ad) { setEditError(d.error || t('lm.cmd.edit.loadFailed')); return }
        setSnapshot(d.ad)
        if (d.ad.creative) {
          setForm({
            primaryText: d.ad.creative.primaryText, headline: d.ad.creative.headline,
            description: d.ad.creative.description, landingUrl: d.ad.creative.landingUrl,
            cta: d.ad.creative.ctaType, imageUrl: d.ad.creative.imageUrl, imageHash: d.ad.creative.imageHash,
          })
        }
      } catch { setEditError(t('lm.cmd.edit.loadFailed')) } finally { setEditLoading(false) }
    }
  }

  function setField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  async function onUploadImage(file: File | null) {
    if (!file) return
    setImgBusy(true); setEditError('')
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error)
        r.readAsDataURL(file)
      })
      const res = await fetch('/api/meta/adimages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setEditError(d?.error || 'Image upload failed'); return }
      setForm((f) => (f ? { ...f, imageHash: d.hash, imageUrl: d.url || f.imageUrl } : f))
    } catch { setEditError('Could not read the image file') } finally { setImgBusy(false) }
  }

  async function toggleLibrary() {
    const next = !libOpen
    setLibOpen(next)
    if (next && !libImages.length && !libLoading) {
      setLibLoading(true)
      try {
        const r = await fetch('/api/freehold/library?kind=image', { cache: 'no-store' })
        const d = await r.json().catch(() => ({}))
        if (Array.isArray(d?.items)) setLibImages((d.items as LibImage[]).filter((i) => i.url))
      } finally { setLibLoading(false) }
    }
  }

  async function useLibraryImage(item: LibImage) {
    if (!item.url) return
    if (item.url.startsWith('data:')) {
      setImgBusy(true); setEditError('')
      try {
        const res = await fetch('/api/meta/adimages', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: item.url }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok || !d.hash) { setEditError(d?.error || 'Library image failed'); return }
        setForm((f) => (f ? { ...f, imageHash: d.hash, imageUrl: d.url || f.imageUrl } : f))
        setLibOpen(false)
      } finally { setImgBusy(false) }
    } else {
      setForm((f) => (f ? { ...f, imageUrl: item.url as string, imageHash: '' } : f))
      setLibOpen(false)
    }
  }

  async function save() {
    if (!form || saving) return
    setSaving(true); setEditError('')
    try {
      const res = await fetch(`/api/meta/ads/${encodeURIComponent(ad.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryText: form.primaryText, headline: form.headline, description: form.description,
          landingUrl: form.landingUrl, cta: form.cta,
          imageUrl: form.imageUrl || undefined, imageHash: form.imageHash || undefined,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) { setEditError(d.error || t('lm.cmd.edit.saveFailed')); return }
      toast.success(t('lm.cmd.edit.saved'))
      setEditOpen(false); setSnapshot(null); setForm(null)
      setPdata(null) // stale — pointed at the old creative
    } catch { setEditError(t('lm.cmd.edit.saveFailed')) } finally { setSaving(false) }
  }

  const eng = pdata?.engagement
  const preview = pdata?.previews[fmt]
  const ctaFixed = snapshot?.destination === 'whatsapp' || snapshot?.destination === 'phone'

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface-2">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
        <button type="button" onClick={toggle} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-start">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-100">{ad.name}</div>
            {eng && (
              <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3 text-rose-400" /> {eng.likes.toLocaleString()}</span>
                <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3 text-sky-400" /> {eng.comments.toLocaleString()}</span>
                <span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3 text-emerald-400" /> {eng.shares.toLocaleString()}</span>
              </div>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <button type="button" onClick={toggleEdit}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${editOpen ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line-strong text-slate-300 hover:text-white'}`}>
          <Pencil className="h-3.5 w-3.5" /> {t('lm.cmd.edit.button')}
        </button>
      </div>

      {editOpen && (
        <div className="border-t border-line p-4">
          {editLoading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}</div>
          ) : editError && !form ? (
            <p className="text-xs text-rose-300">{editError}</p>
          ) : snapshot?.usesAssetFeedSpec ? (
            <AdPlacementEditor adId={ad.id}
              onSaved={() => { setEditOpen(false); setSnapshot(null); setForm(null); setPdata(null) }} />
          ) : form ? (
            <div className="space-y-2.5">
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.headline')}</label>
                <input value={form.headline} onChange={(e) => setField('headline', e.target.value)}
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-gold/40" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.primaryText')}</label>
                <textarea rows={2} value={form.primaryText} onChange={(e) => setField('primaryText', e.target.value)}
                  className="w-full resize-none rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-gold/40" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.description')}</label>
                <input value={form.description} onChange={(e) => setField('description', e.target.value)}
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-gold/40" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.landingUrl')}</label>
                <input value={form.landingUrl} onChange={(e) => setField('landingUrl', e.target.value)}
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-gold/40" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.cta')}</label>
                <select value={form.cta} disabled={ctaFixed} onChange={(e) => setField('cta', e.target.value)}
                  className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-gold/40 disabled:opacity-50">
                  {EDIT_CTA_OPTIONS.map((c) => <option key={c} value={c}>{t(`lm.creatives.generate.cta.${c}`)}</option>)}
                </select>
                {ctaFixed && <p className="mt-1 text-[10px] text-slate-500">{t('lm.cmd.edit.ctaFixed')}</p>}
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.imageUrl')}</label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-gold/40">
                    <Upload className="h-3.5 w-3.5" /> {imgBusy ? t('lm.newCampaign.s3.upload.uploading') : t('lm.newCampaign.s3.upload.uploadImage')}
                    <input type="file" accept="image/*" className="hidden" disabled={imgBusy} onChange={(e) => onUploadImage(e.target.files?.[0] ?? null)} />
                  </label>
                  <button type="button" onClick={toggleLibrary}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${libOpen ? 'border-gold/40 bg-gold/[0.07] text-gold' : 'border-line-strong bg-surface text-slate-200 hover:border-gold/40'}`}>
                    <FolderOpen className="h-3.5 w-3.5" /> {t('lm.newCampaign.s3.pickLibrary')}
                  </button>
                  {form.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.imageUrl} alt="" className="h-9 w-14 rounded object-cover" />
                  )}
                </div>
                {libOpen && (
                  <div className="mt-2 rounded-lg border border-line bg-surface p-2">
                    {libLoading ? (
                      <p className="py-2 text-[11px] text-slate-500">{t('common.loading')}</p>
                    ) : libImages.length === 0 ? (
                      <p className="py-2 text-[11px] text-slate-500">{t('lm.newCampaign.s3.libEmpty')}</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                        {libImages.slice(0, 12).map((item) => (
                          <button key={item.id} type="button" onClick={() => useLibraryImage(item)}
                            className="overflow-hidden rounded border border-line transition hover:border-gold/50" title={item.title}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.url ?? ''} alt={item.title} className="h-10 w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {editError && <p className="text-xs text-rose-300">{editError}</p>}

              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={save} disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-gold px-3.5 py-2 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-60">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {saving ? t('lm.cmd.edit.saving') : t('lm.cmd.edit.save')}
                </button>
                <button type="button" onClick={() => setEditOpen(false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-slate-300 transition hover:text-white">
                  <X className="h-3.5 w-3.5" /> {t('lm.rule.cancel')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {open && (
        <div className="border-t border-line p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('lm.cmd.previewLoading')}</div>
          ) : pdata?.demo ? (
            <p className="text-xs text-slate-500">{t('lm.cmd.previewDemo')}</p>
          ) : pdata && pdata.previews.length > 0 ? (
            <>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {pdata.previews.map((p, i) => (
                  <button key={p.format} type="button" onClick={() => setFmt(i)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${i === fmt ? 'border border-gold/40 bg-gold/10 text-gold' : 'border border-line-strong text-slate-400 hover:text-slate-200'}`}>
                    {t(`lm.cmd.fmt.${p.format}`)}
                  </button>
                ))}
              </div>
              <div className="flex justify-center overflow-x-auto" dangerouslySetInnerHTML={{ __html: preview?.body ?? '' }} />
            </>
          ) : (
            <p className="text-xs text-slate-500">{t('lm.cmd.previewNone')}</p>
          )}
        </div>
      )}
    </div>
  )
}

type PlacementDefaultForm = { headline: string; primaryText: string; landingUrl: string; cta: string; imageUrl: string; imageHash: string }
type PlacementSlot = 'default' | PlacementKey

// Edits a live ad's PER-PLACEMENT creative — whichever placements it's
// actually customized for (see getAdPlacementCreative's decode). Same
// chip-per-placement UX as the campaign wizard's Step 3, bound to a live ad
// instead of the launch draft, so a placement's image/copy stays editable
// wherever it's displaying, not just at launch time.
function AdPlacementEditor({ adId, onSaved }: { adId: string; onSaved: () => void }) {
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [defaultForm, setDefaultForm] = useState<PlacementDefaultForm | null>(null)
  const [overrides, setOverrides] = useState<Partial<Record<PlacementKey, PlacementCreativeOverride>>>({})
  const [openKey, setOpenKey] = useState<PlacementKey | null>(null)
  const [saving, setSaving] = useState(false)
  const [imgTarget, setImgTarget] = useState<PlacementSlot | ''>('')
  const [libTarget, setLibTarget] = useState<PlacementSlot | ''>('')
  const [libImages, setLibImages] = useState<LibImage[]>([])
  const [libLoading, setLibLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    fetch(`/api/meta/ads/${encodeURIComponent(adId)}/placements`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return
        if (!ok || !d.ad || !d.ad.isPlacementCreative) { setError(d.error || t('lm.cmd.edit.notEditable')); return }
        setDefaultForm({
          headline: d.ad.default.headline, primaryText: d.ad.default.primaryText,
          landingUrl: d.ad.landingUrl, cta: d.ad.ctaType,
          imageUrl: d.ad.default.imageUrl, imageHash: d.ad.default.imageHash,
        })
        setOverrides(d.ad.overrides || {})
      })
      .catch(() => { if (!cancelled) setError(t('lm.cmd.edit.loadFailed')) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [adId, t])

  function overrideOf(key: PlacementKey): PlacementCreativeOverride { return overrides[key] ?? {} }
  function isCustomized(key: PlacementKey): boolean {
    const ov = overrideOf(key)
    return !!(ov.headline?.trim() || ov.primaryText?.trim() || ov.imageHash || ov.imageUrl)
  }
  function setOverrideField<K extends keyof PlacementCreativeOverride>(key: PlacementKey, field: K, value: PlacementCreativeOverride[K]) {
    setOverrides((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }
  function setSlotImage(slot: PlacementSlot, hash: string, url?: string) {
    if (slot === 'default') { setDefaultForm((f) => (f ? { ...f, imageHash: hash, imageUrl: url || f.imageUrl } : f)); return }
    setOverrides((prev) => ({ ...prev, [slot]: { ...prev[slot], imageHash: hash, imageUrl: url || prev[slot]?.imageUrl } }))
  }
  function clearOverride(key: PlacementKey) {
    setOverrides((prev) => { const next = { ...prev }; delete next[key]; return next })
  }

  async function onUploadImage(slot: PlacementSlot, file: File | null) {
    if (!file) return
    setImgTarget(slot); setError('')
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error)
        r.readAsDataURL(file)
      })
      const res = await fetch('/api/meta/adimages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: dataUrl }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d?.error || 'Image upload failed'); return }
      setSlotImage(slot, d.hash, d.url)
    } catch { setError('Could not read the image file') } finally { setImgTarget('') }
  }

  async function toggleLibrary(slot: PlacementSlot) {
    const next = libTarget === slot ? '' : slot
    setLibTarget(next)
    if (next && !libImages.length && !libLoading) {
      setLibLoading(true)
      try {
        const r = await fetch('/api/freehold/library?kind=image', { cache: 'no-store' })
        const d = await r.json().catch(() => ({}))
        if (Array.isArray(d?.items)) setLibImages((d.items as LibImage[]).filter((i) => i.url))
      } finally { setLibLoading(false) }
    }
  }

  async function useLibraryImage(slot: PlacementSlot, item: LibImage) {
    if (!item.url) return
    if (item.url.startsWith('data:')) {
      setImgTarget(slot); setError('')
      try {
        const res = await fetch('/api/meta/adimages', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: item.url }),
        })
        const d = await res.json().catch(() => ({}))
        if (!res.ok || !d.hash) { setError(d?.error || 'Library image failed'); return }
        setSlotImage(slot, d.hash, d.url)
        setLibTarget('')
      } finally { setImgTarget('') }
    } else {
      if (slot === 'default') setDefaultForm((f) => (f ? { ...f, imageUrl: item.url as string, imageHash: '' } : f))
      else { setOverrideField(slot, 'imageUrl', item.url as string); setOverrideField(slot, 'imageHash', '') }
      setLibTarget('')
    }
  }

  async function save() {
    if (!defaultForm || saving) return
    setSaving(true); setError('')
    try {
      const cleanOverrides = Object.fromEntries(
        (Object.entries(overrides) as Array<[PlacementKey, PlacementCreativeOverride]>)
          .filter(([, ov]) => ov && (ov.headline?.trim() || ov.primaryText?.trim() || ov.imageHash || ov.imageUrl)),
      )
      const res = await fetch(`/api/meta/ads/${encodeURIComponent(adId)}/placements`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: defaultForm.headline, primaryText: defaultForm.primaryText, landingUrl: defaultForm.landingUrl,
          cta: defaultForm.cta, imageUrl: defaultForm.imageUrl || undefined, imageHash: defaultForm.imageHash || undefined,
          overrides: cleanOverrides,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) { setError(d.error || t('lm.cmd.edit.saveFailed')); return }
      toast.success(t('lm.cmd.edit.saved'))
      onSaved()
    } catch { setError(t('lm.cmd.edit.saveFailed')) } finally { setSaving(false) }
  }

  function imageRow(slot: PlacementSlot, imageUrl: string, placeholder?: string) {
    return (
      <div>
        <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.imageUrl')}</label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-[11px] font-medium text-slate-200 transition hover:border-gold/40">
            <Upload className="h-3.5 w-3.5" /> {imgTarget === slot ? t('lm.newCampaign.s3.upload.uploading') : t('lm.newCampaign.s3.upload.uploadImage')}
            <input type="file" accept="image/*" className="hidden" disabled={!!imgTarget} onChange={(e) => onUploadImage(slot, e.target.files?.[0] ?? null)} />
          </label>
          <button type="button" onClick={() => toggleLibrary(slot)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${libTarget === slot ? 'border-gold/40 bg-gold/[0.07] text-gold' : 'border-line-strong bg-surface text-slate-200 hover:border-gold/40'}`}>
            <FolderOpen className="h-3.5 w-3.5" /> {t('lm.newCampaign.s3.pickLibrary')}
          </button>
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-9 w-14 rounded object-cover" />
          ) : placeholder ? (
            <span className="text-[11px] text-slate-500">{placeholder}</span>
          ) : null}
        </div>
        {libTarget === slot && (
          <div className="mt-2 rounded-lg border border-line bg-surface p-2">
            {libLoading ? (
              <p className="py-2 text-[11px] text-slate-500">{t('common.loading')}</p>
            ) : libImages.length === 0 ? (
              <p className="py-2 text-[11px] text-slate-500">{t('lm.newCampaign.s3.libEmpty')}</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
                {libImages.slice(0, 12).map((item) => (
                  <button key={item.id} type="button" onClick={() => useLibraryImage(slot, item)}
                    className="overflow-hidden rounded border border-line transition hover:border-gold/50" title={item.title}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url ?? ''} alt={item.title} className="h-10 w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}</div>
  if (!defaultForm) return <p className="text-xs leading-relaxed text-slate-400">{error || t('lm.cmd.edit.notEditable')}</p>

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.headline')}</label>
          <input value={defaultForm.headline} onChange={(e) => setDefaultForm((f) => (f ? { ...f, headline: e.target.value } : f))}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-gold/40" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.primaryText')}</label>
          <textarea rows={2} value={defaultForm.primaryText} onChange={(e) => setDefaultForm((f) => (f ? { ...f, primaryText: e.target.value } : f))}
            className="w-full resize-none rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-gold/40" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.landingUrl')}</label>
          <input value={defaultForm.landingUrl} onChange={(e) => setDefaultForm((f) => (f ? { ...f, landingUrl: e.target.value } : f))}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-gold/40" />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.cta')}</label>
          <select value={defaultForm.cta} onChange={(e) => setDefaultForm((f) => (f ? { ...f, cta: e.target.value } : f))}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-gold/40">
            {EDIT_CTA_OPTIONS.map((c) => <option key={c} value={c}>{t(`lm.creatives.generate.cta.${c}`)}</option>)}
          </select>
        </div>
        {imageRow('default', defaultForm.imageUrl)}
      </div>

      <div className="rounded-xl border border-line bg-surface p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('lm.newCampaign.s3.perPlacement.title')}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{t('lm.newCampaign.s3.perPlacement.hint')}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {PLACEMENT_KEYS.map((key) => {
            const open = openKey === key
            const customized = isCustomized(key)
            return (
              <button key={key} type="button" onClick={() => setOpenKey(open ? null : key)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  open ? 'border-gold/50 bg-gold/10 text-gold'
                  : customized ? 'border-emerald-400/40 bg-emerald-400/[0.06] text-emerald-300'
                  : 'border-line-strong bg-surface-2 text-slate-300 hover:text-white'}`}>
                {customized && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                {t(`lm.newCampaign.s3.pl.${key}`)}
              </button>
            )
          })}
        </div>
        {openKey && (
          <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-white">{t(`lm.newCampaign.s3.pl.${openKey}`)}</div>
              {isCustomized(openKey) && (
                <button type="button" onClick={() => clearOverride(openKey)}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 transition hover:text-rose-300">
                  <X className="h-3 w-3" /> {t('lm.newCampaign.s3.perPlacement.clear')}
                </button>
              )}
            </div>
            <div className="mt-2 space-y-2">
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.headline')}</label>
                <input value={overrideOf(openKey).headline ?? ''} onChange={(e) => setOverrideField(openKey, 'headline', e.target.value)}
                  placeholder={defaultForm.headline} className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-gold/40" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-medium text-slate-500">{t('lm.newCampaign.s3.label.primaryText')}</label>
                <textarea rows={2} value={overrideOf(openKey).primaryText ?? ''} onChange={(e) => setOverrideField(openKey, 'primaryText', e.target.value)}
                  placeholder={defaultForm.primaryText} className="w-full resize-none rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-slate-100 outline-none focus:border-gold/40" />
              </div>
              {imageRow(openKey, overrideOf(openKey).imageUrl ?? '', t('lm.newCampaign.s3.perPlacement.useDefault'))}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-rose-300">{error}</p>}

      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-gold px-3.5 py-2 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-60">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {saving ? t('lm.cmd.edit.saving') : t('lm.cmd.edit.save')}
        </button>
      </div>
    </div>
  )
}


/** The designs report: one row per ad (design) in the campaign — spend,
 *  leads, cost per lead, and a pause/resume switch. Shown only when the
 *  campaign actually has more than one design; a single-design campaign has
 *  nothing to compare. */
function DesignsBlock({ campaignId }: { campaignId: string }) {
  const t = useT()
  const [ads, setAds] = useState<Array<{ id: string; name: string; status: string; thumbnailUrl: string | null; spend: number; leads: number; cpl: number | null }>>([])
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch(`/api/meta/campaigns/${encodeURIComponent(campaignId)}/ads`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && Array.isArray(d?.ads)) setAds(d.ads) })
      .catch(() => {})
    return () => { alive = false }
  }, [campaignId])

  if (ads.length < 2) return null
  const best = ads.filter((a) => a.leads > 0).sort((a, b) => (a.cpl ?? Infinity) - (b.cpl ?? Infinity))[0]

  async function toggle(adId: string, cur: string) {
    setBusy(adId)
    const next = cur === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    try {
      const res = await fetch(`/api/meta/campaigns/${encodeURIComponent(campaignId)}/ads`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId, status: next }),
      })
      if (res.ok) setAds((xs) => xs.map((x) => (x.id === adId ? { ...x, status: next } : x)))
    } finally { setBusy(null) }
  }

  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface-2 p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{t('lm.designs.title')}</div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{t('lm.designs.sub')}</p>
      <div className="mt-3 space-y-2">
        {ads.map((a) => {
          const live = a.status === 'ACTIVE'
          const winner = best && a.id === best.id
          return (
            <div key={a.id} className={`flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-2.5 ${winner ? 'border-gold/40 bg-gold/[0.06]' : 'border-line bg-surface'}`}>
              {a.thumbnailUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={a.thumbnailUrl} alt="" className="h-9 w-14 shrink-0 rounded object-cover" />
                : <span className="h-9 w-14 shrink-0 rounded bg-surface-2" />}
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-200">{a.name}</span>
              {winner && <span className="shrink-0 rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-[10px] font-bold text-gold">{t('lm.designs.winner')}</span>}
              <span className="shrink-0 text-xs text-slate-500">{t('lm.campaignList.field.leads')} <span className="font-semibold text-gold">{a.leads}</span></span>
              <span className="shrink-0 text-xs text-slate-500">{t('lm.campaignList.field.cpl')} <span className="text-slate-300">{a.cpl != null ? `AED ${a.cpl}` : '—'}</span></span>
              <span className="shrink-0 text-xs text-slate-500">{t('lm.campaignList.field.spend')} <span className="text-slate-300">AED {a.spend.toFixed(0)}</span></span>
              <button type="button" onClick={() => void toggle(a.id, a.status)} disabled={busy === a.id}
                className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${
                  live ? 'border-line text-slate-300 hover:border-amber-400/40 hover:text-amber-300'
                       : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'}`}>
                {busy === a.id ? '…' : live ? t('lm.designs.pause') : t('lm.designs.resume')}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
