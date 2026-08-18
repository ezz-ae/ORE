'use client'

/**
 * WHAT THE MONEY BOUGHT — the card that goes past the lead.
 *
 * Every number on this page stops at the lead: spend, cost per lead, a quality
 * score built out of funnel rates. `deal_value_aed` has been in the CRM the
 * whole time and reached nothing that decides where a dirham goes.
 *
 * So the ladder is drawn whole — spend, leads, worth calling, sold, money in —
 * and the verdict underneath says which of those this campaign has had TIME to
 * be judged on. A campaign eleven days old with no sale has not failed at
 * selling; deals here take about six weeks.
 *
 * The bars are the comparison, not decoration: one row per campaign, the same
 * scale, so "this one is dearer" is something you SEE rather than something
 * you compute from two numbers in different boxes. A campaign that has not
 * separated from the field gets no bar tone at all — see money-truth.ts, where
 * 'tied' is an answer.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import type { MoneyRung, MoneyVerdict } from '@/lib/freehold/money-truth'

interface Row {
  campaignId: string
  name: string
  isThis: boolean
  spendAed: number
  /** False when Meta returned no insights row. Withheld, never printed as 0. */
  spendKnown?: boolean
  leads: number
  qualified: number
  deals: number
  revenueAed: number
  ageDays: number
  rung: MoneyRung
  count: number
  /** hi is null when nothing has converted — no ceiling is supported. */
  cost: { lo: number; hi: number | null }
  returnPerDirham: { lo: number; hi: number | null } | null
  verdict: MoneyVerdict
  p: number
  beats: string[]
  beatenBy: string[]
}

interface Response {
  connected: boolean
  rows?: Row[]
  cycle?: { daysToQualify: number; daysToClose: number; measuredOn: number }
  medianDealAed?: number | null
  closedDeals?: number
  capped?: number
  error?: string
}

const TONE: Record<MoneyVerdict, string> = {
  ahead: 'text-emerald-300', behind: 'text-rose-300',
  tied: 'text-slate-400', tooEarly: 'text-slate-500',
}
const BAR: Record<MoneyVerdict, string> = {
  ahead: 'bg-emerald-400/70', behind: 'bg-rose-400/70',
  tied: 'bg-slate-500/60', tooEarly: 'bg-slate-700',
}

const aed = (n: number) =>
  n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000 ? `AED ${Math.round(n / 1000)}k`
    : `AED ${Math.round(n)}`

export default function MoneyLadderPanel({ campaignId }: { campaignId: string }) {
  const t = useT()
  const [data, setData] = useState<Response | null>(null)

  const load = useCallback(async () => {
    const d = await fetch(`/api/meta/campaigns/${campaignId}/money`, { cache: 'no-store' })
      .then((r) => r.json()).catch(() => null)
    setData(d)
  }, [campaignId])
  useEffect(() => { void load() }, [load])

  if (!data) {
    return (
      <div className="flex min-h-[100px] items-center justify-center rounded-2xl border border-line bg-surface">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
      </div>
    )
  }
  if (!data.connected || data.error || !data.rows?.length) return null

  const rows = data.rows
  const me = rows.find((r) => r.isThis)
  if (!me) return null

  // The bar scale is the dearest KNOWN cost across the field. A campaign with
  // no ceiling (nothing converted yet) is drawn full width and toneless —
  // "we do not know how expensive this is" reads correctly as the whole bar.
  const known = rows.map((r) => r.cost.hi ?? r.cost.lo).filter((n) => Number.isFinite(n) && n > 0)
  const scale = known.length ? Math.max(...known) : 1

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold text-white">{t('money.title')}</h3>

      {/* One sentence, and it names the thing rather than the mechanism. */}
      <p className={`mt-1 text-[12px] leading-relaxed ${TONE[me.verdict]}`}>
        {t(`money.said.${me.verdict}`, {
          rung: t(`money.rung.${me.rung}`),
          n: me.count,
          cost: me.cost.hi === null ? `${aed(me.cost.lo)}+` : aed((me.cost.lo + me.cost.hi) / 2),
          rival: me.beats[0] ?? me.beatenBy[0] ?? '',
          days: me.ageDays,
          cycle: data.cycle?.daysToClose ?? 42,
        })}
      </p>

      {/* THE LADDER. Four steps and the money, in the order they happen. */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
        {([
          // WITHHELD, NOT ZERO. "AED 0" beside "2 LEADS" is a sentence that
          // cannot be true, and it was being printed because a missing
          // insights row was coerced to a number. A dash says the one true
          // thing: we do not have this figure yet.
          ['spend', me.spendKnown === false ? '—' : aed(me.spendAed)],
          ['leads', String(me.leads)],
          ['qualified', String(me.qualified)],
          ['deals', String(me.deals)],
          ['revenue', me.revenueAed > 0 ? aed(me.revenueAed) : '—'],
        ] as const).map(([key, value]) => (
          <div key={key}>
            <dt className="text-[10px] uppercase tracking-wider text-slate-500">{t(`money.step.${key}`)}</dt>
            <dd className="text-[15px] font-semibold text-white">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Return is withheld until the account has closed enough to have a
          median deal — a return computed from two deals is a story about two
          properties, not about this campaign. */}
      {me.returnPerDirham && (
        <p className="mt-3 text-[11px] text-slate-400">
          {t('money.return', {
            lo: me.returnPerDirham.lo.toFixed(1),
            hi: me.returnPerDirham.hi === null ? '∞' : me.returnPerDirham.hi.toFixed(1),
            median: aed(data.medianDealAed ?? 0),
            deals: data.closedDeals ?? 0,
          })}
        </p>
      )}

      <ul className="mt-4 space-y-2 border-t border-line pt-4">
        {rows.map((r) => {
          const width = Math.max(3, Math.min(100, ((r.cost.hi ?? scale) / scale) * 100))
          return (
            <li key={r.campaignId}>
              <div className="flex items-baseline justify-between gap-3">
                <span className={`truncate text-[11px] ${r.isThis ? 'text-white' : 'text-slate-400'}`}>
                  {r.name}
                </span>
                <span className={`shrink-0 text-[11px] tabular-nums ${TONE[r.verdict]}`}>
                  {r.cost.hi === null
                    ? t('money.perOpen', { cost: aed(r.cost.lo), rung: t(`money.rung.${r.rung}`) })
                    : t('money.per', {
                        cost: aed((r.cost.lo + r.cost.hi) / 2), rung: t(`money.rung.${r.rung}`),
                      })}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full ${BAR[r.verdict]}`} style={{ width: `${width}%` }} />
              </div>
            </li>
          )
        })}
      </ul>

      {/* Whose sales cycle this is. An account with its own closed deals is
          paced by them; one without is paced by a stated default, and saying
          which is the difference between a measurement and a guess. */}
      <p className="mt-4 text-[10px] text-slate-500">
        {data.cycle?.measuredOn
          ? t('money.cycleOwn', { days: data.cycle.daysToClose, n: data.cycle.measuredOn })
          : t('money.cycleDefault', { days: data.cycle?.daysToClose ?? 42 })}
        {(data.capped ?? 0) > 0 ? ` · ${t('money.capped', { n: data.capped ?? 0 })}` : ''}
      </p>
    </div>
  )
}
