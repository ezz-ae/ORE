'use client'

/**
 * HOW MANY LEADS HAVE BEEN RATED, and how many of those were worth it.
 *
 * This began life as a "fifty good leads" scoreboard on the ads home page, and
 * it was wrong there twice over. A large number under a progress bar reads as
 * reassurance — "we have got you" — on a screen somebody opens in order to
 * CHANGE something. And a target parked away from the work that moves it is a
 * target nobody acts on.
 *
 * So it sits in the follow-up queue instead, where the next unrated lead is one
 * click away, and it says the one thing a person standing there can act on: how
 * many are still unrated. Everything else on it is context for that.
 *
 * The three bars stay, without the essay. "Good" means different things to
 * different people and the counts genuinely differ — showing one number would
 * be picking a definition on somebody else's behalf.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Star } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { DELIVERY_BARS, type DeliveryBar } from '@/lib/freehold/delivery-commitment'

interface Bar { bar: DeliveryBar; met: number; remaining: number; fraction: number; done: boolean }
type Forecast =
  | { known: false; reason: 'done' | 'tooFewRated' | 'noSpend' | 'noneGood' }
  | {
      known: true
      remaining: number
      rate: { lo: number; hi: number }
      leadsNeeded: { lo: number; hi: number }
      spendAed: { lo: number; hi: number }
    }
interface Row {
  campaignId: string
  campaignName: string
  bars: Bar[]
  leadsBought: number
  unrated: number
  spentAed: number
  spendKnown: boolean
  forecast: Forecast
}
interface Response {
  connected: boolean
  target?: number
  bar?: DeliveryBar
  recommendedBar?: DeliveryBar
  totals?: Bar[]
  rows?: Row[]
  unrated?: number
  leadsBought?: number
  capped?: number
  error?: string
}

const aed = (n: number) =>
  !Number.isFinite(n) ? '∞'
    : n >= 1000 ? `AED ${Math.round(n / 1000)}k`
    : `AED ${Math.round(n)}`

export default function LeadRatingProgress({
  target = 50, bar = 'valuable',
}: { target?: number; bar?: DeliveryBar }) {
  const t = useT()
  const [data, setData] = useState<Response | null>(null)
  const [shown, setShown] = useState<DeliveryBar>(bar)

  const load = useCallback(async () => {
    const d = await fetch(`/api/freehold/delivery?target=${target}&bar=${shown}`, { cache: 'no-store' })
      .then((r) => r.json()).catch(() => null)
    setData(d)
  }, [target, shown])
  useEffect(() => { void load() }, [load])

  if (!data) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-line bg-surface">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
      </div>
    )
  }
  if (!data.connected || data.error || !data.totals) return null

  const totals = data.totals
  const here = totals.find((b) => b.bar === shown) ?? totals[0]
  const rows = data.rows ?? []
  // The campaign carrying the most of this bar — the one to put money behind.
  const best = [...rows].sort((a, b) =>
    (b.bars.find((x) => x.bar === shown)?.met ?? 0) - (a.bars.find((x) => x.bar === shown)?.met ?? 0))[0]

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Star className="h-4 w-4 text-gold" /> {t('rating.title')}
        </h3>
        {/* Switching the bar re-reads the server rather than re-slicing what is
            already here: the forecast is computed against the chosen bar, and a
            client-side switch would show one bar's count under another bar's
            forecast. */}
        <div className="flex gap-1">
          {DELIVERY_BARS.map((b) => (
            <button key={b} type="button" onClick={() => setShown(b)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition ${
                shown === b ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-500 hover:text-slate-300'
              }`}>
              {t(`promise.bar.${b}`)}
            </button>
          ))}
        </div>
      </div>

      {/* THE NUMBER. Largest thing on the card, because it is the only one
          anybody is going to act on this month. */}
      <p className="mt-4 text-4xl font-semibold tabular-nums text-white">
        {here.met}<span className="text-2xl text-slate-500"> / {data.target ?? target}</span>
      </p>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full rounded-full transition-all ${here.done ? 'bg-emerald-400' : 'bg-gold'}`}
          style={{ width: `${Math.round(here.fraction * 100)}%` }} />
      </div>

      {/* THE OTHER TWO, always. Nobody has to be told the count changes with
          the definition — they can see it change. */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-500">
        {totals.filter((b) => b.bar !== shown).map((b) => (
          <span key={b.bar}>{t(`promise.bar.${b.bar}`)} <span className="text-slate-300">{b.met}</span></span>
        ))}
        <span>{t('promise.bought')} <span className="text-slate-300">{data.leadsBought ?? 0}</span></span>
      </div>

      {/* ALREADY PAID FOR, NOT YET CLAIMED. An unrated lead has not failed the
          bar — nobody has looked at it. Under the `valuable` bar every one of
          these is delivery sitting one click away from counting, which is why
          it is a route to the queue rather than a statistic. */}
      {shown === 'valuable' && (data.unrated ?? 0) > 0 && (
        <Link href="/freehold-intelligence/crm/follow-up"
          className="mt-3 flex items-start gap-2 rounded-xl border border-gold/25 bg-gold/[0.05] p-3 text-[12px] text-gold/90 transition hover:border-gold/40">
          <Star className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t('promise.unrated', { n: data.unrated ?? 0 })}
        </Link>
      )}

      {/* NO COST FORECAST HERE. What finishing costs is an ADS decision and
          this is the CRM — a broker rating leads cannot act on a budget range,
          and a number nobody at this screen can move is furniture. */}
      {(data.capped ?? 0) > 0 && (
        <p className="mt-3 text-[10px] text-slate-500">{t('promise.capped', { n: data.capped ?? 0 })}</p>
      )}
    </div>
  )
}
