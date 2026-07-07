'use client'

/**
 * Account memory — per-ACCOUNT state that survives sessions, devices and
 * cleared cookies. localStorage stays as a fast local cache, but the account
 * (via /api/freehold/prefs) is the source of truth: anything a user does that
 * should still be there next time they sign in goes through here.
 *
 * One fetch per page load, shared by every consumer (theme, language,
 * What's-new, coach progress, campaign drafts, panel layout, …).
 */

let cache: Record<string, unknown> | null = null
let inflight: Promise<Record<string, unknown>> | null = null

/** Load the signed-in account's memory (cached; resolves {} when signed out). */
export function loadAccountMemory(): Promise<Record<string, unknown>> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = fetch('/api/freehold/prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        cache = (d && typeof d.prefs === 'object' && d.prefs) || {}
        return cache!
      })
      .catch(() => {
        cache = {}
        return cache!
      })
  }
  return inflight
}

function push(patch: Record<string, unknown>) {
  fetch('/api/freehold/prefs', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).catch(() => {})
}

const timers = new Map<string, ReturnType<typeof setTimeout>>()

/** Fire-and-forget save. Updates the local cache immediately. */
export function saveAccountMemory(patch: Record<string, unknown>): void {
  cache = { ...(cache ?? {}), ...patch }
  // An immediate save wins over any pending debounced write for the same key
  // (e.g. clearing a launched campaign draft while a typing save is queued).
  for (const k of Object.keys(patch)) {
    const t = timers.get(k)
    if (t) { clearTimeout(t); timers.delete(k) }
  }
  push(patch)
}

/**
 * Debounced save for high-frequency writers (draft typing, panel resize) —
 * the cache updates instantly, the network write coalesces.
 */
export function saveAccountMemoryDebounced(key: string, value: unknown, ms = 1200): void {
  cache = { ...(cache ?? {}), [key]: value }
  const prev = timers.get(key)
  if (prev) clearTimeout(prev)
  timers.set(key, setTimeout(() => { timers.delete(key); push({ [key]: value }) }, ms))
}
