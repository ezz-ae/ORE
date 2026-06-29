'use client'
import { useState, useEffect } from 'react'

/**
 * Reports whether any ad platform (Meta or Google) is actually connected.
 *
 * A platform counts as connected only when its campaigns API does NOT return
 * the `demo` flag — i.e. real credentials are configured. Until then, ad
 * surfaces should show an honest "connect your accounts" state rather than
 * seed/demo performance numbers.
 *
 * Returns `connected: null` while still loading.
 */
export function useAdsConnected(): { connected: boolean | null; meta: boolean; google: boolean } {
  const [meta, setMeta] = useState(false)
  const [google, setGoogle] = useState(false)
  const [connected, setConnected] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/meta/campaigns', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/google/campaigns', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([m, g]) => {
      if (cancelled) return
      const metaOk = Boolean(m && !m.demo)
      const googleOk = Boolean(g && !g.demo)
      setMeta(metaOk)
      setGoogle(googleOk)
      setConnected(metaOk || googleOk)
    })
    return () => { cancelled = true }
  }, [])

  return { connected, meta, google }
}
