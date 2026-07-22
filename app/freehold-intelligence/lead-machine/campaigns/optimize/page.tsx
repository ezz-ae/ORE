'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Zap, TrendingDown, TrendingUp, PlugZap, ArrowUpRight, Loader2, Pause, History, ShieldCheck } from 'lucide-react'
import { EmptyState } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'
import { metaLeadCount } from '@/lib/meta/lead-count'

type MachineAction = { id: string; action: string; platform: string; campaignName: string; detail: string; createdAt: string }

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
  dailyAed: number
}

type SpendRules = { enabled: boolean; maxDailyAed: number; cplCeilingAed: number } | null

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
          rows.push({ id: c.id, name: c.name, platform: 'meta', running: c.status === 'ACTIVE', spendAED: spend, leads, cpl: leads > 0 ? spend / leads : 0, dailyAed: 0 })
        }
      }
      if (google && !google.demo) {
        for (const c of google.campaigns ?? []) {
          const spend = Number(c?.metrics?.costAed ?? c?.metrics?.cost) || 0
          const leads = Number(c?.metrics?.conversions ?? c?.metrics?.leads) || 0
          const dailyAed = Number(c?.dailyBudgetAed ?? (c?.dailyBudgetMicros ? Number(c.dailyBudgetMicros) / 1e6 : 0)) || 0
          rows.push({ id: c.id, name: c.name, platform: 'google', running: /enabled|active|running/i.test(String(c.status ?? '')), spendAED: spend, leads, cpl: leads > 0 ? spend / leads : 0, dailyAed })
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
  // Spend Governor — the deterministic rule that gates any budget RAISE.
  const [rules, setRules] = useState<SpendRules>(null)
  const [canEditRules, setCanEditRules] = useState(false)
  const [editRules, setEditRules] = useState(false)
  const [ruleForm, setRuleForm] = useState({ enabled: false, maxDailyAed: 0, cplCeilingAed: 0 })
  const [savingRules, setSavingRules] = useState(false)
  const [raisingId, setRaisingId] = useState<string | null>(null)

  async function loadMachine() {
    try {
      const r = await fetch('/api/freehold/lead-machine/machine', { cache: 'no-store' })
      if (!r.ok) return
      const d = await r.json()
      if (typeof d.autonomy === 'number') setAutonomy(d.autonomy)
      setCanApply(!!d.canApply)
      if (Array.isArray(d.actions)) setLog(d.actions)
      if (d.rules) { setRules(d.rules); setRuleForm({ enabled: !!d.rules.enabled, maxDailyAed: Number(d.rules.maxDailyAed) || 0, cplCeilingAed: Number(d.rules.cplCeilingAed) || 0 }) }
    } catch { /* leave defaults */ }
  }
  useEffect(() => { loadMachine() }, [])
  // Whether the current user can EDIT the rule (management) — read from the rules endpoint.
  useEffect(() => {
    fetch('/api/freehold/lead-machine/spend-rules', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setCanEditRules(!!d.canEdit) })
      .catch(() => {})
  }, [])

  async function saveRules() {
    setSavingRules(true)
    try {
      const r = await fetch('/api/freehold/lead-machine/spend-rules', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ruleForm),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(d.error || t('lm.machine.gov.saveFailed')); return }
      if (d.rules) setRules(d.rules)
      setEditRules(false)
      toast.success(t('lm.machine.gov.saved'))
    } catch { toast.error(t('lm.machine.gov.saveFailed')) }
    finally { setSavingRules(false) }
  }

  async function raiseBudget(c: LiveCampaign) {
    setRaisingId(c.id)
    try {
      const r = await fetch('/api/freehold/lead-machine/machine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'raise_budget', platform: c.platform, campaignId: c.id, campaignName: c.name, currentDailyAed: c.dailyAed, currentCpl: c.cpl }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(d.error || t('lm.machine.gov.raiseFailed')); loadMachine(); return }
      toast.success(t('lm.machine.gov.raised', { aed: String(d.newDaily ?? '') }))
      loadMachine()
    } catch { toast.error(t('lm.machine.gov.raiseFailed')) }
    finally { setRaisingId(null) }
  }

  const ranked = useMemo(
    () => [...campaigns].filter((c) => c.cpl > 0 && !pausedIds.includes(c.id)).sort((a, b) => a.cpl - b.cpl),
    [campaigns, pausedIds],
  )
  const best = ranked[0]
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : undefined

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

      {/* Spend Governor — the deterministic rule that gates autonomous budget raises */}
      <div className="mt-6 rounded-2xl border border-line bg-surface-2/50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" /> {t('lm.machine.gov.title')}
            </div>
            <p className="mt-1.5 text-sm text-slate-200">
              {rules?.enabled && rules.maxDailyAed > 0
                ? t('lm.machine.gov.active', { max: String(rules.maxDailyAed), cpl: rules.cplCeilingAed > 0 ? String(rules.cplCeilingAed) : '∞' })
                : t('lm.machine.gov.off')}
            </p>
          </div>
          {canEditRules && !editRules && (
            <button type="button" onClick={() => setEditRules(true)} className="shrink-0 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-gold/30 hover:text-white">
              {t('lm.machine.gov.edit')}
            </button>
          )}
        </div>
        {editRules && (
          <div className="mt-4 space-y-3 border-t border-line pt-3">
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input type="checkbox" checked={ruleForm.enabled} onChange={(e) => setRuleForm((f) => ({ ...f, enabled: e.target.checked }))} className="accent-gold" />
              {t('lm.machine.gov.enable')}
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">{t('lm.machine.gov.maxDaily')}</span>
                <input type="number" min={0} value={ruleForm.maxDailyAed} onChange={(e) => setRuleForm((f) => ({ ...f, maxDailyAed: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none focus:border-gold/40" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-500">{t('lm.machine.gov.cplCeiling')}</span>
                <input type="number" min={0} value={ruleForm.cplCeilingAed} onChange={(e) => setRuleForm((f) => ({ ...f, cplCeilingAed: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none focus:border-gold/40" />
              </label>
            </div>
            <p className="text-[11px] leading-snug text-slate-500">{t('lm.machine.gov.hint')}</p>
            <div className="flex gap-2">
              <button type="button" onClick={saveRules} disabled={savingRules} className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-60">
                {savingRules ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} {t('lm.machine.gov.save')}
              </button>
              <button type="button" onClick={() => setEditRules(false)} className="text-xs text-slate-400 hover:text-white">{t('common.cancel')}</button>
            </div>
          </div>
        )}
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
              <div className="text-xs font-semibold uppercase tracking-wider text-gold">{t('lm.optimize.aiRecommendations')}</div>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                {t('lm.optimize.shiftReco', {
                  from: worst.name,
                  fromCpl: worst.cpl.toFixed(0),
                  to: best.name,
                  toCpl: best.cpl.toFixed(0),
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
              {/* Governor-gated spend RAISE on the best performer (Google only).
                  The deterministic Spend Governor decides if it's allowed. */}
              {canApply && best.platform === 'google' && (
                <div className="mt-3 border-t border-gold/15 pt-3">
                  <button type="button" onClick={() => raiseBudget(best)} disabled={raisingId === best.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-60">
                    {raisingId === best.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />} {t('lm.machine.gov.raiseCta', { name: best.name })}
                  </button>
                  <span className="ms-2 text-[11px] text-slate-500">{t('lm.machine.gov.raiseNote')}</span>
                </div>
              )}
              <p className="mt-2 text-[11px] leading-snug text-slate-500">{t('lm.machine.autopilotNote')}</p>
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
                    AED {c.cpl.toFixed(0)}
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
                {log.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
                    <Pause className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-300" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-200">{a.campaignName} <span className="text-slate-500">· {a.platform}</span></div>
                      <div className="mt-0.5 text-xs text-slate-500">{a.detail}</div>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500">{new Date(a.createdAt).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
