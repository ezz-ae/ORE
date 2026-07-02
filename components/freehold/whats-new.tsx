'use client'

import { useEffect, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { CHANGELOG, hasUnseenChanges, markChangelogSeen } from '@/lib/freehold/changelog'
import { useT } from '@/lib/i18n/provider'

const OPEN_EVENT = 'fh:whatsnew:open'

/** Fire from anywhere (e.g. the account-menu item) to open the panel. */
export function openWhatsNew() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/** Menu-item button with an "unseen" dot. */
export function WhatsNewMenuButton({ onClick }: { onClick?: () => void }) {
  const t = useT()
  const [unseen, setUnseen] = useState(false)
  useEffect(() => setUnseen(hasUnseenChanges()), [])
  return (
    <button
      onClick={() => { onClick?.(); openWhatsNew() }}
      className="flex w-full items-center gap-2 border-t border-white/[0.07] px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white"
    >
      <Sparkles className="h-4 w-4" />
      <span className="flex-1 text-left">{t('whatsnew.menu')}</span>
      {unseen && <span className="h-2 w-2 rounded-full bg-gold" aria-label="new" />}
    </button>
  )
}

/** The panel itself. Mount once near the app shell. Auto-opens on a new
 *  version, then only opens on demand. */
export function WhatsNew() {
  const t = useT()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Auto-show once when there are unseen feature announcements.
    if (hasUnseenChanges()) setOpen(true)
    const h = () => setOpen(true)
    window.addEventListener(OPEN_EVENT, h)
    return () => window.removeEventListener(OPEN_EVENT, h)
  }, [])

  function close() {
    markChangelogSeen()
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4" onClick={close}>
      <div
        className="relative flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 text-gold">
            <Sparkles className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-white">{t('whatsnew.title')}</div>
            <div className="text-xs text-slate-500">{t('whatsnew.subtitle')}</div>
          </div>
          <button onClick={close} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {CHANGELOG.map((entry) => (
            <section key={entry.version} className="mb-6 last:mb-1">
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className="text-sm font-semibold text-white">{entry.title}</h3>
                <span className="text-[11px] text-slate-500">{entry.date}</span>
              </div>
              <ul className="space-y-2.5">
                {entry.items.map((it, i) => (
                  <li key={i} className="rounded-xl border border-line bg-surface-2 p-3">
                    <div className="text-sm font-medium text-slate-100">{it.title}</div>
                    <div className="mt-0.5 text-xs text-slate-400 leading-relaxed">{it.body}</div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="border-t border-line px-5 py-3">
          <button onClick={close} className="w-full rounded-xl bg-gold py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE]">
            {t('whatsnew.gotIt')}
          </button>
        </div>
      </div>
    </div>
  )
}
