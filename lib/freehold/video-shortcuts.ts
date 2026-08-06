/**
 * Editor keys — the ones every video tool has had for thirty years.
 *
 * The video editor could already trim: `setIn` and `setOut` existed, wired to
 * draggable handles. Nothing was bound to a key, so setting a clean in-point
 * meant scrubbing to the frame and then dragging a handle to the same place
 * without nudging the playhead. That is the sort of friction that makes people
 * stop using a feature without ever reporting it as broken.
 *
 * The mapping is the standard one, so nobody has to learn it:
 *
 *   Space   play / pause
 *   I / O   set the in-point / out-point AT THE PLAYHEAD — the whole point
 *   J / L   step back / forward one second
 *   K       pause
 *   ← / →   nudge one frame (0.04s), or one second with Shift
 *   Home    jump to the in-point
 *   E       grab the current frame as the cover
 *
 * Kept as a pure function from a key event to an intent, separate from the
 * component, for the reason that makes shortcuts hateful when it is missed:
 * they must NOT fire while someone is typing. The caption field sits on the
 * same screen, and "I" in "Marina living" must type an I, not destroy the
 * trim. That rule is a test here, not a hope.
 */

/** What a key press means. `null` is "not ours — let the browser have it". */
export type VideoIntent =
  | { kind: 'playPause' }
  | { kind: 'pause' }
  | { kind: 'setIn' }
  | { kind: 'setOut' }
  | { kind: 'seekBy'; seconds: number }
  | { kind: 'toIn' }
  | { kind: 'captureFrame' }

/** One frame at 25fps — fine enough to land on a cut, coarse enough to feel. */
export const FRAME_STEP = 0.04
/** J / L and Shift+arrow move in whole seconds. */
export const SECOND_STEP = 1

/**
 * Anything that takes text. A shortcut firing inside one of these is the
 * classic way an editor eats a user's caption.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const el = target as { tagName?: unknown; isContentEditable?: unknown }
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : ''
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.isContentEditable === true
}

/** The minimum of a KeyboardEvent this needs — so it is testable as data. */
export interface KeyLike {
  key: string
  shiftKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  target?: EventTarget | null
}

/**
 * Resolve a key press to an intent, or null.
 *
 * Modifier combinations are deliberately ignored: ⌘S must stay Save and ⌘←
 * must stay the browser's, so a shortcut here never shadows one the operating
 * system or the app already owns. Shift is the exception — it is a modifier on
 * the arrow keys' own meaning, not a different command.
 */
export function resolveVideoKey(e: KeyLike): VideoIntent | null {
  if (isTypingTarget(e.target ?? null)) return null
  if (e.metaKey || e.ctrlKey || e.altKey) return null

  switch (e.key) {
    case ' ':
    case 'Spacebar':          return { kind: 'playPause' }
    case 'k': case 'K':       return { kind: 'pause' }
    case 'i': case 'I':       return { kind: 'setIn' }
    case 'o': case 'O':       return { kind: 'setOut' }
    case 'j': case 'J':       return { kind: 'seekBy', seconds: -SECOND_STEP }
    case 'l': case 'L':       return { kind: 'seekBy', seconds: SECOND_STEP }
    case 'e': case 'E':       return { kind: 'captureFrame' }
    case 'Home':              return { kind: 'toIn' }
    case 'ArrowLeft':         return { kind: 'seekBy', seconds: -(e.shiftKey ? SECOND_STEP : FRAME_STEP) }
    case 'ArrowRight':        return { kind: 'seekBy', seconds: e.shiftKey ? SECOND_STEP : FRAME_STEP }
    default:                  return null
  }
}

/** Keys whose default the page must swallow once they are ours. */
export const HANDLED_KEYS = new Set([
  ' ', 'Spacebar', 'k', 'K', 'i', 'I', 'o', 'O', 'j', 'J', 'l', 'L', 'e', 'E',
  'Home', 'ArrowLeft', 'ArrowRight',
])
