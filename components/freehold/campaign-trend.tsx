'use client'

/**
 * THE SHAPE, NOT THE TOTAL.
 *
 * A campaign page full of totals answers "how much" and hides "which way".
 * Rising and falling cost per lead average to the same number; a campaign
 * that stopped delivering four days ago reads exactly like one that never
 * started. This draws the days.
 *
 * Deliberately plain SVG bars rather than a charting library: the page is
 * already heavy, and what an operator needs from this is the SHAPE — is it
 * climbing, flat, or dead — which a bar per day carries perfectly.
 *
 * THE HONEST FLOOR: fewer than three days is not a trend. Below it the chart
 * says so rather than drawing a line through two points and letting the eye
 * invent a direction.
 */
import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

interface Day { date: string; spend: number; leads: number; impressions: number; clicks: number }

const MIN_DAYS_FOR_TREND = 3

export default function CampaignTrend({ campaignId }: { campaignId: string }) {
  const t = useT()
  const [series, setSeries] = useState<Day[] | null>(null)

  useEffect(() => {
    fetch(`/api/meta/campaigns/${encodeURIComponent(campaignId)}/series`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSeries(Array.isArray(d?.series) ? d.series : []))
      .catch(() => setSeries([]))
  }, [campaignId])

  if (!series) return null
  if (series.length < MIN_DAYS_FOR_TREND) {
    return (
      <section className="mt-8 rounded-2xl border border-line bg-surface-2 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <TrendingUp className="h-4 w-4 text-gold" /> {t('lm.trend.title')}
        </div>
        <p className="mt-2 text-[13px] text-slate-500">{t('lm.trend.tooEarly')}</p>
      </section>
    )
  }

  const maxSpend = Math.max(...series.map((d) => d.spend), 1)
  const maxLeads = Math.max(...series.map((d) => d.leads), 1)
  const totalSpend = series.reduce((n, d) => n + d.spend, 0)
  const totalLeads = series.reduce((n, d) => n + d.leads, 0)

  // The last third against the first third — enough to say "getting cheaper"
  // or "getting dearer" without pretending a two-day wobble is a direction.
  const third = Math.max(1, Math.floor(series.length / 3))
  const early = series.slice(0, third)
  const late = series.slice(-third)
  const cplOf = (rows: Day[]) => {
    const s = rows.reduce((n, d) => n + d.spend, 0)
    const l = rows.reduce((n, d) => n + d.leads, 0)
    return l > 0 ? s / l : null
  }
  const cplEarly = cplOf(early)
  const cplLate = cplOf(late)
  // Only speak when BOTH halves produced leads — a direction computed from a
  // half with no leads is a division by nothing.
  const direction = cplEarly !== null && cplLate !== null
    ? (cplLate < cplEarly * 0.85 ? 'better' : cplLate > cplEarly * 1.15 ? 'worse' : 'steady')
    : null

  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface-2 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <TrendingUp className="h-4 w-4 text-gold" /> {t('lm.trend.title')}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span><span className="me-1 inline-block h-2 w-2 rounded-sm bg-slate-500" />{t('lm.trend.spend')}</span>
          <span><span className="me-1 inline-block h-2 w-2 rounded-sm bg-gold" />{t('lm.trend.leads')}</span>
        </div>
      </div>

      {/* One column per day: spend as the tall grey bar, leads as the gold
          one over it. Two scales, because a lead count and a dirham total
          share no axis — the point is each one's own shape over time. */}
      <div className="mt-4 flex h-28 items-end gap-[3px]">
        {series.map((d) => (
          <div key={d.date} className="group relative flex-1" title={`${d.date} · AED ${Math.round(d.spend)} · ${d.leads} lead(s)`}>
            <div className="flex h-28 flex-col justify-end gap-[2px]">
              <div className="w-full rounded-sm bg-gold/80" style={{ height: `${(d.leads / maxLeads) * 40}%` }} />
              <div className="w-full rounded-sm bg-slate-600/70" style={{ height: `${(d.spend / maxSpend) * 55}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[12px]">
        <span className="text-slate-400">{t('lm.trend.days', { n: series.length })}</span>
        <span className="text-white">AED {Math.round(totalSpend).toLocaleString()}</span>
        <span className="text-gold">{totalLeads} {t('lm.trend.leads')}</span>
        {direction && (
          <span className={direction === 'better' ? 'text-emerald-300' : direction === 'worse' ? 'text-rose-300' : 'text-slate-400'}>
            {t(`lm.trend.dir.${direction}`, { early: Math.round(cplEarly!), late: Math.round(cplLate!) })}
          </span>
        )}
      </div>
    </section>
  )
}
