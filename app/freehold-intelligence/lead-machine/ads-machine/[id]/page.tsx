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
  Rocket, Shield, ShieldAlert, Square, X, EyeOff,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'
import { MachinePlanPreview } from '@/components/freehold/machine-plan-preview'
import { MachineLaunchReview } from '@/components/freehold/machine-launch-review'
import type { TrialEdit, ProjectEdit } from '@/lib/freehold/ads-machine-plan-edit'
import type { DeliveryState, CampaignDelivery } from '@/lib/freehold/campaign-delivery'
import type { PermitState } from '@/lib/freehold/trakheesi'
import type {
  ActivityKind, AdsMachine, MachineActivity, MachineCampaign, MachineStatus,
  VerdictAggregates, VerdictQueueItem,
} from '@/lib/freehold/ads-machine'

interface TrialEvidence {
  campaignId: string
  leads?: number
  leadBasis?: 'meta-reported' | 'crm-attributed'
  cplAed?: number | null
  attributedCplAed?: number | null
  qualityScore?: number | null
  attributed?: number
  verdicts?: { yes: number; no: number; decisive: number } | null
}

interface Detail {
  machine: AdsMachine
  campaigns: MachineCampaign[]
  activity: MachineActivity[]
  verdictQueue: VerdictQueueItem[]
  verdictAggregates: VerdictAggregates
  starvedTrials?: { campaignId: string; trialLabel: string; projectSlug: string; pending: number; decisive: number; needed: number }[]
  /** Where each project's Trakheesi permit stands today — computed server-side
   *  from the same helper the engine gates launches on. */
  permits?: {
    projectSlug: string
    listingName: string
    permitNumber: string | null
    permitExpiry: string | null
    daysLeft: number | null
    state: PermitState
    activeTrials: number
  }[]
  /** What the engine actually judged each trial on, from its last observation. */
  evidence?: TrialEvidence[]
  evidenceAt?: string | null
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

// Honest live delivery state (Meta effective_status + learning phase; Google
// primary_status). "Active" is our control flag — this is what's REALLY
// happening once a campaign is created.
const DELIVERY_META: Record<DeliveryState, { dot: string; cls: string; labelKey: string; descKey: string }> = {
  delivering:       { dot: 'bg-emerald-400', cls: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300', labelKey: 'lm.machine.delivery.delivering',       descKey: 'lm.machine.delivery.desc.delivering' },
  learning:         { dot: 'bg-sky-400',     cls: 'border-sky-400/20 bg-sky-400/10 text-sky-300',             labelKey: 'lm.machine.delivery.learning',         descKey: 'lm.machine.delivery.desc.learning' },
  learning_limited: { dot: 'bg-amber-400',   cls: 'border-amber-400/20 bg-amber-400/10 text-amber-300',       labelKey: 'lm.machine.delivery.learning_limited', descKey: 'lm.machine.delivery.desc.learning_limited' },
  limited:          { dot: 'bg-amber-400',   cls: 'border-amber-400/20 bg-amber-400/10 text-amber-300',       labelKey: 'lm.machine.delivery.limited',          descKey: 'lm.machine.delivery.desc.limited' },
  in_review:        { dot: 'bg-violet-400',  cls: 'border-violet-400/20 bg-violet-400/10 text-violet-300',    labelKey: 'lm.machine.delivery.in_review',        descKey: 'lm.machine.delivery.desc.in_review' },
  rejected:         { dot: 'bg-red-400',     cls: 'border-red-400/20 bg-red-400/10 text-red-300',             labelKey: 'lm.machine.delivery.rejected',         descKey: 'lm.machine.delivery.desc.rejected' },
  not_delivering:   { dot: 'bg-red-400',     cls: 'border-red-400/20 bg-red-400/10 text-red-300',             labelKey: 'lm.machine.delivery.not_delivering',   descKey: 'lm.machine.delivery.desc.not_delivering' },
  paused:           { dot: 'bg-slate-400',   cls: 'border-slate-500/20 bg-slate-500/10 text-slate-400',       labelKey: 'lm.machine.delivery.paused',           descKey: 'lm.machine.delivery.desc.paused' },
  ended:            { dot: 'bg-slate-500',   cls: 'border-slate-500/20 bg-slate-500/10 text-slate-500',       labelKey: 'lm.machine.delivery.ended',            descKey: 'lm.machine.delivery.desc.ended' },
  local_draft:      { dot: 'bg-slate-500',   cls: 'border-slate-500/20 bg-slate-500/10 text-slate-400',       labelKey: 'lm.machine.delivery.local_draft',      descKey: 'lm.machine.delivery.desc.local_draft' },
  not_connected:    { dot: 'bg-slate-500',   cls: 'border-slate-500/20 bg-slate-500/10 text-slate-500',       labelKey: 'lm.machine.delivery.not_connected',    descKey: 'lm.machine.delivery.desc.not_connected' },
  unknown:          { dot: 'bg-slate-500',   cls: 'border-slate-500/20 bg-slate-500/10 text-slate-500',       labelKey: 'lm.machine.delivery.unknown',          descKey: 'lm.machine.delivery.desc.unknown' },
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
  permit_blocked:        { Icon: Shield,         color: 'text-orange-300', bg: 'bg-orange-400/10', labelKey: 'lm.machine.kind.permit_blocked' },
  permit_warning:        { Icon: ShieldAlert,    color: 'text-amber-300',  bg: 'bg-amber-400/10',  labelKey: 'lm.machine.kind.permit_warning' },
  delivery_blocked:      { Icon: EyeOff,         color: 'text-orange-300', bg: 'bg-orange-400/10', labelKey: 'lm.machine.kind.delivery_blocked' },
  machine_stalled:       { Icon: AlertTriangle,  color: 'text-red-300',    bg: 'bg-red-400/10',    labelKey: 'lm.machine.kind.machine_stalled' },
  creative_fatigue:      { Icon: RefreshCw,      color: 'text-violet-300', bg: 'bg-violet-400/10', labelKey: 'lm.machine.kind.creative_fatigue' },
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
  const [confirm, setConfirm] = useState<null | 'stop'>(null)
  const [reviewing, setReviewing] = useState(false)
  const [capEditing, setCapEditing] = useState(false)
  const [capValue, setCapValue] = useState('')
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [delivery, setDelivery] = useState<Record<string, CampaignDelivery>>({})
  const [deliveryLoading, setDeliveryLoading] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const dataRef = useRef<Detail | null>(null)
  dataRef.current = data

  // Live delivery/learning state per campaign — a separate call so the main
  // dashboard stays fast. Fail-soft: a failure just leaves the last honest map.
  const loadDelivery = useCallback(async () => {
    setDeliveryLoading(true)
    try {
      const res = await fetch(`/api/freehold/ads/machine/${encodeURIComponent(id)}/delivery`, { cache: 'no-store' })
      const d = await res.json().catch(() => null)
      if (res.ok && d?.delivery) setDelivery(d.delivery as Record<string, CampaignDelivery>)
    } catch { /* keep last map */ } finally {
      setDeliveryLoading(false)
    }
  }, [id])

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

  useEffect(() => { if (id) { load(); loadDelivery() } }, [id, load, loadDelivery])

  // Auto-refresh while open: the activity feed is "what the machine is doing
  // now", so the whole GET re-pulls every 60s; delivery state refreshes with it.
  useEffect(() => {
    if (!id) return
    const iv = setInterval(() => { load({ silent: true }); loadDelivery() }, 60_000)
    return () => clearInterval(iv)
  }, [id, load, loadDelivery])

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

  // Per-campaign on/off — flip one trial and refresh its live state.
  async function toggleTrial(c: MachineCampaign) {
    if (togglingId) return
    const running = c.status !== 'active' // active → turn off; otherwise turn on
    setTogglingId(c.campaignId)
    try {
      const res = await fetch(`/api/freehold/ads/machine/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trial_toggle', campaignId: c.campaignId, running }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) { toast.error(d?.error || t('lm.machine.ctrl.failed')); return }
      toast.success(running ? t('lm.machine.trial.turnedOn') : t('lm.machine.trial.turnedOff'))
      await load({ silent: true })
      loadDelivery()
    } catch {
      toast.error(t('lm.machine.ctrl.failed'))
    } finally {
      setTogglingId(null)
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
      // ran:false = the engine had nothing to do (not running/paused, or no
      // viable plan) — never celebrate a cycle that did not happen.
      if (d?.cycle?.ran === false) toast.message(t('lm.machine.ctrl.cycleIdle'))
      else toast.success(t('lm.machine.ctrl.cycleDone'))
      await load({ silent: true })
    } catch {
      toast.error(t('lm.machine.ctrl.failed'))
    } finally {
      setCycleBusy(false)
    }
  }

  // Launch step: persist the operator's review edits (if any) and start. The
  // server applies the edits to the plan-as-DATA before the first cycle runs,
  // so what launches is exactly what the preview showed.
  async function launchWithEdits(edits: TrialEdit[], projectEdits: ProjectEdit[]) {
    setActionBusy('start')
    try {
      const res = await fetch(`/api/freehold/ads/machine/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', edits, projectEdits }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) { toast.error(d?.error || t('lm.machine.ctrl.failed')); return }
      toast.success(t('lm.machine.review.launched'))
      setReviewing(false)
      await load({ silent: true })
    } catch {
      toast.error(t('lm.machine.ctrl.failed'))
    } finally {
      setActionBusy(null)
    }
  }

  // Save the review edits without launching — the machine stays in planning.
  async function saveEdits(edits: TrialEdit[], projectEdits: ProjectEdit[]) {
    setActionBusy('planEdit')
    try {
      const res = await fetch(`/api/freehold/ads/machine/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'plan_edit', edits, projectEdits }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) { toast.error(d?.error || t('lm.machine.ctrl.failed')); return }
      toast.success(t('lm.machine.review.saved'))
      setReviewing(false)
      await load({ silent: true })
    } catch {
      toast.error(t('lm.machine.ctrl.failed'))
    } finally {
      setActionBusy(null)
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
  // The engine's own numbers, keyed for the trials table.
  const evidenceById = new Map((data.evidence ?? []).map((e) => [e.campaignId, e]))
  // Only permits that need a human: 'ok' is the silent default. Worst first,
  // and within a tier the project with live spend on the line comes first.
  const PERMIT_RANK: Record<PermitState, number> = { expired: 0, missing: 1, expiring: 2, no_expiry: 3, ok: 4 }
  const permitAlerts = (data.permits ?? [])
    .filter((p) => p.state !== 'ok')
    .sort((a, b) => PERMIT_RANK[a.state] - PERMIT_RANK[b.state] || b.activeTrials - a.activeTrials)
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
          {machine.status === 'planning' && machine.plan?.viable && (
            <button type="button" onClick={() => setReviewing(true)} disabled={!!actionBusy}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
              <Eye className="h-3.5 w-3.5" /> {t('lm.machine.review.reviewLaunch')}
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
          {(machine.status === 'running' || machine.status === 'paused') && (
            <button type="button" onClick={runCycle} disabled={cycleBusy}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50">
              {cycleBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {t('lm.machine.ctrl.runCycle')}
            </button>
          )}
        </div>
      </section>

      {/* ── Now / next: what the machine is doing and what happens next —
          derived entirely from real state (plan, campaigns, activity). ── */}
      {(() => {
        const planTrials = machine.plan?.viable ? machine.plan.projects.reduce((n, pr) => n + pr.trials.length, 0) : 0
        const launched = campaigns.filter((c) => c.status !== 'draft').length
        const lastAct = activity[0]
        const text = machine.status === 'planning'
          ? t('lm.machine.now.planning', { n: String(planTrials), m: String(machine.plan?.viable ? machine.plan.projects.length : 0), cap: machine.dailyCapAed.toLocaleString() })
          : machine.status === 'running'
            ? t('lm.machine.now.running', { x: String(launched), n: String(planTrials), when: lastAct ? relTime(lastAct.createdAt, locale) : t('lm.machine.now.noActivity') })
            : machine.status === 'paused'
              ? t('lm.machine.now.paused')
              : t('lm.machine.now.stopped')
        return (
          <section className="mt-5 rounded-[16px] border border-gold/15 bg-gold/[0.04] px-4 py-3">
            <p className="text-sm leading-relaxed text-slate-300">{text}</p>
          </section>
        )
      })()}

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

      {/* ── Trakheesi standing ────────────────────────────────────────────────
          A permit is issued for a fixed window, and the engine stops a
          project's trials the day it lapses. That has to be visible BEFORE it
          happens — a renewal takes days, a stopped campaign is instant. Only
          projects that need attention are listed; a fully-valid plan says
          nothing here rather than adding another green box to scroll past. */}
      {permitAlerts.length > 0 && (
        <section className="mt-8">
          <div className="text-sm font-medium uppercase tracking-wider text-slate-500">{t('lm.machine.permit.title')}</div>
          <div className="mt-4 space-y-2">
            {permitAlerts.map((p) => {
              const tone = p.state === 'expired' || p.state === 'missing'
                ? { box: 'border-red-400/30 bg-red-400/[0.07]', icon: 'text-red-300', text: 'text-red-200', sub: 'text-red-200/80' }
                : p.state === 'expiring'
                  ? { box: 'border-amber-400/30 bg-amber-400/[0.07]', icon: 'text-amber-300', text: 'text-amber-200', sub: 'text-amber-200/80' }
                  : { box: 'border-line bg-surface-2/40', icon: 'text-slate-500', text: 'text-slate-300', sub: 'text-slate-500' }
              const body =
                p.state === 'expired' ? t('lm.machine.permit.expired', { date: p.permitExpiry ?? '—' })
                : p.state === 'expiring' ? t('lm.machine.permit.expiring', { date: p.permitExpiry ?? '—', days: String(p.daysLeft ?? 0) })
                : p.state === 'missing' ? t('lm.machine.permit.missing')
                : t('lm.machine.permit.noExpiry')
              return (
                <div key={p.projectSlug} className={`flex items-start gap-3 rounded-[18px] border p-4 ${tone.box}`}>
                  <ShieldAlert className={`mt-0.5 h-4 w-4 shrink-0 ${tone.icon}`} />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold leading-relaxed ${tone.text}`}>{p.listingName}</p>
                    <p className={`mt-0.5 text-xs leading-relaxed ${tone.sub}`}>{body}</p>
                    {p.activeTrials > 0 && (
                      <p className={`mt-1 text-xs ${tone.sub}`}>
                        {t('lm.machine.permit.liveTrials', { n: String(p.activeTrials) })}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Trials ── */}
      {/* ── The plan: what the machine is creating, per project ── */}
      {machine.plan && (
        <section className="mt-12">
          <div className="text-sm font-medium uppercase tracking-wider text-slate-500">{t('lm.machine.plan.sectionTitle')}</div>
          <div className="mt-4">
            <MachinePlanPreview plan={machine.plan} />
          </div>
        </section>
      )}

      <section className="mt-12">
        <div className="text-sm font-medium uppercase tracking-wider text-slate-500">{t('lm.machine.trials.title')}</div>
        {campaigns.length === 0 ? (
          <div className="mt-4 rounded-[18px] border border-line bg-surface-2/40 px-5 py-8 text-center text-sm text-slate-500">
            {t('lm.machine.trials.empty')}
          </div>
        ) : (
          <>
          {/* LITE: phone trial cards — the 860px table is desktop depth. Each
              card keeps the daily controls: status, budget, on/off, Live. */}
          <div className="mt-4 divide-y divide-line rounded-[18px] border border-line bg-surface md:hidden">
            {campaigns.map((c) => {
              const st = TRIAL_STATUS[c.status]
              const dl = delivery[c.campaignId]
              const dm = dl ? DELIVERY_META[dl.state] : null
              const canToggle = (c.status === 'active' || c.status === 'paused')
                && !(c.channel === 'google' && c.campaignId.startsWith('local-'))
              const isOn = c.status === 'active'
              const busy = togglingId === c.campaignId
              return (
                <div key={c.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-white">{c.trialLabel}</span>
                    {canToggle ? (
                      <button
                        type="button" role="switch" aria-checked={isOn} disabled={busy}
                        onClick={() => toggleTrial(c)}
                        title={isOn ? t('lm.machine.trial.turnOff') : t('lm.machine.trial.turnOn')}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition ${isOn ? 'bg-emerald-400/90' : 'bg-surface-3'} disabled:opacity-60`}
                      >
                        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${isOn ? 'start-[22px]' : 'start-0.5'}`} />
                      </button>
                    ) : (
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${st.cls}`}>{t(st.labelKey)}</span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-400">
                    {c.projectSlug} · {c.channel === 'meta' ? 'Meta' : 'Google'} · AED {c.dailyBudgetAed.toLocaleString()}
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    {canToggle && (
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${st.cls}`}>{t(st.labelKey)}</span>
                    )}
                    {dm && (
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${dm.cls}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${dm.dot}`} />
                        {t(dm.labelKey)}
                      </span>
                    )}
                    {dl?.notSpending && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300">
                        <span className="h-1 w-1 rounded-full bg-amber-400" />
                        {t('lm.machine.delivery.notSpending')}
                      </span>
                    )}
                    <Link
                      href={c.channel === 'meta'
                        ? `/freehold-intelligence/ads-live/meta/${encodeURIComponent(c.campaignId)}`
                        : `/freehold-intelligence/lead-machine/google/campaigns/${encodeURIComponent(c.campaignId)}`}
                      className="ms-auto inline-flex items-center gap-1 text-xs text-gold/80 transition hover:text-gold"
                    >
                      {t('lm.machine.trials.live')} <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 hidden overflow-x-auto rounded-[18px] border border-line bg-surface md:block">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-line text-start text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 text-start font-medium">{t('lm.machine.trials.project')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('lm.machine.trials.trial')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('lm.machine.trials.channel')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('lm.machine.trials.delivery')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('lm.machine.trials.status')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('lm.machine.trials.budget')}</th>
                  <th className="px-4 py-3 text-end font-medium">{t('lm.machine.trials.evidence')}</th>
                  <th className="px-4 py-3 text-start font-medium">{t('lm.machine.trials.onoff')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const st = TRIAL_STATUS[c.status]
                  const dl = delivery[c.campaignId]
                  const dm = dl ? DELIVERY_META[dl.state] : null
                  const ev = evidenceById.get(c.campaignId)
                  return (
                    <tr key={c.id} className="border-b border-line/50 last:border-0">
                      <td className="px-4 py-3 text-slate-200">{c.projectSlug}</td>
                      <td className="px-4 py-3 text-white">{c.trialLabel}</td>
                      <td className="px-4 py-3 text-slate-400">{c.channel === 'meta' ? 'Meta' : 'Google'}</td>
                      <td className="px-4 py-3">
                        {dm ? (
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`inline-flex cursor-help items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${dm.cls}`}
                              title={[t(dm.descKey), dl?.detail].filter(Boolean).join(' — ')}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${dm.dot}`} />
                              {t(dm.labelKey)}
                            </span>
                            {dl?.notSpending ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-300">
                                <span className="h-1 w-1 rounded-full bg-amber-400" />
                                {t('lm.machine.delivery.notSpending')}
                              </span>
                            ) : (dl?.spendTodayAed ?? 0) > 0 ? (
                              <span className="text-[11px] text-slate-500">
                                {t('lm.machine.delivery.spentToday', { n: (dl?.spendTodayAed ?? 0).toLocaleString() })}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">{deliveryLoading ? '…' : '—'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${st.cls}`}>{t(st.labelKey)}</span>
                      </td>
                      <td className="px-4 py-3 text-end font-medium text-slate-200">AED {c.dailyBudgetAed.toLocaleString()}</td>
                      {/* The numbers the machine pauses on — shown with the
                          BASIS, because a Meta-reported CPL and a
                          CRM-attributed one are not the same measurement. */}
                      <td className="px-4 py-3 text-end">
                        {ev ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-xs font-medium text-slate-200">
                              {ev.cplAed != null ? `AED ${Math.round(ev.cplAed)}` : '—'}
                              <span className="ms-1 text-[10px] font-normal text-slate-500">
                                {ev.leadBasis === 'meta-reported' ? t('lm.machine.ev.metaBasis') : t('lm.machine.ev.crmBasis')}
                              </span>
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {t('lm.machine.ev.leads', { n: String(ev.leads ?? 0) })}
                              {ev.qualityScore != null ? ` · ${t('lm.machine.ev.quality', { n: String(ev.qualityScore) })}` : ''}
                              {ev.verdicts && ev.verdicts.decisive > 0 ? ` · ${ev.verdicts.yes}Y/${ev.verdicts.no}N` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const canToggle = (c.status === 'active' || c.status === 'paused')
                            && !(c.channel === 'google' && c.campaignId.startsWith('local-'))
                          if (!canToggle) return <span className="text-xs text-slate-600">—</span>
                          const isOn = c.status === 'active'
                          const busy = togglingId === c.campaignId
                          return (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={isOn}
                              disabled={busy}
                              onClick={() => toggleTrial(c)}
                              title={isOn ? t('lm.machine.trial.turnOff') : t('lm.machine.trial.turnOn')}
                              className="inline-flex items-center gap-2 disabled:opacity-50"
                            >
                              <span className={`relative h-4 w-7 shrink-0 rounded-full transition ${isOn ? 'bg-emerald-500/80' : 'bg-slate-600'}`}>
                                <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${isOn ? 'start-3.5' : 'start-0.5'}`} />
                              </span>
                              <span className={`text-xs font-medium ${isOn ? 'text-emerald-300' : 'text-slate-400'}`}>
                                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (isOn ? t('lm.machine.trial.on') : t('lm.machine.trial.off'))}
                              </span>
                            </button>
                          )
                        })()}
                      </td>
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
          </>
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

      {/* ── Verdict queue (admin view) — the accuracy warning comes FIRST ── */}
      <section className="mt-12">
        <div className="text-sm font-medium uppercase tracking-wider text-slate-500">{t('lm.machine.queue.title')}</div>
        {/* Verdict starvation — trials the machine CANNOT rotate on human
            evidence because too few answers exist. Silent before; loud now. */}
        {(data.starvedTrials?.length ?? 0) > 0 && (
          <div className="mt-4 rounded-[18px] border border-red-400/30 bg-red-400/[0.07] p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-relaxed text-red-200">
                  {t('lm.machine.starved.title', { n: String(data.starvedTrials!.length) })}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-red-200/80">{t('lm.machine.starved.body')}</p>
                <ul className="mt-2 space-y-1">
                  {data.starvedTrials!.map((s) => (
                    <li key={s.campaignId} className="text-xs text-red-200/90">
                      • {s.trialLabel} · {s.projectSlug} — {t('lm.machine.starved.row', { pending: String(s.pending), needed: String(s.needed) })}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
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

      {/* ── Launch review — the "run step" preview with editing options ── */}
      {reviewing && machine.plan?.viable && (
        <MachineLaunchReview
          plan={machine.plan}
          capAed={machine.dailyCapAed}
          busy={actionBusy === 'start' || actionBusy === 'planEdit'}
          onClose={() => setReviewing(false)}
          onLaunch={launchWithEdits}
          onSaveDraft={saveEdits}
        />
      )}

      {/* ── Stop confirm dialog ── */}
      {confirm === 'stop' && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-app p-6 shadow-2xl">
            <div className="text-base font-semibold text-white">{t('lm.machine.ctrl.stopConfirmTitle')}</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{t('lm.machine.ctrl.stopConfirmBody')}</p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={!!actionBusy}
                className="rounded-full border border-line px-4 py-2 text-sm font-medium text-slate-400 transition hover:text-white"
              >
                {t('lm.machine.ctrl.stopConfirmNo')}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const ok = await patch({ action: 'stop' }, 'stop')
                  if (ok) setConfirm(null)
                }}
                disabled={!!actionBusy}
                className="inline-flex items-center gap-2 rounded-full border border-red-400/40 bg-red-400/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-400/25 disabled:opacity-50"
              >
                {actionBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('lm.machine.ctrl.stopConfirmYes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
