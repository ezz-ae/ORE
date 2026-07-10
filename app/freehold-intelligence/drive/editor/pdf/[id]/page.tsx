'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2, Download, ExternalLink, FileSearch, BookOpen, Info, ArrowLeft, ScanText,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { DriveEditorFrame } from '@/components/freehold/drive/drive-editor-frame'
import type { DriveKind } from '@/lib/freehold/drive'

type LibRow = { id: string; kind: DriveKind; title: string; content: string | null; url: string | null }

export default function DrivePdfSurface() {
  const t = useT()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = String(params?.id || '')

  const fileRef = useRef<HTMLInputElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [item, setItem] = useState<LibRow | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null)
  const [showExtract, setShowExtract] = useState(false)

  useEffect(() => {
    let alive = true
    async function run() {
      if (!id) return
      setLoading(true)
      try {
        const res = await fetch('/api/freehold/library', { cache: 'no-store' })
        const d = await res.json()
        const row = (Array.isArray(d.items) ? d.items : []).find((x: LibRow) => x.id === id) as LibRow | undefined
        if (!alive) return
        if (!row) { setNotFound(true); return }
        setItem(row)
      } catch {
        if (alive) setNotFound(true)
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [id])

  async function extract(file: File) {
    if (file.type && file.type !== 'application/pdf') { toast.error(t('ed.pdf.extractFailed')); return }
    setExtracting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/dashboard/projects/parse-brochure', { method: 'POST', body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d?.data) { toast.error(d?.error || t('ed.pdf.extractFailed')); return }
      setParsed(d.data as Record<string, unknown>)
      setShowExtract(true)
    } catch { toast.error(t('ed.pdf.extractFailed')) } finally { setExtracting(false) }
  }

  if (loading) return (
    <div className="flex h-[calc(100vh-56px)] items-center justify-center text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
  )
  if (notFound || !item) return (
    <div className="flex h-[calc(100vh-56px)] flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-slate-400">{t('ed.notFound')}</p>
      <button onClick={() => router.push('/freehold-intelligence/drive')} className="text-sm text-gold hover:opacity-80">{t('drive.homeTitle')}</button>
    </div>
  )

  const url = item.url
  const sectionH = 'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold'
  const rowBtn = 'rounded-lg border border-line bg-surface px-2.5 py-2 text-xs text-slate-200 transition hover:border-gold/30 disabled:opacity-50'

  const toolRail = (
    <div className="space-y-5">
      {/* View */}
      <section className="space-y-2">
        <div className={sectionH}><ExternalLink className="h-3.5 w-3.5" /> {t('ed.pdf.view')}</div>
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
            <ExternalLink className="h-3.5 w-3.5" /> {t('ed.pdf.openTab')}
          </a>
        ) : (
          <p className="text-[11px] text-slate-500">{t('ed.pdf.noSource')}</p>
        )}
        {url && (
          <a href={url} download className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
            <Download className="h-3.5 w-3.5" /> {t('ed.download')}
          </a>
        )}
      </section>

      {/* Extract */}
      <section className="space-y-2">
        <div className={sectionH}><FileSearch className="h-3.5 w-3.5" /> {t('ed.pdf.extract')}</div>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={extracting} className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
          {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanText className="h-3.5 w-3.5" />} {extracting ? t('ed.pdf.extracting') : t('ed.pdf.extractCta')}
        </button>
        {parsed && (
          <button type="button" onClick={() => setShowExtract((s) => !s)} className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
            <FileSearch className="h-3.5 w-3.5" /> {showExtract ? t('ed.pdf.extractBack') : t('ed.pdf.viewExtract')}
          </button>
        )}
        <p className="text-[10px] leading-snug text-slate-500">{t('ed.pdf.extractNote')}</p>
      </section>

      {/* Notebook */}
      <section className="space-y-2">
        <div className={sectionH}><BookOpen className="h-3.5 w-3.5" /> {t('ed.pdf.notebook')}</div>
        <Link href="/freehold-intelligence/notebook" className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
          <BookOpen className="h-3.5 w-3.5" /> {t('ed.pdf.useInNotebook')}
        </Link>
      </section>

      {/* Honest scope */}
      <section className="space-y-2 border-t border-white/[0.07] pt-4">
        <div className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{t('ed.pdf.stampDeferred')}</span>
        </div>
      </section>
    </div>
  )

  return (
    <DriveEditorFrame
      type="pdf"
      title={item.title}
      statusNote={t('ed.pdf.viewNote')}
      toolRail={toolRail}
      actions={url ? (
        <a href={url} download title={t('ed.download')} className="rounded-full border border-line p-1.5 text-slate-400 transition hover:text-white">
          <Download className="h-3.5 w-3.5" />
        </a>
      ) : undefined}
    >
      {/* Hidden file input for extraction (always mounted) */}
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) extract(f); e.target.value = '' }} />

      {showExtract && parsed ? (
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <div className="mb-4 flex items-center gap-2">
            <button type="button" onClick={() => setShowExtract(false)} className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" /> {t('ed.pdf.extractBack')}
            </button>
          </div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><ScanText className="h-4 w-4 text-gold" /> {t('ed.pdf.extractedTitle')}</h2>
          <dl className="space-y-3 rounded-2xl border border-line bg-surface-2/40 p-4">
            {Object.entries(parsed).map(([k, v]) => {
              const val = Array.isArray(v) ? v.filter(Boolean).join(' · ') : (v == null || v === '' ? '—' : String(v))
              return (
                <div key={k} className="border-b border-white/[0.05] pb-2 last:border-0 last:pb-0">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">{k}</dt>
                  <dd dir="auto" className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{val || '—'}</dd>
                </div>
              )
            })}
          </dl>
        </div>
      ) : url ? (
        <iframe
          src={url}
          title={item.title}
          sandbox="allow-same-origin allow-scripts allow-popups allow-downloads"
          className="h-full w-full border-0 bg-[#0d0d0f]"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gold/10 text-gold"><FileSearch className="h-7 w-7" /></span>
          <p className="text-sm text-slate-400">{t('ed.pdf.noSource')}</p>
          <p className="max-w-sm text-xs text-slate-500">{t('ed.pdf.emptyHint')}</p>
          <button type="button" onClick={() => fileRef.current?.click()} className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#F8E7AE]">
            <ScanText className="h-3.5 w-3.5" /> {t('ed.pdf.extractCta')}
          </button>
        </div>
      )}
    </DriveEditorFrame>
  )
}
