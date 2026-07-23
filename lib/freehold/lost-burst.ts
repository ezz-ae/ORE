'use client'
import { useSyncExternalStore } from 'react'

// ── Rapid lost-closing detector ──────────────────────────────────────────────
// A tiny client-side store that watches how fast an agent marks leads "lost".
// When more than THRESHOLD leads are closed as lost inside WINDOW_MS, a
// NON-BLOCKING nudge (see components/freehold/lost-burst-nudge.tsx) offers a
// one-click "drip these into a 60-day nurture instead" macro. It never blocks
// the action — an agent who really means it just ignores the nudge.
//
// Deliberately in-memory and per-tab: it is a gentle in-the-moment coach, not
// an audit trail (Layer-10 training-integrity already keeps the durable record).

export type LostMark = { id: string; name: string; at: number }

export const LOST_BURST_WINDOW_MS = 5 * 60_000 // 5 minutes
export const LOST_BURST_THRESHOLD = 3          // MORE than 3 in the window trips it

let marks: LostMark[] = []
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Record that a lead was just marked lost. De-dupes per lead within the window. */
export function recordLostMark(lead: { id: string; name?: string | null }) {
  const now = Date.now()
  marks = [
    ...marks.filter((m) => m.id !== lead.id && now - m.at < LOST_BURST_WINDOW_MS),
    { id: lead.id, name: lead.name || '—', at: now },
  ]
  emit()
}

/** Clear the burst (after the agent drips them, or dismisses the nudge). */
export function clearLostBurst() {
  if (marks.length) {
    marks = []
    emit()
  }
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
const getSnapshot = () => marks

/**
 * Live view of the recent lost-marks. `active` is true once the agent has
 * closed more than the threshold inside the window.
 */
export function useLostBurst(): { marks: LostMark[]; active: boolean } {
  const all = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const now = Date.now()
  const recent = all.filter((m) => now - m.at < LOST_BURST_WINDOW_MS)
  return { marks: recent, active: recent.length > LOST_BURST_THRESHOLD }
}
