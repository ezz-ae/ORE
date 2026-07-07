'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, X, ArrowRight } from 'lucide-react'
import { CHANGELOG, CHANGELOG_VERSION, getSeenVersion, hasUnseenChanges, markChangelogSeen } from '@/lib/freehold/changelog'
import { loadAccountMemory, saveAccountMemory } from '@/lib/freehold/account-memory'
import { useT } from '@/lib/i18n/provider'

const OPEN_EVENT = 'fh:whatsnew:open'

/** Fire from anywhere (e.g. the account-menu item) to open the full panel. */
export function openWhatsNew() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

/** Menu-item button with an "unseen" dot. */
export function WhatsNewMenuButton({ onClick }: { onClick?: () => void }) {
  const t = useT()
  const [unseen, setUnseen] = useState(false)
  useEffect(() => {
    let cancelled = false
    // The account remembers what it has seen — a new device shows the dot
    // only when the ACCOUNT hasn't seen the latest entry yet.
    loadAccountMemory().then((m) => {
      const acct = typeof m.whatsNewSeen === 'number' ? m.whatsNewSeen : 0
      if (acct >= CHANGELOG_VERSION) markChangelogSeen()
      if (!cancelled) setUnseen(hasUnseenChanges())
    })
    return () => { cancelled = true }
  }, [])
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

/**
 * Mount once near the app shell. When there are unseen features it shows a
 * small, dismissible toast in the corner — never a screen-blocking modal on
 * load. The full panel opens only on demand: from the account menu or the
 * toast's "See what's new".
 */
export function WhatsNew() {
  const t = useT()
  const [open, setOpen] = useState(false)     // full panel
  const [toast, setToast] = useState(false)   // corner nudge
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
    const onOpen = () => { setOpen(true); setToast(false) }
    window.addEventListener(OPEN_EVENT, onOpen)
    let id: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    // Ask the ACCOUNT first: dismissing on one device dismisses everywhere.
    loadAccountMemory().then((m) => {
      if (cancelled) return
      const acct = typeof m.whatsNewSeen === 'number' ? m.whatsNewSeen : 0
      if (acct >= CHANGELOG_VERSION) { markChangelogSeen(); return }
      const local = getSeenVersion()
      if (local > acct) saveAccountMemory({ whatsNewSeen: local }) // backfill from this device
      if (hasUnseenChanges()) {
        // Slide in after the page settles, rather than blocking on first paint.
        id = setTimeout(() => setToast(true), 1200)
      }
    })
    return () => { cancelled = true; if (id) clearTimeout(id); window.removeEventListener(OPEN_EVENT, onOpen) }
  }, [])

  function markSeenEverywhere() {
    markChangelogSeen()
    saveAccountMemory({ whatsNewSeen: CHANGELOG_VERSION })
  }
  function closePanel() { markSeenEverywhere(); setOpen(false); setToast(false) }
  function dismissToast() { markSeenEverywhere(); setToast(false) }
  function openPanel() { setToast(false); setOpen(true) }

  const latest = CHANGELOG[0]

  // Portal to <body>: the nav header uses backdrop-blur, which turns it into a
  // containing block for fixed descendants — rendered inline, the toast/panel
  // got trapped inside (and broke) the header on phone and laptop.
  if (!portalReady) return null

  return createPortal(
    <>
      {/* Non-blocking corner nudge */}
      {toast && !open && latest && (
        <div className="fixed bottom-4 right-4 z-[200] w-[min(92vw,340px)]">
          <div className="overflow-hidden rounded-2xl border border-gold/25 bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.28)]">
            <div className="flex items-start gap-3 p-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-white">{t('whatsnew.title')}</div>
                <div className="mt-0.5 truncate text-xs text-slate-400">{latest.title}</div>
                <button
                  onClick={openPanel}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-gold transition hover:opacity-80"
                >
                  {t('whatsnew.menu')} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
              <button
                onClick={dismissToast}
                aria-label={t('whatsnew.gotIt')}
                className="grid h-6 w-6 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full panel — on demand only */}
      {open && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4" onClick={closePanel}>
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
              <button onClick={closePanel} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white">
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
              <button onClick={closePanel} className="w-full rounded-xl bg-gold py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE]">
                {t('whatsnew.gotIt')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
