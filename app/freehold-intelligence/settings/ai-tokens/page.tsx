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

const OPENING_CONSUMED = 2_003_320_000
const OPENING_BALANCE = 87_400_000
const LOW_WATERMARK = 500_000_000
/** Under this, the amber LOW state escalates to a critical EXTREMELY LOW alert. */
const CRITICAL_WATERMARK = 100_000_000
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
  amount: number
  after: number
}

const txnId = () =>
  `txn_${Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(16).padStart(2, '0')).join('')}`

/** Fixed opening trail so the ledger reads as an operating system, day one.
 *  Balance-after chain is coherent: each row's after = next row's after + amount. */
const OPENING_TRAIL: TrailEntry[] = [
  { id: 'txn_9f41c02a77d1', at: new Date('2026-08-10T10:15:00+04:00'), amount: 750_000_000, after: 87_400_000 },
  { id: 'txn_5b8e33f19c04', at: new Date('2026-08-09T18:40:00+04:00'), amount: 1_250_000_000, after: 837_400_000 },
  { id: 'txn_c27a90d45e18', at: new Date('2026-08-09T09:05:00+04:00'), amount: 2_000_000_000, after: 2_087_400_000 },
]

const num = (v: number) => Math.round(v).toLocaleString('en-US')
/** Balance display, in the same "M tokens" unit the sender uses — the small,
 *  readable magnitude is the point: it's what makes "critically low" legible
 *  against a nine-figure consumed total. */
const numM = (v: number) =>
  (v / SEND_UNIT).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export default function AiTokenControlPage() {
  const t = useT()
  const [consumed, setConsumed] = useState(OPENING_CONSUMED)
  const [balance, setBalance] = useState(OPENING_BALANCE)
  const [trail, setTrail] = useState<TrailEntry[]>(OPENING_TRAIL)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(false)

  // Ambient burn: the balance drains continuously at varying speeds — mostly a
  // slow trickle, occasional heavier pulls — so the meter reads as live
  // consumption. Burn is ambient usage, so it moves both counters but never
  // writes the trail (the trail is for explicit transfers only).
  useEffect(() => {
    const tick = () => {
      const r = Math.random()
      // ~25% idle · ~60% trickle · ~15% burst
      const delta = r < 0.25 ? 0 : r < 0.85 ? 20_000 + Math.random() * 70_000 : 150_000 + Math.random() * 300_000
      if (delta === 0) return
      setBalance((b) => {
        const burned = Math.round(Math.min(delta, b))
        if (burned <= 0) return b
        setConsumed((c) => c + burned)
        return b - burned
      })
    }
    const id = setInterval(tick, 2000)
    return () => clearInterval(id)
  }, [])

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
    setTrail((prev) => [{ id: txnId(), at: new Date(), amount: parsed, after }, ...prev])
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
            <div className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${critical ? 'text-red-400' : 'text-white'}`} dir="ltr">{numM(balance)}</div>
            <div className="mt-0.5 text-xs text-slate-500">{t('settings.tokens.amountUnit')}</div>
            {critical ? (
              <div className="mt-1 text-xs font-medium leading-relaxed text-red-400">{t('settings.tokens.criticalNote')}</div>
            ) : low ? (
              <div className="mt-1 text-xs leading-relaxed text-amber-400/90">{t('settings.tokens.lowNote')}</div>
            ) : null}
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
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-300">{t('settings.tokens.recipientDev')}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-xs tabular-nums text-white" dir="ltr">−{num(e.amount)}</td>
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
