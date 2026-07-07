'use client'

import { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

export interface SetupStep {
  /** i18n key for the step's instruction text. */
  key: string
  /** Literal click-path chip (kept in English — matches the provider's UI). */
  path?: string
}

/**
 * Self-service setup guide shown on every integration page, so a client can
 * connect each provider on their own — numbered steps with exact click-paths,
 * collapsed by default behind a "How do I get this?" toggle.
 */
export function SetupGuide({ steps, defaultOpen = false }: { steps: SetupStep[]; defaultOpen?: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="mb-5 overflow-hidden rounded-[14px] border border-line bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition hover:bg-surface-2"
        aria-expanded={open}
      >
        <HelpCircle className="h-4 w-4 shrink-0 text-gold" />
        <span className="flex-1 text-sm font-medium text-white">{t('guide.open')}</span>
        <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ol className="space-y-3 border-t border-line px-4 py-4">
          {steps.map((s, i) => (
            <li key={s.key} className="flex gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold/10 text-xs font-bold text-gold">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm leading-relaxed text-slate-300">{t(s.key)}</p>
                {s.path && (
                  <code className="mt-1 inline-block rounded-md border border-line bg-surface-2 px-2 py-1 font-mono text-[11.5px] text-slate-400">
                    {s.path}
                  </code>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
