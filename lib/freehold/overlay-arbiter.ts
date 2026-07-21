'use client'

/**
 * One arbiter so two onboarding overlays never fight for the screen.
 *
 * The coach tour (spotlight modal) and the What's New nudge both auto-appear a
 * second after load. Before this, they raced — the tour started at ~900ms and
 * the What's New toast at ~1200ms, so a first-run user got BOTH stacked at once
 * (the exact "they came together and wrecked the screen" report). On phones it
 * was worse: the coach already suppresses its own auto-start on small screens,
 * but What's New didn't, so the toast showed alone-but-cramped.
 *
 * Rule (single source of truth):
 *   - A coach tour, while active, blocks the What's New auto-toast. What's New
 *     subscribes and hides itself the moment a tour becomes active.
 *   - Neither overlay AUTO-opens on a phone. Both remain reachable on demand
 *     from the account menu (What's New) / "Take a tour" (coach); the What's New
 *     badge still shows so the user knows there's something new.
 *
 * Manual opens (menu click) ignore the arbiter entirely — the user asked.
 */

let coachActive = false
const listeners = new Set<() => void>()

export function setCoachActive(active: boolean): void {
  if (coachActive === active) return
  coachActive = active
  listeners.forEach((l) => l())
}

export function isCoachActive(): boolean {
  return coachActive
}

export function onArbiterChange(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Small-screen check shared by both overlays' auto-open guards. */
export function isPhoneViewport(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(max-width: 767px)').matches
  } catch {
    return false
  }
}
