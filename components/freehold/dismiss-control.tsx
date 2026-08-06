'use client'

/**
 * CLOSING SOMETHING, WITHOUT LOSING IT.
 *
 * A close button is a small control that quietly teaches a big habit. An X
 * means "gone" — so the honest response to anything you have not decided yet
 * is to leave it sitting on screen forever, and screens full of things nobody
 * has decided are how a person stops reading their own software.
 *
 * "Later" is the missing verb. It is not a softer X: it genuinely brings the
 * thing back. If it did not, this would be a nicer word for the same
 * destruction, which is worse than the X because it lies.
 *
 * HOW IT IS INTRODUCED. Adding a second button permanently costs space on
 * every card forever, and most people only ever want one. So both appear for
 * the first few closes, the choices are counted, and then the one that person
 * actually uses takes the slot on its own — back to the footprint of a plain
 * X, with the verb they chose.
 *
 * The order is EXIT then LATER, which is the order they were asked for and is
 * deliberately not tuned in Later's favour. Putting the preferred option first
 * would decide the result and then present it as a preference, which is not a
 * measurement — it is a nudge wearing one.
 *
 * A TIE GOES TO LATER, for one reason only: when the evidence does not decide,
 * take the option that loses nothing.
 *
 * Everything is per browser (localStorage). No server, no account state, and
 * nothing to migrate — a habit this small is not worth a table, and a person
 * on a new machine simply gets the short introduction again.
 */

import { useCallback, useEffect, useState } from 'react'
import { X, Clock } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

/** How many closes it takes before one verb wins the slot. Small on purpose —
 *  long enough to be a real preference, short enough that the two-button phase
 *  never becomes the thing people remember about the product. */
export const LEARN_AFTER = 5

type Choice = 'exit' | 'later'

const KEY = (id: string) => `fh.dismiss.${id}`

interface Tally { exit: number; later: number }

const read = (id: string): Tally => {
  if (typeof window === 'undefined') return { exit: 0, later: 0 }
  try {
    const raw = window.localStorage.getItem(KEY(id))
    if (!raw) return { exit: 0, later: 0 }
    const p = JSON.parse(raw) as Partial<Tally>
    return { exit: Number(p.exit) || 0, later: Number(p.later) || 0 }
  } catch { return { exit: 0, later: 0 } }
}

const write = (id: string, t: Tally) => {
  try { window.localStorage.setItem(KEY(id), JSON.stringify(t)) } catch { /* private mode */ }
}

/** Which verb has earned the slot, or null while both are still on show. */
export function settledChoice(t: Tally): Choice | null {
  if (t.exit + t.later < LEARN_AFTER) return null
  // Ties go to the option that keeps the thing rather than destroys it.
  return t.exit > t.later ? 'exit' : 'later'
}

export function DismissControl({
  id,
  onExit,
  onLater,
  className = '',
}: {
  /** What is being closed. Scopes the counting, so learning on one kind of
   *  card does not silently decide the verb on a different kind. */
  id: string
  onExit: () => void
  /** MUST genuinely bring it back. If this hides something for good, use
   *  onExit — a "Later" that never returns is the one thing this must not be. */
  onLater: () => void
  className?: string
}) {
  const t = useT()
  const [tally, setTally] = useState<Tally>({ exit: 0, later: 0 })
  const [ready, setReady] = useState(false)

  // Read after mount: localStorage on the server is undefined, and rendering
  // one verb on the server and two in the browser is a hydration mismatch.
  useEffect(() => { setTally(read(id)); setReady(true) }, [id])

  const choose = useCallback((c: Choice) => {
    const next = { ...read(id), [c]: read(id)[c] + 1 } as Tally
    write(id, next)
    setTally(next)
    ;(c === 'exit' ? onExit : onLater)()
  }, [id, onExit, onLater])

  // Until the tally is read, show the plain X. It is what was there before,
  // it is the smallest thing that can be right, and it never flickers wider.
  const settled = ready ? settledChoice(tally) : 'exit'

  const btn = 'inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition hover:bg-surface hover:text-slate-200'

  if (settled === 'exit') {
    return (
      <button type="button" onClick={() => choose('exit')} aria-label={t('ui.dismiss.exit')} title={t('ui.dismiss.exit')} className={`${btn} ${className}`}>
        <X className="h-3.5 w-3.5" />
      </button>
    )
  }
  if (settled === 'later') {
    return (
      <button type="button" onClick={() => choose('later')} aria-label={t('ui.dismiss.later')} title={t('ui.dismiss.later')} className={`${btn} ${className}`}>
        <Clock className="h-3.5 w-3.5" />
      </button>
    )
  }

  // The introduction. Both verbs, tight enough that the pair is barely wider
  // than the single control it replaces, and only for the first few closes.
  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`}>
      <button type="button" onClick={() => choose('exit')} aria-label={t('ui.dismiss.exit')} title={t('ui.dismiss.exit')} className={btn}>
        <X className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => choose('later')} aria-label={t('ui.dismiss.later')} title={t('ui.dismiss.later')} className={btn}>
        <Clock className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
