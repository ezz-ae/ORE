'use client'

import { useEffect, useState, useCallback } from 'react'

export type ThemeMode = 'dark' | 'light' | 'mint'
const KEY = 'fh-theme'

function apply(mode: ThemeMode) {
  const el = document.documentElement
  // Mint is BUILT ON the light remap layer: it keeps every light-mode surface
  // and text fix and swaps the palette on top. So mint = theme-light +
  // theme-mint, and the mint block only overrides colors.
  el.classList.toggle('theme-light', mode === 'light' || mode === 'mint')
  el.classList.toggle('theme-mint', mode === 'mint')
}

/** Read the persisted mode (dark default). Safe on the server (returns 'dark'). */
export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark'
  const v = window.localStorage.getItem(KEY)
  return v === 'light' || v === 'mint' ? v : 'dark'
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

  const toggle = useCallback(() => {
    const cur = getStoredThemeMode()
    setMode(cur === 'dark' ? 'light' : cur === 'light' ? 'mint' : 'dark')
  }, [setMode])

  return { mode, setMode, toggle }
}
