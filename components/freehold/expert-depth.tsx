'use client'

import { Sparkles, ArrowUpRight } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { sendToExpert } from '@/lib/freehold/expert-bus'

/**
 * Reusable "Ask the Expert" depth strip. Renders contextual quick-prompts that
 * push into the single docked Expert conversation (no separate chat). Drop it on
 * any app's landing page with app-specific prompt keys — one component, no
 * repeated markup.
 *
 *   <ExpertDepth prompts={['expert.depth.crm.q1', 'expert.depth.crm.q2']} />
 */
export function ExpertDepth({
  prompts,
  titleKey = 'expert.depth.title',
  subtitleKey = 'expert.depth.subtitle',
  noteKey,
  className = '',
}: {
  prompts: string[]
  titleKey?: string
  subtitleKey?: string
  /** optional small footer note (e.g. a disclaimer) */
  noteKey?: string
  className?: string
}) {
  const t = useT()
  if (!prompts.length) return null
  return (
    <section
      data-coach="expert-depth"
      className={`overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.08] via-gold/[0.02] to-transparent p-5 ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
          <Sparkles className="h-4 w-4 text-gold" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{t(titleKey)}</div>
          <div className="text-xs text-slate-400">{t(subtitleKey)}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {prompts.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => sendToExpert(t(q))}
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-sm text-slate-300 transition-colors hover:border-gold/40 hover:text-white"
          >
            {t(q)}
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-500 transition-colors group-hover:text-gold" />
          </button>
        ))}
      </div>
      {noteKey && <p className="mt-3 text-xs text-slate-500">{t(noteKey)}</p>}
    </section>
  )
}
