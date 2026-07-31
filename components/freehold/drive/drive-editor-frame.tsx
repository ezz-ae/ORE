'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2, SlidersHorizontal, X } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { EDITOR_STATUS, type EditorType } from '@/lib/freehold/drive'

// The ONE editor shell — the guarantee that "edit anything" reads as a single
// universal editor. Every Drive editor (doc/image/video/pdf) renders inside it;
// only the tool rail + center canvas + AI rail differ per type. RTL-aware via
// logical CSS; the frame flips, the artwork canvas (passed as children) does not.
export function DriveEditorFrame({
  type, title, statusNote, toolRail, aiRail, actions, onSave, saving, dirty, children,
}: {
  type: EditorType
  title: string
  /** honest one-line scope note under the title (e.g. "Save edit (preview)") */
  statusNote?: string
  toolRail?: React.ReactNode
  aiRail?: React.ReactNode
  /** extra header buttons (export / download) */
  actions?: React.ReactNode
  onSave?: () => void
  saving?: boolean
  dirty?: boolean
  children: React.ReactNode
}) {
  const t = useT()
  const [toolsOpen, setToolsOpen] = useState(false)
  const status = EDITOR_STATUS[type]
  const statusColor = status === 'real' ? '#34D399' : status === 'scoped' ? '#FBBF24' : '#94A3B8'

  return (
    // A true application window: the editor overlays the whole platform
    // (nav spine included) instead of rendering as a page with a file in it.
    <div className="fixed inset-0 z-[90] flex flex-col bg-ink">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.07] bg-chrome/97 px-4 backdrop-blur-xl sm:px-5">
        <Link href="/freehold-intelligence/drive" className="flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:block">{t('drive.homeTitle')}</span>
        </Link>
        <div className="h-5 w-px bg-surface-3" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-white">{title || t(`ed.type.${type}`)}</span>
            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: `${statusColor}22`, color: statusColor }}>
              {t(`ed.status.${status}`)}
            </span>
          </div>
          {statusNote && <p className="truncate text-[11px] text-slate-500">{statusNote}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {onSave && (
            <button type="button" onClick={onSave} disabled={saving || dirty === false}
              className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t('ed.save')}
            </button>
          )}
        </div>
      </header>

      {/* Body: tool rail · canvas · AI rail */}
      <div className="flex min-h-0 flex-1">
        {toolRail && (
          <aside className="hidden w-56 shrink-0 overflow-y-auto border-e border-white/[0.07] bg-chrome p-3 lg:block">{toolRail}</aside>
        )}
        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
        {aiRail && (
          <aside className="hidden w-72 shrink-0 overflow-y-auto border-s border-white/[0.07] bg-chrome p-3 xl:block">{aiRail}</aside>
        )}
      </div>

      {/* Mobile tool rail — the desktop aside is hidden < lg, so the SAME tools
          are reachable from a floating button as a bottom sheet. Lives in the
          shared frame so every editor (pdf / video / image / doc) gets it. */}
      {toolRail && (
        <div className="lg:hidden">
          {!toolsOpen && (
            <button
              type="button"
              onClick={() => setToolsOpen(true)}
              className="fixed bottom-5 left-1/2 z-[95] flex -translate-x-1/2 items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink shadow-2xl shadow-black/40"
            >
              <SlidersHorizontal className="h-4 w-4" /> {t('ed.tools')}
            </button>
          )}
          {toolsOpen && (
            <div className="fixed inset-0 z-[96] bg-black/50" onClick={() => setToolsOpen(false)}>
              <div className="absolute inset-x-0 bottom-0 max-h-[82vh] rounded-t-2xl border-t border-white/10 bg-chrome" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-sm font-semibold text-white">{t('ed.tools')}</span>
                  <button type="button" onClick={() => setToolsOpen(false)} className="rounded-full p-1.5 text-slate-400 hover:text-white"><X className="h-4 w-4" /></button>
                </div>
                {/* Close the sheet when a tool action (button/link) is tapped so the
                    result panel behind it is revealed; scrolling/inputs are untouched. */}
                {/* Close ONLY on navigation (links) or buttons that explicitly
                    opt in with data-close-sheet — a multi-tap tool (corner
                    pickers, toggles, steppers) must not dismiss the sheet on
                    every tap. */}
                <div
                  className="max-h-[70vh] overflow-y-auto px-3 pb-6"
                  onClick={(e) => { if ((e.target as HTMLElement).closest('a,[data-close-sheet]')) setToolsOpen(false) }}
                >
                  {toolRail}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
