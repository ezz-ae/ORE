'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Wand2, Undo2, Redo2, AlertTriangle, Sparkles, Loader2 } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import {
  AiUnavailable, DOC_LIMIT,
  type AiEditorRailProps, type Snapshot,
} from '@/lib/freehold/drive-ai-rail'
import { registerExpertEditor, unregisterExpertEditor, type ExpertEditorSurface } from '@/lib/freehold/expert-bus'

/**
 * The Drive AI co-editor — now HEADLESS. There is ONE chat in the workspace:
 * the Expert side panel. This component keeps the reversible-edit state
 * machine (apply → undo/redo with manual-edit protection) and REGISTERS the
 * open artifact with the Expert chat, which becomes its instruction box.
 * What renders here is only a slim strip: undo/redo + the last action.
 * Honest by construction: a thrown error surfaces the REAL message and the
 * artifact is left untouched; history is in-memory only (footer states it).
 */

interface Entry<S> { id: string; instruction: string; before: S; after: S; revisionAtCommit: number }
type LastAction =
  | { kind: 'turn'; n: number; instruction: string; summary: string }
  | { kind: 'noop'; instruction: string }
  | { kind: 'error'; instruction: string; message: string }
  | { kind: 'note'; textKey: string; instruction: string }
  | null

export function AiEditorRail<S extends Snapshot = Snapshot>({
  adapter, revision, presets, disabled, disabledHintKey, footNoteKey,
}: AiEditorRailProps<S>) {
  const t = useT()

  const [undoStack, setUndo] = useState<Entry<S>[]>([])
  const [redoStack, setRedo] = useState<Entry<S>[]>([])
  const [last, setLast] = useState<LastAction>(null)
  const [turns, setTurns] = useState(0)
  const [pending, setPending] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<null | 'undo' | 'redo'>(null)
  const [unavailable, setUnavailable] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const idRef = useRef(0)
  const nextId = () => String(++idRef.current)

  const artifact = t(`ed.ai.artifact.${adapter.kind}`)

  const run = useCallback(async (text: string): Promise<{ ok: boolean; summary: string }> => {
    const instruction = text.trim()
    if (!instruction || pending) return { ok: false, summary: '' }
    if (disabled) {
      const msg = disabledHintKey ? t(disabledHintKey) : t('ed.ai.error.title')
      setLast({ kind: 'error', instruction, message: msg })
      return { ok: false, summary: msg }
    }
    const before = adapter.snapshot()
    const pf = adapter.preflight?.(instruction, before)
    if (pf) { setLast({ kind: 'error', instruction, message: pf }); return { ok: false, summary: pf } }

    const ac = new AbortController()
    abortRef.current = ac
    setPending(instruction)
    try {
      const r = await adapter.apply({ instruction, before, signal: ac.signal })
      if (r.truncated) {
        const msg = t('ed.ai.err.truncated', { limit: DOC_LIMIT })
        setLast({ kind: 'error', instruction, message: msg })
        return { ok: false, summary: msg }
      }
      if (r.noop) {
        setLast({ kind: 'noop', instruction })
        return { ok: true, summary: t('ed.ai.noChange') }
      }
      const entry: Entry<S> = { id: nextId(), instruction, before, after: r.after, revisionAtCommit: revision }
      setUndo((u) => [...u, entry])
      setRedo([])
      const n = turns + 1
      setTurns(n)
      setLast({ kind: 'turn', n, instruction, summary: r.summary })
      return { ok: true, summary: r.summary }
    } catch (err) {
      if (ac.signal.aborted) return { ok: false, summary: '' }
      if (err instanceof AiUnavailable) {
        setUnavailable(true)
        const msg = t('ed.ai.unavailable', { artifact })
        setLast({ kind: 'error', instruction, message: msg })
        return { ok: false, summary: msg }
      }
      const msg = err instanceof Error ? err.message : t('ed.ai.error.title')
      setLast({ kind: 'error', instruction, message: msg })
      return { ok: false, summary: msg }
    } finally {
      setPending(null)
      abortRef.current = null
    }
  }, [pending, disabled, disabledHintKey, adapter, revision, t, artifact, turns])

  const doUndo = useCallback((force = false): boolean => {
    if (!undoStack.length || pending) return false
    const top = undoStack[undoStack.length - 1]
    if (!force && revision !== top.revisionAtCommit) { setConfirm('undo'); return false }
    setConfirm(null)
    adapter.restore(top.before)
    setUndo((u) => u.slice(0, -1))
    setRedo((r) => [top, ...r])
    setLast({ kind: 'note', textKey: 'ed.ai.reverted', instruction: top.instruction })
    return true
  }, [undoStack, pending, revision, adapter])

  const doRedo = useCallback((force = false): boolean => {
    if (!redoStack.length || pending) return false
    const head = redoStack[0]
    if (!force && revision !== head.revisionAtCommit) { setConfirm('redo'); return false }
    setConfirm(null)
    adapter.restore(head.after)
    setRedo((r) => r.slice(1))
    setUndo((u) => [...u, head])
    setLast({ kind: 'note', textKey: 'ed.ai.redone', instruction: head.instruction })
    return true
  }, [redoStack, pending, revision, adapter])

  // ── Register the open artifact with the ONE Expert chat ───────────────────
  // Surface methods read refs so the registration is stable across renders
  // while always invoking the latest state machine.
  const runRef = useRef(run); runRef.current = run
  const undoRef = useRef(doUndo); undoRef.current = doUndo
  const undoLenRef = useRef(0); undoLenRef.current = undoStack.length
  const tRef = useRef(t); tRef.current = t
  const presetsRef = useRef(presets); presetsRef.current = presets
  const artifactRef = useRef(artifact); artifactRef.current = artifact
  // Manual-edit warning state for CHAT-initiated undo: the rail (and its
  // inline confirm box) is hidden below xl, so the chat path must resolve the
  // warning with a native confirm — never strand the action invisibly.
  const undoTopRef = useRef('')
  undoTopRef.current = undoStack[undoStack.length - 1]?.instruction ?? ''
  const undoNeedsWarnRef = useRef(false)
  undoNeedsWarnRef.current =
    undoStack.length > 0 && revision !== undoStack[undoStack.length - 1].revisionAtCommit

  useEffect(() => {
    const surface: ExpertEditorSurface = {
      kind: adapter.kind,
      title: artifactRef.current,
      presets: () => (presetsRef.current ?? []).map((p) => ({
        label: tRef.current(p.labelKey),
        instruction: tRef.current(p.instructionKey),
      })),
      apply: (instruction) => runRef.current(instruction),
      canUndo: () => undoLenRef.current > 0,
      undo: () => {
        if (undoNeedsWarnRef.current) {
          const ok = typeof window !== 'undefined' &&
            window.confirm(tRef.current('ed.ai.undoWarnManual', { instruction: undoTopRef.current }))
          return ok ? undoRef.current(true) : false
        }
        return undoRef.current(false)
      },
    }
    registerExpertEditor(surface)
    return () => unregisterExpertEditor(surface)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter.kind])

  const confirmInstruction = confirm === 'undo'
    ? undoStack[undoStack.length - 1]?.instruction ?? ''
    : confirm === 'redo' ? redoStack[0]?.instruction ?? '' : ''

  const iconBtn = 'grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-surface-2 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent'

  // ── Slim strip — the instruction box lives in the Expert chat now ─────────
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold">
          <Wand2 className="h-3.5 w-3.5" /> {t('ed.ai.title')}
          {turns > 0 && <span className="text-slate-500">· {turns}</span>}
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

      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{t('ed.ai.chatHint')}</p>

      {/* One-tap quick edits — the same reversible pipeline as the Expert chat,
          surfaced right here so the rail is a live tool, not just a pointer. */}
      {presets && presets.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <Sparkles className="h-3 w-3 text-gold/70" /> {t('ed.ai.quickEdits')}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => {
              const label = t(p.labelKey)
              return (
                <button
                  key={p.labelKey}
                  type="button"
                  disabled={!!pending || !!disabled}
                  onClick={() => { void run(t(p.instructionKey)) }}
                  title={t(p.instructionKey)}
                  className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2/60 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-gold/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Wand2 className="h-3 w-3 text-gold/70" /> {label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {pending && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-gold/80">
          <Loader2 className="h-3 w-3 animate-spin" /> “{pending}”
        </p>
      )}

      {unavailable && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-[11px] leading-snug text-amber-200/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('ed.ai.unavailable', { artifact })}
        </div>
      )}

      {confirm && (
        <div className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2">
          <p className="text-[11px] leading-snug text-amber-100">{t('ed.ai.undoWarnManual', { instruction: confirmInstruction })}</p>
          <div className="mt-1.5 flex gap-2">
            <button type="button" onClick={() => (confirm === 'undo' ? doUndo(true) : doRedo(true))}
              className="rounded-md bg-amber-400/90 px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-amber-300">
              {t('ed.ai.undoWarnConfirm')}
            </button>
            <button type="button" onClick={() => setConfirm(null)}
              className="rounded-md border border-line px-2.5 py-1 text-[11px] font-medium text-slate-300 transition hover:text-white">
              {t('ed.ai.cancel')}
            </button>
          </div>
        </div>
      )}

      {last && !pending && (
        <div className="mt-2 rounded-lg border border-line bg-surface-2/50 px-3 py-2">
          {last.kind === 'turn' && (
            <>
              <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
                <Sparkles className="h-3 w-3" /> {t('ed.ai.step', { n: last.n })}
              </div>
              <p dir="auto" className="text-xs leading-snug text-slate-200">“{last.instruction}”</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{last.summary}</p>
            </>
          )}
          {last.kind === 'noop' && <p className="text-[11px] text-slate-500">{t('ed.ai.noChange')}</p>}
          {last.kind === 'error' && <p className="text-[11px] text-red-300/90">{last.message}</p>}
          {last.kind === 'note' && <p className="text-[11px] text-slate-500">{t(last.textKey)} — “{last.instruction}”</p>}
        </div>
      )}

      {footNoteKey && <p className="mt-2 text-[10px] leading-relaxed text-slate-600">{t(footNoteKey)}</p>}
    </div>
  )
}
