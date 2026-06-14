'use client'

import { useState } from 'react'
import { Plus, Minus } from 'lucide-react'

interface FaqItem {
  question: string
  answer: string
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null)

  if (!items.length) return null

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02] transition-colors hover:border-white/[0.12]"
        >
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
          >
            <span className="text-[15px] font-medium text-white/85 leading-snug">{item.question}</span>
            <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.12] text-white/40">
              {open === i ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </span>
          </button>
          {open === i && (
            <div className="border-t border-white/[0.05] px-6 pb-5 pt-4">
              <p className="text-[14px] text-white/55 leading-relaxed">{item.answer}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
