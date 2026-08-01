'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18n/provider'

/**
 * The one-click lead VALUE rating — 0 to 10, one tap, no green/red.
 *
 * The scale ranks leads by worth, and the bottom matters as much as the top:
 * a 0 tells the machine what it should stop buying, which is training signal
 * a binary "no" flattens away (a 0 and a 4 are both "no", but they are not
 * the same fact). One click writes the lead's canonical rating, answers any
 * open Ads-Machine question about the same lead, and feeds the shared
 * targeting signals on the next nightly fold.
 */
export function LeadValueChips({
  value,
  onRate,
  disabled = false,
  size = 'md',
}: {
  value: number | null
  onRate: (v: number) => void | Promise<void>
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const pad = size === 'sm' ? 'h-6 min-w-6 text-[10px]' : 'h-7 min-w-7 text-[11px]'

  // Colour communicates the judgment without words: the low end is the
  // "machine, avoid this" zone, the high end the "buy more of this" zone.
  const tone = (v: number, active: boolean): string => {
    if (!active) return 'border-line bg-surface-2 text-slate-500 hover:border-line-strong hover:text-slate-300'
    if (v <= 2) return 'border-red-400/50 bg-red-400/15 text-red-300'
    if (v <= 5) return 'border-amber-400/50 bg-amber-400/15 text-amber-300'
    return 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300'
  }

  async function rate(v: number) {
    if (disabled || busy) return
    setBusy(true)
    try { await onRate(v) } finally { setBusy(false) }
  }

  return (
    <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={t('crm.value.label')}>
      {Array.from({ length: 11 }, (_, v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          disabled={disabled || busy}
          onClick={() => rate(v)}
          className={`inline-flex items-center justify-center rounded-md border px-1 font-semibold tabular-nums transition disabled:opacity-50 ${pad} ${tone(v, value === v)}`}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

/** Compact read-only badge for list rows: the rating at a glance, coloured by
 *  zone, or a quiet dash when the lead has not been judged yet. */
export function LeadValueBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) {
    return <span className="inline-flex h-5 min-w-7 items-center justify-center rounded-md border border-line bg-surface-2 px-1 text-[10px] text-slate-600">—</span>
  }
  const cls = value <= 2
    ? 'border-red-400/40 bg-red-400/10 text-red-300'
    : value <= 5
      ? 'border-amber-400/40 bg-amber-400/10 text-amber-300'
      : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'
  return (
    <span className={`inline-flex h-5 min-w-7 items-center justify-center rounded-md border px-1 text-[10px] font-semibold tabular-nums ${cls}`}>
      {value}
    </span>
  )
}
