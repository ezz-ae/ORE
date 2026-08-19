'use client'

/**
 * FIFTY GOOD LEADS — the promise, on a screen, in one number.
 *
 * The client will not be invoiced until fifty good leads have landed. That is
 * the only number that matters this month, and until now it lived in somebody's
 * head while the screens reported cost per lead — the number that has already
 * been wrong once here, by a factor of fifty.
 *
 * THREE BARS, ALWAYS SHOWN TOGETHER. "Good" is a term of a deal, not a fact,
 * and a panel that picked one definition would be taking a side in somebody
 * else's negotiation. Three lines side by side turns "is this real" into
 * "which line did we agree on", which is a conversation that ends.
 *
 * The unrated count sits beside the recommended bar and is never folded into
 * it. An unrated lead has not failed — nobody has looked at it. On this account
 * that distinction is most of the answer: leads already bought and paid for,
 * sitting one broker-click away from counting.
 */
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Target, AlertTriangle, Star } from 'lucide-react'
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

export default function DeliveryPromisePanel({
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
          <Target className="h-4 w-4 text-gold" /> {t('promise.title', { n: data.target ?? target })}
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
      <p className="mt-1 text-[12px] text-slate-400">{t(`promise.said.${shown}`)}</p>

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

      {/* WHAT FINISHING COSTS — or a named refusal to guess. */}
      {best && (
        <div className="mt-3 rounded-xl border border-line bg-surface-2/40 p-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
            {t('promise.finish')}
          </p>
          {best.forecast.known ? (
            <>
              <p className="mt-1 text-[13px] text-slate-200">
                {t('promise.cost', {
                  name: best.campaignName,
                  leads: `${best.forecast.leadsNeeded.lo}–${Number.isFinite(best.forecast.leadsNeeded.hi) ? best.forecast.leadsNeeded.hi : '∞'}`,
                  spend: `${aed(best.forecast.spendAed.lo)}–${aed(best.forecast.spendAed.hi)}`,
                })}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {t('promise.rate', {
                  lo: (best.forecast.rate.lo * 100).toFixed(0),
                  hi: (best.forecast.rate.hi * 100).toFixed(0),
                })}
              </p>
              {/* MORE MONEY IS THE WRONG ANSWER below a certain rate, and a
                  forecast that just returned a huge number would be read as a
                  plan. Said as what it is. */}
              {best.forecast.rate.hi < 0.05 && (
                <p className="mt-2 flex items-start gap-2 text-[12px] text-rose-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('promise.hopeless')}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-[12px] text-slate-400">{t(`promise.cannot.${best.forecast.reason}`)}</p>
          )}
        </div>
      )}

      {(data.capped ?? 0) > 0 && (
        <p className="mt-3 text-[10px] text-slate-500">{t('promise.capped', { n: data.capped ?? 0 })}</p>
      )}
    </div>
  )
}
