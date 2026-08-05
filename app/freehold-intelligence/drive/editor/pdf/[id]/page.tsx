'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2, Download, ExternalLink, FileSearch, BookOpen, ArrowLeft, ScanText, Stamp, QrCode, Upload, Save,
  Layers, RotateCw, Trash2, FilePlus, ArrowUp, ArrowDown, ImagePlus, Palette, FileImage, Sparkles, Building2,
} from 'lucide-react'
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib'
import { buildExplainerPdf } from '@/lib/freehold/pdf-explainer'
import { createListingAndLanding, type BrochureFields } from '@/lib/freehold/brochure-to-listing'
import { useSession } from '@/lib/freehold/use-session'
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
  const explainerFileRef = useRef<HTMLInputElement | null>(null)
  const [explainerBusy, setExplainerBusy] = useState(false)
  const [explainerLang, setExplainerLang] = useState<'en' | 'ru'>('en')
  const { user } = useSession()
  const [creatingListing, setCreatingListing] = useState(false)

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
  const [workUrl, setWorkUrl] = useState<string | null>(null) // live preview of the edited doc
  const [pageCount, setPageCount] = useState(0)
  const [delSpec, setDelSpec] = useState('')
  const [pageBusy, setPageBusy] = useState(false)
  const addImgRef = useRef<HTMLInputElement | null>(null)
  // Brand & cover — rebrand the brochure and cover the developer's contact band.
  const [showBrand, setShowBrand] = useState(false)
  const brandLogoRef = useRef<HTMLInputElement | null>(null)
  const [brandLogo, setBrandLogo] = useState<{ dataUrl: string; png: boolean } | null>(null)
  const [barPos, setBarPos] = useState<'none' | 'top' | 'bottom'>('bottom')
  const [barPct, setBarPct] = useState(8)
  const [barColor, setBarColor] = useState('#0a0a0a')
  const [logoCorner, setLogoCorner] = useState<'tl' | 'tr' | 'bl' | 'br'>('br')
  const [logoScale, setLogoScale] = useState(0.14)
  const [brandFooter, setBrandFooter] = useState('')
  const [brandTextColor, setBrandTextColor] = useState('#ffffff')
  const [brandTarget, setBrandTarget] = useState<'all' | 'first' | 'last'>('all')
  const [brandBusy, setBrandBusy] = useState(false)

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

  // Live preview: every edit to `work` re-points the viewer iframe at the edited
  // PDF (the browser's native renderer), so reorder/brand/cover are visible.
  useEffect(() => {
    if (!work) { setWorkUrl(null); return }
    const u = URL.createObjectURL(new Blob([work.slice() as unknown as BlobPart], { type: 'application/pdf' }))
    setWorkUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [work])

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

  // AI client explainer: send the current PDF to the explainer endpoint, render
  // the organised result into a branded client-ready PDF, and save it to Drive.
  async function runExplainer(bytes: ArrayBuffer) {
    setExplainerBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', new Blob([bytes], { type: 'application/pdf' }), 'source.pdf')
      fd.append('lang', explainerLang)
      const res = await fetch('/api/freehold/drive/pdf-explainer', { method: 'POST', body: fd })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d?.data) { toast.error(d?.error || t('ed.pdf.explainer.failed')); return }
      let logo: Uint8Array | null = null
      try { const lr = await fetch('/icon.png'); if (lr.ok) logo = new Uint8Array(await lr.arrayBuffer()) } catch { /* logo optional */ }
      const out = await buildExplainerPdf(d.data, logo, explainerLang)
      const dataUrl = `data:application/pdf;base64,${u8ToBase64(out)}`
      const title = `${(d.data as { title?: string })?.title || item?.title || 'Project'} — ${t('ed.pdf.explainer.docTitle')}`
      const sres = await fetch('/api/freehold/drive/save-pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, dataUrl }),
      })
      const sd = await sres.json().catch(() => ({}))
      if (sres.ok && sd.item) { toast.success(t('ed.pdf.explainer.saved')); router.push(`/freehold-intelligence/drive/editor/pdf/${sd.item.id}`) }
      else toast.error(sd.error || t('ed.pdf.explainer.failed'))
    } catch { toast.error(t('ed.pdf.explainer.failed')) } finally { setExplainerBusy(false) }
  }
  async function startExplainer() {
    // Prefer the loaded PDF; fall back to an upload if it can't be fetched (CORS).
    if (item?.url) {
      try { const r = await fetch(item.url); if (r.ok) return runExplainer(await r.arrayBuffer()) } catch { /* upload fallback */ }
    }
    explainerFileRef.current?.click()
  }

  // Turn the extracted brochure fields into a live listing + landing page —
  // same shared flow as the Landing-pages "Create from brochure" action.
  async function createListingFromExtract() {
    if (!parsed) return
    setCreatingListing(true)
    try {
      const res = await createListingAndLanding(parsed as BrochureFields)
      if (res.ok) { toast.success(t('ed.pdf.listing.created')); router.push('/freehold-intelligence/inventory/landings') }
      else if (res.error === 'landing-failed') toast.error(t('ed.pdf.listing.landingFailed'))
      else if (res.error === 'name-required') toast.error(t('ed.pdf.listing.needName'))
      else toast.error(t('ed.pdf.listing.failed'))
    } catch { toast.error(t('ed.pdf.listing.failed')) } finally { setCreatingListing(false) }
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

  // Per-page ops on the working document.
  async function movePage(i: number, dir: -1 | 1) {
    setPageBusy(true)
    try {
      const pdf = await loadWork(); if (!pdf) return
      const j = i + dir
      if (j < 0 || j >= pdf.getPageCount()) return
      const page = pdf.getPage(i)
      pdf.removePage(i)
      pdf.insertPage(j, page)
      await commitDoc(pdf)
    } catch { toast.error(t('ed.pdf.pagesLoadFailed')) } finally { setPageBusy(false) }
  }
  async function rotateOne(i: number) {
    setPageBusy(true)
    try {
      const pdf = await loadWork(); if (!pdf) return
      const p = pdf.getPage(i)
      p.setRotation(degrees(((p.getRotation().angle || 0) + 90) % 360))
      await commitDoc(pdf)
    } catch { toast.error(t('ed.pdf.pagesLoadFailed')) } finally { setPageBusy(false) }
  }
  async function deleteOne(i: number) {
    setPageBusy(true)
    try {
      const pdf = await loadWork(); if (!pdf) return
      if (pdf.getPageCount() <= 1) { toast.error(t('ed.pdf.pagesCantDeleteAll')); return }
      pdf.removePage(i)
      await commitDoc(pdf); toast.success(t('ed.pdf.pagesDeleted'))
    } catch { toast.error(t('ed.pdf.pagesLoadFailed')) } finally { setPageBusy(false) }
  }
  async function addBlank() {
    setPageBusy(true)
    try {
      const pdf = await loadWork(); if (!pdf) return
      const pages = pdf.getPages()
      const size = pages.length ? pages[pages.length - 1].getSize() : { width: 595, height: 842 }
      pdf.addPage([size.width, size.height])
      await commitDoc(pdf); toast.success(t('ed.pdf.pageAdded'))
    } catch { toast.error(t('ed.pdf.pagesLoadFailed')) } finally { setPageBusy(false) }
  }
  async function addImagePage(file: File | null) {
    if (!file) return
    setPageBusy(true)
    try {
      const pdf = await loadWork(); if (!pdf) return
      const bytes = new Uint8Array(await file.arrayBuffer())
      const img = file.type.includes('png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
      const pages = pdf.getPages()
      const size = pages.length ? pages[pages.length - 1].getSize() : { width: img.width, height: img.height }
      const page = pdf.addPage([size.width, size.height])
      const s = Math.min(size.width / img.width, size.height / img.height)
      const w = img.width * s, h = img.height * s
      page.drawImage(img, { x: (size.width - w) / 2, y: (size.height - h) / 2, width: w, height: h })
      await commitDoc(pdf); toast.success(t('ed.pdf.pageAdded'))
    } catch { toast.error(t('ed.pdf.pagesMergeFailed')) } finally { setPageBusy(false) }
  }
  async function openBrand() {
    setShowStamp(false); setShowPages(false); setShowExtract(false); setShowBrand(true)
    if (!work) { setPageBusy(true); try { const pdf = await loadWork(); if (pdf) await commitDoc(pdf) } finally { setPageBusy(false) } }
  }

  // Brand & cover — draw a colour bar (covers the developer's contact band),
  // a logo in a corner, and a footer line onto the target pages.
  const hexRgb = (hex: string) => {
    const m = hex.replace('#', '')
    const s = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
    const n = parseInt(s || '000000', 16)
    return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
  }
  function onBrandLogo(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setBrandLogo({ dataUrl: String(reader.result || ''), png: file.type.includes('png') })
    reader.readAsDataURL(file)
  }
  async function applyBrand() {
    setBrandBusy(true)
    try {
      const pdf = await loadWork(); if (!pdf) return
      const font = await pdf.embedFont(StandardFonts.Helvetica)
      const logoImg = brandLogo ? (brandLogo.png ? await pdf.embedPng(brandLogo.dataUrl) : await pdf.embedJpg(brandLogo.dataUrl)) : null
      const pages = pdf.getPages()
      const targets = brandTarget === 'all' ? pages : brandTarget === 'first' ? [pages[0]] : [pages[pages.length - 1]]
      for (const p of targets) {
        const { width, height } = p.getSize()
        if (barPos !== 'none' && barPct > 0) {
          const bh = height * (barPct / 100)
          const by = barPos === 'top' ? height - bh : 0
          p.drawRectangle({ x: 0, y: by, width, height: bh, color: hexRgb(barColor) })
          if (brandFooter.trim()) p.drawText(brandFooter.trim().slice(0, 120), { x: 20, y: by + bh / 2 - 4, size: Math.max(8, bh * 0.3), font, color: hexRgb(brandTextColor) })
        } else if (brandFooter.trim()) {
          p.drawText(brandFooter.trim().slice(0, 120), { x: 20, y: 16, size: 9, font, color: hexRgb(brandTextColor) })
        }
        if (logoImg) {
          const lw = width * logoScale
          const lh = lw * (logoImg.height / logoImg.width)
          const margin = 16
          const lx = logoCorner.endsWith('l') ? margin : width - lw - margin
          const ly = logoCorner.startsWith('t') ? height - lh - margin : margin
          p.drawImage(logoImg, { x: lx, y: ly, width: lw, height: lh })
        }
      }
      await commitDoc(pdf); toast.success(t('ed.pdf.branded'))
    } catch { toast.error(t('ed.pdf.brandFailed')) } finally { setBrandBusy(false) }
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

      {/* AI client explainer — organise the brochure into a branded, sendable PDF */}
      <section className="space-y-2 border-t border-white/[0.07] pt-4">
        <div className={sectionH}><Sparkles className="h-3.5 w-3.5" /> {t('ed.pdf.explainer.title')}</div>
        <div className="flex gap-1.5">
          {(['en', 'ru'] as const).map((lg) => (
            <button
              key={lg}
              type="button"
              onClick={() => setExplainerLang(lg)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${explainerLang === lg ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}
            >
              {t(`ed.pdf.explainer.lang.${lg}`)}
            </button>
          ))}
        </div>
        <button type="button" onClick={startExplainer} disabled={explainerBusy} className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
          {explainerBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {explainerBusy ? t('ed.pdf.explainer.busy') : t('ed.pdf.explainer.cta')}
        </button>
        <input ref={explainerFileRef} type="file" accept="application/pdf" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) runExplainer(await f.arrayBuffer()) }} />
        <p className="text-[10px] leading-snug text-slate-500">{t('ed.pdf.explainer.note')}</p>
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

      {/* Brand & cover — rebrand + cover the developer's contact details */}
      <section className="space-y-2 border-t border-white/[0.07] pt-4">
        <div className={sectionH}><Palette className="h-3.5 w-3.5" /> {t('ed.pdf.brand')}</div>
        <button type="button" onClick={() => (showBrand ? setShowBrand(false) : openBrand())} className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
          <Palette className="h-3.5 w-3.5" /> {showBrand ? t('ed.pdf.pagesClose') : t('ed.pdf.brandOpen')}
        </button>
        <p className="text-[10px] leading-snug text-slate-500">{t('ed.pdf.brandNote')}</p>
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
      <input ref={addImgRef} type="file" accept="image/png,image/jpeg" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0] ?? null; addImagePage(f); e.target.value = '' }} />
      <input ref={brandLogoRef} type="file" accept="image/png,image/jpeg" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0] ?? null; onBrandLogo(f); e.target.value = '' }} />

      {showBrand ? (
        <div className="mx-auto max-w-lg px-4 py-6 sm:px-6">
          <div className="mb-4 flex items-center gap-2">
            <button type="button" onClick={() => setShowBrand(false)} className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> {t('ed.pdf.view')}</button>
          </div>
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-white"><Palette className="h-4 w-4 text-gold" /> {t('ed.pdf.brandTitle')}</h2>
          <p className="mb-4 text-xs text-slate-500">{t('ed.pdf.brandHelp')}</p>
          <div className="space-y-3 rounded-2xl border border-line bg-surface-2/40 p-4">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">{t('ed.pdf.coverBar')}</label>
              <div className="flex gap-1.5">
                {(['none', 'top', 'bottom'] as const).map((pos) => (
                  <button key={pos} type="button" onClick={() => setBarPos(pos)} className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition ${barPos === pos ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}>{t(`ed.pdf.bar.${pos}`)}</button>
                ))}
              </div>
            </div>
            {barPos !== 'none' && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">{t('ed.pdf.barHeight')} · {barPct}%</label>
                  <input type="range" min={3} max={25} step={1} value={barPct} onChange={(e) => setBarPct(Number(e.target.value))} className="w-full accent-gold" />
                </div>
                <label className="flex items-center gap-2 text-[11px] text-slate-400">{t('ed.pdf.barColor')}
                  <input type="color" value={barColor} onChange={(e) => setBarColor(e.target.value)} className="h-6 w-8 cursor-pointer rounded border border-line bg-transparent" />
                </label>
              </>
            )}
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">{t('ed.pdf.brandFooter')}</label>
              <div className="flex items-center gap-2">
                <input value={brandFooter} onChange={(e) => setBrandFooter(e.target.value)} dir="auto" placeholder={t('ed.pdf.brandFooterPh')} className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600" />
                <input type="color" value={brandTextColor} onChange={(e) => setBrandTextColor(e.target.value)} title={t('ed.pdf.textColor')} className="h-8 w-9 cursor-pointer rounded border border-line bg-transparent" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">{t('ed.pdf.brandLogo')}</label>
              <button type="button" onClick={() => brandLogoRef.current?.click()} className="flex w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-slate-200 transition hover:border-gold/30">
                <ImagePlus className="h-3.5 w-3.5" /> {brandLogo ? t('ed.pdf.logoSet') : t('ed.pdf.uploadLogo')}
              </button>
              {brandLogo && (
                <div className="mt-2 space-y-2">
                  <div className="grid grid-cols-4 gap-1">
                    {([['tl', '↖'], ['tr', '↗'], ['bl', '↙'], ['br', '↘']] as const).map(([c, g]) => (
                      <button key={c} type="button" onClick={() => setLogoCorner(c)} className={`rounded-lg border py-1.5 text-sm transition ${logoCorner === c ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line text-slate-400'}`}>{g}</button>
                    ))}
                  </div>
                  <label className="block text-[11px] text-slate-400">{t('ed.pdf.logoSize')} · {Math.round(logoScale * 100)}%</label>
                  <input type="range" min={0.06} max={0.4} step={0.01} value={logoScale} onChange={(e) => setLogoScale(Number(e.target.value))} className="w-full accent-gold" />
                  <button type="button" onClick={() => setBrandLogo(null)} className="text-[11px] text-rose-300 hover:text-rose-200">{t('ed.tool.remove')}</button>
                </div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">{t('ed.pdf.page')}</label>
              <div className="flex gap-1.5">
                {(['first', 'last', 'all'] as const).map((pt) => (
                  <button key={pt} type="button" onClick={() => setBrandTarget(pt)} className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${brandTarget === pt ? 'border-gold/40 bg-gold/15 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}>{t(`ed.pdf.page.${pt}`)}</button>
                ))}
              </div>
            </div>
            <button type="button" onClick={applyBrand} disabled={brandBusy || pageBusy} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
              {brandBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Palette className="h-4 w-4" />} {t('ed.pdf.applyBrand')}
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={saveWork} disabled={pageBusy || !work} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-slate-200 transition hover:text-white disabled:opacity-50"><Save className="h-4 w-4" /> {t('ed.pdf.pagesSave')}</button>
              <button type="button" onClick={downloadWork} disabled={!work} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm text-slate-200 transition hover:text-white disabled:opacity-50"><Download className="h-4 w-4" /> {t('ed.download')}</button>
            </div>
          </div>
        </div>
      ) : showPages ? (
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
            {/* Per-page list — reorder / rotate / delete */}
            {work && pageCount > 0 && (
              <div className="max-h-64 space-y-1.5 overflow-y-auto">
                {Array.from({ length: pageCount }).map((_, i) => (
                  <div key={i} className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5">
                    <span className="flex-1 text-xs text-slate-200">{t('ed.pdf.pageN', { n: String(i + 1) })}</span>
                    <button type="button" disabled={pageBusy || i === 0} onClick={() => movePage(i, -1)} title={t('ed.pdf.moveUp')} className="rounded p-1 text-slate-400 transition hover:text-white disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" disabled={pageBusy || i === pageCount - 1} onClick={() => movePage(i, 1)} title={t('ed.pdf.moveDown')} className="rounded p-1 text-slate-400 transition hover:text-white disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" disabled={pageBusy} onClick={() => rotateOne(i)} title={t('ed.pdf.rotate')} className="rounded p-1 text-slate-400 transition hover:text-white disabled:opacity-50"><RotateCw className="h-3.5 w-3.5" /></button>
                    <button type="button" disabled={pageBusy || pageCount <= 1} onClick={() => deleteOne(i)} title={t('ed.pdf.deletePagesCta')} className="rounded p-1 text-rose-400 transition hover:text-rose-300 disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
            {/* Add page */}
            <div className="flex gap-1.5">
              <button type="button" onClick={addBlank} disabled={pageBusy} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-slate-200 transition hover:border-gold/30 disabled:opacity-50"><FilePlus className="h-3.5 w-3.5" /> {t('ed.pdf.addBlank')}</button>
              <button type="button" onClick={() => addImgRef.current?.click()} disabled={pageBusy} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-slate-200 transition hover:border-gold/30 disabled:opacity-50"><ImagePlus className="h-3.5 w-3.5" /> {t('ed.pdf.addImage')}</button>
            </div>
            <button type="button" onClick={rotateAll} disabled={pageBusy} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
              {pageBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />} {t('ed.pdf.rotateAll')}
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
              <button type="button" onClick={saveWork} disabled={pageBusy || !work} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
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
              <button type="button" onClick={stampSave} disabled={stamping} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
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
          {user && user.role !== 'broker' && (
            <button
              type="button"
              onClick={createListingFromExtract}
              disabled={creatingListing}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-60"
            >
              {creatingListing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
              {creatingListing ? t('ed.pdf.listing.creating') : t('ed.pdf.listing.cta')}
            </button>
          )}
          <p className="mt-2 text-center text-[11px] text-slate-500">{t('ed.pdf.listing.note')}</p>
        </div>
      ) : (workUrl || url) ? (
        <iframe
          src={workUrl || url || undefined}
          title={item.title}
          sandbox="allow-same-origin allow-scripts allow-popups allow-downloads"
          className="h-full w-full border-0 bg-[#0d0d0f]"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gold/10 text-gold"><FileSearch className="h-7 w-7" /></span>
          <p className="text-sm text-slate-400">{t('ed.pdf.noSource')}</p>
          <p className="max-w-sm text-xs text-slate-500">{t('ed.pdf.emptyHint')}</p>
          <button type="button" onClick={() => fileRef.current?.click()} className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright">
            <ScanText className="h-3.5 w-3.5" /> {t('ed.pdf.extractCta')}
          </button>
        </div>
      )}
    </DriveEditorFrame>
  )
}
