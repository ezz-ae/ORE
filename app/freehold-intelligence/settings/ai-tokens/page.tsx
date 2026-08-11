'use client'

/**
 * AI Token Control — the platform-intelligence quota monitor.
 *
 * HARDCODED control surface by explicit product decision: figures live in
 * client state only, connected to no API and no store. It exists so the
 * operator can see, on the current deployment, how a token transfer moves the
 * balance — the send form debits the live balance and writes the trail in
 * place. Wiring it to real metering is a later, separate decision.
 */

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Cpu, TriangleAlert } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

/** A fresh top-up: consumption starts at zero against a 15,000,000-token credit. */
const OPENING_CONSUMED = 0
const OPENING_BALANCE = 15_000_000
/** Alert thresholds are PROPORTIONAL to the credit pool (30% / 10%), not an
 *  absolute figure — so LOW / EXTREMELY LOW reflect genuine depletion of
 *  THIS balance as it drains, rather than a fixed line left over from a
 *  different scale. */
const LOW_WATERMARK = Math.round(OPENING_BALANCE * 0.3) // 4,500,000
const CRITICAL_WATERMARK = Math.round(OPENING_BALANCE * 0.1) // 1,500,000

/** Daily consumption rate — randomized once per session within the stated
 *  300k–1M/day band, then rounded to a clean figure so it reads as a
 *  deliberately-set budget, not a jittery float. Every tick's burn size is
 *  DERIVED from this rate (see the effect below), so the live meter always
 *  ties back to a calculated, displayed number rather than an arbitrary one. */
const DAILY_BURN_MIN = 300_000
const DAILY_BURN_MAX = 1_000_000
const pickDailyRate = () =>
  Math.round((DAILY_BURN_MIN + Math.random() * (DAILY_BURN_MAX - DAILY_BURN_MIN)) / 10_000) * 10_000

const TICK_MS = 2000
/** A full day's pacing compressed into a watchable ~30-minute window — the
 *  meter stays live without waiting a literal day, while the total burn
 *  stays anchored to dailyRate via the tick math in the effect below. */
const WINDOW_TICKS = (30 * 60 * 1000) / TICK_MS // 900

/** Per-workload utilization meters (percent of each workload's allocation). */
const WORKLOADS: Array<{ key: string; pct: number }> = [
  { key: 'settings.tokens.usageDev', pct: 85 },
  { key: 'settings.tokens.usageExpertChat', pct: 31 },
  { key: 'settings.tokens.usageMediaGen', pct: 17 },
  { key: 'settings.tokens.usageOperations', pct: 9 },
  { key: 'settings.tokens.usageDeployment', pct: 4 },
]

/** Meta AI runs on its own dedicated quota, metered apart from platform usage. */
const META_AI = { pct: 54, used: 810_000_000, total: 1_500_000_000 }
/** The sender takes amounts in millions of tokens. */
const SEND_UNIT = 1_000_000

interface TrailEntry {
  id: string
  at: Date
  kind: 'credit' | 'debit'
  amount: number
  after: number
}

const txnId = () =>
  `txn_${Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, '0')).join('')}`

/** Fixed opening trail so the ledger reads as an operating system, day one:
 *  the 15,000,000-token top-up that set today's opening balance. */
const OPENING_TRAIL: TrailEntry[] = [
  { id: 'txn_7c14ad02f9e3', at: new Date('2026-08-11T09:00:00+04:00'), kind: 'credit', amount: 15_000_000, after: 15_000_000 },
]

const num = (v: number) => Math.round(v).toLocaleString('en-US')

export default function AiTokenControlPage() {
  const t = useT()
  const [consumed, setConsumed] = useState(OPENING_CONSUMED)
  const [balance, setBalance] = useState(OPENING_BALANCE)
  const [trail, setTrail] = useState<TrailEntry[]>(OPENING_TRAIL)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(false)
  // Randomized once per session, within the stated 300k–1M/day band — stable
  // for the life of this page load, and displayed so the pacing is legible.
  const [dailyRate] = useState(pickDailyRate)

  // Ambient burn: the balance drains continuously at varying speeds, paced so
  // the tick-by-tick expectation tracks back to dailyRate/day (not an
  // unrelated animation speed). Burn moves both counters but never writes the
  // trail (the trail is for explicit transfers only).
  useEffect(() => {
    const avgPerTick = dailyRate / WINDOW_TICKS
    const tick = () => {
      const r = Math.random()
      // idle 35% · trickle 50% (0.4–1.6× avg) · burst 15% (2–5× avg) —
      // weighted so 0.5×1.0×avg + 0.15×3.33×avg ≈ avg, i.e. the long-run
      // burn rate converges on the displayed dailyRate.
      const delta =
        r < 0.35 ? 0 : r < 0.85 ? avgPerTick * (0.4 + Math.random() * 1.2) : avgPerTick * (2 + Math.random() * 3)
      if (delta <= 0) return
      setBalance((b) => {
        const burned = Math.round(Math.min(delta, b))
        if (burned <= 0) return b
        setConsumed((c) => c + burned)
        return b - burned
      })
    }
    const id = setInterval(tick, TICK_MS)
    return () => clearInterval(id)
  }, [dailyRate])

  const critical = balance < CRITICAL_WATERMARK
  const low = !critical && balance < LOW_WATERMARK
  // Sender input is in MILLIONS of tokens.
  const parsed = useMemo(() => {
    const n = Number.parseFloat(amount)
    return Number.isFinite(n) && n > 0 ? Math.round(n * SEND_UNIT) : null
  }, [amount])

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!parsed) return
    if (parsed > balance) {
      setError(t('settings.tokens.insufficient'))
      return
    }
    const after = balance - parsed
    setBalance(after)
    setConsumed((c) => c + parsed)
    setTrail((prev) => [{ id: txnId(), at: new Date(), kind: 'debit', amount: parsed, after }, ...prev])
    setAmount('')
    setFlash(true)
    setTimeout(() => setFlash(false), 2500)
  }

  const timeFmt = (d: Date) =>
    d.toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai',
    })

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">
      <div className="mb-1 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">{t('settings.tokens.title')}</h1>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          {t('settings.tokens.updatedNow')}
        </span>
      </div>
      <p className="mb-8 text-sm text-slate-400">{t('settings.tokens.subtitle')}</p>

      {/* Quota snapshot */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('settings.tokens.quotaTitle')}</div>
          <div className="text-xs text-slate-500" dir="ltr">{t('settings.tokens.quotaWindow')}</div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-[14px] border border-line bg-surface p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Cpu className="h-3.5 w-3.5 text-gold/70" />
              {t('settings.tokens.totalConsumed')}
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white" dir="ltr">{num(consumed)}</div>
            <div className="mt-0.5 text-xs text-slate-500">{t('settings.tokens.tokens')}</div>
          </div>
          <div className={`rounded-[14px] border p-4 ${critical ? 'border-red-500/40 bg-red-500/[0.06]' : low ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-line bg-surface'}`}>
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">{t('settings.tokens.currentBalance')}</div>
              {critical ? (
                <span className="inline-flex animate-pulse items-center gap-1 rounded-full border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
                  <TriangleAlert className="h-3 w-3" />
                  {t('settings.tokens.criticalBadge')}
                </span>
              ) : low ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                  <TriangleAlert className="h-3 w-3" />
                  {t('settings.tokens.lowBadge')}
                </span>
              ) : null}
            </div>
            <div className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${critical ? 'text-red-400' : 'text-white'}`} dir="ltr">{num(balance)}</div>
            <div className="mt-0.5 text-xs text-slate-500">{t('settings.tokens.tokens')}</div>
            {critical ? (
              <div className="mt-1 text-xs font-medium leading-relaxed text-red-400">{t('settings.tokens.criticalNote')}</div>
            ) : low ? (
              <div className="mt-1 text-xs leading-relaxed text-amber-400/90">{t('settings.tokens.lowNote')}</div>
            ) : null}
            <div className="mt-1.5 text-[11px] text-slate-500" dir="ltr">
              {t('settings.tokens.dailyRateNote', { rate: num(dailyRate) })}
            </div>
          </div>
        </div>
      </section>

      {/* Meta AI — dedicated quota, its own meter */}
      <section className="mb-6 rounded-[14px] border border-emerald-500/25 bg-emerald-500/[0.04] p-4">
        <div className="mb-1 flex items-center justify-between">
          <div className="text-sm font-semibold text-white">{t('settings.tokens.usageMetaAi')}</div>
          <span className="font-mono text-sm tabular-nums text-emerald-400" dir="ltr">{META_AI.pct}%</span>
        </div>
        <p className="mb-3 text-xs text-slate-400">{t('settings.tokens.metaAiDesc')}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5" dir="ltr">
          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${META_AI.pct}%` }} />
        </div>
        <div className="mt-2 text-xs text-slate-500" dir="ltr">
          <span className="font-mono tabular-nums text-slate-300">
            {t('settings.tokens.metaAiUsed', { used: num(META_AI.used), total: num(META_AI.total) })}
          </span>
        </div>
      </section>

      {/* Usage by workload */}
      <section className="mb-6 rounded-[14px] border border-line bg-surface p-4">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('settings.tokens.usageTitle')}</div>
        <div className="space-y-3.5">
          {WORKLOADS.map(({ key, pct }) => (
            <div key={key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-slate-300">{t(key)}</span>
                <span className="font-mono tabular-nums text-white" dir="ltr">{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5" dir="ltr">
                <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Development team token sender */}
      <section className="mb-6 rounded-[18px] border border-line bg-surface p-6">
        <div className="text-sm font-semibold text-white">{t('settings.tokens.senderTitle')}</div>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{t('settings.tokens.senderDesc')}</p>
        <form onSubmit={send} className="mt-4 flex items-center gap-3">
          <input
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError('') }}
            inputMode="decimal"
            placeholder={t('settings.tokens.amountPh')}
            dir="ltr"
            className="w-40 rounded-lg border border-line bg-white/[0.03] px-3 py-2 font-mono text-sm tabular-nums text-white outline-none placeholder:text-slate-600 focus:border-gold/50"
          />
          <span className="text-xs text-slate-500">{t('settings.tokens.amountUnit')}</span>
          <button
            type="submit"
            disabled={!parsed}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-black transition disabled:opacity-40"
          >
            {t('settings.tokens.send')}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
          {flash ? <span className="text-xs text-emerald-400">{t('settings.tokens.sent')}</span> : null}
        </form>
        {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}
      </section>

      {/* Token trail */}
      <section className="rounded-[18px] border border-line bg-surface">
        <div className="border-b border-line px-6 py-4 text-sm font-semibold text-white">{t('settings.tokens.trailTitle')}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-3 font-medium">{t('settings.tokens.trailTx')}</th>
                <th className="px-3 py-3 font-medium">{t('settings.tokens.trailTime')}</th>
                <th className="px-3 py-3 font-medium">{t('settings.tokens.trailTo')}</th>
                <th className="px-3 py-3 text-right font-medium">{t('settings.tokens.trailAmount')}</th>
                <th className="px-3 py-3 text-right font-medium">{t('settings.tokens.trailAfter')}</th>
                <th className="px-6 py-3 text-right font-medium">{t('settings.tokens.trailStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {trail.map((e) => (
                <tr key={e.id} className="border-t border-line/60">
                  <td className="px-6 py-3 font-mono text-xs text-slate-500" dir="ltr">{e.id}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-400" dir="ltr">{timeFmt(e.at)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-300">
                    {t(e.kind === 'credit' ? 'settings.tokens.creditSource' : 'settings.tokens.recipientDev')}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-3 text-right font-mono text-xs tabular-nums ${e.kind === 'credit' ? 'text-emerald-400' : 'text-white'}`}
                    dir="ltr"
                  >
                    {e.kind === 'credit' ? '+' : '−'}{num(e.amount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-xs tabular-nums text-slate-300" dir="ltr">{num(e.after)}</td>
                  <td className="whitespace-nowrap px-6 py-3 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                      {t('settings.tokens.trailCompleted')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
