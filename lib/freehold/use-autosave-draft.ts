'use client'

import { useCallback, useEffect, useRef } from 'react'

/**
 * Autosave any in-progress editor/launcher state as a DRAFT. Saves are
 * debounced while the user works AND flushed the moment the tab is hidden or
 * closed (pagehide / visibilitychange) — so "upload an image, start editing,
 * close the tab" leaves a resumable draft instead of nothing. Call clearDraft()
 * on an explicit Save/Publish; the work now lives in its real home.
 */
export function useAutosaveDraft<T>(opts: {
  kind: string
  refKey: string
  href: string
  data: T
  active: boolean                 // only persist when there's real unsaved work (e.g. dirty)
  title?: string
  isEmpty?: (d: T) => boolean      // skip saving pristine/blank state
  delay?: number
}) {
  const { kind, refKey, href, data, active, title, isEmpty, delay = 1200 } = opts
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSent = useRef('')
  // Always flush the freshest state, even from an unload handler bound once.
  const latest = useRef({ title, data, active })
  latest.current = { title, data, active }

  const flush = useCallback((force = false) => {
    const cur = latest.current
    if (!cur.active) return
    if (isEmpty && isEmpty(cur.data)) return
    const sig = JSON.stringify({ t: cur.title, d: cur.data })
    if (!force && sig === lastSent.current) return
    lastSent.current = sig
    fetch('/api/freehold/drafts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, refKey, href, title: cur.title, payload: cur.data }),
      keepalive: true,
    }).catch(() => {})
  }, [kind, refKey, href, isEmpty])

  // Debounced save as the user types/edits.
  useEffect(() => {
    if (!active) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => flush(false), delay)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [data, title, active, delay, flush])

  // Save on tab hide/close — captures "closed the tab" without an explicit save.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(false) }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [flush])

  const clearDraft = useCallback(() => {
    lastSent.current = '__cleared__'
    if (timer.current) clearTimeout(timer.current)
    fetch(`/api/freehold/drafts?kind=${encodeURIComponent(kind)}&refKey=${encodeURIComponent(refKey)}`, {
      method: 'DELETE', keepalive: true,
    }).catch(() => {})
  }, [kind, refKey])

  return { clearDraft, flush }
}
