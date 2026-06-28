'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Globe, Loader2, Save, Check } from 'lucide-react'
import { useSessionGuard } from '@/lib/freehold/use-session'
import { useI18n } from '@/lib/i18n/provider'
import { LOCALES, LOCALE_LABELS, LOCALE_FLAGS, type Locale } from '@/lib/i18n/config'

interface LanguagePrefs {
  writing: Locale[]
  ai: Locale | 'auto'
  translateTeamInputs: boolean
  inlineTranslate: boolean
}

const DEFAULT_PREFS: LanguagePrefs = {
  writing: ['en'],
  ai: 'auto',
  translateTeamInputs: false,
  inlineTranslate: true,
}

export default function LanguagesSettingsPage() {
  const { ready } = useSessionGuard()
  const { locale, setLocale, t } = useI18n()
  const [prefs, setPrefs] = useState<LanguagePrefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!ready) return
    fetch('/api/freehold/settings')
      .then((r) => r.json())
      .then((data) => {
        const lang = data?.settings?.language
        if (lang) setPrefs({ ...DEFAULT_PREFS, ...lang })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [ready])

  if (!ready) return null

  function toggleWriting(l: Locale) {
    setPrefs((p) => {
      const has = p.writing.includes(l)
      // keep at least one writing language
      const writing = has ? p.writing.filter((x) => x !== l) : [...p.writing, l]
      return { ...p, writing: writing.length ? writing : p.writing }
    })
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/freehold/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: prefs }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('settings.lang.saved'))
    } catch {
      toast.error(t('settings.lang.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const card = 'rounded-[16px] border border-line bg-surface p-5'
  const chip = (active: boolean) =>
    `flex items-center gap-2 rounded-[10px] border px-3.5 py-2.5 text-sm font-medium transition ${
      active ? 'border-gold/30 bg-gold/[0.08] text-gold' : 'border-line text-slate-400 hover:text-slate-200'
    }`

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24 pt-7 sm:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-gold/25 bg-gold/10">
          <Globe className="h-5 w-5 text-gold" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">{t('settings.lang.title')}</h1>
          <p className="mt-0.5 text-sm text-slate-400">{t('settings.lang.subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('common.loading')}</div>
      ) : (
        <div className="space-y-4">
          {/* Platform language */}
          <div className={card}>
            <div className="mb-1 text-sm font-semibold text-white">{t('settings.lang.platform')}</div>
            <p className="mb-3 text-xs text-slate-500">{t('settings.lang.platformHint')}</p>
            <div className="flex flex-wrap gap-2">
              {LOCALES.map((l) => (
                <button key={l} onClick={() => setLocale(l)} className={chip(l === locale)}>
                  <span>{LOCALE_FLAGS[l]}</span> {LOCALE_LABELS[l]}
                  {l === locale && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Writing languages (multi) */}
          <div className={card}>
            <div className="mb-1 text-sm font-semibold text-white">{t('settings.lang.writing')}</div>
            <p className="mb-3 text-xs text-slate-500">{t('settings.lang.writingHint')}</p>
            <div className="flex flex-wrap gap-2">
              {LOCALES.map((l) => (
                <button key={l} onClick={() => toggleWriting(l)} className={chip(prefs.writing.includes(l))}>
                  <span>{LOCALE_FLAGS[l]}</span> {LOCALE_LABELS[l]}
                  {prefs.writing.includes(l) && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* AI language */}
          <div className={card}>
            <div className="mb-1 text-sm font-semibold text-white">{t('settings.lang.ai')}</div>
            <p className="mb-3 text-xs text-slate-500">{t('settings.lang.aiHint')}</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setPrefs((p) => ({ ...p, ai: 'auto' }))} className={chip(prefs.ai === 'auto')}>
                {t('settings.lang.aiAuto')}
                {prefs.ai === 'auto' && <Check className="h-3.5 w-3.5" />}
              </button>
              {LOCALES.map((l) => (
                <button key={l} onClick={() => setPrefs((p) => ({ ...p, ai: l }))} className={chip(prefs.ai === l)}>
                  <span>{LOCALE_FLAGS[l]}</span> {LOCALE_LABELS[l]}
                  {prefs.ai === l && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className={card}>
            <label className="flex items-center justify-between gap-3 border-b border-line pb-4">
              <div>
                <div className="text-sm font-medium text-slate-200">{t('settings.lang.translateTeam')}</div>
                <div className="mt-0.5 text-xs text-slate-500">{t('settings.lang.translateTeamHint')}</div>
              </div>
              <button onClick={() => setPrefs((p) => ({ ...p, translateTeamInputs: !p.translateTeamInputs }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${prefs.translateTeamInputs ? 'bg-gold' : 'bg-surface-3'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${prefs.translateTeamInputs ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between gap-3 pt-4">
              <div>
                <div className="text-sm font-medium text-slate-200">{t('settings.lang.inline')}</div>
                <div className="mt-0.5 text-xs text-slate-500">{t('settings.lang.inlineHint')}</div>
              </div>
              <button onClick={() => setPrefs((p) => ({ ...p, inlineTranslate: !p.inlineTranslate }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${prefs.inlineTranslate ? 'bg-gold' : 'bg-surface-3'}`}>
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${prefs.inlineTranslate ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </label>
          </div>

          <button onClick={save} disabled={saving}
            className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('settings.lang.save')}
          </button>
        </div>
      )}
    </div>
  )
}
