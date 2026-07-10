'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Wand2, Undo2, Redo2, Loader2, Square, X, Sparkles, AlertTriangle, RotateCcw,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import {
  AiUnavailable, DOC_LIMIT,
  type AiEditorRailProps, type Snapshot,
} from '@/lib/freehold/drive-ai-rail'

// The ONE agentic co-editor rail. The user types a natural-language instruction;
// the host adapter performs the real edit and returns the post-edit snapshot; the
// rail records a reversible turn (undo/redo). It knows nothing about doc vs image —
// all artifact behaviour lives in the injected adapter. Honest by construction:
// a thrown error becomes an error row with the REAL message and the artifact is
// left untouched; the thread + undo history are in-memory only (stated in a footer).

interface Entry<S> { id: string; instruction: string; before: S; after: S; revisionAtCommit: number }
type ThreadItem =
  | { id: string; kind: 'turn'; n: number; instruction: string; summary: string }
  | { id: string; kind: 'noop'; instruction: string }
  | { id: string; kind: 'error'; instruction: string; message: string }
  | { id: string; kind: 'note'; textKey: 'ed.ai.reverted' | 'ed.ai.redone'; instruction: string }

function useIsXl() {
  const [isXl, setIsXl] = useState(true) // SSR-safe default: desktop
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1280px)')
    const on = () => setIsXl(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return isXl
}

export function AiEditorRail<S extends Snapshot = Snapshot>({
  adapter, revision, presets, placeholderKey, disabled, disabledHintKey, footNoteKey,
}: AiEditorRailProps<S>) {
  const t = useT()
  const isXl = useIsXl()

  const [undoStack, setUndo] = useState<Entry<S>[]>([])
  const [redoStack, setRedo] = useState<Entry<S>[]>([])
  const [thread, setThread] = useState<ThreadItem[]>([])
  const [pending, setPending] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [confirm, setConfirm] = useState<null | 'undo' | 'redo'>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const idRef = useRef(0)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const nextId = () => String(++idRef.current)

  const artifact = t(`ed.ai.artifact.${adapter.kind}`)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [thread, pending])

  const pushError = useCallback((instruction: string, message: string) => {
    setThread((th) => [...th, { id: nextId(), kind: 'error', instruction, message }])
  }, [])

  const run = useCallback(async (text: string) => {
    const instruction = text.trim()
    if (!instruction || pending || disabled) return
    const before = adapter.snapshot()
    const pf = adapter.preflight?.(instruction, before)
    if (pf) { pushError(instruction, pf); return }

    const ac = new AbortController()
    abortRef.current = ac
    setPending(instruction)
    try {
      const r = await adapter.apply({ instruction, before, signal: ac.signal })
      if (r.truncated) { pushError(instruction, t('ed.ai.err.truncated', { limit: DOC_LIMIT })); return }
      if (r.noop) { setThread((th) => [...th, { id: nextId(), kind: 'noop', instruction }]); return }
      const n = undoStack.length + 1
      const entry: Entry<S> = { id: nextId(), instruction, before, after: r.after, revisionAtCommit: revision }
      setUndo((u) => [...u, entry])
      setRedo([])
      setThread((th) => [...th, { id: nextId(), kind: 'turn', n, instruction, summary: r.summary }])
      setInput('')
    } catch (err) {
      if (ac.signal.aborted) return // aborted → nothing recorded, input kept
      if (err instanceof AiUnavailable) {
        setUnavailable(true)
        pushError(instruction, t('ed.ai.unavailable', { artifact }))
      } else {
        pushError(instruction, err instanceof Error ? err.message : t('ed.ai.error.title'))
      }
    } finally {
      setPending(null)
      abortRef.current = null
    }
  }, [pending, disabled, adapter, undoStack.length, revision, t, artifact, pushError])

  const doUndo = useCallback((force = false) => {
    if (!undoStack.length || pending) return
    const top = undoStack[undoStack.length - 1]
    if (!force && revision !== top.revisionAtCommit) { setConfirm('undo'); return }
    setConfirm(null)
    adapter.restore(top.before)
    setUndo((u) => u.slice(0, -1))
    setRedo((r) => [top, ...r])
    setThread((th) => [...th, { id: nextId(), kind: 'note', textKey: 'ed.ai.reverted', instruction: top.instruction }])
  }, [undoStack, pending, revision, adapter])

  const doRedo = useCallback((force = false) => {
    if (!redoStack.length || pending) return
    const head = redoStack[0]
    if (!force && revision !== head.revisionAtCommit) { setConfirm('redo'); return }
    setConfirm(null)
    adapter.restore(head.after)
    setRedo((r) => r.slice(1))
    setUndo((u) => [...u, head])
    setThread((th) => [...th, { id: nextId(), kind: 'note', textKey: 'ed.ai.redone', instruction: head.instruction }])
  }, [redoStack, pending, revision, adapter])

  function pickPreset(instructionKey: string) {
    setInput(t(instructionKey))
    requestAnimationFrame(() => {
      const el = taRef.current
      if (el) { el.focus(); const v = el.value; el.setSelectionRange(v.length, v.length) }
    })
  }

  const confirmInstruction = confirm === 'undo'
    ? undoStack[undoStack.length - 1]?.instruction ?? ''
    : confirm === 'redo' ? redoStack[0]?.instruction ?? '' : ''

  const canSend = !!input.trim() && !pending && !disabled

  // ── Render pieces ────────────────────────────────────────────────────────────
  const iconBtn = 'grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-surface-2 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent'

  const header = (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] pb-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold">
        <Wand2 className="h-3.5 w-3.5" /> {t('ed.ai.title')}
      </div>
      <div className="flex items-center gap-0.5">
        <button type="button" onClick={() => doUndo()} disabled={!undoStack.length || !!pending} title={t('ed.ai.undo')} className={iconBtn}>
          <Undo2 className="h-4 w-4 rtl:-scale-x-100" />
        </button>
        <button type="button" onClick={() => doRedo()} disabled={!redoStack.length || !!pending} title={t('ed.ai.redo')} className={iconBtn}>
          <Redo2 className="h-4 w-4 rtl:-scale-x-100" />
        </button>
      </div>
    </div>
  )

  const chips = presets && presets.length > 0 ? (
    <div>
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">{t('ed.ai.presetsLabel')}</div>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button key={p.instructionKey} type="button" onClick={() => pickPreset(p.instructionKey)} disabled={!!pending || disabled}
            className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-gold/30 hover:text-gold disabled:opacity-50">
            {t(p.labelKey)}
          </button>
        ))}
      </div>
    </div>
  ) : null

  const threadView = (
    <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto py-3">
      {unavailable && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-[11px] leading-snug text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('ed.ai.unavailable', { artifact })}
        </div>
      )}

      {thread.length === 0 ? (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-500">{t('ed.ai.emptyThread', { artifact })}</p>
          {chips}
        </div>
      ) : (
        thread.map((it) => {
          if (it.kind === 'turn') {
            return (
              <div key={it.id} className="rounded-lg border border-line bg-surface-2/50 px-3 py-2">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
                  <Sparkles className="h-3 w-3" /> {t('ed.ai.step', { n: it.n })}
                </div>
                <p dir="auto" className="text-xs leading-snug text-slate-200">“{it.instruction}”</p>
                <p className="mt-1 text-[11px] text-slate-500">{it.summary}</p>
              </div>
            )
          }
          if (it.kind === 'noop') {
            return <p key={it.id} dir="auto" className="px-1 text-[11px] leading-snug text-slate-500">{t('ed.ai.noChange')}</p>
          }
          if (it.kind === 'note') {
            return <p key={it.id} dir="auto" className="px-1 text-[11px] leading-snug text-slate-500">{t(it.textKey, { instruction: it.instruction })}</p>
          }
          // error
          return (
            <div key={it.id} className="rounded-lg border border-red-400/25 bg-red-400/[0.06] px-3 py-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-red-300">{t('ed.ai.error.title')}</div>
              <p dir="auto" className="text-[11px] leading-snug text-red-200/90">{it.message}</p>
              <p className="mt-1 text-[11px] text-slate-500">{t('ed.ai.error.unchanged', { artifact })}</p>
              <button type="button" onClick={() => run(it.instruction)} disabled={!!pending || disabled}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-gold transition hover:opacity-80 disabled:opacity-50">
                <RotateCcw className="h-3 w-3" /> {t('ed.ai.retry')}
              </button>
            </div>
          )
        })
      )}

      {pending && (
        <div className="rounded-lg border border-gold/20 bg-gold/[0.06] px-3 py-2">
          <p dir="auto" className="text-xs leading-snug text-slate-300">“{pending}”</p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400"><Loader2 className="h-3 w-3 animate-spin text-gold" /> {t('ed.ai.working')}</span>
            <button type="button" onClick={() => abortRef.current?.abort()} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-[11px] text-slate-400 transition hover:text-white">
              <Square className="h-2.5 w-2.5" /> {t('ed.ai.stop')}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const composer = (
    <div className="shrink-0 space-y-2 border-t border-white/[0.07] pt-3">
      {confirm && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-3 py-2">
          <p className="text-[11px] leading-snug text-amber-100">{t('ed.ai.undoWarnManual', { instruction: confirmInstruction })}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => (confirm === 'undo' ? doUndo(true) : doRedo(true))}
              className="rounded-md bg-amber-400/90 px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-amber-300">{t('ed.ai.undoWarnConfirm')}</button>
            <button type="button" onClick={() => setConfirm(null)}
              className="rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:text-white">{t('ed.ai.cancel')}</button>
          </div>
        </div>
      )}

      {!confirm && thread.length > 0 && chips}

      <textarea
        ref={taRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(input) } }}
        rows={3}
        dir="auto"
        disabled={disabled}
        placeholder={t(placeholderKey)}
        className="w-full resize-none rounded-xl border border-line bg-surface px-2.5 py-2 text-xs leading-snug text-white outline-none placeholder:text-slate-600 focus:border-gold/40 disabled:opacity-50"
      />
      {disabled && disabledHintKey ? (
        <p className="text-[11px] text-slate-500">{t(disabledHintKey)}</p>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-600">{t('ed.ai.submitHint')}</span>
          <button type="button" onClick={() => run(input)} disabled={!canSend}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-40">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} {t('ed.ai.send')}
          </button>
        </div>
      )}

      {footNoteKey && <p className="text-[10px] leading-snug text-slate-600">{t(footNoteKey)}</p>}
      <p className="text-[10px] leading-snug text-slate-600">{t('ed.ai.ephemeralNote')}</p>
    </div>
  )

  const railBody = (
    <div className="flex h-full flex-col">
      {header}
      {threadView}
      {composer}
    </div>
  )

  // Desktop: render inside the frame's xl aside.
  if (isXl) return <div className="flex h-full flex-col">{railBody}</div>

  // Mobile/tablet: the frame's aside is display:none below xl, so self-portal a
  // launcher + bottom sheet to document.body — ONE instance, so thread/undo state
  // survives a desktop⇄mobile resize.
  if (typeof document === 'undefined') return null
  return createPortal(
    <>
      <button type="button" onClick={() => setMobileOpen(true)}
        className="fixed inset-block-end-4 inset-inline-end-4 z-[120] inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2.5 text-xs font-semibold text-ink shadow-[0_8px_24px_rgba(0,0,0,0.4)] xl:hidden">
        <Sparkles className="h-4 w-4" /> {t('ed.ai.mobileOpen')}
        {undoStack.length > 0 && <span className="ms-0.5 h-1.5 w-1.5 rounded-full bg-ink" />}
      </button>
      {mobileOpen && (
        <div className="fixed inset-0 z-[130] xl:hidden" role="dialog" aria-modal="true">
          <button aria-label={t('ed.ai.mobileClose')} onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-inline-0 inset-block-end-0 flex max-h-[85svh] flex-col rounded-t-2xl border-t border-white/10 bg-chrome p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-surface-3" />
            <div className="flex shrink-0 items-center justify-between pb-1">
              <span className="text-sm font-semibold text-white">{t('ed.ai.title')}</span>
              <button type="button" onClick={() => setMobileOpen(false)} className={iconBtn}><X className="h-4 w-4" /></button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">{railBody}</div>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
