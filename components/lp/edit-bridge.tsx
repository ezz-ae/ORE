'use client'

import { useEffect } from 'react'

/**
 * On-canvas editing bridge (stage 1 of the Elementor-style editor).
 *
 * Rendered ONLY when the page is opened with ?lpe=1 — which the staff landing
 * editor appends to its preview iframe. It makes every [data-lpe] element
 * directly editable on the design and posts each edit to the parent editor,
 * which updates its form state ("Save edits" lights up). Nothing is ever
 * persisted from here: a visitor adding ?lpe=1 by hand can only re-type text
 * in their own browser (exactly like devtools) — saving requires the
 * authenticated editor API on the parent side.
 */
export function LpEditBridge() {
  useEffect(() => {
    // Only meaningful inside the editor's iframe — standalone tabs get nothing.
    if (typeof window === 'undefined' || window.parent === window) return

    const style = document.createElement('style')
    style.textContent = `
      [data-lpe] { cursor: text; transition: box-shadow 120ms; }
      [data-lpe]:hover { box-shadow: 0 0 0 2px rgba(212,175,55,0.45); border-radius: 4px; }
      [data-lpe]:focus { outline: none; box-shadow: 0 0 0 2px rgba(212,175,55,0.9); border-radius: 4px; }
    `
    document.head.appendChild(style)

    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-lpe]'))
    const onInput = (e: Event) => {
      const el = e.currentTarget as HTMLElement
      const field = el.dataset.lpe
      if (!field) return
      window.parent.postMessage(
        { source: 'fh-lpe', field, value: el.textContent ?? '' },
        window.location.origin,
      )
    }
    const stopNav = (e: Event) => e.preventDefault()
    for (const el of els) {
      el.setAttribute('contenteditable', 'plaintext-only')
      // Browsers without plaintext-only fall back to standard contenteditable.
      if (!el.isContentEditable) el.setAttribute('contenteditable', 'true')
      el.addEventListener('input', onInput)
      // Editing text must never trigger the element's link/CTA behaviour.
      el.closest('a')?.addEventListener('click', stopNav)
    }
    return () => {
      style.remove()
      for (const el of els) {
        el.removeAttribute('contenteditable')
        el.removeEventListener('input', onInput)
        el.closest('a')?.removeEventListener('click', stopNav)
      }
    }
  }, [])

  return null
}
