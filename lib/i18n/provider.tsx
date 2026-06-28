'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isRtl, normalizeLocale, type Locale } from './config'
import { DICTIONARIES } from './dictionaries'

interface I18nValue {
  locale: Locale
  setLocale: (l: Locale) => void
  /** translate a dotted key, with optional {placeholder} interpolation */
  t: (key: string, vars?: Record<string, string | number>) => string
  dir: 'ltr' | 'rtl'
}

const I18nContext = createContext<I18nValue | null>(null)

function readCookieLocale(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`))
  return normalizeLocale(match ? decodeURIComponent(match[1]) : null)
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Lazy init from cookie so the first render already has the right language.
  const [locale, setLocaleState] = useState<Locale>(readCookieLocale)

  const setLocale = useCallback((l: Locale) => {
    const next = normalizeLocale(l)
    setLocaleState(next)
    try {
      // 1 year, site-wide
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    } catch {}
  }, [])

  const dir: 'ltr' | 'rtl' = isRtl(locale) ? 'rtl' : 'ltr'

  // Reflect language/direction on the document so native widgets + CSS logical
  // properties pick up RTL. Scoped here (the app shell) without breaking the
  // public marketing site, which never mounts this provider.
  useEffect(() => {
    const root = document.documentElement
    const prevLang = root.getAttribute('lang')
    const prevDir = root.getAttribute('dir')
    root.setAttribute('lang', locale)
    root.setAttribute('dir', dir)
    return () => {
      if (prevLang) root.setAttribute('lang', prevLang); else root.removeAttribute('lang')
      if (prevDir) root.setAttribute('dir', prevDir); else root.removeAttribute('dir')
    }
  }, [locale, dir])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE]
      let str = dict[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
        }
      }
      return str
    },
    [locale],
  )

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
      {children}
    </I18nContext.Provider>
  )
}

/** Full i18n context (locale, setLocale, t, dir). Falls back to English if used
 *  outside the provider so a stray call never crashes a page. */
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (ctx) return ctx
  return {
    locale: DEFAULT_LOCALE,
    setLocale: () => {},
    t: (key: string, vars?: Record<string, string | number>) => {
      let str = DICTIONARIES[DEFAULT_LOCALE][key] ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      return str
    },
    dir: 'ltr',
  }
}

/** Convenience hook returning just the translate function. */
export function useT() {
  return useI18n().t
}
