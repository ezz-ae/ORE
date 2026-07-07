'use client'

import { useEffect } from 'react'
import { useI18n } from '@/lib/i18n/provider'
import { getStoredThemeMode, useThemeMode, type ThemeMode } from '@/lib/freehold/use-theme-mode'
import { loadAccountMemory, saveAccountMemory } from '@/lib/freehold/account-memory'

/** Fire-and-forget save of an account preference (theme, locale). */
export function saveUserPref(patch: Record<string, string>) {
  saveAccountMemory(patch)
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
    loadAccountMemory()
      .then((m) => {
        if (cancelled) return
        const saved = m as { theme?: ThemeMode; locale?: string }
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
