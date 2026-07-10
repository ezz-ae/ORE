'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, Minus, Plus, Sparkles, Pause, Play } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { sendToExpert } from '@/lib/freehold/expert-bus'
import type { MetaCampaign, MetaAdSet, MetaInsights } from '@/lib/meta/types'

type AdSetRow = MetaAdSet & { ads?: { id: string; name: string; status: string }[] }
type Detail = { campaign: MetaCampaign; insights: MetaInsights | null; adSets: AdSetRow[]; demo?: boolean }

const fmtAED = (n: number) => `AED ${n.toLocaleString()}`

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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/meta/campaigns/${encodeURIComponent(id)}`, { cache: 'no-store' })
      if (res.status === 404) { setNotFound(true); return }
      const d = await res.json()
      if (!res.ok || !d.campaign) { setNotFound(true); return }
      setData({ campaign: d.campaign, insights: d.insights ?? null, adSets: Array.isArray(d.adSets) ? d.adSets : [], demo: !!d.demo })
    } catch { setNotFound(true) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { if (id) load() }, [id, load])

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

  async function toggleStatus() {
    if (!data || statusBusy) return
    const next = active ? 'PAUSED' : 'ACTIVE'
    setStatusBusy(true)
    // Optimistic — reflect the intent instantly, revert on failure.
    setData((d) => (d ? { ...d, campaign: { ...d.campaign, status: next } } : d))
    try {
      const res = await fetch(`/api/meta/campaigns/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || d.error) throw new Error(d.error || 'failed')
      toast.success(t('lm.cmd.statusUpdated'))
    } catch {
      setData((d) => (d ? { ...d, campaign: { ...d.campaign, status: active ? 'ACTIVE' : 'PAUSED' } } : d))
      toast.error(t('lm.cmd.statusFailed'))
    } finally { setStatusBusy(false) }
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

  function refine() {
    if (!data) return
    sendToExpert(t('lm.cmd.refinePrompt', { name: data.campaign.name }))
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

      {/* Refiner — ask the single docked Expert to analyse this campaign (incl. the landing) */}
      <section className="mt-8 overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.08] via-gold/[0.02] to-transparent p-5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg border border-gold/25 bg-gold/10"><Sparkles className="h-4 w-4 text-gold" /></div>
          <div>
            <div className="text-sm font-semibold text-white">{t('lm.cmd.refineTitle')}</div>
            <div className="text-xs text-slate-400">{t('lm.cmd.refineSubtitle')}</div>
          </div>
        </div>
        <button type="button" onClick={refine}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90">
          <Sparkles className="h-4 w-4" /> {t('lm.cmd.refineCta')}
        </button>
      </section>
    </div>
  )
}
