'use client'

/**
 * Ads Machine — machine dashboard. Everything on this page is the GET
 * response of /api/freehold/ads/machine/[id]: controls (pause/resume/stop/
 * run-cycle/cap), the real budget stats (combined Meta+Google committed +
 * headroom), the trials table (no invented spend/lead columns — Meta rows
 * link to the ads-live detail, Google rows to the Google campaign detail, for
 * the full live data), the activity feed ("what the machine is
 * doing now", auto-refreshed every 60s), the admin verdict queue with its
 * accuracy warning FIRST, and the per-member / per-day answer aggregates.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertCircle, AlertTriangle, ArrowLeft, ArrowLeftRight, ArrowUpRight, Bell,
  Check, Eye, FileText, ListChecks, Loader2, Pause, Pencil, Play, RefreshCw,
  Rocket, Shield, Square, X,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'
import type {
  ActivityKind, AdsMachine, MachineActivity, MachineCampaign, MachineStatus,
  VerdictAggregates, VerdictQueueItem,
} from '@/lib/freehold/ads-machine'

interface Detail {
  machine: AdsMachine
  campaigns: MachineCampaign[]
  activity: MachineActivity[]
  verdictQueue: VerdictQueueItem[]
  verdictAggregates: VerdictAggregates
  budget: { dailyCapAed: number; committedDailyAed: number; headroomAed: number }
}

const STATUS_PILL: Record<MachineStatus, { dot: string; cls: string; labelKey: string }> = {
  planning: { dot: 'bg-sky-400', cls: 'border-sky-400/20 bg-sky-400/10 text-sky-300', labelKey: 'lm.machine.status.planning' },
  running: { dot: 'bg-emerald-400', cls: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300', labelKey: 'lm.machine.status.running' },
  paused: { dot: 'bg-amber-400', cls: 'border-amber-400/20 bg-amber-400/10 text-amber-300', labelKey: 'lm.machine.status.paused' },
  stopped: { dot: 'bg-red-400', cls: 'border-red-400/20 bg-red-400/10 text-red-300', labelKey: 'lm.machine.status.stopped' },
}

const TRIAL_STATUS: Record<MachineCampaign['status'], { cls: string; labelKey: string }> = {
  active: { cls: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300', labelKey: 'lm.machine.trial.status.active' },
  paused: { cls: 'border-amber-400/20 bg-amber-400/10 text-amber-300', labelKey: 'lm.machine.trial.status.paused' },
  draft: { cls: 'border-slate-500/20 bg-slate-500/10 text-slate-400', labelKey: 'lm.machine.trial.status.draft' },
  stopped: { cls: 'border-red-400/20 bg-red-400/10 text-red-300', labelKey: 'lm.machine.trial.status.stopped' },
}

// Kind-specific icon + color for the activity feed.
const KIND_META: Record<ActivityKind, { Icon: typeof Rocket; color: string; bg: string; labelKey: string }> = {
  launched:              { Icon: Rocket,         color: 'text-gold',       bg: 'bg-gold/10',       labelKey: 'lm.machine.kind.launched' },
  budget_shift:          { Icon: ArrowLeftRight, color: 'text-sky-300',    bg: 'bg-sky-400/10',    labelKey: 'lm.machine.kind.budget_shift' },
  trial_paused:          { Icon: Pause,          color: 'text-amber-300',  bg: 'bg-amber-400/10',  labelKey: 'lm.machine.kind.trial_paused' },
  trial_resumed:         { Icon: Play,           color: 'text-emerald-300', bg: 'bg-emerald-400/10', labelKey: 'lm.machine.kind.trial_resumed' },
  observation:           { Icon: Eye,            color: 'text-slate-400',  bg: 'bg-surface-2',     labelKey: 'lm.machine.kind.observation' },
  feedback_request:      { Icon: Bell,           color: 'text-violet-300', bg: 'bg-violet-400/10', labelKey: 'lm.machine.kind.feedback_request' },
  feedback_answered:     { Icon: Check,          color: 'text-emerald-300', bg: 'bg-emerald-400/10', labelKey: 'lm.machine.kind.feedback_answered' },
  cap_enforced:          { Icon: Shield,         color: 'text-red-300',    bg: 'bg-red-400/10',    labelKey: 'lm.machine.kind.cap_enforced' },
  error:                 { Icon: AlertTriangle,  color: 'text-red-300',    bg: 'bg-red-400/10',    labelKey: 'lm.machine.kind.error' },
  google_draft_prepared: { Icon: FileText,       color: 'text-slate-400',  bg: 'bg-surface-2',     labelKey: 'lm.machine.kind.google_draft_prepared' },
  planned:               { Icon: ListChecks,     color: 'text-slate-400',  bg: 'bg-surface-2',     labelKey: 'lm.machine.kind.planned' },
}

const RTF_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800],
  ['day', 86_400], ['hour', 3_600], ['minute', 60],
]

function relTime(iso: string, locale: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const secs = Math.round((then - Date.now()) / 1000)
  const abs = Math.abs(secs)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  for (const [unit, size] of RTF_UNITS) {
    if (abs >= size) return rtf.format(Math.trunc(secs / size), unit)
  }
  return rtf.format(secs, 'second')
}

export default function MachineDashboardPage() {
  const { t, locale } = useI18n()
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')

  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const [cycleBusy, setCycleBusy] = useState(false)
  const [confirm, setConfirm] = useState<null | 'stop' | 'start'>(null)
  const [capEditing, setCapEditing] = useState(false)
  const [capValue, setCapValue] = useState('')
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const dataRef = useRef<Detail | null>(null)
  dataRef.current = data

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const res = await fetch(`/api/freehold/ads/machine/${encodeURIComponent(id)}`, { cache: 'no-store' })
      if (res.status === 404) { setNotFound(true); return }
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.machine) { setLoadError(d?.error || t('lm.machine.loadFailed')); return }
      setData(d as Detail)
      setLoadError(null)
    } catch {
      // keep the last honest state on transient failures; surface on first load
      if (!dataRef.current) setLoadError(t('lm.machine.loadFailed'))
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [id, t])

  useEffect(() => { if (id) load() }, [id, load])

  // Auto-refresh while open: the activity feed is "what the machine is doing
  // now", so the whole GET re-pulls every 60s.
  useEffect(() => {
    if (!id) return
    const iv = setInterval(() => load({ silent: true }), 60_000)
    return () => clearInterval(iv)
  }, [id, load])

  async function patch(body: Record<string, unknown>, busyKey: string): Promise<boolean> {
    setActionBusy(busyKey)
    try {
      const res = await fetch(`/api/freehold/ads/machine/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) { toast.error(d?.error || t('lm.machine.ctrl.failed')); return false }
      await load({ silent: true })
      return true
    } catch {
      toast.error(t('lm.machine.ctrl.failed'))
      return false
    } finally {
      setActionBusy(null)
    }
  }

  async function runCycle() {
    if (cycleBusy) return
    setCycleBusy(true)
    try {
      const res = await fetch(`/api/freehold/ads/machine/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_cycle' }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) { toast.error(d?.error || t('lm.machine.ctrl.failed')); return }
      toast.success(t('lm.machine.ctrl.cycleDone'))
      await load({ silent: true })
    } catch {
      toast.error(t('lm.machine.ctrl.failed'))
    } finally {
      setCycleBusy(false)
    }
  }

  async function saveCap() {
    const cap = Number(capValue)
    if (!Number.isFinite(cap) || cap <= 0) return
    const ok = await patch({ dailyCapAed: cap }, 'cap')
    if (ok) setCapEditing(false)
  }

  async function answerVerdict(item: VerdictQueueItem, ans: { verdict: 'yes' | 'no' } | { score: number }) {
    setAnsweringId(item.id)
    // Optimistic remove — the pending count derives from the queue.
    setData((prev) => prev ? { ...prev, verdictQueue: prev.verdictQueue.filter((v) => v.id !== item.id) } : prev)
    try {
      const res = await fetch(`/api/freehold/ads/machine/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lead_verdict', verdictRowId: item.id, ...ans }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        toast.error(d?.error || t('lm.machine.queue.answerFailed'))
      }
    } catch {
      toast.error(t('lm.machine.queue.answerFailed'))
    } finally {
      setAnsweringId(null)
      // Refresh counts + aggregates from the server either way.
      load({ silent: true })
    }
  }

  const dateLocale = locale === 'ar' ? 'ar-AE' : locale === 'ru' ? 'ru-RU' : 'en-AE'

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    )
  }

  if (notFound || (!data && loadError)) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        <Link href="/freehold-intelligence/lead-machine/ads-machine" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> {t('lm.machine.eyebrow')}
        </Link>
        <div className="mt-8 flex items-start gap-3 rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] p-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
          <p className="text-sm text-slate-300">{notFound ? t('lm.machine.detail.notFound') : loadError}</p>
        </div>
      </div>
    )
  }
  if (!data) return null

  const { machine, campaigns, activity, verdictQueue, verdictAggregates, budget } = data
  const pill = STATUS_PILL[machine.status]
  const btnCls = 'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-300 transition hover:border-gold/30 hover:text-white disabled:opacity-50'

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
      <Link href="/freehold-intelligence/lead-machine/ads-machine" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('lm.machine.eyebrow')}
      </Link>

      {/* ── Header: name, status, controls ── */}
      <section className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-white">{machine.name}</h1>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${pill.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${pill.dot}`} />
              {t(pill.labelKey)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {machine.status === 'planning' && (
            <button type="button" onClick={() => setConfirm('start')} disabled={!!actionBusy}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-50">
              <Play className="h-3.5 w-3.5" /> {t('lm.machine.plan.start')}
            </button>
          )}
          {machine.status === 'running' && (
            <button type="button" onClick={() => patch({ action: 'pause' }, 'pause')} disabled={!!actionBusy} className={btnCls}>
              {actionBusy === 'pause' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5" />}
              {t('lm.machine.ctrl.pause')}
            </button>
          )}
          {(machine.status === 'paused' || machine.status === 'stopped') && (
            <button type="button" onClick={() => patch({ action: 'resume' }, 'resume')} disabled={!!actionBusy} className={btnCls}>
              {actionBusy === 'resume' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {t('lm.machine.ctrl.resume')}
            </button>
          )}
          {machine.status !== 'stopped' && machine.status !== 'planning' && (
            <button type="button" onClick={() => setConfirm('stop')} disabled={!!actionBusy}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-400/10 px-3.5 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-400/20 disabled:opacity-50">
              <Square className="h-3.5 w-3.5" /> {t('lm.machine.ctrl.stop')}
            </button>
          )}
          <button type="button" onClick={runCycle} disabled={cycleBusy}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50">
            {cycleBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t('lm.machine.ctrl.runCycle')}
          </button>
        </div>
      </section>

      {/* ── Stat row (all from the GET — nothing invented) ── */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[18px] border border-line bg-surface p-4">
          {capEditing ? (
            <div className="flex items-center gap-2">
              <input
                value={capValue}
                onChange={(e) => setCapValue(e.target.value.replace(/[^\d]/g, ''))}
                inputMode="numeric"
                autoFocus
                className="w-20 rounded-lg border border-line bg-surface-2 px-2 py-1 text-[18px] font-semibold text-white outline-none focus:border-gold/40"
              />
              <button type="button" onClick={saveCap} disabled={actionBusy === 'cap'} aria-label={t('lm.machine.ctrl.capSave')}
                className="rounded-lg p-1.5 text-gold transition hover:bg-gold/10 disabled:opacity-50">
                {actionBusy === 'cap' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => setCapEditing(false)} aria-label={t('lm.machine.ctrl.capCancel')}
                className="rounded-lg p-1.5 text-slate-500 transition hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <div className="text-[26px] font-semibold leading-none text-gold">
                {machine.dailyCapAed.toLocaleString()}
              </div>
              <button
                type="button"
                onClick={() => { setCapValue(String(machine.dailyCapAed)); setCapEditing(true) }}
                aria-label={t('lm.machine.ctrl.capEdit')}
                title={t('lm.machine.ctrl.capEdit')}
                className="rounded-lg p-1 text-slate-500 transition hover:text-gold"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="mt-1.5 text-sm text-slate-500">{t('lm.machine.stat.cap')}</div>
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-4">
          <div className="text-[26px] font-semibold leading-none text-white">
            {budget.committedDailyAed.toLocaleString()}
          </div>
          <div className="mt-1.5 text-sm text-slate-500">
            {t('lm.machine.stat.committed')}
            <span className="ms-1.5 text-xs text-emerald-400/80">{t('lm.machine.stat.headroom', { n: budget.headroomAed.toLocaleString() })}</span>
          </div>
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-4">
          <div className="text-[26px] font-semibold leading-none text-white">{campaigns.length}</div>
          <div className="mt-1.5 text-sm text-slate-500">{t('lm.machine.stat.campaigns')}</div>
        </div>
        <div className="rounded-[18px] border border-line bg-surface p-4">
          <div className={`text-[26px] font-semibold leading-none ${verdictQueue.length > 0 ? 'text-amber-300' : 'text-white'}`}>
            {verdictQueue.length}
          </div>
          <div className="mt-1.5 text-sm text-slate-500">{t('lm.machine.stat.pending')}</div>
        </div>
      </div>

      {/* ── Trials ── */}
      <section className="mt-12">
        <div className="text-sm font-medium uppercase tracking-wider text-slate-500">{t('lm.machine.trials.title')}</div>
        {campaigns.length === 0 ? (
          <div className="mt-4 rounded-[18px] border border-line bg-surface-2/40 px-5 py-8 text-center text-sm text-slate-500">
            {t('lm.machine.trials.empty')}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[18px] border border-line bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-start text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-start font-medium">{t('lm.machine.trials.project')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('lm.machine.trials.trial')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('lm.machine.trials.channel')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('lm.machine.trials.status')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('lm.machine.trials.budget')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const st = TRIAL_STATUS[c.status]
                  return (
                    <tr key={c.id} className="border-b border-line/50 last:border-0">
                      <td className="px-4 py-3 text-slate-200">{c.projectSlug}</td>
                      <td className="px-4 py-3 text-white">{c.trialLabel}</td>
                      <td className="px-4 py-3 text-slate-400">{c.channel === 'meta' ? 'Meta' : 'Google'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${st.cls}`}>{t(st.labelKey)}</span>
                      </td>
                      <td className="px-4 py-3 text-end font-medium text-slate-200">AED {c.dailyBudgetAed.toLocaleString()}</td>
                      <td className="px-4 py-3 text-end">
                        <Link
                          href={c.channel === 'meta'
                            ? `/freehold-intelligence/ads-live/meta/${encodeURIComponent(c.campaignId)}`
                            : `/freehold-intelligence/lead-machine/google/campaigns/${encodeURIComponent(c.campaignId)}`}
                          className="inline-flex items-center gap-1 text-xs text-gold/80 transition hover:text-gold"
                        >
                          {t('lm.machine.trials.live')} <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Verdict queue (admin view) — the accuracy warning comes FIRST ── */}
      <section className="mt-12">
        <div className="text-sm font-medium uppercase tracking-wider text-slate-500">{t('lm.machine.queue.title')}</div>
        <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-amber-400/30 bg-amber-400/[0.08] p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-sm leading-relaxed text-amber-200">{t('lm.machine.queue.warning')}</p>
        </div>

        {verdictQueue.length === 0 ? (
          <div className="mt-3 rounded-[18px] border border-line bg-surface-2/40 px-5 py-8 text-center text-sm text-slate-500">
            {t('lm.machine.queue.empty')}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {verdictQueue.map((v) => {
              const busy = answeringId === v.id
              const question = v.questionKind === 'confirm'
                ? t('lm.machine.q.confirm', { name: v.leadName })
                : t('lm.machine.q.score', { name: v.leadName })
              return (
                <div key={v.id} className="rounded-[18px] border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-white">{v.leadName}</span>
                    {v.leadPhoneMasked && (
                      <span className="font-mono text-xs text-slate-500" dir="ltr">{v.leadPhoneMasked}</span>
                    )}
                    {v.leadStatus && (
                      <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10px] text-slate-400">{v.leadStatus}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                    <span>{[v.projectSlug, v.trialLabel].filter(Boolean).join(' · ')}</span>
                    <span className={v.ownerEmail ? 'text-slate-400' : 'text-amber-300/80'}>
                      {v.ownerEmail ?? t('lm.machine.queue.unassigned')}
                    </span>
                    {v.leadArrivedAt && (
                      <span>{t('lm.machine.queue.arrived', { date: new Date(v.leadArrivedAt).toLocaleDateString(dateLocale, { dateStyle: 'medium' }) })}</span>
                    )}
                  </div>
                  <p className="mt-2.5 text-sm text-slate-200">{question}</p>

                  {v.questionKind === 'confirm' ? (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => answerVerdict(v, { verdict: 'yes' })}
                        className={[
                          'rounded-full border px-5 py-1.5 text-xs font-semibold transition disabled:opacity-50',
                          v.suggestedVerdict === 'yes'
                            ? 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/40'
                            : 'border-line bg-surface-2 text-slate-300 hover:border-emerald-400/40 hover:text-emerald-300',
                        ].join(' ')}
                      >
                        {t('lm.machine.queue.yes')}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => answerVerdict(v, { verdict: 'no' })}
                        className={[
                          'rounded-full border px-5 py-1.5 text-xs font-semibold transition disabled:opacity-50',
                          v.suggestedVerdict === 'no'
                            ? 'border-red-400/50 bg-red-400/15 text-red-300 ring-1 ring-red-400/40'
                            : 'border-line bg-surface-2 text-slate-300 hover:border-red-400/40 hover:text-red-300',
                        ].join(' ')}
                      >
                        {t('lm.machine.queue.no')}
                      </button>
                      {v.suggestedVerdict && (
                        <span className="text-[10px] text-slate-500">{t('lm.machine.queue.suggested')}</span>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Array.from({ length: 11 }, (_, s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={busy}
                          onClick={() => answerVerdict(v, { score: s })}
                          className="h-8 w-8 rounded-lg border border-line bg-surface-2 text-xs font-semibold text-slate-300 transition hover:border-gold/40 hover:text-gold disabled:opacity-50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Aggregates: who answers, and how the days compare ── */}
      <section className="mt-12">
        <div className="text-sm font-medium uppercase tracking-wider text-slate-500">{t('lm.machine.agg.title')}</div>
        {verdictAggregates.byOwner.length === 0 && verdictAggregates.byDay.length === 0 ? (
          <div className="mt-4 rounded-[18px] border border-line bg-surface-2/40 px-5 py-8 text-center text-sm text-slate-500">
            {t('lm.machine.agg.empty')}
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-[18px] border border-line bg-surface">
              <div className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('lm.machine.agg.byMember')}
              </div>
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-line/50 text-xs text-slate-500">
                    <th className="px-4 py-2 text-start font-medium">{t('lm.machine.agg.member')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('lm.machine.agg.answered')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('lm.machine.agg.yes')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('lm.machine.agg.no')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('lm.machine.agg.pending')}</th>
                  </tr>
                </thead>
                <tbody>
                  {verdictAggregates.byOwner.map((r) => (
                    <tr key={r.owner} className="border-b border-line/40 last:border-0">
                      <td className="max-w-[180px] truncate px-4 py-2 text-slate-200">
                        {r.owner === '(unassigned)' ? t('lm.machine.queue.unassigned') : r.owner}
                      </td>
                      <td className="px-3 py-2 text-end text-slate-200">{r.answered}</td>
                      <td className="px-3 py-2 text-end text-emerald-300">{r.yes}</td>
                      <td className="px-3 py-2 text-end text-red-300">{r.no}</td>
                      <td className={`px-3 py-2 text-end ${r.pending > 0 ? 'text-amber-300' : 'text-slate-500'}`}>{r.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-[18px] border border-line bg-surface">
              <div className="border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t('lm.machine.agg.byDay')}
              </div>
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-line/50 text-xs text-slate-500">
                    <th className="px-4 py-2 text-start font-medium">{t('lm.machine.agg.day')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('lm.machine.agg.answered')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('lm.machine.agg.yes')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('lm.machine.agg.no')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('lm.machine.agg.pending')}</th>
                  </tr>
                </thead>
                <tbody>
                  {verdictAggregates.byDay.map((r) => (
                    <tr key={r.day} className="border-b border-line/40 last:border-0">
                      <td className="px-4 py-2 font-mono text-xs text-slate-300">{r.day}</td>
                      <td className="px-3 py-2 text-end text-slate-200">{r.answered}</td>
                      <td className="px-3 py-2 text-end text-emerald-300">{r.yes}</td>
                      <td className="px-3 py-2 text-end text-red-300">{r.no}</td>
                      <td className={`px-3 py-2 text-end ${r.pending > 0 ? 'text-amber-300' : 'text-slate-500'}`}>{r.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Activity feed ── */}
      <section className="mt-12">
        <div className="text-sm font-medium uppercase tracking-wider text-slate-500">{t('lm.machine.activity.title')}</div>
        {activity.length === 0 ? (
          <div className="mt-4 rounded-[18px] border border-line bg-surface-2/40 px-5 py-8 text-center text-sm text-slate-500">
            {t('lm.machine.activity.empty')}
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {activity.map((a) => {
              const meta = KIND_META[a.kind] ?? KIND_META.observation
              const Icon = meta.Icon
              return (
                <div key={a.id} className="flex items-start gap-3 rounded-[16px] border border-line bg-surface p-4">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
                    <Icon className={`h-4 w-4 ${meta.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <span className={`text-xs font-semibold ${meta.color}`}>{t(meta.labelKey)}</span>
                      <span className="text-[11px] text-slate-500" title={new Date(a.createdAt).toLocaleString(dateLocale)}>
                        {relTime(a.createdAt, locale)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-300">{a.detail}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Confirm dialogs ── */}
      {confirm && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-app p-6 shadow-2xl">
            <div className="text-base font-semibold text-white">
              {confirm === 'stop' ? t('lm.machine.ctrl.stopConfirmTitle') : t('lm.machine.plan.confirmTitle')}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              {confirm === 'stop'
                ? t('lm.machine.ctrl.stopConfirmBody')
                : t('lm.machine.plan.confirmBody', { n: machine.dailyCapAed.toLocaleString() })}
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={!!actionBusy}
                className="rounded-full border border-line px-4 py-2 text-sm font-medium text-slate-400 transition hover:text-white"
              >
                {confirm === 'stop' ? t('lm.machine.ctrl.stopConfirmNo') : t('lm.machine.plan.confirmNo')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = confirm === 'stop' ? 'stop' : 'start'
                  const ok = await patch({ action }, action)
                  if (ok) setConfirm(null)
                }}
                disabled={!!actionBusy}
                className={[
                  'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-50',
                  confirm === 'stop'
                    ? 'border border-red-400/40 bg-red-400/15 text-red-300 hover:bg-red-400/25'
                    : 'bg-gold text-ink hover:bg-[#F8E7AE]',
                ].join(' ')}
              >
                {actionBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirm === 'stop' ? t('lm.machine.ctrl.stopConfirmYes') : t('lm.machine.plan.confirmYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
