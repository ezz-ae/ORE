'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { upload } from '@vercel/blob/client'
import {
  Loader2, Upload, FolderOpen, Play, Pause, Download, Save, Trash2,
  Clapperboard, Sparkles, ArrowRight, GripVertical,
} from 'lucide-react'
import { DriveEditorFrame } from '@/components/freehold/drive/drive-editor-frame'
import { useLiveProjects, type LiveProject } from '@/lib/freehold/use-live-projects'
import { useT } from '@/lib/i18n/provider'
import { fieldClass, Modal } from '@/components/freehold/ui'
import { PALETTES, FORMATS, loadImage, fmtPrice, type Overlay } from '@/lib/freehold/ad-compose'
import { drawReelFrame, reelDuration, reelPoster, REEL_DEFAULTS, REEL_FPS, type ReelOptions } from '@/lib/freehold/reel-compose'

/**
 * PHOTO REEL — the motion tool of the Creative Suite.
 *
 * Listing photos in, a real 9:16 video out: Ken Burns motion, cross-fades, a
 * title card and a closing offer card, all in the ad engine's design language
 * so a reel matches the static ads made from the same listing. The preview is
 * the same per-frame renderer the export records, so what you watch IS what
 * downloads — no separate "preview approximation".
 */

/** First WebM codec the platform's MediaRecorder actually supports, else null. */
function pickWebmMime(): string | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    try { if (MediaRecorder.isTypeSupported(m)) return m } catch { continue }
  }
  return null
}

type Shot = { id: string; url: string; img: HTMLImageElement }

export default function ReelMakerPage() {
  const t = useT()
  const { projects } = useLiveProjects()

  const [listingId, setListingId] = useState('')
  const [shots, setShots] = useState<Shot[]>([])
  const [overlay, setOverlay] = useState<Overlay>({ eyebrow: '', headline: '', price: '', priceUnit: 'AED', footnote: '' })
  const [palette, setPalette] = useState(1)
  const [perPhoto, setPerPhoto] = useState(REEL_DEFAULTS.perPhoto)
  const [motion, setMotion] = useState(REEL_DEFAULTS.motion)

  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportPct, setExportPct] = useState(0)
  const [saving, setSaving] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)

  const listing: LiveProject | undefined = projects.find((l) => l.id === listingId)

  const opts: ReelOptions = useMemo(() => ({
    photos: shots.map((s) => s.img),
    overlay,
    palette: PALETTES[palette] ?? PALETTES[0],
    format: 'story',
    perPhoto,
    motion,
    titleSecs: REEL_DEFAULTS.titleSecs,
    endSecs: REEL_DEFAULTS.endSecs,
  }), [shots, overlay, palette, perPhoto, motion])

  const duration = reelDuration(opts)
  const canRender = shots.length > 0 && !!overlay.headline.trim()

  // Prefill the copy from a picked listing, and seed its hero as the first shot.
  useEffect(() => {
    if (!listing) return
    setOverlay((prev) => ({
      eyebrow: prev.eyebrow || `${listing.area} · Dubai`,
      headline: prev.headline || listing.name,
      price: prev.price || (listing.priceAED ? fmtPrice(listing.priceAED) : ''),
      priceUnit: prev.priceUnit || 'AED',
      footnote: prev.footnote || (listing.paymentPlan ?? ''),
    }))
    const hero = listing.heroImage
    if (!hero) return
    loadImage(hero, !hero.startsWith('data:'))
      .then((img) => setShots((prev) => (prev.some((s) => s.url === hero) ? prev : [...prev, { id: hero, url: hero, img }])))
      .catch(() => toast.error(t('reel.err.photo')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId])

  // ── Preview: the SAME renderer the export records ──
  const paint = useCallback((tSec: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawReelFrame(ctx, tSec, opts)
  }, [opts])

  useEffect(() => { if (!playing) paint(Math.min(1, opts.titleSecs * 0.5)) }, [paint, playing, opts.titleSecs])

  useEffect(() => {
    if (!playing) return
    startRef.current = performance.now()
    const loop = () => {
      const elapsed = (performance.now() - startRef.current) / 1000
      if (elapsed >= duration) { startRef.current = performance.now(); paint(0) }
      else paint(elapsed)
      rafRef.current = window.requestAnimationFrame(loop)
    }
    rafRef.current = window.requestAnimationFrame(loop)
    return () => { if (rafRef.current) window.cancelAnimationFrame(rafRef.current) }
  }, [playing, duration, paint])

  // ── Photo sources ──
  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    for (const file of Array.from(files).slice(0, 10)) {
      if (!file.type.startsWith('image/')) continue
      await new Promise<void>((resolve) => {
        const reader = new FileReader()
        reader.onload = async () => {
          const url = String(reader.result)
          try {
            const img = await loadImage(url)
            setShots((prev) => [...prev, { id: `${url.slice(-24)}-${prev.length}`, url, img }])
          } catch { toast.error(t('reel.err.photo')) }
          resolve()
        }
        reader.onerror = () => resolve()
        reader.readAsDataURL(file)
      })
    }
  }

  const [driveOpen, setDriveOpen] = useState(false)
  const [driveItems, setDriveItems] = useState<{ id: string; title: string; url: string }[] | null>(null)
  async function openDrive() {
    setDriveOpen(true)
    if (driveItems !== null) return
    const d = await fetch('/api/freehold/library?kind=image', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    setDriveItems((Array.isArray(d?.items) ? d.items : [])
      .filter((i: { url?: string | null }) => !!i.url)
      .map((i: { id: string; title?: string; url: string }) => ({ id: i.id, title: i.title || 'Untitled', url: i.url })))
  }
  async function pickDrive(url: string) {
    setDriveOpen(false)
    try {
      const img = await loadImage(url, !url.startsWith('data:'))
      setShots((prev) => [...prev, { id: `${url}-${prev.length}`, url, img }])
    } catch { toast.error(t('reel.err.photo')) }
  }

  const move = (i: number, dir: -1 | 1) => setShots((prev) => {
    const j = i + dir
    if (j < 0 || j >= prev.length) return prev
    const next = [...prev]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })
  const removeShot = (i: number) => setShots((prev) => prev.filter((_, x) => x !== i))

  // ── Real WebM export: record the canvas as the renderer drives it ──
  async function renderToBlob(): Promise<Blob | null> {
    const canvas = canvasRef.current
    if (!canvas || !canRender) return null
    const mimeType = pickWebmMime()
    if (!mimeType) { toast.error(t('reel.err.unsupported')); return null }
    setPlaying(false)
    setExporting(true)
    setExportPct(0)
    try {
      const stream = canvas.captureStream(REEL_FPS)
      const rec = new MediaRecorder(stream, { mimeType })
      const chunks: BlobPart[] = []
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data) }
      const done = new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mimeType }))
      })
      rec.start()
      // Drive the frames in real time so the recorder captures the true motion.
      const t0 = performance.now()
      await new Promise<void>((resolve) => {
        const step = () => {
          const el = (performance.now() - t0) / 1000
          if (el >= duration) { resolve(); return }
          paint(el)
          setExportPct(Math.min(99, Math.round((el / duration) * 100)))
          window.requestAnimationFrame(step)
        }
        window.requestAnimationFrame(step)
      })
      rec.stop()
      const blob = await done
      setExportPct(100)
      return blob
    } catch {
      // A tainted (cross-origin) photo makes captureStream/drawImage throw.
      toast.error(t('reel.err.tainted'))
      return null
    } finally {
      setExporting(false)
    }
  }

  async function downloadReel() {
    const blob = await renderToBlob()
    if (!blob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(overlay.headline || 'reel').slice(0, 40).replace(/\s+/g, '-').toLowerCase()}.webm`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }

  async function saveReel() {
    if (saving) return
    const blob = await renderToBlob()
    if (!blob) return
    setSaving(true)
    try {
      const title = `${(overlay.headline || 'Reel').slice(0, 60)} — reel`
      const file = new File([blob], `${title.replace(/\s+/g, '-').toLowerCase()}.webm`, { type: blob.type })
      const put = await upload(file.name, file, { access: 'public', handleUploadUrl: '/api/freehold/drive/upload-video' })
      const res = await fetch('/api/freehold/library', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'video', title, url: put.url }),
      })
      if (!res.ok) { toast.error(t('reel.err.save')); return }
      // The poster still doubles as the reel's cover in the Library.
      try {
        await fetch('/api/freehold/drive/save-image', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `${title} — cover`, dataUrl: reelPoster(opts) }),
        })
      } catch { /* the cover is a nicety, never a failure */ }
      toast.success(t('reel.saved'))
    } catch {
      toast.error(t('reel.err.save'))
    } finally {
      setSaving(false)
    }
  }

  // ── Tool rail ──
  const toolRail = (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('reel.listing')}</div>
        <select value={listingId} onChange={(e) => setListingId(e.target.value)} className={fieldClass('sm')}>
          <option value="">—</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-2 py-2 text-[12px] font-semibold text-slate-200 transition hover:border-gold/30">
            <Upload className="h-3.5 w-3.5 shrink-0" /> {t('reel.addPhotos')}
          </button>
          <button type="button" onClick={openDrive}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-2 py-2 text-[12px] font-semibold text-slate-200 transition hover:border-gold/30">
            <FolderOpen className="h-3.5 w-3.5 shrink-0" /> {t('reel.fromDrive')}
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </div>

      {/* Shot list — order is the reel's order */}
      <div className="border-t border-line pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('reel.shots')}</span>
          <span className="text-[11px] text-slate-500">{t('reel.duration', { s: duration.toFixed(1) })}</span>
        </div>
        {shots.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-slate-500">{t('reel.shotsEmpty')}</p>
        ) : (
          <div className="space-y-1.5">
            {shots.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2/60 p-1.5">
                <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-400">{i + 1}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                  className="px-1 text-[11px] text-slate-500 transition hover:text-slate-200 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === shots.length - 1}
                  className="px-1 text-[11px] text-slate-500 transition hover:text-slate-200 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => removeShot(i)} className="px-1 text-slate-500 transition hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Copy */}
      <div className="border-t border-line pt-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('reel.copy')}</div>
        <div className="space-y-2">
          <input value={overlay.eyebrow} onChange={(e) => setOverlay({ ...overlay, eyebrow: e.target.value })} placeholder={t('adz.field.eyebrow')} className={fieldClass('sm')} dir="auto" />
          <input value={overlay.headline} onChange={(e) => setOverlay({ ...overlay, headline: e.target.value })} placeholder={t('adz.field.headline')} className={fieldClass('sm')} dir="auto" />
          <div className="flex gap-1.5">
            <div className="min-w-0 flex-1">
              <input value={overlay.price} onChange={(e) => setOverlay({ ...overlay, price: e.target.value })} placeholder={t('adz.field.price')} className={fieldClass('sm')} dir="auto" />
            </div>
            <div className="w-16 shrink-0">
              <input value={overlay.priceUnit} onChange={(e) => setOverlay({ ...overlay, priceUnit: e.target.value })} className={fieldClass('sm', 'text-center')} dir="auto" />
            </div>
          </div>
          <input value={overlay.footnote} onChange={(e) => setOverlay({ ...overlay, footnote: e.target.value })} placeholder={t('adz.field.footnote')} className={fieldClass('sm')} dir="auto" />
        </div>
      </div>

      {/* Motion options */}
      <div className="border-t border-line pt-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('reel.motion')}</div>
        <div className="flex flex-wrap gap-1.5">
          {[2, 3, 4].map((s) => (
            <button key={s} type="button" onClick={() => setPerPhoto(s)}
              className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${perPhoto === s ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}>
              {t('reel.perPhoto', { s: String(s) })}
            </button>
          ))}
          <button type="button" onClick={() => setMotion(!motion)}
            className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${motion ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}>
            {t('reel.kenBurns')}
          </button>
        </div>
        <div className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('adz.opt.palettes')}</div>
        <div className="flex flex-wrap gap-1.5">
          {PALETTES.map((p, pi) => (
            <button key={pi} type="button" onClick={() => setPalette(pi)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition ${palette === pi ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}>
              <span className="h-3 w-3 rounded-full border border-black/20" style={{ background: p.bg }} />
              {t(`adz.pal.${pi}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 border-t border-line pt-3">
        <button type="button" data-close-sheet onClick={() => setPlaying(!playing)} disabled={!canRender || exporting}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />} {playing ? t('reel.pause') : t('reel.play')}
        </button>
        {exporting && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${exportPct}%` }} />
          </div>
        )}
        <button type="button" onClick={downloadReel} disabled={!canRender || exporting}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
          {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} {t('reel.download')}
        </button>
        <button type="button" onClick={saveReel} disabled={!canRender || exporting || saving}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t('reel.save')}
        </button>
        <Link href="/freehold-intelligence/drive/create"
          className="flex w-full items-center justify-center gap-1.5 py-1.5 text-xs text-slate-500 transition hover:text-slate-300">
          <Sparkles className="h-3 w-3" /> {t('reel.backToSuite')}
        </Link>
      </div>
      <p className="text-[10px] leading-relaxed text-slate-500">{t('reel.note')}</p>
    </div>
  )

  return (
    <DriveEditorFrame type="video" title={t('reel.title')} statusNote={t('reel.note')} toolRail={toolRail}>
      <div className="flex h-full w-full items-center justify-center overflow-y-auto p-4 sm:p-6">
        {shots.length === 0 ? (
          <div className="max-w-sm text-center">
            <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gold/10 text-gold ring-1 ring-gold/20">
              <Clapperboard className="h-8 w-8" />
            </span>
            <p className="text-base font-semibold text-white">{t('reel.empty.title')}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{t('reel.empty.desc')}</p>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-xs font-semibold text-ink transition hover:bg-gold-bright">
              <Upload className="h-3.5 w-3.5" /> {t('reel.addPhotos')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <canvas
              ref={canvasRef}
              width={FORMATS.story.w}
              height={FORMATS.story.h}
              className="max-h-[74vh] w-auto rounded-2xl border border-line bg-black"
              style={{ aspectRatio: `${FORMATS.story.w} / ${FORMATS.story.h}` }}
            />
            <p className="text-[11px] text-slate-500">
              {t('reel.meta', { n: String(shots.length), s: duration.toFixed(1) })}
            </p>
          </div>
        )}
      </div>

      <Modal open={driveOpen} onClose={() => setDriveOpen(false)} title={t('reel.fromDrive')} maxWidth="max-w-2xl">
        {driveItems === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
          </div>
        ) : driveItems.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{t('adz.source.driveEmpty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {driveItems.map((item) => (
              <button key={item.id} type="button" onClick={() => pickDrive(item.url)}
                className="group overflow-hidden rounded-xl border border-line bg-surface-2 text-start transition hover:border-gold/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="aspect-square w-full object-cover" />
                <div className="truncate px-2 py-1.5 text-[11px] text-slate-300">{item.title}</div>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </DriveEditorFrame>
  )
}
