'use client'

/**
 * What the machine is doing, on the page you land on.
 *
 * The Lead Machine hub opened with inventory readiness — how many projects
 * have a landing page. Useful, and not the subject. The subject is a machine
 * spending money on decisions it can explain, and none of that was visible
 * until you clicked into an individual machine.
 *
 * Three things, in the order an operator asks them:
 *
 *   1. Is it on, and what is it spending?
 *   2. What does it need from me? (things it cannot fix itself)
 *   3. What did it decide? (and why — the log already carries the reason)
 *
 * The decision feed is the point. Every line is the machine committing or
 * withholding real money with its evidence attached, and it was the most
 * compelling artefact in the product with nowhere to be seen.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Activity, AlertTriangle, Loader2, Play, Pause, TrendingUp, Rocket,
  ClipboardList, ShieldAlert, RefreshCw, Layers,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

type Entry = { id: string; kind: string; detail: string; at: string; machine: string }
type Pulse = {
  machines: { total: number; running: number; names: string[] }
  spend: { committedAed: number; capAed: number; liveCampaigns: number }
  lastActivityAt: string | null
  decisions: Entry[]
  alarms: Entry[]
}

/** One icon per kind, so the feed can be scanned rather than read. */
const KIND_ICON: Record<string, typeof Play> = {
  launched: Rocket, planned: ClipboardList, google_draft_prepared: ClipboardList,
  budget_shift: TrendingUp, trial_paused: Pause, trial_resumed: Play,
  permit_blocked: ShieldAlert, permit_warning: ShieldAlert,
  delivery_blocked: AlertTriangle, machine_stalled: AlertTriangle,
  creative_fatigue: RefreshCw, placement_drain: Layers,
  cap_enforced: AlertTriangle, error: AlertTriangle,
}

function ago(iso: string, t: ReturnType<typeof useT>): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 1) return t('lm.pulse.justNow')
  if (mins < 60) return t('lm.pulse.minsAgo', { n: mins })
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return t('lm.pulse.hrsAgo', { n: hrs })
  return t('lm.pulse.daysAgo', { n: Math.round(hrs / 24) })
}

export function MachinePulse() {
  const t = useT()
  const [p, setP] = useState<Pulse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/freehold/lead-machine/pulse', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !d.error) setP(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="mt-6 flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-5 py-5 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> {t('lm.pulse.loading')}
      </div>
    )
  }

  // No machine at all is a real state with a real next step, not an error.
  if (!p || p.machines.total === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.08] via-gold/[0.02] to-transparent p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Activity className="h-4 w-4 text-gold" /> {t('lm.pulse.noMachineTitle')}
        </div>
        <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-slate-400">{t('lm.pulse.noMachineBody')}</p>
        <Link href="/freehold-intelligence/lead-machine/ads-machine"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:opacity-90">
          <Activity className="h-3.5 w-3.5" /> {t('lm.pulse.noMachineCta')}
        </Link>
      </div>
    )
  }

  const live = p.machines.running > 0
  const pctOfCap = p.spend.capAed > 0 ? Math.min(100, Math.round((p.spend.committedAed / p.spend.capAed) * 100)) : 0

  return (
    <div className="mt-6 space-y-4">
      {/* 1 — is it on, and what is it spending */}
      <div className="rounded-2xl border border-line bg-surface-2 p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
            live ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                 : 'border-line-strong bg-surface text-slate-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-emerald-400' : 'bg-slate-600'}`} />
            {live ? t('lm.pulse.running', { n: p.machines.running }) : t('lm.pulse.idle')}
          </span>
          <span className="text-xs text-slate-400">
            {t('lm.pulse.liveCampaigns', { n: p.spend.liveCampaigns })}
          </span>
          {p.lastActivityAt && (
            <span className="text-xs text-slate-500">{t('lm.pulse.lastCycle', { when: ago(p.lastActivityAt, t) })}</span>
          )}
        </div>

        {/* Committed against the cap — the number that says whether the machine
            has room to act, which is not the same as what it has spent. */}
        {p.spend.capAed > 0 && (
          <div className="mt-3.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-400">{t('lm.pulse.committed')}</span>
              <span className="font-semibold text-white tabular-nums">
                AED {p.spend.committedAed.toLocaleString()}
                <span className="font-normal text-slate-500"> / {p.spend.capAed.toLocaleString()}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
              <div className={`h-full rounded-full ${pctOfCap >= 95 ? 'bg-amber-400' : 'bg-gold'}`} style={{ width: `${pctOfCap}%` }} />
            </div>
            {pctOfCap >= 95 && <p className="mt-1.5 text-[11px] text-amber-200/80">{t('lm.pulse.atCap')}</p>}
          </div>
        )}
      </div>

      {/* 2 — what it cannot fix itself */}
      {p.alarms.length > 0 && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.05] p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" /> {t('lm.pulse.needsYou', { n: p.alarms.length })}
          </div>
          <div className="mt-3 space-y-2">
            {p.alarms.map((a) => {
              const Icon = KIND_ICON[a.kind] ?? AlertTriangle
              return (
                <div key={a.id} className="flex items-start gap-2.5">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/80" />
                  <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-amber-100/85">{a.detail}</p>
                  <span className="shrink-0 text-[10px] text-amber-200/50">{ago(a.at, t)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 3 — what it decided, and why. The reason is already in the log. */}
      <div className="rounded-2xl border border-line bg-surface-2 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <Activity className="h-3.5 w-3.5 text-gold" /> {t('lm.pulse.decisions')}
          </div>
          <Link href="/freehold-intelligence/lead-machine/ads-machine"
            className="text-[11px] text-gold/70 transition hover:text-gold">{t('lm.pulse.openMachine')}</Link>
        </div>

        {p.decisions.length === 0 ? (
          <p className="mt-3 text-xs leading-relaxed text-slate-500">{t('lm.pulse.noDecisions')}</p>
        ) : (
          <div className="mt-3 space-y-2.5">
            {p.decisions.map((d) => {
              const Icon = KIND_ICON[d.kind] ?? Activity
              return (
                <div key={d.id} className="flex items-start gap-2.5 border-s-2 border-line ps-3">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] leading-relaxed text-slate-300">{d.detail}</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">{d.machine} · {ago(d.at, t)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
