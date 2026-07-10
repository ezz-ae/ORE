'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2, Save, Scissors, Captions, Megaphone, Camera,
  ArrowUpToLine, ArrowDownToLine, Info,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { DriveEditorFrame } from '@/components/freehold/drive/drive-editor-frame'
import type { DriveKind } from '@/lib/freehold/drive'

// ── Types ────────────────────────────────────────────────────────────────────
type LibRow = { id: string; kind: DriveKind; title: string; content: string | null; url: string | null }
type CaptionPos = 'top' | 'bottom'
/** The edit is a RECIPE applied live by our in-app player — the source file is
 *  never re-encoded. Persisted as JSON in the Library row's `content`. */
type Recipe = {
  trimStart: number
  trimEnd: number
  caption: string
  captionPos: CaptionPos
  endCta: string
  endPhone: string
  endSecs: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function parseRecipe(raw: string | null): Partial<Recipe> | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    if (!o || typeof o !== 'object') return null
    return {
      trimStart: typeof o.trimStart === 'number' ? o.trimStart : undefined,
      trimEnd: typeof o.trimEnd === 'number' ? o.trimEnd : undefined,
      caption: typeof o.caption === 'string' ? o.caption : undefined,
      captionPos: o.captionPos === 'top' || o.captionPos === 'bottom' ? o.captionPos : undefined,
      endCta: typeof o.endCta === 'string' ? o.endCta : undefined,
      endPhone: typeof o.endPhone === 'string' ? o.endPhone : undefined,
      endSecs: typeof o.endSecs === 'number' ? o.endSecs : undefined,
    }
  } catch {
    return null
  }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function DriveVideoEditor() {
  const t = useT()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = String(params?.id || '')

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const endActiveRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [dirty, setDirty] = useState(false)

  const [item, setItem] = useState<LibRow | null>(null)
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(0)

  // recipe state
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [caption, setCaption] = useState('')
  const [captionPos, setCaptionPos] = useState<CaptionPos>('bottom')
  const [endCta, setEndCta] = useState('')
  const [endPhone, setEndPhone] = useState('')
  const [endSecs, setEndSecs] = useState(3)
  const [showEndCard, setShowEndCard] = useState(false)

  // ── Load ───────────────────────────────────────────────────────────────────
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
        setItem(row); setTitle(row.title || '')
        const rec = parseRecipe(row.content)
        if (rec) {
          if (rec.trimStart != null) setTrimStart(rec.trimStart)
          if (rec.trimEnd != null) setTrimEnd(rec.trimEnd)
          if (rec.caption != null) setCaption(rec.caption)
          if (rec.captionPos != null) setCaptionPos(rec.captionPos)
          if (rec.endCta != null) setEndCta(rec.endCta)
          if (rec.endPhone != null) setEndPhone(rec.endPhone)
          if (rec.endSecs != null) setEndSecs(rec.endSecs)
        }
      } catch {
        if (alive) setNotFound(true)
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [id])

  // ── End-card lifecycle ───────────────────────────────────────────────────────
  const resetEnd = useCallback(() => {
    if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null }
    endActiveRef.current = false
    setShowEndCard(false)
  }, [])

  // Clear a stuck end-card whenever the recipe changes.
  useEffect(() => { resetEnd() }, [trimStart, trimEnd, endSecs, endCta, endPhone, resetEnd])
  // Clean up the timer on unmount.
  useEffect(() => () => { if (endTimerRef.current) clearTimeout(endTimerRef.current) }, [])

  const endConfigured = endSecs > 0 && (endCta.trim() !== '' || endPhone.trim() !== '')

  function onLoadedMetadata() {
    const v = videoRef.current
    if (!v) return
    const d = v.duration
    if (!Number.isFinite(d) || d <= 0) return
    setDuration(d)
    setTrimStart((ts) => clamp(ts, 0, d))
    setTrimEnd((te) => (te <= 0 || te > d ? d : te))
  }

  function onTimeUpdate() {
    const v = videoRef.current
    if (!v || endActiveRef.current) return
    const cur = v.currentTime
    const end = trimEnd > 0 ? trimEnd : duration
    if (cur < trimStart - 0.05) { v.currentTime = trimStart; return }
    if (end > 0 && cur >= end) {
      if (endConfigured) {
        endActiveRef.current = true
        setShowEndCard(true)
        v.pause()
        endTimerRef.current = setTimeout(() => {
          endActiveRef.current = false
          setShowEndCard(false)
          const vid = videoRef.current
          if (vid) { vid.currentTime = trimStart; vid.play().catch(() => {}) }
        }, Math.max(0.3, endSecs) * 1000)
      } else {
        v.currentTime = trimStart
      }
    }
  }

  // If the user manually plays/seeks during the end-card, dismiss it.
  function onNativePlay() {
    if (endActiveRef.current) { resetEnd(); const v = videoRef.current; if (v) v.currentTime = trimStart }
  }
  function onNativeSeeked() {
    const v = videoRef.current
    if (!v) return
    const end = trimEnd > 0 ? trimEnd : duration
    if (endActiveRef.current && v.currentTime < end - 0.05) resetEnd()
  }

  // ── Recipe field setters ─────────────────────────────────────────────────────
  const mark = () => setDirty(true)
  function setIn(v: number) { setTrimStart(clamp(v, 0, Math.max(0, (trimEnd || duration) - 0.1))); mark() }
  function setOut(v: number) { setTrimEnd(clamp(v, trimStart + 0.1, duration || v)); mark() }

  // ── Poster capture ───────────────────────────────────────────────────────────
  async function captureCover() {
    const v = videoRef.current
    const canvas = canvasRef.current
    if (!v || !canvas || !v.videoWidth || !v.videoHeight) { toast.error(t('ed.video.captureFailed')); return }
    const ctx = canvas.getContext('2d')
    if (!ctx) { toast.error(t('ed.video.captureFailed')); return }
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    let dataUrl: string
    try {
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
      dataUrl = canvas.toDataURL('image/png') // throws for a tainted (cross-origin) frame
    } catch {
      toast.error(t('ed.video.captureFailed')); return
    }
    setCapturing(true)
    try {
      const res = await fetch('/api/freehold/drive/save-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${title || 'Cover'} — cover`, dataUrl }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.item) { toast.error(t('ed.saveFailed')); return }
      toast.success(t('ed.video.coverSaved'))
    } catch { toast.error(t('ed.saveFailed')) } finally { setCapturing(false) }
  }

  // ── Save recipe ──────────────────────────────────────────────────────────────
  async function save() {
    if (!item) return
    const recipe: Recipe = {
      trimStart: Math.round(trimStart * 100) / 100,
      trimEnd: Math.round((trimEnd || duration) * 100) / 100,
      caption, captionPos, endCta, endPhone,
      endSecs: Math.round(endSecs * 100) / 100,
    }
    setSaving(true)
    try {
      const res = await fetch('/api/freehold/library', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, content: JSON.stringify(recipe) }),
      })
      if (res.status === 404) { toast.error(t('ed.video.readOnly')); return }
      if (!res.ok) { toast.error(t('ed.saveFailed')); return }
      setDirty(false); toast.success(t('ed.saved'))
    } catch { toast.error(t('ed.saveFailed')) } finally { setSaving(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
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
  const trimmed = clamp((trimEnd || duration) - trimStart, 0, duration)
  const hasMeta = duration > 0

  const sectionH = 'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold'
  const rowBtn = 'rounded-lg border border-line bg-surface px-2.5 py-2 text-xs text-slate-200 transition hover:border-gold/30 disabled:opacity-50'
  const field = 'w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-gold/30'

  const toolRail = (
    <div className="space-y-5">
      {/* Trim */}
      <section className="space-y-2">
        <div className={sectionH}><Scissors className="h-3.5 w-3.5" /> {t('ed.video.trim')}</div>
        <label className="block text-[11px] text-slate-400">{t('ed.video.trimIn')} · {fmt(trimStart)}</label>
        <input type="range" min={0} max={duration || 0} step={0.1} value={trimStart} disabled={!hasMeta}
          onChange={(e) => setIn(Number(e.target.value))} className="w-full accent-gold disabled:opacity-40" />
        <button type="button" onClick={() => setIn(videoRef.current?.currentTime ?? trimStart)} disabled={!hasMeta} className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
          <ArrowDownToLine className="h-3.5 w-3.5" /> {t('ed.video.setIn')}
        </button>
        <label className="block text-[11px] text-slate-400">{t('ed.video.trimOut')} · {fmt(trimEnd || duration)}</label>
        <input type="range" min={0} max={duration || 0} step={0.1} value={trimEnd || duration} disabled={!hasMeta}
          onChange={(e) => setOut(Number(e.target.value))} className="w-full accent-gold disabled:opacity-40" />
        <button type="button" onClick={() => setOut(videoRef.current?.currentTime ?? (trimEnd || duration))} disabled={!hasMeta} className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
          <ArrowUpToLine className="h-3.5 w-3.5" /> {t('ed.video.setOut')}
        </button>
        <p className="text-[11px] text-slate-500">{t('ed.video.trimmed')} · <span className="text-slate-300">{fmt(trimmed)}</span> / {fmt(duration)}</p>
      </section>

      {/* Caption */}
      <section className="space-y-2">
        <div className={sectionH}><Captions className="h-3.5 w-3.5" /> {t('ed.video.caption')}</div>
        <input value={caption} onChange={(e) => { setCaption(e.target.value); mark() }} placeholder={t('ed.video.captionPh')} dir="auto" className={field} />
        <div className="flex gap-1.5">
          {(['top', 'bottom'] as CaptionPos[]).map((p) => (
            <button key={p} type="button" onClick={() => { setCaptionPos(p); mark() }}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] transition ${captionPos === p ? 'border-gold/50 bg-gold/10 text-gold' : 'border-line bg-surface text-slate-300'}`}>
              {t(p === 'top' ? 'ed.video.posTop' : 'ed.video.posBottom')}
            </button>
          ))}
        </div>
      </section>

      {/* End card */}
      <section className="space-y-2">
        <div className={sectionH}><Megaphone className="h-3.5 w-3.5" /> {t('ed.video.endCard')}</div>
        <label className="block text-[11px] text-slate-400">{t('ed.video.endCta')}</label>
        <input value={endCta} onChange={(e) => { setEndCta(e.target.value); mark() }} placeholder={t('ed.video.endCtaPh')} dir="auto" className={field} />
        <label className="block text-[11px] text-slate-400">{t('ed.video.endPhone')}</label>
        <input value={endPhone} onChange={(e) => { setEndPhone(e.target.value); mark() }} placeholder={t('ed.video.endPhonePh')} dir="ltr" inputMode="tel" className={field} />
        <label className="block text-[11px] text-slate-400">{t('ed.video.endSecs')} · {endSecs}s</label>
        <input type="range" min={0} max={8} step={0.5} value={endSecs} onChange={(e) => { setEndSecs(Number(e.target.value)); mark() }} className="w-full accent-gold" />
      </section>

      {/* Cover frame */}
      <section className="space-y-2">
        <div className={sectionH}><Camera className="h-3.5 w-3.5" /> {t('ed.video.cover')}</div>
        <button type="button" onClick={captureCover} disabled={!url || capturing} className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
          {capturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} {t('ed.video.capture')}
        </button>
      </section>

      {/* Honest scope */}
      <section className="space-y-2 border-t border-white/[0.07] pt-4">
        <div className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{t('ed.video.exportDeferred')}</span>
        </div>
      </section>
    </div>
  )

  return (
    <DriveEditorFrame
      type="video"
      title={title || item.title}
      statusNote={t('ed.video.exportDeferred')}
      toolRail={toolRail}
      actions={
        <button type="button" onClick={save} disabled={saving || !dirty}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-ink transition hover:bg-[#F8E7AE] disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t('ed.video.savePreview')}
        </button>
      }
    >
      {/* Hidden canvas for cover capture */}
      <canvas ref={canvasRef} className="hidden" />
      {url ? (
        <div className="flex h-full w-full items-center justify-center bg-[#0d0d0f] p-4">
          <div className="relative max-h-full max-w-full">
            {/* Media content stays LTR/as-is; only chrome flips for RTL. */}
            <video
              ref={videoRef}
              src={url}
              controls
              playsInline
              dir="ltr"
              onLoadedMetadata={onLoadedMetadata}
              onTimeUpdate={onTimeUpdate}
              onPlay={onNativePlay}
              onSeeked={onNativeSeeked}
              className="block max-h-[calc(100vh-120px)] max-w-full rounded-lg shadow-2xl ring-1 ring-white/10"
            />
            {/* Caption overlay */}
            {caption.trim() !== '' && !showEndCard && (
              <div dir="auto" className={`pointer-events-none absolute inset-x-0 flex justify-center px-4 ${captionPos === 'top' ? 'top-3' : 'bottom-14'}`}>
                <span className="max-w-[90%] rounded-md bg-black/55 px-3 py-1.5 text-center text-sm font-semibold text-white shadow-lg backdrop-blur-sm">{caption}</span>
              </div>
            )}
            {/* End-card overlay */}
            {showEndCard && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-gold px-6 text-center text-ink">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink/10 text-2xl font-black">ف</span>
                {endCta.trim() !== '' && <p dir="auto" className="text-xl font-bold leading-tight">{endCta}</p>}
                {endPhone.trim() !== '' && <p dir="ltr" className="text-lg font-semibold tracking-wide">{endPhone}</p>}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center p-6 text-center">
          <p className="text-sm text-slate-500">{t('ed.video.noSource')}</p>
        </div>
      )}
    </DriveEditorFrame>
  )
}
