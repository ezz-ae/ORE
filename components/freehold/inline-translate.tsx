'use client'

import { useState } from 'react'
import { Languages, Loader2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'
import { LOCALE_LABELS } from '@/lib/i18n/config'

/**
 * Inline "Translate" affordance for free text the dictionary can't cover —
 * team notes, lead messages, long Arabic/Russian content. Shows a small button
 * under the text; on click it calls the Gemini-backed translate API and lets the
 * user flip between original and translation.
 *
 * Only renders the button when the text is long enough to be worth translating,
 * so short labels stay clean.
 */
export function InlineTranslate({
  text,
  minLength = 40,
  className = '',
}: {
  text: string
  minLength?: number
  className?: string
}) {
  const { locale, t } = useI18n()
  const [translated, setTranslated] = useState<string | null>(null)
  const [showing, setShowing] = useState<'original' | 'translation'>('original')
  const [loading, setLoading] = useState(false)

  const worthIt = (text?.length ?? 0) >= minLength

  async function translate() {
    if (translated) { setShowing((s) => (s === 'original' ? 'translation' : 'original')); return }
    setLoading(true)
    try {
      const res = await fetch('/api/freehold/i18n/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, to: locale }),
      })
      const data = await res.json() as { text?: string; translated?: boolean }
      if (data.translated && data.text) {
        setTranslated(data.text)
        setShowing('translation')
      } else {
        // No API key / failure — degrade quietly by keeping the original.
        setTranslated(text)
        setShowing('translation')
      }
    } catch {
      setTranslated(text)
      setShowing('translation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className={className}>
      <span>{showing === 'translation' && translated ? translated : text}</span>
      {worthIt && (
        <button
          type="button"
          onClick={translate}
          disabled={loading}
          className="ml-2 inline-flex items-center gap-1 align-baseline text-[11px] text-gold/70 transition hover:text-gold disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />}
          {showing === 'translation'
            ? t('common.showOriginal')
            : t('common.translateTo', { lang: LOCALE_LABELS[locale] })}
        </button>
      )}
    </span>
  )
}
