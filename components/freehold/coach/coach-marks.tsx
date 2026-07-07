'use client'

/**
 * Coach marks — a self-contained, role-aware onboarding tour.
 *
 * <CoachProvider> wraps the app shell. It:
 *   - auto-starts the tour once per role per version (localStorage-gated),
 *   - exposes `useCoach().start()` so the nav can offer "Take a tour",
 *   - renders a spotlight overlay that pins a tooltip beside any
 *     `[data-coach="…"]` element, falling back to a centred card when the
 *     anchor isn't on the current page.
 *
 * Fully translated (EN/AR/RU) and RTL-aware via the i18n provider.
 */

import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n/provider'
import { useSession } from '@/lib/freehold/use-session'
import {
  tourForRole, tourForApp, appIdForPath, coachSeenKey, appCoachSeenKey,
  type CoachStep, type Placement,
} from '@/lib/freehold/coach-tours'
import { getHowTo } from '@/lib/freehold/howto'
import { loadAccountMemory, saveAccountMemory } from '@/lib/freehold/account-memory'

interface CoachCtx {
  /** launch the tour for the signed-in role from step 0 */
  start: () => void
  /** whether a tour exists for the signed-in role */
  available: boolean
  /** start a task walkthrough (e.g. 'meta-ad') — guides across pages */
  startHowTo: (id: string) => void
}

const Ctx = createContext<CoachCtx>({ start: () => {}, available: false, startHowTo: () => {} })

export function useCoach(): CoachCtx {
  return useContext(Ctx)
}

function firstName(name?: string): string {
  const n = (name || '').trim()
  return n ? n.split(/\s+/)[0] : ''
}

// --- Session-scoped "stop nagging" cap -------------------------------------
// After the user skips two auto-started tours in one browser session, we stop
// auto-opening tours for the rest of that session. sessionStorage clears when
// the tab/session ends, so a fresh visit starts clean.
const SKIP_KEY = 'fh-coach-skips'
const SKIP_CAP = 2

function autoTourSuppressed(): boolean {
  if (typeof window === 'undefined') return false
  try { return Number(window.sessionStorage.getItem(SKIP_KEY)) >= SKIP_CAP } catch { return false }
}

function noteAutoTourSkip(): void {
  try {
    const n = Number(window.sessionStorage.getItem(SKIP_KEY)) || 0
    window.sessionStorage.setItem(SKIP_KEY, String(n + 1))
  } catch { /* ignore */ }
}

// A finished/skipped tour is remembered by the ACCOUNT, not just this browser —
// on a new device the coach won't restart tours the user already completed.
function recordTourSeen(key: string): void {
  try { localStorage.setItem(key, '1') } catch { /* ignore */ }
  loadAccountMemory().then((m) => {
    const seen = { ...((m.coachSeen as Record<string, 1>) ?? {}), [key]: 1 as const }
    saveAccountMemory({ coachSeen: seen })
  })
}

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const { ready, user } = useSession()
  const role = user?.role
  const pathname = usePathname() ?? ''
  const appId = appIdForPath(pathname)

  const [active, setActive] = useState(false)
  const [index, setIndex] = useState(0)
  const [steps, setSteps] = useState<CoachStep[]>([])
  const seenKeyRef = useRef<string | null>(null)
  // Whether the currently-active tour was auto-started (vs. replayed on demand).
  const autoStartedRef = useRef(false)
  // Active task walkthrough (cross-page): flow id + absolute index of the
  // first step in the slice currently on screen + the slice length.
  const howtoRef = useRef<{ id: string; base: number; len: number } | null>(null)
  const router = useRouter()

  // The tour the "Take a tour" button replays on the current surface: the
  // app's contextual tour when on an app, otherwise the role welcome.
  const contextualSteps = appId ? tourForApp(appId) : tourForRole(role)

  // "Smart" filter: keep centred steps (welcome/tip/done) and only those
  // anchored steps whose highlight target is actually on the page right now.
  // This stops the tour from explaining things the user can't see.
  const visibleSteps = useCallback((s: CoachStep[]): CoachStep[] => {
    if (typeof document === 'undefined') return s
    return s.filter((step) => {
      if (!step.anchor || step.placement === 'center') return true
      return !!document.querySelector(`[data-coach="${step.anchor}"]`)
    })
  }, [])

  const startTour = useCallback((s: CoachStep[], seenKey: string | null, auto = false) => {
    const filtered = visibleSteps(s)
    if (filtered.length === 0) return
    seenKeyRef.current = seenKey
    autoStartedRef.current = auto
    setSteps(filtered)
    setIndex(0)
    setActive(true)
  }, [visibleSteps])

  const start = useCallback(() => {
    if (appId) startTour(tourForApp(appId), appCoachSeenKey(appId))
    else if (role) startTour(tourForRole(role), coachSeenKey(role))
  }, [appId, role, startTour])

  // Hydrate tour progress from ACCOUNT memory before any auto-start decision:
  // tours completed on another device are mirrored into localStorage first, so
  // a returning user is never re-toured just because the browser is new.
  const [memReady, setMemReady] = useState(false)
  useEffect(() => {
    let cancelled = false
    loadAccountMemory().then((m) => {
      const seen = m.coachSeen as Record<string, unknown> | undefined
      if (seen) {
        for (const k of Object.keys(seen)) {
          if (seen[k]) { try { localStorage.setItem(k, '1') } catch { /* ignore */ } }
        }
      }
      if (!cancelled) setMemReady(true)
    })
    return () => { cancelled = true }
  }, [])

  // Auto-start: the role welcome the first time (anywhere), then each app's
  // contextual tour the first time that app is opened. One tour per page load.
  // If the user has skipped auto-tours twice this session, stop offering them —
  // a quieter experience; the "Take a tour" button still replays on demand.
  useEffect(() => {
    if (!ready || !memReady || !role || active) return
    if (autoTourSuppressed()) return
    const seen = (k: string) => { try { return !!localStorage.getItem(k) } catch { return true } }

    const roleSteps = tourForRole(role)
    if (roleSteps.length && !seen(coachSeenKey(role))) {
      const id = setTimeout(() => startTour(roleSteps, coachSeenKey(role), true), 900)
      return () => clearTimeout(id)
    }
    if (appId) {
      const appSteps = tourForApp(appId)
      if (appSteps.length && !seen(appCoachSeenKey(appId))) {
        const id = setTimeout(() => startTour(appSteps, appCoachSeenKey(appId), true), 900)
        return () => clearTimeout(id)
      }
    }
  }, [ready, memReady, role, appId, active, startTour])

  // Close via skip / dismiss. Marks the tour seen (so it won't reappear next
  // session) and, when it was auto-started, counts toward the session skip cap.
  const finish = useCallback(() => {
    setActive(false)
    // Skipping a task walkthrough ends the whole flow — no skip-cap, no seen key.
    if (howtoRef.current) {
      howtoRef.current = null
      try { sessionStorage.removeItem(HOWTO_SS) } catch {}
      return
    }
    if (seenKeyRef.current) recordTourSeen(seenKeyRef.current)
    if (autoStartedRef.current) noteAutoTourSkip()
  }, [])

  // Reaching the end is a completion, not a skip — mark seen, no skip count.
  const complete = useCallback(() => {
    // Task walkthroughs advance across pages instead of just closing.
    const h = howtoRef.current
    if (h) {
      const flow = getHowTo(h.id)
      const nextIdx = h.base + h.len
      setActive(false)
      howtoRef.current = null
      if (flow && nextIdx < flow.steps.length) {
        try { sessionStorage.setItem(HOWTO_SS, JSON.stringify({ id: h.id, idx: nextIdx })) } catch {}
        router.push(flow.steps[nextIdx].href) // resume effect picks it up there
      } else {
        try { sessionStorage.removeItem(HOWTO_SS) } catch {}
      }
      return
    }
    setActive(false)
    if (seenKeyRef.current) recordTourSeen(seenKeyRef.current)
  }, [router])

  // ── Task walkthroughs ("How do I…") — cross-page guided flows ─────────────
  const startHowTo = useCallback((id: string) => {
    const flow = getHowTo(id)
    if (!flow?.steps.length) return
    try { sessionStorage.setItem(HOWTO_SS, JSON.stringify({ id, idx: 0 })) } catch {}
    if (pathname !== flow.steps[0].href) {
      router.push(flow.steps[0].href) // the resume effect starts the overlay there
    } else {
      // Already on the right page — trigger the resume effect via state below.
      setResumeTick((n) => n + 1)
    }
  }, [pathname, router])

  const [resumeTick, setResumeTick] = useState(0)

  // Resume a pending walkthrough whenever we land on the page its next step
  // expects. Shows the contiguous run of steps that belong to this page.
  useEffect(() => {
    if (!ready || active) return
    let saved: { id: string; idx: number } | null = null
    try { saved = JSON.parse(sessionStorage.getItem(HOWTO_SS) || 'null') } catch {}
    if (!saved) return
    const flow = getHowTo(saved.id)
    if (!flow) { try { sessionStorage.removeItem(HOWTO_SS) } catch {}; return }
    const step = flow.steps[saved.idx]
    if (!step || step.href !== pathname) return // waiting for the user to arrive
    let len = 1
    while (saved.idx + len < flow.steps.length && flow.steps[saved.idx + len].href === pathname) len++
    const slice: CoachStep[] = flow.steps.slice(saved.idx, saved.idx + len).map((s) => ({
      key: s.key,
      anchor: s.anchor,
      placement: s.anchor ? 'bottom' : 'center',
    }))
    howtoRef.current = { id: saved.id, base: saved.idx, len }
    seenKeyRef.current = null
    autoStartedRef.current = false
    // Give the page a beat to render its anchors before spotlighting.
    const t = setTimeout(() => { setSteps(slice); setIndex(0); setActive(true) }, 700)
    return () => clearTimeout(t)
  }, [pathname, ready, active, resumeTick])

  return (
    <Ctx.Provider value={{ start, available: contextualSteps.length > 0, startHowTo }}>
      {children}
      {active && role && (
        <CoachOverlay
          steps={steps}
          index={index}
          onIndex={setIndex}
          onClose={finish}
          onComplete={complete}
          userName={firstName(user?.name)}
        />
      )}
    </Ctx.Provider>
  )
}

const HOWTO_SS = 'fh-howto'

const CARD_W = 340
const GAP = 14
const PAD = 8 // spotlight padding around the anchor

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** Compute the tooltip card position from the anchor rect + preferred placement. */
function place(
  rect: DOMRect | null,
  placement: Placement,
  cardW: number,
  cardH: number,
): { top: number; left: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!rect || placement === 'center') {
    return { top: clamp(vh / 2 - cardH / 2, PAD, vh - cardH - PAD), left: clamp(vw / 2 - cardW / 2, PAD, vw - cardW - PAD) }
  }

  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  // Pick an effective placement that fits; fall back to the opposite side.
  let p = placement
  if (p === 'bottom' && rect.bottom + GAP + cardH > vh - PAD && rect.top - GAP - cardH > PAD) p = 'top'
  else if (p === 'top' && rect.top - GAP - cardH < PAD && rect.bottom + GAP + cardH < vh - PAD) p = 'bottom'
  else if (p === 'right' && rect.right + GAP + cardW > vw - PAD && rect.left - GAP - cardW > PAD) p = 'left'
  else if (p === 'left' && rect.left - GAP - cardW < PAD && rect.right + GAP + cardW < vw - PAD) p = 'right'

  let top: number
  let left: number
  switch (p) {
    case 'top':
      top = rect.top - GAP - cardH
      left = cx - cardW / 2
      break
    case 'left':
      left = rect.left - GAP - cardW
      top = cy - cardH / 2
      break
    case 'right':
      left = rect.right + GAP
      top = cy - cardH / 2
      break
    case 'bottom':
    default:
      top = rect.bottom + GAP
      left = cx - cardW / 2
      break
  }
  return { top: clamp(top, PAD, vh - cardH - PAD), left: clamp(left, PAD, vw - cardW - PAD) }
}

function sameRect(a: DOMRect | null, b: DOMRect | null) {
  if (a === b) return true
  if (!a || !b) return false
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height
}

function CoachOverlay({
  steps, index, onIndex, onClose, onComplete, userName,
}: {
  steps: CoachStep[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  onComplete: () => void
  userName: string
}) {
  const { t, dir } = useI18n()
  const step = steps[index]
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [cardH, setCardH] = useState(200)
  const [portalReady, setPortalReady] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const rectRef = useRef<DOMRect | null>(null)

  useEffect(() => setPortalReady(true), [])

  const isFirst = index === 0
  const isLast = index === steps.length - 1
  const cardW = Math.min(CARD_W, (typeof window !== 'undefined' ? window.innerWidth : CARD_W) - 2 * PAD)

  // Track the anchor's rect every frame so the spotlight stays glued during
  // smooth-scroll and layout shifts. Cheap getBoundingClientRect + change-guard.
  useEffect(() => {
    if (!step) return
    const el = step.anchor
      ? (document.querySelector(`[data-coach="${step.anchor}"]`) as HTMLElement | null)
      : null
    // Centered step (no anchor, or anchor not on this page): set rect once and
    // skip the per-frame tracking loop entirely — nothing to follow.
    if (!el) {
      if (rectRef.current !== null) { rectRef.current = null; setRect(null) }
      return
    }
    try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }) } catch {}
    let raf = 0
    const loop = () => {
      const next = document.contains(el) ? el.getBoundingClientRect() : null
      if (!sameRect(rectRef.current, next)) {
        rectRef.current = next
        setRect(next)
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [index, step])

  // Measure the card height after content/locale changes for accurate placement.
  useLayoutEffect(() => {
    if (cardRef.current) setCardH(cardRef.current.getBoundingClientRect().height)
  }, [index, step?.key])

  // Keyboard: Esc closes, ←/→ navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); isLast ? onComplete() : onIndex(index + 1) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (!isFirst) onIndex(index - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, isFirst, isLast, onClose, onComplete, onIndex])

  if (!portalReady || !step) return null

  const pos = place(rect, step.placement ?? (rect ? 'bottom' : 'center'), cardW, cardH)
  const title = t(`${step.key}.title`, { name: userName })
  const body = t(`${step.key}.body`, { name: userName })

  return createPortal(
    <div dir={dir} className="fixed inset-0 z-[300]" aria-live="polite" role="dialog" aria-modal="true">
      {/* Click-blocker: makes the tour modal without dimming (dim comes from the
          spotlight's box-shadow, or a full backdrop when there's no anchor). */}
      <div
        className="absolute inset-0"
        style={{ background: rect ? 'transparent' : 'rgba(2,6,12,0.72)' }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Spotlight — one box-shadow does it all: a strong page dim, a crisp gold
          ring tight to the element, a soft halo, and an outer glow. (Explicit
          shadow rings stay pixel-aligned to the rounded rect, unlike `ring-*`.) */}
      {rect && (
        <div
          className="pointer-events-none absolute rounded-xl transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow:
              '0 0 0 9999px rgba(2,6,12,0.82), ' +   // dim everything else
              '0 0 0 2px rgba(212,175,55,0.95), ' +  // crisp gold ring
              '0 0 0 6px rgba(212,175,55,0.28), ' +  // soft halo
              '0 0 28px 6px rgba(212,175,55,0.30)',  // outer glow
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={cardRef}
        className="absolute w-[340px] max-w-[92vw] rounded-2xl border border-gold/25 bg-surface p-5 shadow-[0_24px_70px_rgba(0,0,0,0.7)]"
        style={{ top: pos.top, left: pos.left }}
      >
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-gold">
            <Sparkles className="h-3.5 w-3.5" />
            {t('coach.ui.step', { n: index + 1, total: steps.length })}
          </span>
          <button
            onClick={onClose}
            aria-label={t('coach.ui.skip')}
            className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3 className="text-base font-semibold leading-snug text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{body}</p>

        {/* Progress dots */}
        <div className="mt-4 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s.key + i}
              className={[
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-5 bg-gold' : 'w-1.5 bg-white/15',
              ].join(' ')}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-300"
          >
            {t('coach.ui.skip')}
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={() => onIndex(index - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-white/[0.12] px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:border-white/[0.25] hover:text-white"
              >
                {dir === 'rtl' ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                {t('coach.ui.back')}
              </button>
            )}
            <button
              onClick={() => (isLast ? onComplete() : onIndex(index + 1))}
              className="inline-flex items-center gap-1 rounded-lg bg-gold px-3.5 py-1.5 text-sm font-semibold text-[#06080A] transition-opacity hover:opacity-90"
            >
              {isLast ? t('coach.ui.done') : t('coach.ui.next')}
              {!isLast && (dir === 'rtl' ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />)}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
