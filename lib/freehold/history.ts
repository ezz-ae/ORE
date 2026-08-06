/**
 * Undo and redo, as a value.
 *
 * The image editor could undo exactly one thing: an AI edit, by swapping the
 * source photo back. Everything a person actually does by hand — a text layer,
 * a crop, a logo, the colour sliders — had no way back at all. `revision`
 * existed only to WARN that an AI undo would discard manual work, so the code
 * already knew the asymmetry was uncomfortable.
 *
 * Kept generic and pure on purpose. The stack itself is where the subtle bugs
 * live, and none of them need a DOM to reproduce:
 *
 *   · Editing after an undo must discard the redo branch. Otherwise "redo"
 *     reinstates work from a timeline the user abandoned.
 *   · A snapshot must be COPIED, not referenced. Storing the live `texts`
 *     array means the next `setTexts` mutates history too, and undo silently
 *     returns the present — the failure that makes people stop trusting ⌘Z.
 *   · The cap drops the OLDEST entry, never the newest. A cap that trims the
 *     wrong end throws away the change you just made.
 *   · Two identical snapshots in a row are one step, so dragging a slider does
 *     not bury the real edit under two hundred no-ops.
 */

export interface History<T> {
  /** Oldest → newest. Always at least one entry. */
  readonly past: readonly T[]
  /** Index of the current state within `past`. */
  readonly index: number
  readonly limit: number
}

/** How many steps back a person can go. Beyond this, memory costs more than it helps. */
export const HISTORY_LIMIT = 50

export function createHistory<T>(initial: T, limit = HISTORY_LIMIT): History<T> {
  return { past: [clone(initial)], index: 0, limit: Math.max(1, limit) }
}

/**
 * Deep copy, so nothing the editor mutates later can reach back into history.
 *
 * structuredClone is used where available; the JSON fallback covers the same
 * ground for this data (plain objects, arrays, strings, numbers) and is only
 * reached on engines that lack it.
 */
function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value) } catch { /* fall through */ }
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** The state the editor should currently be showing. */
export function present<T>(h: History<T>): T {
  return h.past[h.index]
}

export const canUndo = <T,>(h: History<T>): boolean => h.index > 0
export const canRedo = <T,>(h: History<T>): boolean => h.index < h.past.length - 1

/**
 * Record a new state.
 *
 * Returns the SAME history object when the snapshot is identical to the
 * current one, so a caller can push freely on every change without inflating
 * the stack — and React skips the re-render.
 */
export function push<T>(h: History<T>, next: T): History<T> {
  if (same(next, present(h))) return h

  // Anything ahead of the cursor belonged to a future the user walked away
  // from the moment they edited.
  const trimmed = h.past.slice(0, h.index + 1)
  trimmed.push(clone(next))

  // Over the cap: drop from the FRONT. The oldest state is the one nobody is
  // coming back for.
  const overflow = Math.max(0, trimmed.length - h.limit)
  const past = overflow > 0 ? trimmed.slice(overflow) : trimmed

  return { past, index: past.length - 1, limit: h.limit }
}

/** Step back. A no-op at the beginning rather than an error. */
export function undo<T>(h: History<T>): History<T> {
  return canUndo(h) ? { ...h, index: h.index - 1 } : h
}

/** Step forward. A no-op at the end. */
export function redo<T>(h: History<T>): History<T> {
  return canRedo(h) ? { ...h, index: h.index + 1 } : h
}

/**
 * Start again from a new baseline — after loading a different asset, or
 * saving. The old timeline belongs to a different document.
 */
export function reset<T>(h: History<T>, initial: T): History<T> {
  return createHistory(initial, h.limit)
}

/** How many steps are available each way — for a tooltip, or a test. */
export function depth<T>(h: History<T>): { back: number; forward: number } {
  return { back: h.index, forward: h.past.length - 1 - h.index }
}

/**
 * Is this key press an undo or a redo?
 *
 * Both spellings of redo are honoured because both are in muscle memory:
 * ⌘⇧Z on a Mac, Ctrl+Y on Windows. Typing is respected — ⌘Z inside a caption
 * field must undo the TYPING, not the canvas, or the editor eats text.
 */
export function historyIntent(e: {
  key: string; shiftKey?: boolean; metaKey?: boolean; ctrlKey?: boolean
  // `unknown` rather than EventTarget: this only duck-types the target, and
  // claiming a DOM type would force every caller (and every test) to build one.
  target?: unknown
}): 'undo' | 'redo' | null {
  const el = e.target as { tagName?: unknown; isContentEditable?: unknown } | null
  const tag = el && typeof el.tagName === 'string' ? el.tagName.toUpperCase() : ''
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return null
  if (el?.isContentEditable === true) return null
  if (!e.metaKey && !e.ctrlKey) return null

  const k = e.key.toLowerCase()
  if (k === 'z') return e.shiftKey ? 'redo' : 'undo'
  if (k === 'y') return 'redo'
  return null
}
