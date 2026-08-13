'use client'

/**
 * AI Token Control — the platform-intelligence quota monitor.
 *
 * HARDCODED control surface by explicit product decision: connected to no
 * API, no database, no network call. State lives in the browser's own
 * localStorage — still "not connected to anything" in the sense that matters
 * (no server), but durable, so the meter never resets on refresh and keeps
 * draining forward across closed tabs and days via a time-based catch-up.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
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
 *  10k–50k/day band, then rounded to a clean figure so it reads as a
 *  deliberately-set budget, not a jittery float. Every tick's burn size is
 *  DERIVED from this rate (see the effect below), so the live meter always
 *  ties back to a calculated, displayed number rather than an arbitrary one. */
const DAILY_BURN_MIN = 10_000
const DAILY_BURN_MAX = 50_000
const pickDailyRate = () =>
  Math.round((DAILY_BURN_MIN + Math.random() * (DAILY_BURN_MAX - DAILY_BURN_MIN)) / 1_000) * 1_000

const TICK_MS = 2000
/** dailyRate means a REAL calendar day — no compression. This is the ONE
 *  clock the whole page runs on: while the tab is open, ticks burn at
 *  dailyRate per 24 real hours; while it's closed (or just refreshed), the
 *  same rate is applied to the real elapsed time on the next load — so
 *  "300k–1M every day" is literally true, live viewing and offline catch-up
 *  never disagree, and an overnight gap burns roughly one day, not several. */
const WINDOW_MS = 24 * 60 * 60 * 1000
const WINDOW_TICKS = WINDOW_MS / TICK_MS // 43,200

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

/** Fresh-init trail: the 15,000,000-token top-up, dated to whenever this
 *  browser first opens the page (see hydration below) — not a fixed date,
 *  since the ledger is now real, persisted state. */
const openingTrail = (): TrailEntry[] => [
  { id: 'txn_7c14ad02f9e3', at: new Date(), kind: 'credit', amount: OPENING_BALANCE, after: OPENING_BALANCE },
]

const num = (v: number) => Math.round(v).toLocaleString('en-US')

// ── Persistence — localStorage only, no network, no server ─────────────────
const STORAGE_KEY = 'fh_ai_token_control_v1'
// v1 → v2: the catch-up window was wrongly compressed to 30 minutes, so an
// overnight gap burned many simulated "days" instead of one real day.
// v2 → v3: dailyRate is no longer PART of the stored shape at all — see
// below. Every earlier version tied a tuning change (the rate band, the
// window size) to a version bump, and a version bump discards the ledger.
// That meant every time the PACE was adjusted, progress reset — the exact
// complaint this fixes. From v3 on, only a genuine STORAGE SHAPE change
// (adding/removing a required field) should ever bump this number; a rate
// or pacing tweak in code takes effect immediately, on the existing balance,
// with no reset, ever.
const STORAGE_VERSION = 3

interface Ledger {
  consumed: number
  balance: number
  trail: TrailEntry[]
}

// dailyRate is deliberately NOT part of the stored shape. Storing it meant
// freezing whatever rate happened to be picked when the ledger was created —
// so tuning DAILY_BURN_MIN/MAX in code could never reach an existing ledger
// without discarding it. The rate is now always read fresh from the current
// code on every load (see the hydration effect) and applied to the persisted
// balance/consumed/trail, which are the only things that need to survive.
interface StoredLedger {
  version: number
  consumed: number
  balance: number
  trail: Array<{ id: string; at: string; kind: 'credit' | 'debit'; amount: number; after: number }>
  lastTickAt: string
}

function readStored(): StoredLedger | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredLedger>
    if (
      parsed?.version !== STORAGE_VERSION ||
      !Number.isFinite(parsed.consumed) ||
      !Number.isFinite(parsed.balance) ||
      !Array.isArray(parsed.trail) ||
      typeof parsed.lastTickAt !== 'string'
    ) {
      return null
    }
    return parsed as StoredLedger
  } catch {
    return null // corrupt or unavailable (private mode, quota) — fall back to a fresh start
  }
}

function writeStored(ledger: Ledger, lastTickAt: number): void {
  try {
    const payload: StoredLedger = {
      version: STORAGE_VERSION,
      consumed: ledger.consumed,
      balance: ledger.balance,
      trail: ledger.trail.map((e) => ({ ...e, at: e.at.toISOString() })),
      lastTickAt: new Date(lastTickAt).toISOString(),
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    /* storage unavailable — the live session still works, just won't persist */
  }
}

export default function AiTokenControlPage() {
  const t = useT()
  const [ledger, setLedger] = useState<Ledger>({
    consumed: OPENING_CONSUMED,
    balance: OPENING_BALANCE,
    trail: openingTrail(),
  })
  // null until hydration resolves what dailyRate actually is (stored or
  // freshly picked) — nothing ticks or persists before that.
  const [dailyRate, setDailyRate] = useState<number | null>(null)
  // False for the first render on every mount — including a plain refresh.
  // The page MUST NOT show OPENING_BALANCE/OPENING_CONSUMED before the real
  // stored balance is known, or that default flashes on screen for a beat
  // and reads exactly like a reset even though nothing was actually touched.
  const [hydrated, setHydrated] = useState(false)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState(false)
  const lastTickRef = useRef<number>(Date.now())

  // Hydrate once on mount: read localStorage, and if a ledger is already
  // there, fast-forward it by however much real time passed since it was
  // last saved — closed-tab time burns tokens too. The rate is ALWAYS picked
  // fresh from the current code (never read from storage), so a future rate
  // tweak applies immediately, to the real saved balance, with no reset.
  // No saved state (or corrupt/incompatible shape) → fresh start.
  useEffect(() => {
    const rate = pickDailyRate()
    setDailyRate(rate)
    const stored = readStored()
    if (!stored) {
      lastTickRef.current = Date.now()
      setHydrated(true)
      return
    }
    const lastTick = new Date(stored.lastTickAt).getTime()
    const elapsedMs = Math.max(0, Date.now() - (Number.isFinite(lastTick) ? lastTick : Date.now()))
    const caughtUpBurn = Math.round(Math.min((elapsedMs / WINDOW_MS) * rate, stored.balance))
    setLedger({
      consumed: stored.consumed + caughtUpBurn,
      balance: stored.balance - caughtUpBurn,
      trail: stored.trail.map((e) => ({ ...e, at: new Date(e.at) })),
    })
    lastTickRef.current = Date.now()
    setHydrated(true)
  }, [])

  // Persist on every ledger change, once hydrated — a refresh a moment later
  // reads back this exact state (near-zero catch-up), never the opening one.
  useEffect(() => {
    if (!hydrated) return
    writeStored(ledger, lastTickRef.current)
  }, [ledger, hydrated])

  // Ambient burn: the balance drains continuously at varying speeds, paced so
  // the tick-by-tick expectation tracks back to dailyRate/day (the same rate
  // the hydration catch-up above uses, so open-tab and closed-tab time agree).
  // Burn moves both counters but never writes the trail (transfers only).
  useEffect(() => {
    if (dailyRate == null) return
    const avgPerTick = dailyRate / WINDOW_TICKS
    const tick = () => {
      lastTickRef.current = Date.now()
      const r = Math.random()
      // idle 35% · trickle 50% (0.4–1.6× avg) · burst 15% (2–5× avg) —
      // weighted so 0.5×1.0×avg + 0.15×3.33×avg ≈ avg, i.e. the long-run
      // burn rate converges on the displayed dailyRate.
      const delta =
        r < 0.35 ? 0 : r < 0.85 ? avgPerTick * (0.4 + Math.random() * 1.2) : avgPerTick * (2 + Math.random() * 3)
      if (delta <= 0) return
      setLedger((prev) => {
        const burned = Math.round(Math.min(delta, prev.balance))
        if (burned <= 0) return prev
        return { ...prev, consumed: prev.consumed + burned, balance: prev.balance - burned }
      })
    }
    const id = setInterval(tick, TICK_MS)
    return () => clearInterval(id)
  }, [dailyRate])

  const critical = ledger.balance < CRITICAL_WATERMARK
  const low = !critical && ledger.balance < LOW_WATERMARK
  // Sender input is in MILLIONS of tokens.
  const parsed = useMemo(() => {
    const n = Number.parseFloat(amount)
    return Number.isFinite(n) && n > 0 ? Math.round(n * SEND_UNIT) : null
  }, [amount])

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!parsed) return
    if (parsed > ledger.balance) {
      setError(t('settings.tokens.insufficient'))
      return
    }
    lastTickRef.current = Date.now()
    setLedger((prev) => {
      const after = prev.balance - parsed
      return {
        consumed: prev.consumed + parsed,
        balance: after,
        trail: [{ id: txnId(), at: new Date(), kind: 'debit', amount: parsed, after }, ...prev.trail],
      }
    })
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
            <div className="mt-2 font-mono text-2xl font-semibold tabular-nums text-white" dir="ltr">
              {hydrated ? num(ledger.consumed) : '—'}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">{t('settings.tokens.tokens')}</div>
          </div>
          <div className={`rounded-[14px] border p-4 ${hydrated && critical ? 'border-red-500/40 bg-red-500/[0.06]' : hydrated && low ? 'border-amber-500/30 bg-amber-500/[0.04]' : 'border-line bg-surface'}`}>
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">{t('settings.tokens.currentBalance')}</div>
              {hydrated && critical ? (
                <span className="inline-flex animate-pulse items-center gap-1 rounded-full border border-red-500/50 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
                  <TriangleAlert className="h-3 w-3" />
                  {t('settings.tokens.criticalBadge')}
                </span>
              ) : hydrated && low ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
                  <TriangleAlert className="h-3 w-3" />
                  {t('settings.tokens.lowBadge')}
                </span>
              ) : null}
            </div>
            <div className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${hydrated && critical ? 'text-red-400' : 'text-white'}`} dir="ltr">
              {hydrated ? num(ledger.balance) : '—'}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">{t('settings.tokens.tokens')}</div>
            {hydrated && critical ? (
              <div className="mt-1 text-xs font-medium leading-relaxed text-red-400">{t('settings.tokens.criticalNote')}</div>
            ) : hydrated && low ? (
              <div className="mt-1 text-xs leading-relaxed text-amber-400/90">{t('settings.tokens.lowNote')}</div>
            ) : null}
            {hydrated && dailyRate != null ? (
              <div className="mt-1.5 text-[11px] text-slate-500" dir="ltr">
                {t('settings.tokens.dailyRateNote', { rate: num(dailyRate) })}
              </div>
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
              {hydrated && ledger.trail.map((e) => (
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
