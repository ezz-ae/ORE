'use client'

import { useEffect, useState, useCallback } from 'react'

export type ThemeMode = 'dark' | 'light'
const KEY = 'fh-theme'

function apply(mode: ThemeMode) {
  const el = document.documentElement
  el.classList.toggle('theme-light', mode === 'light')
  el.classList.remove('theme-mint')
}

/** Read the persisted mode (dark default). Safe on the server (returns 'dark'). */
export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  return window.localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'
}

/** Account-menu theme toggle. Persists per browser + reflects on <html>. */
export function useThemeMode(): { mode: ThemeMode; setMode: (m: ThemeMode) => void; toggle: () => void } {
  const [mode, setModeState] = useState<ThemeMode>('dark')

  useEffect(() => {
    const initial = getStoredThemeMode()
    setModeState(initial)
    apply(initial)
  }, [])

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m)
    apply(m)
    try { window.localStorage.setItem(KEY, m) } catch { /* ignore */ }
  }, [])

  const toggle = useCallback(() => setMode(getStoredThemeMode() === 'light' ? 'dark' : 'light'), [setMode])

  return { mode, setMode, toggle }
}
