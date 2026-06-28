'use client'

import { useState } from 'react'
import { Check, Globe } from 'lucide-react'
import { LOCALES, LOCALE_LABELS, LOCALE_FLAGS } from '@/lib/i18n/config'
import { useI18n } from '@/lib/i18n/provider'

/**
 * Compact language switcher (EN / AR / RU). Designed to sit inside the account
 * menu in the nav spine. Selecting a language persists it to a cookie and flips
 * the document direction (RTL for Arabic) immediately.
 */
export function LanguageSwitcher({ variant = 'menu' }: { variant?: 'menu' | 'inline' }) {
  const { locale, setLocale } = useI18n()
  const [open, setOpen] = useState(false)

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-1">
        {LOCALES.map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition ${
              l === locale ? 'bg-gold/15 text-gold' : 'text-slate-400 hover:text-slate-200'
            }`}
            aria-pressed={l === locale}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-surface-2 hover:text-white"
      >
        <Globe className="h-4 w-4 text-slate-500" />
        <span className="flex-1">{LOCALE_LABELS[locale]}</span>
        <span className="text-xs text-slate-500">{LOCALE_FLAGS[locale]}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-50 mt-1 rounded-xl border border-line-strong bg-surface py-1 shadow-xl">
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => { setLocale(l); setOpen(false) }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-300 transition hover:bg-surface-2 hover:text-white"
              >
                <span className="w-5 text-center">{LOCALE_FLAGS[l]}</span>
                <span className="flex-1">{LOCALE_LABELS[l]}</span>
                {l === locale && <Check className="h-3.5 w-3.5 text-gold" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
