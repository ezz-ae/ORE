'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { upload } from '@vercel/blob/client'
import {
  Loader2, Upload, FolderOpen, Play, Pause, Download, Save, Trash2,
  Clapperboard, Sparkles, GripVertical, Image as ImageIcon,
} from 'lucide-react'
import { DriveEditorFrame } from '@/components/freehold/drive/drive-editor-frame'
import { useLiveProjects, type LiveProject } from '@/lib/freehold/use-live-projects'
import { useI18n } from '@/lib/i18n/provider'
import { fieldClass, Modal } from '@/components/freehold/ui'
import { PALETTES, FORMATS, loadImage, fmtPrice, ensureAdFonts, type FormatKey, type Overlay } from '@/lib/freehold/ad-compose'
import { writeAdCopy, BRIEF_MAX } from '@/lib/freehold/ad-copy-writer'
import { SUITE_LANGS, type SuiteLang } from '@/lib/freehold/creative-suite'
import { drawReelFrame, reelDuration, reelPoster, REEL_DEFAULTS, REEL_FPS, type ReelOptions } from '@/lib/freehold/reel-compose'
import { pickRecorderMime } from '@/lib/freehold/video-export'
import { planGif, encodeGif, formatBytes } from '@/lib/freehold/gif-encode'
import { saveBlob, safeFileName } from '@/lib/freehold/bundle'

/**
 * PHOTO REEL — the motion tool of the Creative Suite.
 *
 * Listing photos in, a real video out in any Meta placement (9:16 story,
 * 4:5 feed, 1:1 square): Ken Burns motion, cross-fades, a
 * title card and a closing offer card, all in the ad engine's design language
 * so a reel matches the static ads made from the same listing. The preview is
 * the same per-frame renderer the export records, so what you watch IS what
 * downloads — no separate "preview approximation".
 */

type Shot = { id: string; url: string; img: HTMLImageElement }

export default function ReelMakerPage() {
  const { t, locale } = useI18n()
  const { projects } = useLiveProjects()

  const [listingId, setListingId] = useState('')
  const [shots, setShots] = useState<Shot[]>([])
  const [overlay, setOverlay] = useState<Overlay>({ eyebrow: '', headline: '', price: '', priceUnit: 'AED', footnote: '' })
  const [palette, setPalette] = useState(1)
  const [perPhoto, setPerPhoto] = useState(REEL_DEFAULTS.perPhoto)
  const [motion, setMotion] = useState(REEL_DEFAULTS.motion)
  // Meta's in-feed video is 4:5 and 1:1, not only 9:16 — the engine has always
  // been format-aware (its anchors are height fractions); the page just never
  // offered the choice.
  const [format, setFormat] = useState<FormatKey>('story')
  const [endCard, setEndCard] = useState(true)

  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [gifBusy, setGifBusy] = useState(false)
  const [gifPct, setGifPct] = useState(0)
  const [exportPct, setExportPct] = useState(0)
  const [saving, setSaving] = useState(false)

  // Describe the reel in words — the same grounded writer the Ad Designer
  // uses, so a reel and an ad from one listing are written the same way.
  const [describe, setDescribe] = useState('')
  const [describeBusy, setDescribeBusy] = useState(false)
  const [adLang, setAdLang] = useState<SuiteLang>(
    () => ((SUITE_LANGS as string[]).includes(locale) ? (locale as SuiteLang) : 'en'),
  )

  async function writeCopy() {
    const brief = describe.trim()
    if (!brief || describeBusy) return
    setDescribeBusy(true)
    try {
      const written = await writeAdCopy({
        brief,
        lang: adLang,
        facts: {
          project: listing?.name, area: listing?.area,
          price: overlay.price, priceUnit: overlay.priceUnit,
          paymentPlan: listing?.paymentPlan,
        },
      })
      const before = overlay
      setOverlay((prev) => ({
        ...prev,
        eyebrow: written.eyebrow || prev.eyebrow,
        headline: written.headline || prev.headline,
        footnote: written.footnote || prev.footnote,
      }))
      toast.success(t('adz.describe.done'), {
        action: { label: t('ed.ai.undo'), onClick: () => setOverlay(before) },
      })
    } catch {
      toast.error(t('adz.describe.err'))
    } finally {
      setDescribeBusy(false)
    }
  }

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)
  // Monotonic shot ids. Using the array length would collide after a removal
  // (add, add, remove-first, add → two shots claim the same React key).
  const shotSeq = useRef(0)
  const nextShotId = () => `shot-${++shotSeq.current}`
  // Navigating away mid-export must stop the render loop, not keep painting
  // a detached canvas.
  // Armed on mount, not just cleared on unmount: under StrictMode's double
  // invoke the cleanup runs once and a ref left false would make every later
  // export bail on frame 1 and emit an empty file.
  const aliveRef = useRef(true)
  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  const listing: LiveProject | undefined = projects.find((l) => l.id === listingId)

  const opts: ReelOptions = useMemo(() => ({
    photos: shots.map((s) => s.img),
    overlay,
    palette: PALETTES[palette] ?? PALETTES[0],
    format,
    perPhoto,
    motion,
    titleSecs: REEL_DEFAULTS.titleSecs,
    endSecs: endCard ? REEL_DEFAULTS.endSecs : 0,
  }), [shots, overlay, palette, perPhoto, motion, format, endCard])

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
      .then((img) => setShots((prev) => (prev.some((s) => s.url === hero) ? prev : [...prev, { id: nextShotId(), url: hero, img }])))
      .catch(() => toast.error(t('reel.err.photo')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId])

  // ── VIDEO AD AUTOPILOT ──────────────────────────────────────────────────
  // Arrive with ?project=<slug>&auto=1[&lang=ar] and the reel builds itself,
  // Meta-Advantage+-style, with REAL staged progress (each tick is an actual
  // completed call, never a fake timer): 1) the grounded ad-copy writer
  // scripts the overlay text; 2) the image engine generates two frames to
  // join the project's hero photo; 3) the assembled reel autoplays in the
  // editor, fully editable and exportable like any hand-built reel.
  type AutoStep = 'idle' | 'script' | 'frames' | 'assemble' | 'done' | 'error'
  const [autoStep, setAutoStep] = useState<AutoStep>('idle')
  const [autoErr, setAutoErr] = useState('')
  const [autoNote, setAutoNote] = useState('')
  const autoStartedRef = useRef(false)

  useEffect(() => {
    if (autoStartedRef.current) return
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('auto') !== '1') return
    const slug = (sp.get('project') || '').trim()
    if (!slug) return
    const proj = projects.find((p) => p.id === slug)
    if (!proj) return // projects still loading — effect re-runs when they land
    autoStartedRef.current = true
    const lang: SuiteLang = (SUITE_LANGS as string[]).includes(sp.get('lang') || '')
      ? (sp.get('lang') as SuiteLang) : adLang
    setAdLang(lang)
    setListingId(slug) // existing effect fills overlay defaults + hero shot
    ;(async () => {
      // 1 — script
      setAutoStep('script')
      try {
        const written = await writeAdCopy({
          brief: `${proj.name} in ${proj.area}, Dubai. Short punchy video-ad overlay for property buyers.`,
          lang,
          facts: { project: proj.name, area: proj.area, price: proj.priceAED ? fmtPrice(proj.priceAED) : undefined, priceUnit: 'AED', paymentPlan: proj.paymentPlan ?? undefined },
        })
        setOverlay((prev) => ({
          ...prev,
          eyebrow: written.eyebrow || prev.eyebrow,
          headline: written.headline || prev.headline,
          footnote: written.footnote || prev.footnote,
        }))
      } catch { /* overlay keeps the listing defaults — honest, not blocking */ }
      // 2 — frames (join the hero; a failed generation degrades, never dies)
      setAutoStep('frames')
      const prompts = [
        `Photorealistic golden-hour exterior of ${proj.name}, a luxury residence in ${proj.area}, Dubai. Ultra-high-end real-estate marketing photo, cinematic light, no text, no watermarks, no people.`,
        `Bright designer living interior of a residence at ${proj.name}, ${proj.area}, Dubai — floor-to-ceiling windows, city view. Ultra-high-end real-estate marketing photo, no text, no watermarks, no people.`,
      ]
      let generated = 0
      for (const p of prompts) {
        try {
          const res = await fetch('/api/freehold/creative-studio/generate-image', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: p, aspectRatio: '9:16', title: `${proj.name} — auto reel frame` }),
          })
          const data = await res.json().catch(() => null)
          if (!res.ok || !data?.url) throw new Error(data?.error || 'generation failed')
          const img = await loadImage(data.url, false)
          setShots((prev) => [...prev, { id: nextShotId(), url: data.url, img }])
          generated++
        } catch (err) {
          setAutoNote(err instanceof Error ? err.message.slice(0, 160) : 'frame generation failed')
        }
      }
      if (generated === 0 && !proj.heroImage) {
        setAutoErr(t('reel.auto.errNoFrames'))
        setAutoStep('error')
        return
      }
      // 3 — assemble: the preview IS the deliverable; autoplay it
      setAutoStep('assemble')
      setPlaying(true)
      setAutoStep('done')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects])

  // ── Preview: the SAME renderer the export records ──
  const paint = useCallback((tSec: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawReelFrame(ctx, tSec, opts)
  }, [opts])

  // Resolve the ad fonts once, then repaint — otherwise the idle frame the
  // user judges the reel by is drawn in the fallback face.
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => { ensureAdFonts().then(() => setFontsReady(true)) }, [])
  useEffect(() => { if (!playing) paint(Math.min(1, opts.titleSecs * 0.5)) }, [paint, playing, opts.titleSecs, fontsReady])

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
            setShots((prev) => [...prev, { id: nextShotId(), url, img }])
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
      setShots((prev) => [...prev, { id: nextShotId(), url, img }])
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

  // ── Real video export: record the canvas as the renderer drives it ──
  // MP4 first — the reel exists to run as an Instagram/Facebook ad, and Meta
  // does not accept WebM for ad creative. See lib/freehold/video-export.ts.
  async function renderToBlob(): Promise<{ blob: Blob; ext: 'mp4' | 'webm' } | null> {
    const canvas = canvasRef.current
    if (!canvas || !canRender) return null
    const choice = pickRecorderMime()
    if (!choice) { toast.error(t('reel.err.unsupported')); return null }
    const mimeType = choice.mime
    setPlaying(false)
    setExporting(true)
    setExportPct(0)
    try {
      await ensureAdFonts()
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
      let lastPct = -1
      await new Promise<void>((resolve) => {
        const step = () => {
          if (!aliveRef.current) { resolve(); return }
          const el = (performance.now() - t0) / 1000
          if (el >= duration) {
            // Paint the true final frame and give the recorder a beat to grab
            // it — stopping immediately drops the last of the closing card.
            paint(duration - 0.001)
            window.setTimeout(resolve, 1000 / REEL_FPS + 40)
            return
          }
          paint(el)
          // Progress is throttled: a setState per animation frame would re-render
          // the page ~60×/s while the canvas is being recorded, and the jank
          // lands in the exported file.
          const pct = Math.min(99, Math.round((el / duration) * 100))
          if (pct !== lastPct && pct % 5 === 0) { lastPct = pct; setExportPct(pct) }
          window.requestAnimationFrame(step)
        }
        window.requestAnimationFrame(step)
      })
      rec.stop()
      const blob = await done
      // Release the capture tracks — repeated exports otherwise pile up live
      // tracks against the canvas.
      stream.getTracks().forEach((track) => track.stop())
      setExportPct(100)
      return { blob, ext: choice.ext }
    } catch {
      // A tainted (cross-origin) photo makes captureStream/drawImage throw.
      toast.error(t('reel.err.tainted'))
      return null
    } finally {
      setExporting(false)
    }
  }

  async function downloadReel() {
    const out = await renderToBlob()
    if (!out) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(out.blob)
    // The extension follows the container that was actually recorded. Writing
    // an MP4 as .webm (or the reverse) gives the uploader and the OS a file
    // that disagrees with its own name.
    a.download = `${(overlay.headline || 'reel').slice(0, 40).replace(/\s+/g, '-').toLowerCase()}-${format}.${out.ext}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }

  // ── GIF ────────────────────────────────────────────────────────────────────
  // Same frames as the reel, sampled: Meta takes GIF for ad creative, and a GIF
  // plays inline where a video will not — a WhatsApp broadcast, an email, a
  // portal that refuses MP4. Drawn through the SAME drawReelFrame, scaled down,
  // so a GIF and a reel from one listing are one piece of work at two lengths.
  async function downloadGif() {
    if (!canRender || gifBusy) return
    const { w: W, h: H } = FORMATS[format]
    const plan = planGif({ sourceWidth: W, sourceHeight: H, durationSecs: duration })
    setGifBusy(true)
    setGifPct(0)
    try {
      await ensureAdFonts()
      const blob = await encodeGif(
        plan,
        (ctx, t, w, h) => {
          // drawReelFrame always composes at the format's native size, so the
          // context is scaled rather than the design being re-laid out.
          ctx.save()
          ctx.clearRect(0, 0, w, h)
          ctx.scale(w / W, h / H)
          drawReelFrame(ctx, t, opts)
          ctx.restore()
        },
        (done, total) => setGifPct(Math.round((done / total) * 100)),
      )
      saveBlob(blob, `${safeFileName(overlay.headline || 'reel')}-${format}.gif`)
      // Say what actually came out — a GIF that quietly dropped half the reel
      // is the kind of thing you only notice after sending it to a client.
      toast.success(
        plan.truncated
          ? t('reel.gif.doneShort', { secs: plan.coveredSecs.toFixed(1), size: formatBytes(blob.size) })
          : t('reel.gif.done', { size: formatBytes(blob.size) }),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('reel.gif.failed'))
    } finally {
      setGifBusy(false)
    }
  }

  async function saveReel() {
    if (saving) return
    const out = await renderToBlob()
    if (!out) return
    const { blob } = out
    setSaving(true)
    try {
      const title = `${(overlay.headline || 'Reel').slice(0, 60)} — reel (${FORMATS[format].w}×${FORMATS[format].h})`
      const file = new File([blob], `${title.replace(/\s+/g, '-').toLowerCase()}.${out.ext}`, { type: blob.type })
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

      {/* Describe the reel — same grounded writer as the Ad Designer */}
      <div className="border-t border-line pt-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('adz.describe.title')}</span>
          <div className="flex gap-1">
            {SUITE_LANGS.map((l) => (
              <button key={l} type="button" onClick={() => setAdLang(l)}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${adLang === l ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-500 hover:text-slate-300'}`}>
                {t(`suite.tpl.lang.${l}`)}
              </button>
            ))}
          </div>
        </div>
        <textarea value={describe} onChange={(e) => setDescribe(e.target.value)}
          placeholder={t('adz.describe.ph')} rows={3} maxLength={BRIEF_MAX}
          className={fieldClass('sm', 'resize-y leading-relaxed')} dir="auto" />
        <button type="button" onClick={writeCopy} disabled={!describe.trim() || describeBusy}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gold/35 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50">
          {describeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {describeBusy ? t('adz.describe.working') : t('adz.describe.cta')}
        </button>
      </div>

      {/* The words on the reel — labelled and sized like the designer's */}
      <div className="border-t border-line pt-3">
        <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('reel.copy')}</div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-300">{t('adz.field.eyebrow')}</span>
              <span className="text-[11px] tabular-nums text-slate-500">{overlay.eyebrow.length}/40</span>
            </span>
            <input value={overlay.eyebrow} onChange={(e) => setOverlay({ ...overlay, eyebrow: e.target.value })}
              placeholder={t('adz.field.eyebrowPh')} className={fieldClass('sm')} dir="auto" />
          </label>
          <label className="block">
            <span className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-300">{t('adz.field.headline')}</span>
              <span className="text-[11px] tabular-nums text-slate-500">{overlay.headline.length}/60</span>
            </span>
            {/* The title card carries this — it needs room, like the ad's. */}
            <textarea value={overlay.headline} onChange={(e) => setOverlay({ ...overlay, headline: e.target.value })}
              placeholder={t('adz.field.headlinePh')} rows={2}
              className={fieldClass('sm', 'resize-y font-semibold leading-snug')} dir="auto" />
          </label>
          <div className="flex gap-1.5">
            <label className="block min-w-0 flex-1">
              <span className="mb-1 block text-[11px] font-medium text-slate-300">{t('adz.field.price')}</span>
              <input value={overlay.price} onChange={(e) => setOverlay({ ...overlay, price: e.target.value })}
                placeholder={t('adz.field.pricePh')} className={fieldClass('sm')} dir="auto" />
            </label>
            <label className="block w-20 shrink-0">
              <span className="mb-1 block truncate text-[11px] font-medium text-slate-300">{t('adz.field.unit')}</span>
              <input value={overlay.priceUnit} onChange={(e) => setOverlay({ ...overlay, priceUnit: e.target.value })}
                className={fieldClass('sm', 'text-center')} dir="auto" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-300">{t('adz.field.footnote')}</span>
              <span className="text-[11px] tabular-nums text-slate-500">{overlay.footnote.length}/48</span>
            </span>
            <input value={overlay.footnote} onChange={(e) => setOverlay({ ...overlay, footnote: e.target.value })}
              placeholder={t('adz.field.footnotePh')} className={fieldClass('sm')} dir="auto" />
          </label>
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
        <button type="button" onClick={() => setEndCard(!endCard)}
          className={`mt-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition ${endCard ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}>
          {t('reel.endCard')}
        </button>
        <div className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('adz.opt.format')}</div>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(FORMATS) as FormatKey[]).map((f) => (
            <button key={f} type="button" onClick={() => setFormat(f)}
              className={`rounded-lg border px-2 py-2 text-center text-[11px] font-semibold transition ${format === f ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}>
              {t(`adz.format.${f}`)}
              <span className="block text-[9px] font-normal text-slate-500">{FORMATS[f].w}×{FORMATS[f].h}</span>
            </button>
          ))}
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
        {/* GIF — a smaller, looping cut of the same reel. The estimated size is
            shown BEFORE the wait, because a GIF is big and the encode is slow. */}
        <button type="button" onClick={downloadGif} disabled={!canRender || exporting || gifBusy}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
          {gifBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
          {gifBusy ? t('reel.gif.working', { pct: gifPct }) : t('reel.gif.download')}
        </button>
        {canRender && !gifBusy && (
          <p className="-mt-1 text-center text-[10px] text-slate-500">
            {(() => {
              const plan = planGif({ sourceWidth: FORMATS[format].w, sourceHeight: FORMATS[format].h, durationSecs: duration })
              return t(plan.truncated ? 'reel.gif.hintShort' : 'reel.gif.hint', {
                w: plan.width, h: plan.height,
                secs: plan.coveredSecs.toFixed(1),
                size: formatBytes(plan.estimatedBytes),
              })
            })()}
          </p>
        )}
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
      {/* Autopilot progress — every tick is a really-completed step. */}
      {autoStep !== 'idle' && (
        <div className="pointer-events-auto fixed inset-x-0 top-20 z-30 mx-auto w-[min(92%,420px)] rounded-2xl border border-gold/25 bg-surface/95 p-4 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
              <Sparkles className="h-3.5 w-3.5" /> {t('reel.auto.title')}
            </div>
            {(autoStep === 'done' || autoStep === 'error') && (
              <button onClick={() => setAutoStep('idle')} className="text-xs text-slate-500 hover:text-slate-300">{t('reel.auto.close')}</button>
            )}
          </div>
          <ol className="mt-3 space-y-2">
            {([['script', t('reel.auto.step.script')], ['frames', t('reel.auto.step.frames')], ['assemble', t('reel.auto.step.assemble')]] as const).map(([step, label]) => {
              const order = { script: 0, frames: 1, assemble: 2 } as const
              const cur = autoStep === 'done' ? 3 : autoStep === 'error' ? 3 : order[autoStep as 'script' | 'frames' | 'assemble'] ?? -1
              const done = order[step] < cur
              const active = order[step] === cur && autoStep !== 'done' && autoStep !== 'error'
              return (
                <li key={step} className="flex items-center gap-2.5 text-sm">
                  {done
                    ? <span className="grid h-5 w-5 place-items-center rounded-full bg-gold text-[10px] font-bold text-ink">✓</span>
                    : active
                      ? <Loader2 className="h-5 w-5 animate-spin text-gold" />
                      : <span className="h-5 w-5 rounded-full border border-line" />}
                  <span className={done || active ? 'text-slate-100' : 'text-slate-500'}>{label}</span>
                </li>
              )
            })}
          </ol>
          {autoStep === 'done' && <p className="mt-3 text-xs text-gold">{t('reel.auto.done')}</p>}
          {autoStep === 'error' && <p className="mt-3 text-xs text-red-300">{autoErr}</p>}
          {autoNote && autoStep !== 'error' && <p className="mt-1.5 text-[11px] text-slate-500">{t('reel.auto.partial')}</p>}
        </div>
      )}
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
              width={FORMATS[format].w}
              height={FORMATS[format].h}
              className="max-h-[74vh] w-auto rounded-2xl border border-line bg-black"
              style={{ aspectRatio: `${FORMATS[format].w} / ${FORMATS[format].h}` }}
            />
            <p className="text-[11px] text-slate-500">
              {t('reel.meta', { n: String(shots.length), s: duration.toFixed(1) })} · {FORMATS[format].w}×{FORMATS[format].h}
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
