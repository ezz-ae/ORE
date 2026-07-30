'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import {
  Loader2, Upload, Type, ImagePlus, QrCode, Frame, Download, Trash2, Plus,
  AlignLeft, AlignCenter, AlignRight, Bold, Move, Palette, RotateCcw,
  Crop, SlidersHorizontal, Sparkles, ZoomIn, ZoomOut, Maximize2,
} from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { DriveEditorFrame } from '@/components/freehold/drive/drive-editor-frame'
import { AiEditorRail } from '@/components/freehold/drive/ai-editor-rail'
import { type ArtifactAdapter, type PresetChip } from '@/lib/freehold/drive-ai-rail'
import type { DriveKind } from '@/lib/freehold/drive'
import { composeVariant, PALETTES as AD_PALETTES, type Overlay as AdOverlay } from '@/lib/freehold/ad-compose'
import { SUITE_TEMPLATES, type SuiteCopy, type SuiteTemplate } from '@/lib/freehold/creative-suite'
import { TemplateThumb } from '@/components/freehold/drive/template-thumb'

// ── Types ────────────────────────────────────────────────────────────────────
type LibRow = { id: string; kind: DriveKind; title: string; content: string | null; url: string | null }
type PresetKey = '1_1' | '4_5' | '9_16' | '16_9' | 'link'
type Align = 'auto' | 'left' | 'center' | 'right'
type TextLayer = { id: string; text: string; x: number; y: number; size: number; color: string; align: Align; weight: number }
type LogoLayer = { url: string; img: HTMLImageElement | null; x: number; y: number; scale: number }
type QrLayer = { value: string; url: string; img: HTMLImageElement | null; x: number; y: number; scale: number; stamp: boolean }
type BrandFrame = { on: boolean; color: string; width: number }
// Color adjustments apply to the source photo only (CSS filter on the draw).
// brightness/contrast/saturate are percentages (100 = untouched);
// grayscale/sepia are 0–100 (0 = off).
type ColorAdj = { brightness: number; contrast: number; saturate: number; grayscale: number; sepia: number }
type Drag =
  | { kind: 'image'; startPx: number; startPy: number; startPanX: number; startPanY: number }
  | { kind: 'text'; id: string; ox: number; oy: number }
  | { kind: 'logo'; ox: number; oy: number }
  | { kind: 'qr'; ox: number; oy: number }

// ── Constants ────────────────────────────────────────────────────────────────
const PRESETS: Record<PresetKey, { w: number; h: number; key: string }> = {
  '1_1':  { w: 1080, h: 1080, key: 'ed.image.preset.square' },
  '4_5':  { w: 1080, h: 1350, key: 'ed.image.preset.portrait' },
  '9_16': { w: 1080, h: 1920, key: 'ed.image.preset.story' },
  '16_9': { w: 1920, h: 1080, key: 'ed.image.preset.wide' },
  'link': { w: 1200, h: 628,  key: 'ed.image.preset.link' },
}
const PRESET_ORDER: PresetKey[] = ['1_1', '4_5', '9_16', '16_9', 'link']
// Maps the current placement preset to the aspect-ratio string the gen-image
// endpoint understands. The 1200×628 link banner is closest to a 16:9 frame.
const PRESET_ASPECT: Record<PresetKey, string> = {
  '1_1': '1:1', '4_5': '4:5', '9_16': '9:16', '16_9': '16:9', 'link': '16:9',
}
// Quick-edit chips for the co-editor rail → prefill the composer.
const IMAGE_PRESETS: PresetChip[] = [
  { labelKey: 'ed.image.ai.chipEvening', instructionKey: 'ed.image.ai.chipEvening' },
  { labelKey: 'ed.image.ai.chipWhiteBg', instructionKey: 'ed.image.ai.chipWhiteBg' },
  { labelKey: 'ed.image.ai.chipSkyline', instructionKey: 'ed.image.ai.chipSkyline' },
]
const COLOR_DEFAULT: ColorAdj = { brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0 }
const colorFilter = (c: ColorAdj) =>
  `brightness(${c.brightness}%) contrast(${c.contrast}%) saturate(${c.saturate}%) grayscale(${c.grayscale}%) sepia(${c.sepia}%)`
const colorIsDefault = (c: ColorAdj) =>
  c.brightness === 100 && c.contrast === 100 && c.saturate === 100 && c.grayscale === 0 && c.sepia === 0
const FONT = '"Segoe UI", "Noto Sans Arabic", "Noto Kufi Arabic", Tahoma, system-ui, sans-serif'
const AR_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/
const isArabic = (s: string) => AR_RE.test(s)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const effAlign = (l: TextLayer): 'left' | 'center' | 'right' =>
  l.align === 'auto' ? (isArabic(l.text) ? 'right' : 'center') : l.align

function loadImage(src: string, cross = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    if (cross) im.crossOrigin = 'anonymous'
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('load failed'))
    im.src = src
  })
}

/** cover-fit source draw rect for the current zoom/pan, always covering the frame. */
function sourceRect(iw: number, ih: number, W: number, H: number, zoom: number, panX: number, panY: number) {
  const s = Math.max(W / iw, H / ih) * zoom
  const dw = iw * s, dh = ih * s
  const dx = clamp((W - dw) / 2 + panX, W - dw, 0)
  const dy = clamp((H - dh) / 2 + panY, H - dh, 0)
  return { dw, dh, dx, dy }
}

function logoSize(l: LogoLayer, W: number) {
  const nw = l.img?.naturalWidth || 1, nh = l.img?.naturalHeight || 1
  const w = l.scale * W
  return { w, h: w * (nh / nw) }
}
function qrSize(q: QrLayer, W: number) {
  const size = q.scale * W
  const pad = size * 0.08
  return { size, pad, backW: size + pad * 2, backH: size + pad * 2 }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function DriveImageEditor() {
  const t = useT()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = String(params?.id || '')

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const logoFileRef = useRef<HTMLInputElement | null>(null)
  const dragRef = useRef<Drag | null>(null)

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [dropping, setDropping] = useState(false)

  const [title, setTitle] = useState('')
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [preset, setPreset] = useState<PresetKey>('1_1')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [texts, setTexts] = useState<TextLayer[]>([])
  const [selText, setSelText] = useState<string | null>(null)
  const [logo, setLogo] = useState<LogoLayer | null>(null)
  const [qr, setQr] = useState<QrLayer | null>(null)
  const [permitInput, setPermitInput] = useState('')
  const [qrBusy, setQrBusy] = useState(false)
  const [frame, setFrame] = useState<BrandFrame>({ on: false, color: '#D4AF37', width: 24 })
  const [colors, setColors] = useState<ColorAdj>(COLOR_DEFAULT)
  // Source-layer URL is the reversible unit for the AI co-editor (undo swaps the
  // photo back). `revision` bumps on manual edits only, so the rail can warn
  // before an undo discards edits made after an AI turn.
  const [sourceUrl, setSourceUrl] = useState('')
  const [revision, setRevision] = useState(0)
  // Tabbed tool panel + mobile bottom-sheet access (the rail is hidden < lg).
  const [tab, setTab] = useState<'crop' | 'adjust' | 'text' | 'brand'>('crop')

  const { w: W, h: H } = PRESETS[preset]

  // ── Load ───────────────────────────────────────────────────────────────────
  const applySource = useCallback(async (src: string, opts?: { title?: string; cross?: boolean }) => {
    try {
      const im = await loadImage(src, opts?.cross ?? false)
      setImg(im); setSourceUrl(src); setPan({ x: 0, y: 0 }); setZoom(1); setDirty(true)
      if (opts?.title) setTitle((prev) => prev || opts.title!)
    } catch {
      toast.error(t('ed.image.exportFailed'))
    }
  }, [t])

  // "Start from a design": suite templates composed at full ad resolution by
  // the shared engine become the source layer — then every real tool (crop,
  // adjust, text, brand, QR) works on top of it.
  const [tplBusy, setTplBusy] = useState<string | null>(null)
  const tplCopy = useMemo<Record<SuiteCopy, AdOverlay>>(() => ({
    launch: { eyebrow: t('suite.copy.launch.eyebrow'), headline: t('suite.copy.launch.headline'), price: '1.4M', priceUnit: 'AED', footnote: t('suite.copy.launch.footnote') },
    offer:  { eyebrow: t('suite.copy.offer.eyebrow'),  headline: t('suite.copy.offer.headline'),  price: '980K', priceUnit: 'AED', footnote: t('suite.copy.offer.footnote') },
    open:   { eyebrow: t('suite.copy.open.eyebrow'),   headline: t('suite.copy.open.headline'),   price: '2.1M', priceUnit: 'AED', footnote: t('suite.copy.open.footnote') },
  }), [t])
  async function applyTemplate(tpl: SuiteTemplate) {
    if (tplBusy) return
    setTplBusy(tpl.id)
    try {
      const url = composeVariant(null, tpl.layout, AD_PALETTES[tpl.palette] ?? AD_PALETTES[0], tplCopy[tpl.copy], tpl.format, 1)
      await applySource(url)
    } finally { setTplBusy(null) }
  }

  useEffect(() => {
    let alive = true
    async function run() {
      if (!id) return
      if (id === 'new') { setLoading(false); return }
      setLoading(true)
      try {
        const res = await fetch('/api/freehold/library', { cache: 'no-store' })
        const d = await res.json()
        const row = (Array.isArray(d.items) ? d.items : []).find((x: LibRow) => x.id === id) as LibRow | undefined
        if (!alive) return
        if (!row) { setNotFound(true); return }
        setTitle(row.title || '')
        if (row.url) await applySource(row.url, { cross: /^https?:/.test(row.url) })
        else setNotFound(true) // no source → offer upload
      } catch {
        if (alive) setNotFound(true)
      } finally {
        if (alive) setLoading(false)
      }
    }
    run()
    return () => { alive = false }
  }, [id, applySource])

  // ── Draw ─────────────────────────────────────────────────────────────────────
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#111114'
    ctx.fillRect(0, 0, W, H)

    // Source (cover + zoom + pan) — color adjustments apply to the photo only.
    if (img) {
      const r = sourceRect(img.naturalWidth, img.naturalHeight, W, H, zoom, pan.x, pan.y)
      const filtered = !colorIsDefault(colors)
      if (filtered) { ctx.save(); ctx.filter = colorFilter(colors) }
      ctx.drawImage(img, r.dx, r.dy, r.dw, r.dh)
      if (filtered) ctx.restore()
    }

    // Text layers
    ctx.textBaseline = 'middle'
    for (const l of texts) {
      const al = effAlign(l)
      ctx.save()
      ctx.direction = isArabic(l.text) ? 'rtl' : 'ltr'
      ctx.font = `${l.weight} ${l.size}px ${FONT}`
      ctx.textAlign = al
      const cx = l.x * W, cy = l.y * H
      const m = ctx.measureText(l.text || ' ')
      const anchorX = al === 'left' ? cx - m.width / 2 : al === 'right' ? cx + m.width / 2 : cx
      ctx.shadowColor = 'rgba(0,0,0,0.4)'
      ctx.shadowBlur = Math.max(2, l.size * 0.06)
      ctx.shadowOffsetY = Math.max(1, l.size * 0.02)
      ctx.fillStyle = l.color
      ctx.fillText(l.text, anchorX, cy)
      ctx.restore()
    }

    // Logo
    if (logo?.img) {
      const { w, h } = logoSize(logo, W)
      ctx.drawImage(logo.img, logo.x * W - w / 2, logo.y * H - h / 2, w, h)
    }

    // Permit / Trakhees QR on a white rounded backing
    if (qr?.img) {
      const { size, pad, backW, backH } = qrSize(qr, W)
      const bx = qr.x * W - backW / 2, by = qr.y * H - backH / 2
      const rad = Math.max(6, size * 0.06)
      ctx.save()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      if (typeof ctx.roundRect === 'function') ctx.roundRect(bx, by, backW, backH, rad)
      else ctx.rect(bx, by, backW, backH)
      ctx.fill()
      ctx.drawImage(qr.img, bx + pad, by + pad, size, size)
      if (qr.stamp && qr.value) {
        ctx.fillStyle = '#0f0f12'
        ctx.direction = 'ltr'
        ctx.textAlign = 'center'
        const fs = Math.max(10, size * 0.11)
        ctx.font = `600 ${fs}px ${FONT}`
        const label = qr.value.length > 34 ? qr.value.slice(0, 33) + '…' : qr.value
        ctx.fillText(label, bx + backW / 2, by + backH + fs)
      }
      ctx.restore()
    }

    // Brand frame border (inset)
    if (frame.on && frame.width > 0) {
      ctx.save()
      ctx.strokeStyle = frame.color
      ctx.lineWidth = frame.width
      ctx.strokeRect(frame.width / 2, frame.width / 2, W - frame.width, H - frame.width)
      ctx.restore()
    }
  }, [W, H, img, zoom, pan, texts, logo, qr, frame, colors])

  useEffect(() => { redraw() }, [redraw])

  // Keep pan within cover bounds when zoom/preset change.
  useEffect(() => {
    if (!img) return
    setPan((p) => {
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s
      const mx = (dw - W) / 2, my = (dh - H) / 2
      const nx = clamp(p.x, -mx, mx), ny = clamp(p.y, -my, my)
      return nx === p.x && ny === p.y ? p : { x: nx, y: ny }
    })
  }, [zoom, W, H, img])

  // ── Pointer interaction (drag to reposition / pan) ───────────────────────────
  const toCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      px: (e.clientX - rect.left) * (canvas.width / rect.width),
      py: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { px, py } = toCanvas(e)

    // QR (top-most)
    if (qr?.img) {
      const { backW, backH } = qrSize(qr, W)
      const bx = qr.x * W - backW / 2, by = qr.y * H - backH / 2
      if (px >= bx && px <= bx + backW && py >= by && py <= by + backH) {
        dragRef.current = { kind: 'qr', ox: px / W - qr.x, oy: py / H - qr.y }
        canvas.setPointerCapture(e.pointerId); return
      }
    }
    // Logo
    if (logo?.img) {
      const { w, h } = logoSize(logo, W)
      const lx = logo.x * W - w / 2, ly = logo.y * H - h / 2
      if (px >= lx && px <= lx + w && py >= ly && py <= ly + h) {
        dragRef.current = { kind: 'logo', ox: px / W - logo.x, oy: py / H - logo.y }
        canvas.setPointerCapture(e.pointerId); return
      }
    }
    // Text (last drawn = top-most)
    for (let i = texts.length - 1; i >= 0; i--) {
      const l = texts[i]
      ctx.save()
      ctx.font = `${l.weight} ${l.size}px ${FONT}`
      const w = Math.max(ctx.measureText(l.text || ' ').width, 8)
      ctx.restore()
      const hgt = l.size * 1.3
      const cx = l.x * W, cy = l.y * H
      if (px >= cx - w / 2 - 8 && px <= cx + w / 2 + 8 && py >= cy - hgt / 2 && py <= cy + hgt / 2) {
        setSelText(l.id)
        dragRef.current = { kind: 'text', id: l.id, ox: px / W - l.x, oy: py / H - l.y }
        canvas.setPointerCapture(e.pointerId); return
      }
    }
    // Fallback: pan the source image
    if (img) {
      dragRef.current = { kind: 'image', startPx: px, startPy: py, startPanX: pan.x, startPanY: pan.y }
      canvas.setPointerCapture(e.pointerId)
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = dragRef.current
    if (!d) return
    const { px, py } = toCanvas(e)
    if (d.kind === 'text') {
      setTexts((prev) => prev.map((l) => l.id === d.id ? { ...l, x: clamp(px / W - d.ox, 0, 1), y: clamp(py / H - d.oy, 0, 1) } : l))
    } else if (d.kind === 'logo') {
      setLogo((l) => l ? { ...l, x: clamp(px / W - d.ox, 0, 1), y: clamp(py / H - d.oy, 0, 1) } : l)
    } else if (d.kind === 'qr') {
      setQr((q) => q ? { ...q, x: clamp(px / W - d.ox, 0, 1), y: clamp(py / H - d.oy, 0, 1) } : q)
    } else if (d.kind === 'image' && img) {
      const s = Math.max(W / img.naturalWidth, H / img.naturalHeight) * zoom
      const mx = (img.naturalWidth * s - W) / 2, my = (img.naturalHeight * s - H) / 2
      setPan({ x: clamp(d.startPanX + (px - d.startPx), -mx, mx), y: clamp(d.startPanY + (py - d.startPy), -my, my) })
    }
    setDirty(true); setRevision((r) => r + 1)
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    dragRef.current = null
    try { canvasRef.current?.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
  }

  // ── Layer ops ────────────────────────────────────────────────────────────────
  const mark = () => { setDirty(true); setRevision((r) => r + 1) }
  function addText() {
    const l: TextLayer = { id: `t-${Date.now()}`, text: t('ed.image.textSeed'), x: 0.5, y: 0.5, size: Math.round(W * 0.07), color: '#ffffff', align: 'auto', weight: 700 }
    setTexts((p) => [...p, l]); setSelText(l.id); mark()
  }
  const updateText = (tid: string, patch: Partial<TextLayer>) => { setTexts((p) => p.map((l) => l.id === tid ? { ...l, ...patch } : l)); mark() }
  const removeText = (tid: string) => { setTexts((p) => p.filter((l) => l.id !== tid)); if (selText === tid) setSelText(null); mark() }

  function onLogoFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = async () => {
      const url = String(reader.result || '')
      const im = await loadImage(url).catch(() => null)
      setLogo({ url, img: im, x: 0.82, y: 0.12, scale: 0.18 }); mark()
    }
    reader.readAsDataURL(file)
  }

  async function generateQr() {
    const value = permitInput.trim()
    if (!value || qrBusy) return
    setQrBusy(true)
    try {
      const url = await QRCode.toDataURL(value, { margin: 1, width: 640, color: { dark: '#000000', light: '#ffffff' } })
      const im = await loadImage(url)
      setQr((prev) => ({ value, url, img: im, x: prev?.x ?? 0.84, y: prev?.y ?? 0.84, scale: prev?.scale ?? 0.16, stamp: prev?.stamp ?? true }))
      mark()
    } catch {
      toast.error(t('ed.image.qrFailed'))
    } finally { setQrBusy(false) }
  }

  // ── Upload (source) ──────────────────────────────────────────────────────────
  function onSourceFile(file: File) {
    if (!file.type.startsWith('image/')) { toast.error(t('ed.image.qrFailed')); return }
    const reader = new FileReader()
    reader.onload = () => {
      const name = file.name.replace(/\.[^.]+$/, '')
      applySource(String(reader.result || ''), { title: name })
      setRevision((r) => r + 1) // manual re-upload = a manual edit
    }
    reader.readAsDataURL(file)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDropping(false)
    const f = e.dataTransfer.files?.[0]; if (f) onSourceFile(f)
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  function exportPng(): string | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    redraw()
    try { return canvas.toDataURL('image/png') } catch { toast.error(t('ed.image.exportFailed')); return null }
  }
  function download() {
    const url = exportPng(); if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `${(title || 'image').replace(/[^\w؀-ۿ-]+/g, '_').slice(0, 60)}.png`
    a.click()
  }
  async function save() {
    const dataUrl = exportPng(); if (!dataUrl) return
    setSaving(true)
    try {
      // Editing an existing library image updates it IN PLACE — saving must
      // not fork a duplicate row on every click. A read-only source (or a
      // brand-new canvas) still becomes a new row server-side.
      const res = await fetch('/api/freehold/drive/save-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title || 'Untitled image', dataUrl, id: id && id !== 'new' ? id : undefined }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.item) { toast.error(t('ed.saveFailed')); return }
      setDirty(false); toast.success(t('ed.image.savedToLibrary'))
      if (d.item.id !== id) router.replace(`/freehold-intelligence/drive/editor/image/${d.item.id}`)
    } catch { toast.error(t('ed.saveFailed')) } finally { setSaving(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex h-[calc(100vh-56px)] items-center justify-center text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div>
  )

  const hasSource = !!img
  const sel = texts.find((l) => l.id === selText) || null

  const sectionH = 'flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gold'
  const rowBtn = 'rounded-lg border border-line bg-surface px-2.5 py-2 text-xs text-slate-200 transition hover:border-gold/30'

  // Little proportional rectangles for the aspect-ratio chips.
  const CHIP: Record<PresetKey, { w: number; h: number }> = {
    '1_1': { w: 22, h: 22 }, '4_5': { w: 18, h: 22 }, '9_16': { w: 13, h: 23 }, '16_9': { w: 26, h: 15 }, 'link': { w: 26, h: 14 },
  }
  const TABS = [
    { k: 'crop' as const, icon: Crop, label: 'ed.image.tab.crop' },
    { k: 'adjust' as const, icon: SlidersHorizontal, label: 'ed.image.tab.adjust' },
    { k: 'text' as const, icon: Type, label: 'ed.image.tab.text' },
    { k: 'brand' as const, icon: Sparkles, label: 'ed.image.tab.brand' },
  ]

  const toolContent = hasSource ? (
    <div>
      {/* Tab bar — a segmented control so the panel isn't one long scroll */}
      <div className="sticky top-0 z-10 -mx-3 mb-4 bg-chrome px-3 pb-3 pt-1">
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-white/[0.06] bg-surface-2/40 p-1">
          {TABS.map((tb) => (
            <button key={tb.k} type="button" onClick={() => setTab(tb.k)}
              className={`flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition ${tab === tb.k ? 'bg-gold/15 text-gold shadow-sm shadow-black/20 ring-1 ring-gold/20' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'}`}>
              <tb.icon className="h-4 w-4" /> {t(tb.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
      {tab === 'crop' && (<>
      {/* Placement — visual aspect chips */}
      <section className="space-y-2">
        <div className={sectionH}><Move className="h-3.5 w-3.5" /> {t('ed.tool.placement')}</div>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESET_ORDER.map((k) => (
            <button key={k} type="button" onClick={() => { setPreset(k); mark() }}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[11px] transition ${preset === k ? 'border-gold/50 bg-gold/10 text-gold' : 'border-line bg-surface text-slate-300 hover:border-gold/30'}`}>
              <span className="grid h-6 w-7 shrink-0 place-items-center">
                <span className="block rounded-[2px] border-2 border-current" style={{ width: CHIP[k].w, height: CHIP[k].h }} />
              </span>
              <span className="truncate text-start">{t(PRESETS[k].key)}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Source */}
      <section className="space-y-2">
        <div className={sectionH}><ImagePlus className="h-3.5 w-3.5" /> {t('ed.tool.source')}</div>
        <label className="block text-[11px] text-slate-400">{t('ed.image.zoom')} · {Math.round(zoom * 100)}%</label>
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => { setZoom(Number(e.target.value)); mark() }} className="w-full accent-gold" />
        <p className="text-[10px] leading-snug text-slate-500">{t('ed.image.panHint')}</p>
        <button type="button" onClick={() => fileRef.current?.click()} className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
          <Upload className="h-3.5 w-3.5" /> {t('ed.image.uploadCta')}
        </button>
      </section>
      </>)}

      {tab === 'adjust' && (<>
      {/* Colors */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <div className={sectionH}><Palette className="h-3.5 w-3.5" /> {t('ed.tool.colors')}</div>
          {!colorIsDefault(colors) && (
            <button type="button" onClick={() => { setColors(COLOR_DEFAULT); mark() }}
              title={t('ed.image.color.reset')} className="flex items-center gap-1 text-[10px] text-slate-500 transition hover:text-gold">
              <RotateCcw className="h-3 w-3" /> {t('ed.image.color.reset')}
            </button>
          )}
        </div>
        {([
          ['brightness', 'ed.image.color.brightness', 0, 200] as const,
          ['contrast', 'ed.image.color.contrast', 0, 200] as const,
          ['saturate', 'ed.image.color.saturation', 0, 200] as const,
          ['grayscale', 'ed.image.color.grayscale', 0, 100] as const,
          ['sepia', 'ed.image.color.warmth', 0, 100] as const,
        ]).map(([k, labelKey, lo, hi]) => (
          <div key={k}>
            <label className="block text-[11px] text-slate-400">{t(labelKey)} · {colors[k]}%</label>
            <input type="range" min={lo} max={hi} step={1} value={colors[k]}
              onChange={(e) => { const v = Number(e.target.value); setColors((c) => ({ ...c, [k]: v })); mark() }}
              className="w-full accent-gold" />
          </div>
        ))}
      </section>
      </>)}

      {tab === 'text' && (<>
      {/* Text */}
      <section className="space-y-2">
        <div className={sectionH}><Type className="h-3.5 w-3.5" /> {t('ed.tool.text')}</div>
        <button type="button" onClick={addText} className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
          <Plus className="h-3.5 w-3.5" /> {t('ed.image.addText')}
        </button>
        {texts.length === 0 && <p className="text-[11px] text-slate-500">{t('ed.image.noText')}</p>}
        {texts.length > 0 && (
          <div className="space-y-1">
            {texts.map((l) => (
              <button key={l.id} type="button" onClick={() => setSelText(l.id)}
                className={`flex w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-start text-[11px] transition ${selText === l.id ? 'border-gold/50 bg-gold/10 text-gold' : 'border-line bg-surface text-slate-300'}`}>
                <Type className="h-3 w-3 shrink-0" /> <span className="truncate">{l.text || '—'}</span>
              </button>
            ))}
          </div>
        )}
        {sel && (
          <div className="space-y-2 rounded-xl border border-line bg-surface-2/40 p-2.5">
            <input value={sel.text} onChange={(e) => updateText(sel.id, { text: e.target.value })} placeholder={t('ed.image.textPh')} dir="auto"
              className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-gold/30" />
            <label className="block text-[11px] text-slate-400">{t('ed.tool.size')} · {sel.size}px</label>
            <input type="range" min={Math.round(W * 0.02)} max={Math.round(W * 0.22)} step={1} value={sel.size} onChange={(e) => updateText(sel.id, { size: Number(e.target.value) })} className="w-full accent-gold" />
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400">{t('ed.tool.color')}
                <input type="color" value={sel.color} onChange={(e) => updateText(sel.id, { color: e.target.value })} className="h-6 w-8 cursor-pointer rounded border border-line bg-transparent" />
              </label>
              <button type="button" onClick={() => updateText(sel.id, { weight: sel.weight >= 700 ? 400 : 800 })}
                title={t('ed.tool.bold')} className={`rounded-lg border p-1.5 ${sel.weight >= 700 ? 'border-gold/50 bg-gold/10 text-gold' : 'border-line text-slate-300'}`}><Bold className="h-3.5 w-3.5" /></button>
            </div>
            <div>
              <div className="mb-1 text-[11px] text-slate-400">{t('ed.tool.align')}</div>
              <div className="flex gap-1">
                {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Ic]) => (
                  <button key={a} type="button" onClick={() => updateText(sel.id, { align: a })}
                    className={`flex-1 rounded-lg border p-1.5 ${effAlign(sel) === a ? 'border-gold/50 bg-gold/10 text-gold' : 'border-line text-slate-300'}`}><Ic className="mx-auto h-3.5 w-3.5" /></button>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => removeText(sel.id)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 px-2 py-1.5 text-[11px] text-rose-300 transition hover:bg-rose-500/10">
              <Trash2 className="h-3.5 w-3.5" /> {t('ed.tool.remove')}
            </button>
          </div>
        )}
      </section>
      </>)}

      {tab === 'brand' && (<>
      {/* Logo */}
      <section className="space-y-2">
        <div className={sectionH}><ImagePlus className="h-3.5 w-3.5" /> {t('ed.tool.logo')}</div>
        <button type="button" onClick={() => logoFileRef.current?.click()} className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
          <Upload className="h-3.5 w-3.5" /> {t('ed.image.uploadLogo')}
        </button>
        {logo && (
          <div className="space-y-2 rounded-xl border border-line bg-surface-2/40 p-2.5">
            <label className="block text-[11px] text-slate-400">{t('ed.tool.scale')} · {Math.round(logo.scale * 100)}%</label>
            <input type="range" min={0.05} max={0.6} step={0.01} value={logo.scale} onChange={(e) => { setLogo((l) => l ? { ...l, scale: Number(e.target.value) } : l); mark() }} className="w-full accent-gold" />
            <button type="button" onClick={() => { setLogo(null); mark() }} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 px-2 py-1.5 text-[11px] text-rose-300 transition hover:bg-rose-500/10">
              <Trash2 className="h-3.5 w-3.5" /> {t('ed.tool.remove')}
            </button>
          </div>
        )}
      </section>

      {/* Permit / QR */}
      <section className="space-y-2">
        <div className={sectionH}><QrCode className="h-3.5 w-3.5" /> {t('ed.tool.permit')}</div>
        <input value={permitInput} onChange={(e) => setPermitInput(e.target.value)} placeholder={t('ed.image.permitPh')} dir="ltr"
          className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-white outline-none placeholder:text-slate-600 focus:border-gold/30" />
        <button type="button" onClick={generateQr} disabled={qrBusy || !permitInput.trim()} className={`${rowBtn} flex w-full items-center justify-center gap-1.5 disabled:opacity-50`}>
          {qrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />} {t('ed.image.generateQr')}
        </button>
        {qr && (
          <div className="space-y-2 rounded-xl border border-line bg-surface-2/40 p-2.5">
            <label className="block text-[11px] text-slate-400">{t('ed.tool.scale')} · {Math.round(qr.scale * 100)}%</label>
            <input type="range" min={0.08} max={0.5} step={0.01} value={qr.scale} onChange={(e) => { setQr((q) => q ? { ...q, scale: Number(e.target.value) } : q); mark() }} className="w-full accent-gold" />
            <label className="flex items-center gap-2 text-[11px] text-slate-300">
              <input type="checkbox" checked={qr.stamp} onChange={(e) => { setQr((q) => q ? { ...q, stamp: e.target.checked } : q); mark() }} className="accent-gold" />
              {t('ed.image.permitStamp')}
            </label>
            <button type="button" onClick={() => { setQr(null); mark() }} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 px-2 py-1.5 text-[11px] text-rose-300 transition hover:bg-rose-500/10">
              <Trash2 className="h-3.5 w-3.5" /> {t('ed.tool.remove')}
            </button>
          </div>
        )}
      </section>

      {/* Brand frame */}
      <section className="space-y-2">
        <div className={sectionH}><Frame className="h-3.5 w-3.5" /> {t('ed.tool.frame')}</div>
        <label className="flex items-center gap-2 text-[11px] text-slate-300">
          <input type="checkbox" checked={frame.on} onChange={(e) => { setFrame((f) => ({ ...f, on: e.target.checked })); mark() }} className="accent-gold" />
          {t('ed.image.frameShow')}
        </label>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-slate-400">{t('ed.tool.color')}
            <input type="color" value={frame.color} onChange={(e) => { setFrame((f) => ({ ...f, color: e.target.value })); mark() }} className="h-6 w-8 cursor-pointer rounded border border-line bg-transparent" />
          </label>
        </div>
        <label className="block text-[11px] text-slate-400">{t('ed.tool.width')} · {frame.width}px</label>
        <input type="range" min={2} max={96} step={1} value={frame.width} onChange={(e) => { setFrame((f) => ({ ...f, width: Number(e.target.value) })); mark() }} className="w-full accent-gold" />
      </section>
      </>)}

      {/* Export — persistent footer (visible on every tab) */}
      <section className="space-y-2 border-t border-white/[0.07] pt-4">
        <div className={sectionH}><Download className="h-3.5 w-3.5" /> {t('ed.tool.export')}</div>
        <button type="button" onClick={download} className={`${rowBtn} flex w-full items-center justify-center gap-1.5`}>
          <Download className="h-3.5 w-3.5" /> {t('ed.download')}
        </button>
        <button type="button" onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gold px-2.5 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} {t('ed.image.saveToLibrary')}
        </button>
        <p className="text-[10px] leading-snug text-slate-500">{t('ed.image.ai.boundary')}</p>
      </section>
      </div>
    </div>
  ) : undefined // no source yet → the canvas dropzone is the single upload surface

  // Image adapter: the reversible unit is the source-layer URL (undo swaps the
  // photo back). The AI edit reference is the full flattened canvas (exportPng),
  // faithful to the previous image→image flow. Text/logo/QR/frame stay on their
  // own tool-rail controls (see the flatten note).
  const imageAdapter: ArtifactAdapter<string> = {
    kind: 'image',
    snapshot: () => sourceUrl,
    restore: (url) => {
      if (url) applySource(url, { cross: /^https?:/.test(url) })
      else { setImg(null); setSourceUrl(''); setDirty(true) }
    },
    apply: async ({ instruction, signal }) => {
      const ref = hasSource ? exportPng() : undefined
      if (hasSource && !ref) throw new Error(t('ed.ai.err.tainted')) // toDataURL failed → honest, no network
      const res = await fetch('/api/freehold/drive/gen-image', {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: instruction, aspectRatio: PRESET_ASPECT[preset], imageUrl: ref ?? undefined }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.url) throw new Error(d.error || t('ed.image.ai.failed')) // real provider message
      await applySource(d.url, { cross: /^https?:/.test(d.url) })
      return { after: d.url as string, summary: t(ref ? 'ed.ai.summary.image.edit' : 'ed.ai.summary.image.gen') }
    },
  }

  const aiRail = (
    <AiEditorRail
      adapter={imageAdapter}
      revision={revision}
      presets={IMAGE_PRESETS}
      placeholderKey="ed.ai.placeholder.image"
      footNoteKey="ed.ai.imageFlattenNote"
    />
  )

  return (
    <DriveEditorFrame
      type="image"
      title={title || t('ed.type.image')}
      statusNote={t('ed.image.ai.boundary')}
      dirty={dirty}
      saving={saving}
      onSave={hasSource ? save : undefined}
      toolRail={toolContent}
      aiRail={aiRail}
      actions={hasSource ? (
        <button type="button" onClick={download} title={t('ed.download')} className="rounded-full border border-line p-1.5 text-slate-400 transition hover:text-white">
          <Download className="h-3.5 w-3.5" />
        </button>
      ) : undefined}
    >
      {/* Hidden file inputs (always mounted) */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onSourceFile(f); e.target.value = '' }} />
      <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogoFile(f); e.target.value = '' }} />

      {/* Mobile tools are provided by DriveEditorFrame's shared bottom-sheet
          (it renders the same toolRail below lg for every editor type). */}

      {hasSource ? (
        <div
          className="relative flex h-full w-full items-center justify-center overflow-hidden p-4 sm:p-8"
          style={{ background: 'radial-gradient(130% 100% at 50% -10%, rgba(212,175,55,0.07), transparent 55%), #0b0b0d' }}
        >
          {/* Transparency checkerboard — the universal "image workspace" signal */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.045) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.045) 75%), linear-gradient(45deg, rgba(255,255,255,0.045) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.045) 75%)',
              backgroundSize: '28px 28px',
              backgroundPosition: '0 0, 14px 14px',
              maskImage: 'radial-gradient(120% 100% at 50% 40%, #000 25%, transparent 100%)',
            }}
          />

          {/* Live format badge — the operator always knows the exact output size */}
          <div className="pointer-events-none absolute start-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] font-medium backdrop-blur-sm">
            <span className="text-gold">{t(PRESETS[preset].key)}</span>
            <span className="text-slate-500" dir="ltr">{W} × {H}</span>
          </div>

          {/* The canvas — lifted off the stage with a soft platform shadow */}
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            dir="ltr"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative z-[1] max-h-full max-w-full cursor-grab touch-none rounded-xl shadow-[0_40px_90px_-25px_rgba(0,0,0,0.85)] ring-1 ring-white/10 transition-shadow active:cursor-grabbing hover:ring-gold/25"
            style={{ touchAction: 'none' }}
          />

          {/* Floating zoom dock — reposition/zoom without leaving the canvas */}
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2 py-1.5 shadow-lg shadow-black/40 backdrop-blur-sm">
            <button type="button" onClick={() => { setZoom((z) => clamp(Math.round((z - 0.1) * 100) / 100, 1, 3)); mark() }}
              disabled={zoom <= 1} title={t('ed.image.zoom')} className="grid h-6 w-6 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-40">
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <input type="range" min={1} max={3} step={0.01} value={zoom} aria-label={t('ed.image.zoom')}
              onChange={(e) => { setZoom(Number(e.target.value)); mark() }} className="h-1 w-28 accent-gold" />
            <button type="button" onClick={() => { setZoom((z) => clamp(Math.round((z + 0.1) * 100) / 100, 1, 3)); mark() }}
              disabled={zoom >= 3} title={t('ed.image.zoom')} className="grid h-6 w-6 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white disabled:opacity-40">
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <span className="ms-0.5 min-w-[2.75rem] text-center text-[11px] font-medium tabular-nums text-slate-400" dir="ltr">{Math.round(zoom * 100)}%</span>
            {zoom !== 1 && (
              <button type="button" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); mark() }}
                title={t('ed.image.color.reset')} className="grid h-6 w-6 place-items-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white">
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="relative flex h-full w-full items-center justify-center overflow-hidden p-6"
          style={{ background: 'radial-gradient(130% 100% at 50% -10%, rgba(212,175,55,0.07), transparent 55%), #0b0b0d' }}
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(45deg, rgba(255,255,255,0.045) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.045) 75%), linear-gradient(45deg, rgba(255,255,255,0.045) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.045) 75%)',
              backgroundSize: '28px 28px',
              backgroundPosition: '0 0, 14px 14px',
              maskImage: 'radial-gradient(120% 100% at 50% 40%, #000 25%, transparent 100%)',
            }}
          />
          <div
            onDragOver={(e) => { e.preventDefault(); setDropping(true) }}
            onDragLeave={() => setDropping(false)}
            onDrop={onDrop}
            className={`relative z-[1] flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-6 py-14 text-center backdrop-blur-sm transition ${dropping ? 'scale-[1.02] border-gold bg-gold/10 shadow-2xl shadow-gold/10' : 'border-white/15 bg-black/30 hover:border-gold/40'}`}
          >
            <span className={`grid h-16 w-16 place-items-center rounded-2xl bg-gold/10 text-gold ring-1 ring-gold/20 transition ${dropping ? 'scale-110' : ''}`}>
              <Upload className="h-8 w-8" />
            </span>
            {notFound && <p className="text-xs text-slate-500">{t('ed.notFound')}</p>}
            <p className="text-base font-semibold text-white">{dropping ? t('ed.image.dropHere') : t('ed.image.uploadTitle')}</p>
            <p className="text-xs leading-relaxed text-slate-400">{t('ed.image.uploadHint')}</p>
            <button type="button" onClick={() => fileRef.current?.click()} className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-xs font-semibold text-ink shadow-lg shadow-gold/10 transition hover:bg-gold-bright">
              <Upload className="h-3.5 w-3.5" /> {t('ed.image.uploadCta')}
            </button>
            <p className="mt-2 text-[10px] leading-snug text-slate-600">{t('ed.image.ai.boundary')}</p>
          </div>

          {/* Or start from a suite design — composed live by the real engine. */}
          <div className="absolute inset-x-0 bottom-4 z-[1] mx-auto w-full max-w-2xl px-4">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('suite.tpl.startFrom')}</p>
            <div className="flex justify-center gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SUITE_TEMPLATES.slice(0, 8).map((tpl) => (
                <button key={tpl.id} type="button" onClick={() => applyTemplate(tpl)} disabled={tplBusy !== null}
                  className={`w-16 shrink-0 overflow-hidden rounded-md ring-1 ring-white/15 transition hover:ring-2 hover:ring-gold/50 disabled:opacity-60 ${tplBusy === tpl.id ? 'ring-2 ring-gold' : ''}`}>
                  <TemplateThumb layout={tpl.layout} palette={tpl.palette} format={tpl.format} overlay={tplCopy[tpl.copy]} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </DriveEditorFrame>
  )
}
