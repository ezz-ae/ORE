'use client'

/**
 * WHEN THE GOOD LEADS ARRIVE.
 *
 * Four bars, one per part of the day, showing how many of that block's leads
 * turned into somebody worth calling. The bar is the comparison — "the night
 * is half the morning" is something you see rather than something you work out
 * from two percentages in different boxes.
 *
 * The important line is the one under a bad block. "Nobody answered these for
 * seven hours" and "these leads are worse" look identical in a conversion rate
 * and lead to opposite actions: one is a rota to fix, the other is an hour to
 * stop buying. The panel never merges them.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import type { DayBlock, HourVerdict } from '@/lib/freehold/hour-truth'

interface Block {
  block: DayBlock
  leads: number
  qualified: number
  ratePct: number | null
  medianResponseMinutes: number | null
  neverAnswered: number
  verdict: HourVerdict
  p: number
  hours: [number, number]
}

interface Response {
  lookbackDays: number
  total: number
  blocks: Block[]
  schedule: DayBlock[] | null
}

const TONE: Record<HourVerdict, string> = {
  strong: 'text-emerald-300', weak: 'text-rose-300',
  unanswered: 'text-amber-200', even: 'text-slate-400', thin: 'text-slate-500',
}
const BAR: Record<HourVerdict, string> = {
  strong: 'bg-emerald-400/70', weak: 'bg-rose-400/70',
  unanswered: 'bg-amber-300/70', even: 'bg-slate-500/60', thin: 'bg-slate-700',
}

const wait = (m: number) => (m >= 120 ? `${Math.round(m / 60)}h` : `${Math.round(m)}m`)

export default function HourTruthPanel() {
  const t = useT()
  const [data, setData] = useState<Response | null>(null)

  const load = useCallback(async () => {
    const d = await fetch('/api/ads/hours', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    setData(d)
  }, [])
  useEffect(() => { void load() }, [load])

  if (!data) {
    return (
      <div className="flex min-h-[100px] items-center justify-center rounded-2xl border border-line bg-surface">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
      </div>
    )
  }
  // Nothing to read is not an empty chart — a chart of four grey stumps reads
  // as "your nights are dead" to somebody skimming.
  if (data.total === 0) return null

  // One scale across all four, so the bars are a comparison rather than four
  // separate meters that happen to sit together.
  const top = Math.max(1, ...data.blocks.map((b) => b.ratePct ?? 0))

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold text-white">{t('hours.title')}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
        {data.schedule
          ? t('hours.said.narrow', { blocks: data.schedule.map((b) => t(`hours.block.${b}`)).join(', ') })
          : t('hours.said.allDay', { n: data.total, days: data.lookbackDays })}
      </p>

      <ul className="mt-4 space-y-3">
        {data.blocks.map((b) => (
          <li key={b.block}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] text-slate-300">
                {t(`hours.block.${b.block}`)}
                <span className="ml-1.5 text-[10px] text-slate-500">
                  {String(b.hours[0]).padStart(2, '0')}–{String(b.hours[1]).padStart(2, '0')}
                </span>
              </span>
              <span className={`shrink-0 text-[11px] tabular-nums ${TONE[b.verdict]}`}>
                {b.ratePct === null
                  ? '—'
                  : t('hours.rate', { pct: b.ratePct, n: b.leads })}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full ${BAR[b.verdict]}`}
                style={{ width: `${Math.max(2, ((b.ratePct ?? 0) / top) * 100)}%` }} />
            </div>
            {/* THE LINE THAT DECIDES WHAT TO DO. A slow-answered block and a
                genuinely bad block look identical above and are opposite
                problems. */}
            {b.verdict !== 'even' && (
              <p className={`mt-1 text-[10px] leading-snug ${TONE[b.verdict]}`}>
                {t(`hours.why.${b.verdict}`, {
                  wait: b.medianResponseMinutes === null ? '—' : wait(b.medianResponseMinutes),
                  unanswered: b.neverAnswered,
                  n: b.leads,
                })}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
