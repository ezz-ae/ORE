'use client'

import { useEffect, useState, useCallback } from 'react'

export type ThemeMode = 'dark' | 'light' | 'mint'
const KEY = 'fh-theme'

function apply(mode: ThemeMode) {
  const el = document.documentElement
  // Mint is a TEAL duotone on the dark base: deep teal-green surfaces with
  // bright mint accents — full contrast inside one colour family. Never
  // stacked with the light remap; light text stays light on teal.
  el.classList.toggle('theme-light', mode === 'light')
  el.classList.toggle('theme-mint', mode === 'mint')
}

/** Read the persisted mode. FRESH (mint) is the default by owner decision —
 *  an account that explicitly chose Night or Day keeps its choice. Safe on
 *  the server (returns the default). */
export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'mint'
  const v = window.localStorage.getItem(KEY)
  return v === 'light' || v === 'dark' ? v : 'mint'
}

/** Account-menu theme toggle. Persists per browser + reflects on <html>. */
export function useThemeMode(): { mode: ThemeMode; setMode: (m: ThemeMode) => void; toggle: () => void } {
  const [mode, setModeState] = useState<ThemeMode>('mint')

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
