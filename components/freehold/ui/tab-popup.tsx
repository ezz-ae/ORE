'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * A tab shown as a popup. The builder's philosophy: any tab that can also be a
 * full page (Targeting, Creative, …) should open in-context as a modal when it's
 * reached from inside another flow — never a full navigation that loses the
 * campaign you're building. Direct browsing still renders the full tab; this is
 * the nested presentation.
 *
 * Renders a backdrop + centred panel, traps Escape, and locks body scroll while
 * open. Title + optional footer are provided by the caller.
 */
export function TabPopup({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-2xl',
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div className={`relative flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg border border-line p-1.5 text-slate-400 transition hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/** Canonical modal — same shell (ESC, scroll-lock, aria, bottom-sheet on mobile). */
export const Modal = TabPopup
