'use client'

/**
 * THE AGENT HAS SOMETHING TO SAY.
 *
 * A model does not start conversations. Every chat anyone has used opens
 * because a person typed first, so a message that simply appears is genuinely
 * unusual — and unusual is exactly what makes it worth reading, provided it is
 * never startling.
 *
 * Two states, and the difference between them is the whole design:
 *
 *   CHAT OPEN   — the message arrives in the thread, visibly not a reply:
 *                 its own background, one small animation, no ceremony.
 *   CHAT CLOSED — WE DO NOT OPEN IT. A window opening by itself is the
 *                 software taking the wheel, and that reads as something
 *                 going wrong even when it is good news. Instead the chat's
 *                 own entry in the menu lights: two soft flashes, then it
 *                 simply stays lit until it is read.
 *
 * The lit state is the important half. A flash is missable — someone is
 * looking at another part of the screen, or is not at the desk. Staying lit
 * means the signal waits for them rather than needing them to be present at
 * the moment it fired.
 *
 * Per browser, deliberately. This is "have YOU seen it", not a fact about the
 * account, and it should not follow someone onto a machine they are not at.
 */

const KEY = 'fh.agent.waiting'
const EVENT = 'fh:agent-waiting'

export interface AgentWaiting {
  /** One short line — the same sentence the agent would open with. */
  line: string
  /** What it is about, so the same news is not announced twice. */
  signature: string
  /** When it was raised, so the flash only plays for something genuinely new. */
  at: number
}

/** Read what is waiting, if anything. */
export function agentWaiting(): AgentWaiting | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    const w = JSON.parse(raw) as Partial<AgentWaiting>
    if (!w || typeof w.line !== 'string' || typeof w.signature !== 'string') return null
    return { line: w.line, signature: w.signature, at: Number(w.at) || 0 }
  } catch { return null }
}

/**
 * Raise the signal.
 *
 * Idempotent on the signature: re-announcing the same thing is how a light
 * becomes a decoration. If it is already waiting for this exact news, nothing
 * happens — no new timestamp, so nothing flashes a second time.
 */
export function raiseAgentWaiting(w: Omit<AgentWaiting, 'at'>): void {
  if (typeof window === 'undefined') return
  const current = agentWaiting()
  if (current && current.signature === w.signature) return
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...w, at: Date.now() }))
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch { /* private mode: the signal is simply not shown */ }
}

/** It has been read. Clears the light. */
export function clearAgentWaiting(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(KEY)
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch { /* ignore */ }
}

/** Subscribe to changes — including from another tab, via `storage`. */
export function onAgentWaiting(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = () => fn()
  window.addEventListener(EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}

/**
 * Has this particular news already been played as a flash?
 *
 * The flash is for arrival. Once it has played, moving between pages must not
 * replay it — that is the same message shouting again, which is the thing the
 * whole design is trying not to do. The steady light carries on regardless.
 */
const FLASHED = 'fh.agent.flashed'

export function shouldFlash(signature: string): boolean {
  if (typeof window === 'undefined') return false
  try { return window.sessionStorage.getItem(FLASHED) !== signature } catch { return false }
}

export function markFlashed(signature: string): void {
  try { window.sessionStorage.setItem(FLASHED, signature) } catch { /* ignore */ }
}
