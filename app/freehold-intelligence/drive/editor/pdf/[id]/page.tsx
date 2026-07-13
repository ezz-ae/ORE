'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2, Download, ExternalLink, FileSearch, BookOpen, ArrowLeft, ScanText, Stamp, QrCode, Upload, Save,
  Layers, RotateCw, Trash2, FilePlus,
} from 'lucide-react'
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import QRCode from 'qrcode'
import { useT } from '@/lib/i18n/provider'
import { DriveEditorFrame } from '@/components/freehold/drive/drive-editor-frame'
import type { DriveKind } from '@/lib/freehold/drive'

// Chunked base64 — String.fromCharCode(...big) overflows the stack on large PDFs.
function u8ToBase64(u8: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  return btoa(s)
}

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
  // Stamp mode — real in-place PDF stamping (Trakhees permit QR + number + footer)
  const [showStamp, setShowStamp] = useState(false)
  const [stampFile, setStampFile] = useState<File | null>(null)
  const stampFileRef = useRef<HTMLInputElement | null>(null)
  const [permitUrl, setPermitUrl] = useState('')
  const [permitNum, setPermitNum] = useState('')
  const [footer, setFooter] = useState('')
  const [pageTarget, setPageTarget] = useState<'first' | 'last' | 'all'>('all')
  const [stamping, setStamping] = useState(false)
  // Page editing — real structural edits via pdf-lib (rotate / delete / merge).
  // The working document lives in `work`; each op reloads, mutates, re-saves it.
  const [showPages, setShowPages] = useState(false)
  const [pagesSrc, setPagesSrc] = useState<File | null>(null)
  const pagesSrcRef = useRef<HTMLInputElement | null>(null)
  const mergeRef = useRef<HTMLInputElement | null>(null)
  const [work, setWork] = useState<Uint8Array | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [delSpec, setDelSpec] = useState('')
  const [pageBusy, setPageBusy] = useState(false)

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

  // Build a stamped PDF (pdf-lib). Source = an uploaded file, else the loaded
  // PDF fetched by url (best-effort; CORS may block → prompt upload). Real.
  async function buildStamped(): Promise<Uint8Array | null> {
    let bytes: ArrayBuffer | null = null
    if (stampFile) bytes = await stampFile.arrayBuffer()
    else if (item?.url) {
      try { const r = await fetch(item.url); if (r.ok) bytes = await r.arrayBuffer() } catch { /* CORS */ }
    }
    if (!bytes) { toast.error(t('ed.pdf.stampNeedFile')); return null }
    const pdf = await PDFDocument.load(bytes)
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const pages = pdf.getPages()
    if (!pages.length) return null
    const targets = pageTarget === 'all' ? pages : pageTarget === 'first' ? [pages[0]] : [pages[pages.length - 1]]
    let qrImg: Awaited<ReturnType<typeof pdf.embedPng>> | null = null
    if (permitUrl.trim()) {
      const qrDataUrl = await QRCode.toDataURL(permitUrl.trim(), { margin: 1, width: 220 })
      qrImg = await pdf.embedPng(qrDataUrl)
    }
    for (const p of targets) {
      const { width } = p.getSize()
      if (qrImg) {
        const sz = 60
        p.drawRectangle({ x: width - sz - 24 - 5, y: 22 - 5, width: sz + 10, height: sz + 10, color: rgb(1, 1, 1) })
        p.drawImage(qrImg, { x: width - sz - 24, y: 22, width: sz, height: sz })
      }
      if (permitNum.trim()) p.drawText(permitNum.trim().slice(0, 40), { x: width - 60 - 24, y: 12, size: 7, font, color: rgb(0.12, 0.12, 0.12) })
      if (footer.trim()) p.drawText(footer.trim().slice(0, 120), { x: 24, y: 20, size: 9, font, color: rgb(0.2, 0.2, 0.2) })
    }
    return pdf.save()
  }
  async function stampDownload() {
    setStamping(true)
    try {
      const out = await buildStamped(); if (!out) return
      const blob = new Blob([out.slice() as unknown as BlobPart], { type: 'application/pdf' })
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
      a.download = `${(item?.title || 'stamped').replace(/[^\w-]+/g, '_').slice(0, 50)}-stamped.pdf`
      a.click(); URL.revokeObjectURL(a.href)
      toast.success(t('ed.pdf.stamped'))
    } catch { toast.error(t('ed.pdf.stampFailed')) } finally { setStamping(false) }
  }
  async function stampSave() {
    setStamping(true)
    try {
      const out = await buildStamped(); if (!out) return
      const dataUrl = `data:application/pdf;base64,${u8ToBase64(out)}`
      const res = await fetch('/api/freehold/drive/save-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${item?.title || 'PDF'} — stamped`, dataUrl }),
      })
      const d = await res.json()
      if (res.ok && d.item) { toast.success(t('ed.pdf.stampSaved')); router.push(`/freehold-intelligence/drive/editor/pdf/${d.item.id}`) }
      else toast.error(d.error || t('ed.pdf.stampFailed'))
    } catch { toast.error(t('ed.pdf.stampFailed')) } finally { setStamping(false) }
  }

  // ── Page editing (rotate / delete / merge) — real pdf-lib document edits ──────
  async function loadWork(): Promise<PDFDocument | null> {
    let bytes: ArrayBuffer | Uint8Array | null = work
    if (!bytes) {
      if (pagesSrc) bytes = await pagesSrc.arrayBuffer()
      else if (item?.url) { try { const r = await fetch(item.url); if (r.ok) bytes = await r.arrayBuffer() } catch { /* CORS */ } }
    }
    if (!bytes) { toast.error(t('ed.pdf.stampNeedFile')); return null }
    try { return await PDFDocument.load(bytes) } catch { toast.error(t('ed.pdf.pagesLoadFailed')); return null }
  }
  async function commitDoc(pdf: PDFDocument) {
    const out = await pdf.save()
    setWork(out); setPageCount(pdf.getPageCount())
  }
  async function openPages() {
    setShowPages(true)
    if (!work) { setPageBusy(true); try { const pdf = await loadWork(); if (pdf) await commitDoc(pdf) } finally { setPageBusy(false) } }
  }
  async function rotateAll() {
    setPageBusy(true)
    try {
      const pdf = await loadWork(); if (!pdf) return
      pdf.getPages().forEach((p) => p.setRotation(degrees(((p.getRotation().angle || 0) + 90) % 360)))
      await commitDoc(pdf); toast.success(t('ed.pdf.pagesRotated'))
    } catch { toast.error(t('ed.pdf.pagesLoadFailed')) } finally { setPageBusy(false) }
  }
  async function deletePages() {
    const nums = delSpec.split(/[,\s]+/).map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n))
    if (!nums.length) { toast.error(t('ed.pdf.pagesPickDelete')); return }
    setPageBusy(true)
    try {
      const pdf = await loadWork(); if (!pdf) return
      const total = pdf.getPageCount()
      const idx = [...new Set(nums.map((n) => n - 1).filter((i) => i >= 0 && i < total))].sort((a, b) => b - a)
      if (!idx.length) { toast.error(t('ed.pdf.pagesPickDelete')); return }
      if (idx.length >= total) { toast.error(t('ed.pdf.pagesCantDeleteAll')); return }
      idx.forEach((i) => pdf.removePage(i))
      await commitDoc(pdf); setDelSpec(''); toast.success(t('ed.pdf.pagesDeleted'))
    } catch { toast.error(t('ed.pdf.pagesLoadFailed')) } finally { setPageBusy(false) }
  }
  async function mergePdf(file: File | null) {
    if (!file) return
    setPageBusy(true)
    try {
      const pdf = await loadWork(); if (!pdf) return
      const other = await PDFDocument.load(await file.arrayBuffer())
      const copied = await pdf.copyPages(other, other.getPageIndices())
      copied.forEach((p) => pdf.addPage(p))
      await commitDoc(pdf); toast.success(t('ed.pdf.pagesMerged'))
    } catch { toast.error(t('ed.pdf.pagesMergeFailed')) } finally { setPageBusy(false) }
  }
  function downloadWork() {
    if (!work) return
    const blob = new Blob([work.slice() as unknown as BlobPart], { type: 'application/pdf' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `${(item?.title || 'document').replace(/[^\w-]+/g, '_').slice(0, 50)}-edited.pdf`
    a.click(); URL.revokeObjectURL(a.href)
  }
  async function saveWork() {
    if (!work) return
    setPageBusy(true)
    try {
      const dataUrl = `data:application/pdf;base64,${u8ToBase64(work)}`
      const res = await fetch('/api/freehold/drive/save-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${item?.title || 'PDF'} — edited`, dataUrl }),
      })
      const d = await res.json()
      if (res.ok && d.item) { toast.success(t('ed.pdf.pagesSaved')); router.push(`/freehold-intelligence/drive/editor/pdf/${d.item.id}`) }
      else toast.error(d.error || t('ed.pdf.stampFailed'))
    } catch { toast.error(t('ed.pdf.stampFailed')) } finally { setPageBusy(false) }
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

      {/* Pages — real structural edits (rotate / delete / merge) via pdf-lib */}
      <section className="space-y-2 border-t border-white/[0.07] pt-4">
        <div className={sectionH}><Layers className="h-3.5 w-3.5" /> {t('ed.pdf.pages')}</div>
        <button type="button" onClick={() => (showPages ? setShowPages(false) : openPages())} className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
          <Layers className="h-3.5 w-3.5" /> {showPages ? t('ed.pdf.pagesClose') : t('ed.pdf.pagesOpen')}
        </button>
        <p className="text-[10px] leading-snug text-slate-500">{t('ed.pdf.pagesNote')}</p>
      </section>

      {/* Stamp — real in-place stamping (Trakhees permit QR + number + footer) */}
      <section className="space-y-2 border-t border-white/[0.07] pt-4">
        <div className={sectionH}><Stamp className="h-3.5 w-3.5" /> {t('ed.pdf.stamp')}</div>
        <button type="button" onClick={() => setShowStamp((s) => !s)} className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
          <Stamp className="h-3.5 w-3.5" /> {showStamp ? t('ed.pdf.stampClose') : t('ed.pdf.stampOpen')}
        </button>
        <p className="text-[10px] leading-snug text-slate-500">{t('ed.pdf.stampNote')}</p>
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
      {/* Hidden file inputs (always mounted) */}
      <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) extract(f); e.target.value = '' }} />
      <input ref={stampFileRef} type="file" accept="application/pdf,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0] ?? null; setStampFile(f); e.target.value = '' }} />
      <input ref={pagesSrcRef} type="file" accept="application/pdf,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0] ?? null; setPagesSrc(f); setWork(null); setPageCount(0); e.target.value = '' }} />
      <input ref={mergeRef} type="file" accept="application/pdf,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0] ?? null; mergePdf(f); e.target.value = '' }} />

      {showPages ? (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
          <div className="mb-4 flex items-center gap-2">
            <button type="button" onClick={() => setShowPages(false)} className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> {t('ed.pdf.view')}</button>
          </div>
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><Layers className="h-4 w-4 text-gold" /> {t('ed.pdf.pagesTitle')}</h2>
          <p className="mb-4 text-xs text-slate-500">{work ? t('ed.pdf.pageCount', { n: String(pageCount) }) : t('ed.pdf.pagesNote')}</p>
          <div className="space-y-3 rounded-2xl border border-line bg-surface-2/40 p-4">
            {!item.url && (
              <div>
                <label className="mb-1 block text-[11px] text-slate-400">{t('ed.pdf.stampSource')}</label>
                <button type="button" onClick={() => pagesSrcRef.current?.click()} className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-slate-200 transition hover:border-gold/30">
                  <Upload className="h-3.5 w-3.5" /> {pagesSrc ? pagesSrc.name.slice(0, 40) : t('ed.pdf.stampUpload')}
                </button>
              </div>
            )}
            <button type="button" onClick={rotateAll} disabled={pageBusy} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
              {pageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />} {t('ed.pdf.rotate')}
            </button>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">{t('ed.pdf.deletePagesLabel')}</label>
              <div className="flex gap-1.5">
                <input value={delSpec} onChange={(e) => setDelSpec(e.target.value)} inputMode="numeric" placeholder="2, 5" className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600" />
                <button type="button" onClick={deletePages} disabled={pageBusy || !delSpec.trim()} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"><Trash2 className="h-4 w-4" /> {t('ed.pdf.deletePagesCta')}</button>
              </div>
            </div>
            <button type="button" onClick={() => mergeRef.current?.click()} disabled={pageBusy} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
              <FilePlus className="h-4 w-4" /> {t('ed.pdf.mergeCta')}
            </button>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={saveWork} disabled={pageBusy || !work} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-50">
                {pageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('ed.pdf.pagesSave')}
              </button>
              <button type="button" onClick={downloadWork} disabled={!work} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-slate-200 transition hover:text-white disabled:opacity-50">
                <Download className="h-4 w-4" /> {t('ed.download')}
              </button>
            </div>
          </div>
        </div>
      ) : showStamp ? (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
          <div className="mb-4 flex items-center gap-2">
            <button type="button" onClick={() => setShowStamp(false)} className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> {t('ed.pdf.view')}</button>
          </div>
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><Stamp className="h-4 w-4 text-gold" /> {t('ed.pdf.stampTitle')}</h2>
          <p className="mb-4 text-xs text-slate-500">{t('ed.pdf.stampHelp')}</p>
          <div className="space-y-3 rounded-2xl border border-line bg-surface-2/40 p-4">
            {/* Source */}
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">{t('ed.pdf.stampSource')}</label>
              <button type="button" onClick={() => stampFileRef.current?.click()} className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-slate-200 transition hover:border-gold/30">
                <Upload className="h-3.5 w-3.5" /> {stampFile ? stampFile.name.slice(0, 40) : item.url ? t('ed.pdf.stampUseLoaded') : t('ed.pdf.stampUpload')}
              </button>
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1 text-[11px] text-slate-400"><QrCode className="h-3 w-3" /> {t('ed.pdf.permitUrl')}</label>
              <input value={permitUrl} onChange={(e) => setPermitUrl(e.target.value)} placeholder="https://…" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">{t('ed.pdf.permitNum')}</label>
              <input value={permitNum} onChange={(e) => setPermitNum(e.target.value)} className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">{t('ed.pdf.footer')}</label>
              <input value={footer} onChange={(e) => setFooter(e.target.value)} dir="auto" className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">{t('ed.pdf.page')}</label>
              <div className="flex gap-1.5">
                {(['first', 'last', 'all'] as const).map((pt) => (
                  <button key={pt} type="button" onClick={() => setPageTarget(pt)} className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${pageTarget === pt ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}>{t(`ed.pdf.page.${pt}`)}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={stampSave} disabled={stamping} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-50">
                {stamping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {t('ed.pdf.stampSave')}
              </button>
              <button type="button" onClick={stampDownload} disabled={stamping} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-slate-200 transition hover:text-white disabled:opacity-50">
                <Download className="h-4 w-4" /> {t('ed.download')}
              </button>
            </div>
          </div>
        </div>
      ) : showExtract && parsed ? (
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
              // Humanize machine field names (developer_name → Developer Name)
              // — a marketer must never read snake_case labels.
              const label = k.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
              return (
                <div key={k} className="border-b border-white/[0.05] pb-2 last:border-0 last:pb-0">
                  <dt className="text-[11px] uppercase tracking-wide text-slate-500">{label}</dt>
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
