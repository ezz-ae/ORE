'use client'

import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n/provider'
import { getStoredThemeMode, useThemeMode, type ThemeMode } from '@/lib/freehold/use-theme-mode'

/** Fire-and-forget save of an account preference (theme, locale). */
export function saveUserPref(patch: Record<string, string>) {
  fetch('/api/freehold/prefs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => {})
}

/**
 * Account memory for user settings. Mounted once in the signed-in shell:
 * loads the account's saved prefs and applies them (theme + language), so a
 * user gets *their* setup on any device — device defaults only apply until
 * the account has a saved choice.
 */
export function PrefsSync() {
  const { locale, setLocale } = useI18n()
  const theme = useThemeMode()

  useEffect(() => {
    let cancelled = false
    fetch('/api/freehold/prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.prefs) return
        const saved = d.prefs as { theme?: ThemeMode; locale?: string }
        if (saved.theme && saved.theme !== getStoredThemeMode()) theme.setMode(saved.theme)
        if (saved.locale && saved.locale !== locale) setLocale(saved.locale as never)
      })
      .catch(() => {})
    return () => { cancelled = true }
    // Run once per shell mount — prefs are the account's source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
