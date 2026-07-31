'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Zap, TrendingDown, TrendingUp, PlugZap, ArrowUpRight, Loader2, Pause, History, ShieldCheck, Sparkles, Check } from 'lucide-react'
import { EmptyState } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { metaLeadCount } from '@/lib/meta/lead-count'

type MachineAction = { id: string; source?: string; action: string; platform: string; campaignId?: string; campaignName: string; detail: string; createdAt: string }

// The advisor's grounded output (app/api/freehold/ads/advisor) — suggestions
// carry an optional machine-applicable action in one of three safe shapes.
type AdvisorAction =
  | { type: 'set_budget'; adSetId: string; dailyBudgetAED: number }
  | { type: 'pause_campaign' }
  | { type: 'resume_campaign' }
type AdvisorSuggestion = { area: string; title: string; detail: string; evidence: string; action?: AdvisorAction | null }
type AdvisorResult =
  | { available: true; suggestions: AdvisorSuggestion[] }
  | { available: false; reason: 'not_connected' | 'no_delivery' | 'no_ai_key' | 'ai_error' }

// Campaign optimizer — ranks the REAL campaigns by cost-per-lead and points
// budget from the least efficient to the most efficient. No seed budgets,
// no invented projections.

interface LiveCampaign {
  id: string
  name: string
  platform: 'meta' | 'google'
  running: boolean
  spendAED: number
  leads: number
  cpl: number
}

const metaLeads = (insights?: { actions?: Array<{ action_type: string; value: string }> } | null) =>
  metaLeadCount(insights?.actions)

export default function CampaignOptimizePage() {
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [campaigns, setCampaigns] = useState<LiveCampaign[]>([])

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/meta/campaigns', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/google/campaigns', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null),
    ]).then(([meta, google]) => {
      if (cancelled) return
      const rows: LiveCampaign[] = []
      if (meta && !meta.demo) {
        for (const c of meta.campaigns ?? []) {
          const spend = Number(c?.insights?.spend) || 0
          const leads = metaLeads(c?.insights)
          rows.push({ id: c.id, name: c.name, platform: 'meta', running: c.status === 'ACTIVE', spendAED: spend, leads, cpl: leads > 0 ? spend / leads : 0 })
        }
      }
      if (google && !google.demo) {
        for (const c of google.campaigns ?? []) {
          const spend = Number(c?.metrics?.costAed ?? c?.metrics?.cost) || 0
          const leads = Number(c?.metrics?.conversions ?? c?.metrics?.leads) || 0
          rows.push({ id: c.id, name: c.name, platform: 'google', running: /enabled|active|running/i.test(String(c.status ?? '')), spendAED: spend, leads, cpl: leads > 0 ? spend / leads : 0 })
        }
      }
      setConnected(Boolean((meta && !meta.demo) || (google && !google.demo)))
      setCampaigns(rows)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  // The Machine's brain: current autonomy level, whether this user may apply
  // money-moving actions, and the real log of what it has already done.
  const [autonomy, setAutonomy] = useState<1 | 2 | 3>(1)
  const [canApply, setCanApply] = useState(false)
  const [log, setLog] = useState<MachineAction[]>([])
  const [pausingId, setPausingId] = useState<string | null>(null)
  const [pausedIds, setPausedIds] = useState<string[]>([])
  const [confirmId, setConfirmId] = useState<string | null>(null)

  async function loadMachine() {
    try {
      const r = await fetch('/api/freehold/lead-machine/machine', { cache: 'no-store' })
      if (!r.ok) return
      const d = await r.json()
      if (typeof d.autonomy === 'number') setAutonomy(d.autonomy)
      setCanApply(!!d.canApply)
      if (Array.isArray(d.actions)) setLog(d.actions)
    } catch { /* leave defaults */ }
  }
  useEffect(() => { loadMachine() }, [])

  // Rank ALL spenders. A campaign burning money with ZERO leads is the worst
  // case the optimizer exists to catch — it ranks as infinite CPL (last),
  // never filtered out. Only zero-spend zero-lead rows are excluded.
  const effCpl = (c: LiveCampaign) => (c.leads > 0 ? c.cpl : c.spendAED > 0 ? Infinity : 0)
  const ranked = useMemo(
    () => [...campaigns]
      .filter((c) => (c.leads > 0 || c.spendAED > 0) && !pausedIds.includes(c.id))
      .sort((a, b) => effCpl(a) - effCpl(b)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campaigns, pausedIds],
  )
  const best = ranked[0]
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : undefined
  // The advisor works on Meta campaigns (its data plane); target the least
  // efficient one — that's where a grounded review pays most.
  const worstMeta = useMemo(() => [...ranked].reverse().find((c) => c.platform === 'meta'), [ranked])

  // The REAL AI pass: the grounded advisor (real delivery + CRM quality →
  // suggestions with safe one-click actions). Runs on the worst Meta campaign.
  const [advisorFor, setAdvisorFor] = useState<LiveCampaign | null>(null)
  const [advisorBusy, setAdvisorBusy] = useState(false)
  const [advisor, setAdvisor] = useState<AdvisorResult | null>(null)
  const [applying, setApplying] = useState<number | null>(null)
  const [appliedIdx, setAppliedIdx] = useState<number[]>([])

  async function runAdvisor(c: LiveCampaign) {
    setAdvisorBusy(true); setAdvisorFor(c); setAdvisor(null); setAppliedIdx([])
    try {
      const r = await fetch('/api/freehold/ads/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: c.id, campaignName: c.name }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d) { setAdvisor({ available: false, reason: 'ai_error' }); return }
      setAdvisor(d as AdvisorResult)
    } catch { setAdvisor({ available: false, reason: 'ai_error' }) }
    finally { setAdvisorBusy(false) }
  }

  async function applySuggestion(idx: number, s: AdvisorSuggestion) {
    if (!advisorFor || !s.action || applying !== null) return
    setApplying(idx)
    try {
      const a = s.action
      const payload = a.type === 'set_budget'
        ? { action: 'set_budget', platform: 'meta', campaignId: advisorFor.id, campaignName: advisorFor.name, adSetId: a.adSetId, dailyBudgetAED: a.dailyBudgetAED }
        : { action: a.type === 'pause_campaign' ? 'pause' : 'resume', platform: 'meta', campaignId: advisorFor.id, campaignName: advisorFor.name }
      const r = await fetch('/api/freehold/lead-machine/machine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(d.error || t('lm.adv.applyFailed')); return }
      setAppliedIdx((p) => [...p, idx])
      if (a.type === 'pause_campaign') setPausedIds((p) => [...p, advisorFor.id])
      if (a.type === 'resume_campaign') setPausedIds((p) => p.filter((x) => x !== advisorFor.id))
      toast.success(t('lm.adv.applied'))
      loadMachine()
    } catch { toast.error(t('lm.adv.applyFailed')) }
    finally { setApplying(null) }
  }

  async function pauseWorst(c: LiveCampaign) {
    setPausingId(c.id); setConfirmId(null)
    try {
      const r = await fetch('/api/freehold/lead-machine/machine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause', platform: c.platform, campaignId: c.id, campaignName: c.name }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(d.error || t('lm.machine.pauseFailed')); return }
      setPausedIds((p) => [...p, c.id])
      toast.success(t('lm.machine.paused', { name: c.name }))
      loadMachine()
    } catch { toast.error(t('lm.machine.pauseFailed')) }
    finally { setPausingId(null) }
  }

  if (!loading && !connected) {
    return (
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <Zap className="h-3.5 w-3.5" /> {t('lm.optimize.eyebrow')}
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">{t('lm.optimize.title')}</h1>
        <div className="mt-8">
          <EmptyState
            Icon={PlugZap}
            title={t('lm.live.connect.title')}
            description={t('lm.live.connect.desc')}
            action={
              <Link href="/freehold-intelligence/integrations" className="inline-flex items-center gap-2 rounded-xl border border-gold/35 bg-gold/10 px-4 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/20">
                {t('lm.live.connect.cta')} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
        <Zap className="h-3.5 w-3.5" /> {t('lm.optimize.eyebrow')}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-white">{t('lm.optimize.title')}</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-slate-300">
          <ShieldCheck className="h-3 w-3 text-emerald-400" /> {t('lm.machine.autonomy')}: {t(`lm.machine.autonomy.${autonomy}`)}
        </span>
      </div>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 rounded-2xl border border-line bg-surface px-5 py-6 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
        </div>
      ) : ranked.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface px-6 py-10 text-center">
          <p className="text-sm text-slate-400">{t('lm.optimize.noData')}</p>
          <Link href="/freehold-intelligence/lead-machine/campaigns/new" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold hover:opacity-80">
            {t('lm.live.empty.cta')} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <>
          {/* Recommendation — from the real spread, only when there IS one */}
          {best && worst && best.id !== worst.id && (
            <div className="mt-8 rounded-2xl border border-gold/20 bg-gold/[0.04] p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-gold">{t('lm.optimize.machineReco')}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                {t('lm.optimize.shiftReco', {
                  from: worst.name,
                  fromCpl: worst.leads > 0 ? worst.cpl.toFixed(0) : '∞',
                  to: best.name,
                  toCpl: best.leads > 0 ? best.cpl.toFixed(0) : '∞',
                })}
              </p>
              {/* The one real, reversible action the Machine applies: pause the
                  worst spender. Money-moving, so it's role-gated + confirmed. */}
              <div className="mt-4">
                {!canApply ? (
                  <p className="text-xs text-slate-500">{t('lm.machine.notAllowed')}</p>
                ) : confirmId === worst.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-300">{t('lm.machine.confirm')}</span>
                    <button type="button" onClick={() => pauseWorst(worst)} disabled={pausingId === worst.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-400/90 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-red-300 disabled:opacity-60">
                      {pausingId === worst.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />} {t('lm.machine.pauseCta', { name: worst.name })}
                    </button>
                    <button type="button" onClick={() => setConfirmId(null)} className="text-xs text-slate-400 hover:text-white">{t('common.cancel')}</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmId(worst.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-400/20">
                    <Pause className="h-3.5 w-3.5" /> {t('lm.machine.pauseCta', { name: worst.name })}
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-snug text-slate-500">{t('lm.machine.autopilotNote')}</p>
            </div>
          )}

          {/* The REAL AI pass — the grounded advisor, with applyable actions */}
          {worstMeta && (
            <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                    <Sparkles className="h-3.5 w-3.5 text-gold" /> {t('lm.optimize.aiRecommendations')}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-slate-500">{t('lm.adv.sub')}</p>
                </div>
                <button type="button" onClick={() => runAdvisor(worstMeta)} disabled={advisorBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gold/35 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-60">
                  {advisorBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {advisorBusy ? t('lm.adv.running') : t('lm.adv.run', { name: worstMeta.name })}
                </button>
              </div>

              {advisor && !advisor.available && (
                <p className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs text-slate-400">
                  {t(`lm.adv.unavailable.${advisor.reason}`)}
                </p>
              )}
              {advisor && advisor.available && advisor.suggestions.length === 0 && (
                <p className="mt-4 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs text-slate-400">{t('lm.adv.none')}</p>
              )}
              {advisor && advisor.available && advisor.suggestions.length > 0 && !canApply && advisor.suggestions.some((s) => s.action) && (
                <p className="mt-3 text-xs text-slate-500">{t('lm.machine.notAllowed')}</p>
              )}
              {advisor && advisor.available && advisor.suggestions.length > 0 && (
                <div className="mt-4 space-y-3">
                  {advisor.suggestions.map((s, i) => (
                    <div key={i} className="rounded-xl border border-line bg-surface-2/60 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-teal-400/25 bg-teal-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                          {t(`lm.adv.area.${s.area}`)}
                        </span>
                        <span className="text-sm font-semibold text-white">{s.title}</span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">{s.detail}</p>
                      {s.evidence && (
                        <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                          <span className="font-semibold uppercase tracking-wider">{t('lm.adv.evidence')}:</span> {s.evidence}
                        </p>
                      )}
                      {s.action && canApply && (
                        <div className="mt-3">
                          {appliedIdx.includes(i) ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                              <Check className="h-3.5 w-3.5" /> {t('lm.adv.applied')}
                            </span>
                          ) : (
                            <button type="button" onClick={() => applySuggestion(i, s)} disabled={applying !== null}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-60">
                              {applying === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                              {t('lm.adv.apply')}
                              {s.action.type === 'set_budget' ? ` — AED ${s.action.dailyBudgetAED}/d` : ''}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Efficiency ranking */}
          <section className="mt-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{t('lm.optimize.efficiencyRank')}</h2>
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {ranked.map((c, i) => (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${i === 0 ? 'bg-gold/15 text-gold' : 'bg-surface-2 text-slate-400'}`}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{c.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500 capitalize">{t('lm.optimize.rowMeta', { platform: c.platform, n: c.leads, spend: c.spendAED.toLocaleString() })}</div>
                  </div>
                  <div className={`flex shrink-0 items-center gap-1 text-sm font-semibold ${i === 0 ? 'text-emerald-400' : i === ranked.length - 1 ? 'text-red-300' : 'text-slate-300'}`}>
                    {i === 0 ? <TrendingDown className="h-3.5 w-3.5" /> : i === ranked.length - 1 ? <TrendingUp className="h-3.5 w-3.5" /> : null}
                    {c.leads > 0 ? `AED ${c.cpl.toFixed(0)}` : t('lm.optimize.zeroLeads')}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/freehold-intelligence/lead-machine/campaigns/attribution" className="inline-flex items-center gap-1 text-sm text-gold/70 transition hover:text-gold">
              {t('lm.optimize.fullAttribution')} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* What the Machine actually did — real, append-only history */}
          <section className="mt-10">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <History className="h-3.5 w-3.5" /> {t('lm.machine.history')}
            </h2>
            {log.length === 0 ? (
              <p className="rounded-2xl border border-line bg-surface px-5 py-6 text-sm text-slate-500">{t('lm.machine.noHistory')}</p>
            ) : (
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {log.map((a) => {
                  // The merged ledger carries machine moves too — icon by action,
                  // not a blanket pause; blank trial labels fall back to the id.
                  const isPause = a.action === 'pause' || a.action === 'trial_paused' || a.action === 'cap_enforced'
                  const Icon = isPause ? Pause : a.action === 'launched' ? Sparkles : Zap
                  const tone = isPause ? 'text-red-300' : a.action === 'launched' ? 'text-emerald-400' : 'text-gold'
                  return (
                    <div key={`${a.source ?? 'op'}-${a.id}`} className="flex items-start gap-3 px-5 py-3.5">
                      <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-200">{a.campaignName || a.campaignId || a.action} <span className="text-slate-500">· {a.platform || a.source || ''}</span></div>
                        <div className="mt-0.5 text-xs text-slate-500">{a.detail}</div>
                      </div>
                      <span className="shrink-0 text-[11px] text-slate-500">{new Date(a.createdAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
