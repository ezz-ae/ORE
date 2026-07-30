'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import {
  Loader2, Upload, Sparkles, Check, Download, QrCode, MessageSquareText,
  Monitor, ArrowRight, ArrowLeft, RefreshCw, Save, ExternalLink, Megaphone, FolderOpen, FileText,
} from 'lucide-react'
import { DriveEditorFrame } from '@/components/freehold/drive/drive-editor-frame'
import { useLiveProjects, type LiveProject } from '@/lib/freehold/use-live-projects'
import { useT } from '@/lib/i18n/provider'
import { fieldClass, Modal } from '@/components/freehold/ui'
import {
  PALETTES, LAYOUTS, FORMATS, composeVariant, stampQr, loadImage, fmtPrice, isRtl,
  type LayoutKey, type FormatKey, type Overlay,
} from '@/lib/freehold/ad-compose'

/**
 * AD DESIGNER — the generative ad-creative flow, end to end:
 *   1. Source   — a live listing (its image + facts) or an uploaded image,
 *                 plus the overlay text (headline / price / footnote).
 *   2. Generate — a SET of ready ad designs (3 layouts × 3 palettes),
 *                 composed for real on canvas. Pick the ones you like;
 *                 Enhance runs the selected design through the real
 *                 image-to-image AI (same engine as Creative Studio).
 *   3. QR       — the standalone Trakhees step: download the design, get the
 *                 permit, then stamp its QR (uploaded image or pasted permit
 *                 link) onto a corner with a white backing.
 *   4. Caption  — the AI writes the ad caption from the same facts.
 *   5. Preview  — feed + story mockups of the final creative, then save to
 *                 Drive or jump into a new campaign.
 * Everything composed here is real pixels (1080×1350) — what you download is
 * what Meta gets.
 */

type Step = 'source' | 'generate' | 'qr' | 'caption' | 'preview'
const STEPS: { key: Step; icon: React.ElementType }[] = [
  { key: 'source',   icon: Upload },
  { key: 'generate', icon: Sparkles },
  { key: 'qr',       icon: QrCode },
  { key: 'caption',  icon: MessageSquareText },
  { key: 'preview',  icon: Monitor },
]

interface Variant { id: string; layout: LayoutKey; palette: number; fmt: FormatKey; dataUrl: string }


// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdDesignerPage() {
  const t = useT()
  const { projects } = useLiveProjects()

  const [step, setStep] = useState<Step>('source')
  const [listingId, setListingId] = useState('')
  const [uploadUrl, setUploadUrl] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<Overlay>({ eyebrow: '', headline: '', price: '', priceUnit: 'AED', footnote: '' })

  const [variants, setVariants] = useState<Variant[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // The options: format (single) + which layouts/palettes to compose (multi).
  const [format, setFormat] = useState<FormatKey>('feed')
  const [layoutsOn, setLayoutsOn] = useState<Set<LayoutKey>>(new Set(LAYOUTS))
  const [palettesOn, setPalettesOn] = useState<Set<number>>(new Set(PALETTES.map((_, i) => i)))
  const [generating, setGenerating] = useState(false)
  const [genStage, setGenStage] = useState(0)
  const [enhancing, setEnhancing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // The design that continues through QR → caption → preview (first selected).
  const [finalUrl, setFinalUrl] = useState<string | null>(null)
  const [qrImage, setQrImage] = useState<HTMLImageElement | null>(null)
  const [qrLink, setQrLink] = useState('')
  const [qrCorner, setQrCorner] = useState<'tl' | 'tr' | 'bl' | 'br'>('bl')
  const [qrPct, setQrPct] = useState(12)
  const [qrApplied, setQrApplied] = useState(false)
  const [qrBusy, setQrBusy] = useState(false)

  const [caption, setCaption] = useState('')
  const [captionBusy, setCaptionBusy] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const qrFileRef = useRef<HTMLInputElement>(null)

  // Deep-link seeding from the Creative Suite: /drive/ad-designer?format=story
  // (&layout=frame&palette=1) opens with that recipe preselected.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const f = sp.get('format') as FormatKey | null
    if (f && FORMATS[f]) setFormat(f)
    const l = sp.get('layout') as LayoutKey | null
    if (l && LAYOUTS.includes(l)) setLayoutsOn(new Set([l]))
    const p = sp.get('palette')
    if (p !== null && PALETTES[Number(p)]) setPalettesOn(new Set([Number(p)]))
  }, [])

  // "From Drive": media made in the editors (image editor, Creative Studio,
  // AI generations) is a first-class source — picked straight from the Library.
  const [driveOpen, setDriveOpen] = useState(false)
  const [driveItems, setDriveItems] = useState<{ id: string; title: string; url: string }[] | null>(null)
  async function openDrivePicker() {
    setDriveOpen(true)
    if (driveItems !== null) return
    const d = await fetch('/api/freehold/library?kind=image', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    const items = (Array.isArray(d?.items) ? d.items : [])
      .filter((i: { url?: string | null }) => !!i.url)
      .map((i: { id: string; title?: string; url: string }) => ({ id: i.id, title: i.title || 'Untitled', url: i.url }))
    setDriveItems(items)
  }
  function pickDriveItem(url: string) {
    setUploadUrl(url)
    setListingId('')
    setDriveOpen(false)
  }

  const listing: LiveProject | undefined = projects.find((l) => l.id === listingId)

  // Prefill overlay text from the picked listing (only fields the user hasn't typed).
  useEffect(() => {
    if (!listing) return
    setOverlay((prev) => ({
      eyebrow: prev.eyebrow || `${listing.area} · Dubai`,
      headline: prev.headline || listing.name,
      price: prev.price || (listing.priceAED ? fmtPrice(listing.priceAED) : ''),
      priceUnit: prev.priceUnit || 'AED',
      footnote: prev.footnote || (listing.paymentPlan ?? ''),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId])

  function onUpload(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setUploadUrl(String(reader.result)); setListingId('') }
    reader.readAsDataURL(file)
  }

  // "From brochure": the third source from the spec — a developer PDF goes
  // through the real brochure parser and its facts fill the overlay fields.
  const [brochureBusy, setBrochureBusy] = useState(false)
  const brochureRef = useRef<HTMLInputElement>(null)
  async function onBrochure(file: File | null) {
    if (!file || brochureBusy) return
    setBrochureBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/dashboard/projects/parse-brochure', { method: 'POST', body: fd })
      const d = await res.json().catch(() => ({}))
      const b = d?.data as { name?: string; area?: string; developer?: string; priceFrom?: number | null; paymentPlan?: string } | undefined
      if (!res.ok || !b) { toast.error(d?.error || t('adz.source.brochureFail')); return }
      setOverlay((prev) => ({
        eyebrow: b.area ? `${b.area} · Dubai` : (b.developer || prev.eyebrow),
        headline: b.name || prev.headline,
        price: b.priceFrom ? fmtPrice(b.priceFrom) : prev.price,
        priceUnit: prev.priceUnit || 'AED',
        footnote: b.paymentPlan || prev.footnote,
      }))
      setListingId('')
      toast.success(t('adz.source.brochureDone'))
    } catch { toast.error(t('adz.source.brochureFail')) } finally { setBrochureBusy(false) }
  }

  // A photo is optional now: without one the engine draws a styled placeholder
  // ground, and Enhance (img2img) can paint a real scene over it.
  const hasImage = !!listingId || !!uploadUrl
  const canGenerate = !!overlay.headline.trim()

  async function generate() {
    if (!canGenerate || generating) return
    setGenerating(true)
    setGenStage(1)
    setVariants([])
    setSelected(new Set())
    try {
      let img: HTMLImageElement | null = null
      const src = uploadUrl ?? listing?.heroImage ?? null
      if (src) {
        try { img = await loadImage(src, !src.startsWith('data:')) }
        catch { toast.error(t('adz.err.image')); img = null }
      }
      setGenStage(2)
      const out: Variant[] = []
      const layouts = LAYOUTS.filter((l) => layoutsOn.has(l))
      const palettes = PALETTES.map((_, i) => i).filter((pi) => palettesOn.has(pi))
      for (const layout of layouts) {
        for (const pi of palettes) {
          out.push({ id: `${format}-${layout}-${pi}`, layout, palette: pi, fmt: format, dataUrl: composeVariant(img, layout, PALETTES[pi], overlay, format) })
        }
        setGenStage((s) => Math.min(s + 1, 4))
        // Yield to the browser so the progress bar actually paints between batches.
        await new Promise((r) => setTimeout(r, 60))
      }
      setGenStage(4)
      setVariants(out)
      setStep('generate')
    } catch {
      toast.error(t('adz.err.compose'))
    } finally {
      setGenerating(false)
      setGenStage(0)
    }
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Real image→image pass over one selected design (same engine as Creative Studio). */
  async function enhance(v: Variant) {
    if (enhancing) return
    setEnhancing(v.id)
    try {
      const res = await fetch('/api/freehold/drive/gen-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Enhance this real-estate ad creative: richer lighting, premium finish, keep ALL text, layout, numbers and QR exactly as they are.',
          imageUrl: v.dataUrl,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.url) throw new Error(d.error || 'failed')
      // Normalize to a data URL so QR stamping later can't hit a tainted canvas.
      let url: string = d.url
      if (!url.startsWith('data:')) {
        const blob = await fetch(url).then((r) => r.blob())
        url = await new Promise<string>((resolve) => {
          const fr = new FileReader()
          fr.onload = () => resolve(String(fr.result))
          fr.readAsDataURL(blob)
        })
      }
      setVariants((vs) => vs.map((x) => (x.id === v.id ? { ...x, dataUrl: url } : x)))
      toast.success(t('adz.enhanceOk'))
    } catch (e) {
      toast.error(e instanceof Error && e.message !== 'failed' ? e.message : t('adz.err.enhance'))
    } finally {
      setEnhancing(null)
    }
  }

  async function saveSelected(): Promise<boolean> {
    const picks = variants.filter((v) => selected.has(v.id))
    if (picks.length === 0) { toast.info(t('adz.pickFirst')); return false }
    setSaving(true)
    let ok = 0
    for (const [i, v] of picks.entries()) {
      const res = await fetch('/api/freehold/drive/save-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${overlay.headline.slice(0, 60)} — ad ${i + 1}`, dataUrl: v.dataUrl }),
      }).catch(() => null)
      if (res?.ok) ok++
    }
    setSaving(false)
    if (ok) toast.success(t('adz.savedN', { n: ok }))
    else toast.error(t('adz.err.save'))
    return ok > 0
  }

  function continueToQr() {
    const first = variants.find((v) => selected.has(v.id))
    if (!first) { toast.info(t('adz.pickFirst')); return }
    setFinalUrl(first.dataUrl)
    setQrApplied(false)
    setStep('qr')
  }

  async function onQrUpload(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      try { setQrImage(await loadImage(String(reader.result))) }
      catch { toast.error(t('adz.err.qr')) }
    }
    reader.readAsDataURL(file)
  }

  async function qrFromLink() {
    const link = qrLink.trim()
    if (!link) return
    try {
      const url = await QRCode.toDataURL(link, { margin: 0, width: 512 })
      setQrImage(await loadImage(url))
    } catch { toast.error(t('adz.err.qr')) }
  }

  async function applyQr() {
    if (!finalUrl || !qrImage || qrBusy) return
    setQrBusy(true)
    try {
      const stamped = await stampQr(finalUrl, qrImage, qrCorner, qrPct)
      setFinalUrl(stamped)
      setQrApplied(true)
      toast.success(t('adz.qr.applied'))
    } catch {
      toast.error(t('adz.err.qrStamp'))
    } finally {
      setQrBusy(false)
    }
  }

  async function writeCaption() {
    if (captionBusy) return
    setCaptionBusy(true)
    try {
      const facts = [
        overlay.headline && `Project: ${overlay.headline}`,
        listing?.area && `Area: ${listing.area}, Dubai`,
        overlay.price && `Price: ${overlay.price} ${overlay.priceUnit}`,
        overlay.footnote && `Payment: ${overlay.footnote}`,
        listing?.landingUrl && `Landing page: ${listing.landingUrl}`,
      ].filter(Boolean).join('\n')
      const lang = isRtl(overlay.headline) ? 'Arabic' : 'English'
      const res = await fetch('/api/freehold/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Write a Meta (Facebook/Instagram) ad caption in ${lang} for a Dubai real-estate ad. Use ONLY these facts — do not invent numbers or amenities:\n${facts}\nStyle: 2 short paragraphs + a call-to-action line + 4 relevant hashtags. No placeholders.`,
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.text) throw new Error(d.error || 'failed')
      setCaption(String(d.text).trim())
    } catch {
      toast.error(t('adz.err.caption'))
    } finally {
      setCaptionBusy(false)
    }
  }

  function download(url: string, name: string) {
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
  }

  async function saveFinal() {
    if (!finalUrl) return
    setSaving(true)
    const res = await fetch('/api/freehold/drive/save-image', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `${overlay.headline.slice(0, 60)} — final ad`, dataUrl: finalUrl }),
    }).catch(() => null)
    setSaving(false)
    if (res?.ok) toast.success(t('adz.savedFinal'))
    else toast.error(t('adz.err.save'))
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  // ── Tool rail (per step) ───────────────────────────────────────────────────
  const toolRail = (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="space-y-1">
        {STEPS.map((s, i) => {
          const active = s.key === step
          const done = i < stepIndex
          const Icon = s.icon
          return (
            <div key={s.key} className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium ${active ? 'bg-gold/10 text-gold' : done ? 'text-emerald-300' : 'text-slate-500'}`}>
              {done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              {t(`adz.step.${s.key}`)}
            </div>
          )
        })}
      </div>

      {/* The source step's form lives in the CENTER canvas where there is real
          room to write — the rail only carries the stepper + a hint here. */}
      {step === 'source' && (
        <p className="text-[11px] leading-relaxed text-slate-500">{t('adz.source.hint')}</p>
      )}

      {step === 'generate' && (
        <div className="space-y-2.5">
          <p className="text-[11px] leading-relaxed text-slate-500">{t('adz.select.hint')}</p>
          <div className="text-xs font-semibold text-slate-200">{t('adz.select.count', { n: selected.size })}</div>
          <button type="button" onClick={() => saveSelected()} disabled={saving || selected.size === 0}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t('adz.actions.save')}
          </button>
          <button type="button" onClick={continueToQr} disabled={selected.size === 0}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
            {t('adz.actions.continue')} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </button>
          <button type="button" onClick={() => setStep('source')}
            className="flex w-full items-center justify-center gap-1.5 py-1.5 text-xs text-slate-500 transition hover:text-slate-300">
            <ArrowLeft className="h-3 w-3 rtl:rotate-180" /> {t('adz.actions.back')}
          </button>
        </div>
      )}

      {step === 'qr' && (
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed text-slate-400">{t('adz.qr.guide')}</p>
          <button type="button" onClick={() => finalUrl && download(finalUrl, 'ad-design.png')}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30">
            <Download className="h-3.5 w-3.5" /> {t('adz.qr.download')}
          </button>
          <a href="https://www.trakhees.ae" target="_blank" rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs text-slate-400 transition hover:text-white">
            Trakhees <ExternalLink className="h-3 w-3" />
          </a>
          <div className="border-t border-line pt-3 space-y-2">
            <button type="button" onClick={() => qrFileRef.current?.click()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30">
              <QrCode className="h-3.5 w-3.5" /> {t('adz.qr.upload')}
            </button>
            <input ref={qrFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onQrUpload(e.target.files?.[0] ?? null); e.target.value = '' }} />
            <div className="flex gap-1.5">
              <input value={qrLink} onChange={(e) => setQrLink(e.target.value)} placeholder={t('adz.qr.linkPh')} className={fieldClass('sm')} />
              <button type="button" onClick={qrFromLink} className="shrink-0 rounded-lg border border-line-strong px-2.5 text-xs font-semibold text-slate-200 transition hover:border-gold/30">{t('adz.qr.make')}</button>
            </div>
            {qrImage && (
              <>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
                    <button key={c} type="button" onClick={() => setQrCorner(c)}
                      className={`rounded-lg border px-2 py-1.5 text-[10px] font-semibold uppercase ${qrCorner === c ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-400'}`}>
                      {c}
                    </button>
                  ))}
                </div>
                <label className="block text-[11px] text-slate-500">{t('adz.qr.size')}
                  <input type="range" min={8} max={20} value={qrPct} onChange={(e) => setQrPct(Number(e.target.value))} className="mt-1 w-full accent-[#D4AF37]" />
                </label>
                <button type="button" onClick={applyQr} disabled={qrBusy}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gold px-3 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
                  {qrBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <QrCode className="h-3.5 w-3.5" />} {t('adz.qr.apply')}
                </button>
              </>
            )}
          </div>
          <button type="button" onClick={() => { setStep('caption'); if (!caption) writeCaption() }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright">
            {qrApplied ? t('adz.actions.continue') : t('adz.qr.skip')} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </button>
          <button type="button" onClick={() => setStep('generate')}
            className="flex w-full items-center justify-center gap-1.5 py-1.5 text-xs text-slate-500 transition hover:text-slate-300">
            <ArrowLeft className="h-3 w-3 rtl:rotate-180" /> {t('adz.actions.back')}
          </button>
        </div>
      )}

      {step === 'caption' && (
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed text-slate-500">{t('adz.caption.hint')}</p>
          <button type="button" onClick={writeCaption} disabled={captionBusy}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50">
            {captionBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} {t('adz.caption.regen')}
          </button>
          <button type="button" onClick={() => setStep('preview')} disabled={!caption.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
            {t('adz.actions.continue')} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </button>
          <button type="button" onClick={() => setStep('qr')}
            className="flex w-full items-center justify-center gap-1.5 py-1.5 text-xs text-slate-500 transition hover:text-slate-300">
            <ArrowLeft className="h-3 w-3 rtl:rotate-180" /> {t('adz.actions.back')}
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-2.5">
          <button type="button" onClick={saveFinal} disabled={saving}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t('adz.preview.save')}
          </button>
          <button type="button" onClick={() => finalUrl && download(finalUrl, 'ad-final.png')}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30">
            <Download className="h-3.5 w-3.5" /> {t('adz.preview.download')}
          </button>
          <Link href={`/freehold-intelligence/lead-machine/campaigns/new${listingId ? `?project=${encodeURIComponent(listingId)}` : ''}`}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright">
            <Megaphone className="h-4 w-4" /> {t('adz.preview.campaign')}
          </Link>
          <button type="button" onClick={() => { setStep('source'); setVariants([]); setSelected(new Set()); setFinalUrl(null); setCaption(''); setQrApplied(false) }}
            className="flex w-full items-center justify-center gap-1.5 py-1.5 text-xs text-slate-500 transition hover:text-slate-300">
            {t('adz.preview.startOver')}
          </button>
        </div>
      )}
    </div>
  )

  // ── Center canvas per step ─────────────────────────────────────────────────
  const genStages = [t('adz.gen.s1'), t('adz.gen.s2'), t('adz.gen.s3'), t('adz.gen.s4')]

  return (
    <DriveEditorFrame type="image" title={t('adz.title')} statusNote={t('adz.note')} toolRail={toolRail}>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">

        {step === 'source' && (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
            {/* Left: the source image (or drop hint) + what this tool does */}
            <div>
              {(uploadUrl || listing?.heroImage) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={uploadUrl ?? listing?.heroImage ?? ''} alt="" className="max-h-[56vh] w-full rounded-2xl border border-line object-cover" />
              ) : (
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="grid h-72 w-full place-items-center rounded-2xl border border-dashed border-line-strong text-sm text-slate-500 transition hover:border-gold/30 hover:text-slate-300">
                  {t('adz.source.empty')}
                </button>
              )}
              <p className="mt-4 text-sm leading-relaxed text-slate-400">{t('adz.source.desc')}</p>
              {generating && (
                <div className="mt-6">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    {genStages.map((s, i) => (
                      <span key={s} className={i < genStage ? 'text-emerald-300' : i === genStage ? 'text-gold' : ''}>{s}</span>
                    ))}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${(genStage / 4) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>

            {/* Right: the real form, with room to write */}
            <div className="rounded-2xl border border-line bg-surface p-5">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('adz.source.listing')}</div>
              <select value={listingId} onChange={(e) => { setListingId(e.target.value); if (e.target.value) setUploadUrl(null) }} className={fieldClass('lg')}>
                <option value="">—</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="mt-2.5 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-2 py-2.5 text-[13px] font-semibold text-slate-200 transition hover:border-gold/30">
                  <Upload className="h-4 w-4 shrink-0" /> {t('adz.source.upload')}
                </button>
                <button type="button" onClick={openDrivePicker}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-2 py-2.5 text-[13px] font-semibold text-slate-200 transition hover:border-gold/30">
                  <FolderOpen className="h-4 w-4 shrink-0" /> {t('adz.source.drive')}
                </button>
                <button type="button" onClick={() => brochureRef.current?.click()} disabled={brochureBusy}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-2 py-2.5 text-[13px] font-semibold text-slate-200 transition hover:border-gold/30 disabled:opacity-60">
                  {brochureBusy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <FileText className="h-4 w-4 shrink-0" />} {t('adz.source.brochure')}
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onUpload(e.target.files?.[0] ?? null); e.target.value = '' }} />
              <input ref={brochureRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { onBrochure(e.target.files?.[0] ?? null); e.target.value = '' }} />

              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('adz.source.overlay')}</div>
                <div className="space-y-2.5">
                  <input value={overlay.eyebrow} onChange={(e) => setOverlay({ ...overlay, eyebrow: e.target.value })} placeholder={t('adz.field.eyebrow')} className={fieldClass('lg')} dir="auto" />
                  <input value={overlay.headline} onChange={(e) => setOverlay({ ...overlay, headline: e.target.value })} placeholder={t('adz.field.headline')} className={fieldClass('lg')} dir="auto" />
                  {/* Wrappers own the widths — fieldClass bakes in w-full, which
                      otherwise fights a width utility and collapses the row. */}
                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1">
                      <input value={overlay.price} onChange={(e) => setOverlay({ ...overlay, price: e.target.value })} placeholder={t('adz.field.price')} className={fieldClass('lg')} dir="auto" />
                    </div>
                    <div className="w-24 shrink-0">
                      <input value={overlay.priceUnit} onChange={(e) => setOverlay({ ...overlay, priceUnit: e.target.value })} className={fieldClass('lg', 'text-center')} dir="auto" />
                    </div>
                  </div>
                  <input value={overlay.footnote} onChange={(e) => setOverlay({ ...overlay, footnote: e.target.value })} placeholder={t('adz.field.footnote')} className={fieldClass('lg')} dir="auto" />
                </div>
              </div>

              {/* Options: format + which layouts/colors to compose */}
              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('adz.opt.format')}</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(FORMATS) as FormatKey[]).map((f) => (
                    <button key={f} type="button" onClick={() => setFormat(f)}
                      className={`rounded-lg border px-2 py-2 text-center text-[11px] font-semibold transition ${format === f ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}>
                      {t(`adz.format.${f}`)}
                      <span className="block text-[9px] font-normal text-slate-500">{FORMATS[f].w}×{FORMATS[f].h}</span>
                    </button>
                  ))}
                </div>
                <div className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('adz.opt.layouts')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {LAYOUTS.map((l) => {
                    const on = layoutsOn.has(l)
                    return (
                      <button key={l} type="button"
                        onClick={() => setLayoutsOn((prev) => { const n = new Set(prev); if (n.has(l)) { if (n.size > 1) n.delete(l) } else n.add(l); return n })}
                        className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${on ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}>
                        {t(`adz.layout.${l}`)}
                      </button>
                    )
                  })}
                </div>
                <div className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('adz.opt.palettes')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {PALETTES.map((p, pi) => {
                    const on = palettesOn.has(pi)
                    return (
                      <button key={pi} type="button"
                        onClick={() => setPalettesOn((prev) => { const n = new Set(prev); if (n.has(pi)) { if (n.size > 1) n.delete(pi) } else n.add(pi); return n })}
                        className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition ${on ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}>
                        <span className="h-3 w-3 rounded-full border border-black/20" style={{ background: p.bg }} />
                        {t(`adz.pal.${pi}`)}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button type="button" onClick={generate} disabled={!canGenerate || generating}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-3 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {t('adz.generate.cta')}
              </button>
              {!hasImage && canGenerate && (
                <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500">{t('adz.noImageHint')}</p>
              )}
            </div>
          </div>
        )}

        {step === 'generate' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {variants.map((v) => {
              const on = selected.has(v.id)
              return (
                <div key={v.id} className={`group relative overflow-hidden rounded-xl border transition ${on ? 'border-gold ring-2 ring-gold/40' : 'border-line hover:border-line-strong'}`}>
                  <button type="button" onClick={() => toggle(v.id)} className="block w-full">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.dataUrl} alt="" className="w-full object-cover" style={{ aspectRatio: `${FORMATS[v.fmt].w} / ${FORMATS[v.fmt].h}` }} />
                  </button>
                  <span className={`absolute start-2 top-2 grid h-6 w-6 place-items-center rounded-md border text-ink ${on ? 'border-gold bg-gold' : 'border-white/40 bg-black/30'}`}>
                    {on && <Check className="h-4 w-4" />}
                  </span>
                  <button type="button" onClick={() => enhance(v)} disabled={!!enhancing}
                    className="absolute bottom-2 end-2 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 backdrop-blur transition group-hover:opacity-100 disabled:opacity-60">
                    {enhancing === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3 text-gold" />} {t('adz.actions.enhance')}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {step === 'qr' && finalUrl && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={finalUrl} alt="" className="max-h-[76vh] rounded-2xl border border-line object-contain" />
          </div>
        )}

        {step === 'caption' && (
          <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-[280px_1fr]">
            {finalUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={finalUrl} alt="" className="w-full rounded-2xl border border-line object-contain" />
            )}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('adz.caption.title')}</div>
              {captionBusy && !caption ? (
                <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 py-6 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t('adz.caption.busy')}
                </div>
              ) : (
                <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={12} dir="auto"
                  className={fieldClass('lg', 'min-h-[280px] resize-y leading-relaxed')} placeholder={t('adz.caption.ph')} />
              )}
            </div>
          </div>
        )}

        {step === 'preview' && finalUrl && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Feed mockup */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('adz.preview.feed')}</div>
              <div className="overflow-hidden rounded-2xl border border-line bg-white text-[#050505]">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-gold text-xs font-bold text-ink">F</span>
                  <div className="text-xs"><div className="font-semibold">Freehold Property</div><div className="text-[10px] text-neutral-500">Sponsored</div></div>
                </div>
                <div className="whitespace-pre-wrap px-3 pb-2 text-xs leading-relaxed" dir="auto">{caption.slice(0, 220)}{caption.length > 220 ? '…' : ''}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={finalUrl} alt="" className="w-full object-cover" />
                <div className="flex items-center justify-between bg-neutral-100 px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-neutral-600">{listing ? new URL(listing.landingUrl).hostname : 'freeholdproperty.ae'}</span>
                  <span className="rounded-md bg-neutral-200 px-3 py-1.5 text-[11px] font-bold">Learn more</span>
                </div>
              </div>
            </div>
            {/* Story mockup */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('adz.preview.story')}</div>
              <div className="relative mx-auto aspect-[9/16] max-w-[280px] overflow-hidden rounded-3xl border border-line bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={finalUrl} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gold text-[10px] font-bold text-ink">F</span>
                  <span className="text-[11px] font-semibold text-white">Freehold Property</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10 text-center">
                  <span className="rounded-full bg-white px-4 py-1.5 text-[11px] font-bold text-black">Learn more</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* From Drive — pick media made in the editors / Creative Studio */}
      <Modal open={driveOpen} onClose={() => setDriveOpen(false)} title={t('adz.source.drive')} maxWidth="max-w-2xl">
        {driveItems === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
          </div>
        ) : driveItems.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{t('adz.source.driveEmpty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {driveItems.map((item) => (
              <button key={item.id} type="button" onClick={() => pickDriveItem(item.url)}
                className="group overflow-hidden rounded-xl border border-line text-start transition hover:border-gold/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="aspect-square w-full object-cover" />
                <span className="block truncate px-2.5 py-1.5 text-[11px] text-slate-400 group-hover:text-slate-200">{item.title}</span>
              </button>
            ))}
          </div>
        )}
      </Modal>
    </DriveEditorFrame>
  )
}
