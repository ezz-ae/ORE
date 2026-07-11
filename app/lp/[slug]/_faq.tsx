'use client'

import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'
import type { LpPalette } from '@/lib/landing-theme'

interface FaqItem {
  question: string
  answer: string
}

// Palette-driven so questions stay readable in BOTH day and night themes —
// hardcoded white-on-transparent was invisible on the day background.
export function FaqAccordion({ items, palette }: { items: FaqItem[]; palette?: LpPalette }) {
  const [open, setOpen] = useState<number | null>(null)

  if (!items.length) return null

  const border = palette?.surfaceBorder ?? 'rgba(255,255,255,0.07)'
  const surface = palette?.surface ?? 'rgba(255,255,255,0.02)'
  const question = palette?.textPrimary ?? 'rgba(255,255,255,0.85)'
  const answer = palette?.textMuted ?? 'rgba(255,255,255,0.55)'
  const iconColor = palette?.textFaint ?? 'rgba(255,255,255,0.40)'

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border transition-colors"
          style={{ borderColor: border, background: surface }}
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-6 py-5 text-start"
          >
            <span className="text-[15px] font-medium leading-snug" style={{ color: question }}>{item.question}</span>
            <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full border" style={{ borderColor: border, color: iconColor }}>
              {open === i ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </span>
          </button>
          {open === i && (
            <div className="border-t px-6 pb-5 pt-4" style={{ borderTopColor: border }}>
              <p className="text-[14px] leading-relaxed" style={{ color: answer }}>{item.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
