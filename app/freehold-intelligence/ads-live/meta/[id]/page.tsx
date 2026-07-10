'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Minus, Plus, Sparkles, Pause, Play, CheckCircle2, AlertTriangle, ArrowRight, Gauge, Zap, Trash2 } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { sendToExpert } from '@/lib/freehold/expert-bus'
import type { MetaCampaign, MetaAdSet, MetaInsights } from '@/lib/meta/types'
import type { CampaignQuality } from '@/lib/freehold/campaign-quality'
import type { CampaignRule, RuleMetric, RuleOperator, RuleAction } from '@/lib/freehold/campaign-rules'

type AdSetRow = MetaAdSet & { ads?: { id: string; name: string; status: string }[] }
type Detail = { campaign: MetaCampaign; insights: MetaInsights | null; adSets: AdSetRow[]; demo?: boolean }
type Analysis = { working: string[]; blocking: string[]; actions: string[] }
type RuleMatch = { ruleId: string; name: string; metric: RuleMetric; operator: RuleOperator; threshold: number; action: RuleAction; actionValue: number | null; currentValue: number }

const fmtAED = (n: number) => `AED ${n.toLocaleString()}`
const scoreColor = (s: number) => (s >= 80 ? '#34D399' : s >= 60 ? '#D4AF37' : s >= 40 ? '#FBBF24' : '#F87171')

// Client-safe rule vocab (the shared module pulls in the DB layer, so we inline
// the option lists here and import only its TYPES).
const METRIC_OPTS: RuleMetric[] = ['quality', 'cpl', 'leads', 'spend', 'ctr']
const OP_OPTS: RuleOperator[] = ['lt', 'gt']
const ACTION_OPTS: RuleAction[] = ['pause', 'resume', 'budget_up', 'budget_down', 'notify']
const isBudgetAction = (a: RuleAction) => a === 'budget_up' || a === 'budget_down'
const selCls = 'rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-slate-100 outline-none focus:border-gold/40'

function leadsFrom(insights: MetaInsights | null): number {
  if (!insights?.actions) return 0
  return insights.actions.filter((a) => a.action_type.includes('lead')).reduce((s, a) => s + (Number(a.value) || 0), 0)
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
  const [budgetBusy, setBudgetBusy] = useState<string | null>(null)
  const [quality, setQuality] = useState<CampaignQuality | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysisText, setAnalysisText] = useState('')
  const [refineBusy, setRefineBusy] = useState(false)
  const [rules, setRules] = useState<CampaignRule[]>([])
  const [matches, setMatches] = useState<RuleMatch[] | null>(null)
  const [checking, setChecking] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [form, setForm] = useState<{ metric: RuleMetric; operator: RuleOperator; threshold: string; action: RuleAction; actionValue: string }>({
    metric: 'quality', operator: 'lt', threshold: '60', action: 'pause', actionValue: '200',
  })

  const load = useCallback(async () => {
    setLoading(true)
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

  const active = data?.campaign.status === 'ACTIVE'

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
    setChecking(true); setMatches(null)
    try {
      const res = await fetch('/api/freehold/campaign-rules/evaluate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: id, campaignName: data.campaign.name, metrics: { cpl: kpis.cpl, leads: kpis.leads, spend: kpis.spend, ctr: kpis.ctr } }),
      })
      const d = await res.json().catch(() => ({}))
      setMatches(Array.isArray(d.matches) ? d.matches : [])
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

  async function nudgeBudget(adSet: AdSetRow, dir: 'up' | 'down') {
    if (budgetBusy) return
    const current = Math.round(Number(adSet.daily_budget) / 100) || 0
    const target = nextBudget(current, dir)
    if (target === current) { toast.info(t('lm.cmd.budgetMin')); return }
    setBudgetBusy(adSet.id)
    setData((d) => d ? { ...d, adSets: d.adSets.map((a) => a.id === adSet.id ? { ...a, daily_budget: String(target * 100) } : a) } : d)
    try {
      const res = await fetch(`/api/meta/adsets/${encodeURIComponent(adSet.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dailyBudgetAED: target }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) throw new Error(d.error || 'failed')
      toast.success(t('lm.cmd.budgetUpdated', { n: target }))
    } catch {
      setData((dd) => dd ? { ...dd, adSets: dd.adSets.map((a) => a.id === adSet.id ? { ...a, daily_budget: String(current * 100) } : a) } : dd)
      toast.error(t('lm.cmd.budgetFailed'))
    } finally { setBudgetBusy(null) }
  }

  function openInExpert() {
    if (!data) return
    sendToExpert(t('lm.cmd.refinePrompt', { name: data.campaign.name }))
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

      {/* Live KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: t('lm.meta.kpi.spend'),       value: kpis.spend > 0 ? fmtAED(kpis.spend) : '—' },
          { label: t('lm.meta.col.clicks'),      value: kpis.clicks > 0 ? kpis.clicks.toLocaleString() : '—' },
          { label: t('lm.meta.kpi.impressions'), value: kpis.impressions > 0 ? kpis.impressions.toLocaleString() : '—' },
          { label: t('lm.meta.kpi.leads'),       value: kpis.leads > 0 ? String(kpis.leads) : '—', gold: kpis.leads > 0 },
          { label: t('lm.meta.kpi.cpl'),         value: kpis.cpl > 0 ? fmtAED(kpis.cpl) : '—' },
          { label: t('lm.meta.kpi.ctr'),         value: kpis.ctr > 0 ? `${kpis.ctr}%` : '—' },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-surface-2 p-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{k.label}</div>
            <div className={`mt-2 text-lg font-semibold leading-none ${k.gold ? 'text-gold' : 'text-white'}`}>{k.value}</div>
          </div>
        ))}
      </div>

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
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-100">{a.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{a.ads?.length ? `${a.ads.length} ${t('lm.cmd.adsLabel')}` : '—'}</div>
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
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

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

      {/* Refiner — real AI analysis grounded in Meta metrics + our funnel + the landing */}
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
            <button type="button" onClick={openInExpert} className="text-xs text-slate-400 transition hover:text-white">{t('lm.cmd.openInExpert')}</button>
            <button type="button" onClick={runRefine} disabled={refineBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60">
              {refineBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {refineBusy ? t('lm.cmd.refining') : t('lm.cmd.refineCta')}
            </button>
          </div>
        </div>
        {analysis && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <RefineCol icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />} title={t('lm.cmd.refineWorking')} items={analysis.working} />
            <RefineCol icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-400" />} title={t('lm.cmd.refineBlocking')} items={analysis.blocking} />
            <RefineCol icon={<ArrowRight className="h-3.5 w-3.5 text-gold" />} title={t('lm.cmd.refineActions')} items={analysis.actions} />
          </div>
        )}
        {!analysis && analysisText && (
          <p className="mt-4 whitespace-pre-wrap rounded-xl border border-line bg-surface px-4 py-3 text-sm leading-relaxed text-slate-300">{analysisText}</p>
        )}
      </section>

      {/* Automation rules — watch a metric, act. The headline: rules on the
          lead-QUALITY score, which no ad platform can offer. */}
      <section className="mt-6 rounded-2xl border border-line bg-surface-2 p-5">
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
          matches.length === 0 ? (
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3.5 py-2.5 text-xs text-emerald-200/90">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t('lm.rule.allClear')}
            </div>
          ) : (
            <div className="mt-4 space-y-2">
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
            </div>
          )
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
