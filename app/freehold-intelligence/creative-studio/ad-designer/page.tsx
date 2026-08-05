'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import {
  Loader2, Upload, Sparkles, Check, Download, QrCode, MessageSquareText,
  Monitor, ArrowRight, ArrowLeft, RefreshCw, Save, ExternalLink, Megaphone, FolderOpen, FileText,
  ImagePlus, LayoutGrid, ChevronDown, Building2,
} from 'lucide-react'
import { DriveEditorFrame } from '@/components/freehold/drive/drive-editor-frame'
import { useLiveProjects, type LiveProject } from '@/lib/freehold/use-live-projects'
import { useT } from '@/lib/i18n/provider'
import { useBrand } from '@/components/whitelabel/brand-provider'
import { BRAND } from '@/lib/freehold/brand'
import { fieldClass, Modal } from '@/components/freehold/ui'
import { SUITE_COPY, type SuiteCopy, type SuiteLang } from '@/lib/freehold/creative-suite'
import { writeAdCopy, BRIEF_MAX } from '@/lib/freehold/ad-copy-writer'
import { BROCHURE_MAX_BYTES, postBrochureForParse } from '@/lib/freehold/parse-brochure-client'
import {
  PALETTES, LAYOUTS, FORMATS, composeVariant, stampQr, loadImage, fmtPrice, isRtl, ensureAdFonts, fitHeadline,
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
  const brand = useBrand()
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
  // Default to 3 of the 5 palettes: 5 layouts × 5 palettes = 25 full-res
  // canvases froze mid-range phones; 15 is the honest ceiling for one tap
  // (all five stay one tap away in the chips).
  const [palettesOn, setPalettesOn] = useState<Set<number>>(new Set([0, 1, 2]))
  const [generating, setGenerating] = useState(false)
  const [genStage, setGenStage] = useState(0)
  const [enhancing, setEnhancing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // The PLACEMENT SET that continues through QR → caption → preview: the
  // chosen design composed in ALL THREE formats (the picked one first). QR
  // stamping and saving apply to the whole set; previews show each
  // placement's true rendition.
  const [finalSet, setFinalSet] = useState<{ fmt: FormatKey; dataUrl: string }[]>([])
  const [composingSet, setComposingSet] = useState(false)
  const finalUrl = finalSet[0]?.dataUrl ?? null
  const fmtUrl = (f: FormatKey) => finalSet.find((x) => x.fmt === f)?.dataUrl ?? finalUrl
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

  // Everything the app filled in FOR the user — template sample copy, listing
  // facts, or the AI writer. A field still holding its auto-filled value is
  // ours to replace; a field the user typed is theirs and is never touched.
  // (The old check compared the WHOLE overlay, so editing one word froze every
  // other field at the placeholder — a picked listing's real price then never
  // reached the ad.)
  const autoFilled = useRef<Partial<Overlay>>({})
  const isOurs = (prev: Overlay, k: keyof Overlay) => prev[k] === '' || prev[k] === autoFilled.current[k]

  // Deep-link seeding from the Creative Suite: /creative-studio/ad-designer?format=story
  // (&layout=frame&palette=1&copy=monthly&lang=ar) opens with that recipe AND
  // its sample copy — in the AD's language, whatever the dashboard is set to.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    const f = sp.get('format') as FormatKey | null
    // Object index would accept 'constructor'/'toString' and set an invalid
    // format, which composes a NaN-sized canvas.
    if (f && (Object.keys(FORMATS) as FormatKey[]).includes(f)) setFormat(f)
    const l = sp.get('layout') as LayoutKey | null
    if (l && LAYOUTS.includes(l)) setLayoutsOn(new Set([l]))
    const p = sp.get('palette')
    if (p !== null && /^\d+$/.test(p) && PALETTES[Number(p)]) setPalettesOn(new Set([Number(p)]))
    const copy = sp.get('copy') as SuiteCopy | null
    const lang = (sp.get('lang') as SuiteLang | null) ?? 'en'
    if (lang && SUITE_COPY[lang]) setAdLang(lang)
    if (copy && SUITE_COPY[lang]?.[copy]) {
      const sample = SUITE_COPY[lang][copy]
      autoFilled.current = { ...sample }
      setOverlay(sample)
    }
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

  // Prefill overlay text from the picked listing. Fields the user TYPED are
  // never overwritten — but untouched template sample copy is: a placeholder
  // must yield to the real project's facts.
  useEffect(() => {
    if (!listing) return
    // priceUnit is a currency LABEL, not a listing fact — an Arabic ad keeps
    // its "درهم" instead of being reset to "AED".
    const facts: Partial<Overlay> = {
      eyebrow: `${listing.area} · Dubai`,
      headline: listing.name,
      price: listing.priceAED ? fmtPrice(listing.priceAED) : '',
      footnote: listing.paymentPlan ?? '',
    }
    setOverlay((prev) => {
      const next = { ...prev }
      ;(Object.keys(facts) as (keyof Overlay)[]).forEach((k) => {
        const value = facts[k]
        if (!value || !isOurs(prev, k)) return
        next[k] = value
        autoFilled.current[k] = value
      })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId])

  function onUpload(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setUploadUrl(String(reader.result)); setListingId('') }
    reader.readAsDataURL(file)
  }

  // ── Describe the ad → the AI writes the on-image copy ──
  // Grounded like every other AI surface here: it may only use the facts we
  // hand it. Prices and dates it was not given must not be invented, and the
  // price field is never touched — that number is the listing's, not a
  // model's.
  const [describe, setDescribe] = useState('')
  const [describeBusy, setDescribeBusy] = useState(false)
  const [adLang, setAdLang] = useState<SuiteLang>('en')

  async function writeCopy() {
    const brief = describe.trim()
    if (!brief || describeBusy) return
    setDescribeBusy(true)
    try {
      const written = await writeAdCopy({
        brief,
        lang: adLang,
        // The price we pass is the one already on the creative — the writer is
        // told not to return one, so this number can only ever be the user's.
        facts: {
          project: listing?.name, area: listing?.area,
          price: overlay.price, priceUnit: overlay.priceUnit,
          paymentPlan: listing?.paymentPlan,
        },
      })
      // Writing can replace copy the user typed, so it is undoable.
      const before = overlay
      setOverlay((prev) => {
        const next = { ...prev }
        ;(Object.keys(written) as (keyof typeof written)[]).forEach((k) => {
          if (!written[k]) return
          next[k] = written[k]
          autoFilled.current[k] = written[k]
        })
        return next
      })
      toast.success(t('adz.describe.done'), {
        action: { label: t('ed.ai.undo'), onClick: () => setOverlay(before) },
      })
    } catch {
      toast.error(t('adz.describe.err'))
    } finally {
      setDescribeBusy(false)
    }
  }

  // "From brochure": the third source from the spec — a developer PDF goes
  // through the real brochure parser and its facts fill the overlay fields.
  // The parsed name/area are kept beyond the overlay: they ground the AI
  // imagery prompts below, so a brochure with no photo still gets real frames
  // of ITS project, not a generic tower.
  const [brochureBusy, setBrochureBusy] = useState(false)
  const brochureFacts = useRef<{ name?: string; area?: string }>({})
  const brochureRef = useRef<HTMLInputElement>(null)
  async function onBrochure(file: File | null) {
    if (!file || brochureBusy) return
    if (file.size > BROCHURE_MAX_BYTES) { toast.error(t('lm.pdf.tooLarge')); return }
    setBrochureBusy(true)
    try {
      // ≤4.3MB posts FormData; larger files upload browser → Vercel Blob first
      // (the platform caps request bodies at ~4.5MB), then parse by {url}.
      const res = await postBrochureForParse(file)
      const d = await res.json().catch(() => ({}))
      const b = d?.data as { name?: string; area?: string; developer?: string; priceFrom?: number | null; paymentPlan?: string } | undefined
      if (!res.ok || !b) { toast.error(d?.error || t('adz.source.brochureFail')); return }
      brochureFacts.current = { name: b.name || undefined, area: b.area || undefined }
      // Fill only fields the user hasn't typed — same contract as the listing
      // prefill: an upload must never overwrite written copy.
      setOverlay((prev) => ({
        eyebrow: prev.eyebrow || (b.area ? `${b.area} · Dubai` : b.developer || ''),
        headline: prev.headline || b.name || '',
        price: prev.price || (b.priceFrom ? fmtPrice(b.priceFrom) : ''),
        priceUnit: prev.priceUnit || 'AED',
        footnote: prev.footnote || b.paymentPlan || '',
      }))
      setListingId('')
      toast.success(t('adz.source.brochureDone'))
    } catch (err) {
      // Honest failure: a Blob upload error (e.g. missing BLOB_READ_WRITE_TOKEN)
      // carries the real reason — show it, never a generic mystery.
      toast.error(err instanceof Error && err.message ? err.message : t('adz.source.brochureFail'))
    } finally { setBrochureBusy(false) }
  }

  // ── AI imagery: generated frames as a fourth source ──
  // Two grounded generations per tap — a golden-hour exterior and a designer
  // interior of the ACTUAL project (listing pick, parsed brochure, or the
  // typed headline as a last resort). Each success lands as a pickable frame;
  // a failure degrades honestly (the server's message is shown, whatever
  // succeeded stays usable). The route saves every generation to the Library
  // itself, so frames also appear in Drive.
  const [frames, setFrames] = useState<{ id: string; url: string }[]>([])
  const [framesBusy, setFramesBusy] = useState(false)
  const [framesNote, setFramesNote] = useState('')
  const frameSeq = useRef(0)

  async function generateFrames() {
    if (framesBusy) return
    const name = listing?.name || brochureFacts.current.name || overlay.headline.trim()
    const area = listing?.area || brochureFacts.current.area || ''
    if (!name) { toast.info(t('adz.frames.needFacts')); return }
    setFramesBusy(true)
    setFramesNote('')
    const site = `${name}${area ? `, ${area}` : ''}, Dubai`
    const prompts = [
      `Photorealistic golden-hour exterior of ${site} — a luxury residence. Ultra-high-end real-estate marketing photo, cinematic light, no text, no watermarks, no people.`,
      `Bright designer living interior of a residence at ${site} — floor-to-ceiling windows, city view. Ultra-high-end real-estate marketing photo, no text, no watermarks, no people.`,
    ]
    let made = 0
    let lastErr = ''
    for (const p of prompts) {
      try {
        const res = await fetch('/api/freehold/creative-studio/generate-image', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: p, aspectRatio: '9:16', title: `${name} — ad frame`.slice(0, 80) }),
        })
        const d = await res.json().catch(() => null)
        if (!res.ok || !d?.url) throw new Error(d?.error || t('adz.frames.err'))
        setFrames((prev) => [...prev, { id: `frame-${++frameSeq.current}`, url: d.url }])
        made++
      } catch (err) {
        lastErr = err instanceof Error ? err.message.slice(0, 160) : t('adz.frames.err')
      }
    }
    if (made === 0) { setFramesNote(lastErr); toast.error(lastErr) }
    else if (lastErr) { setFramesNote(lastErr); toast.success(t('adz.frames.partial')) }
    else toast.success(t('adz.frames.done'))
    setFramesBusy(false)
  }

  // Unlike a Drive pick, choosing a frame KEEPS the listing selection — the
  // frame replaces only the photo; the listing's facts still ground the
  // caption and the campaign link.
  const pickFrame = (url: string) => setUploadUrl(url)

  // A photo is optional now: without one the engine draws a styled placeholder
  // ground, and Enhance (img2img) can paint a real scene over it.
  const hasImage = !!listingId || !!uploadUrl
  const canGenerate = !!overlay.headline.trim()

  // The fit measurement is only meaningful once the ad face has resolved.
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => { ensureAdFonts().then(() => setFontsReady(true)) }, [])

  // ── Live stage preview ──
  // The center canvas is never empty: the CURRENT design (first enabled
  // layout + palette, current format, current copy and photo) is composed
  // live by the same engine that exports — at half scale, debounced, so
  // typing stays smooth. With no photo yet the engine's styled ghost ground
  // makes the layout readable instead of showing a blank form.
  const [livePreview, setLivePreview] = useState<string | null>(null)
  useEffect(() => {
    if (step !== 'source') return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        let img: HTMLImageElement | null = null
        const src = uploadUrl ?? listing?.heroImage ?? null
        if (src) { try { img = await loadImage(src, !src.startsWith('data:')) } catch { img = null } }
        if (cancelled) return
        const layout = LAYOUTS.find((l) => layoutsOn.has(l)) ?? 'heroPrice'
        const pi = PALETTES.findIndex((_, i) => palettesOn.has(i))
        setLivePreview(composeVariant(img, layout, PALETTES[pi === -1 ? 0 : pi], overlay, format, 0.5))
      } catch { /* the preview is a nicety — composing the real set still reports errors */ }
    }, 250)
    return () => { cancelled = true; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, uploadUrl, listingId, overlay, format, layoutsOn, palettesOn, fontsReady, frames])

  // Truthful truncation warning: the SAME measurement the renderer uses, run
  // against every selected layout, so the editor can say which design will cut
  // the headline instead of guessing at a character limit.
  const headlineWarning = useMemo(() => {
    const text = overlay.headline.trim()
    if (!text) return null
    // Continue composes ALL three formats from this copy, and heroPrice allows
    // 3 lines at feed/story but only 2 at square — so checking just the
    // selected format told the user it fit and then cut it anyway.
    const cut: string[] = []
    for (const l of LAYOUTS) {
      if (!layoutsOn.has(l)) continue
      for (const f of Object.keys(FORMATS) as FormatKey[]) {
        if (fitHeadline(text, l, f).truncated) cut.push(`${t(`adz.layout.${l}`)} · ${t(`adz.format.${f}`)}`)
      }
    }
    if (cut.length === 0) return null
    return t('adz.field.headlineCut', { layouts: cut.slice(0, 3).join(', ') + (cut.length > 3 ? ' …' : '') })
    // fontsReady is a dep because the measurement depends on the resolved face.
  }, [overlay.headline, layoutsOn, t, fontsReady])

  async function generate() {
    if (!canGenerate || generating) return
    setGenerating(true)
    setGenStage(1)
    await ensureAdFonts()
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
          // Yield after EVERY compose — each is a full-res canvas + PNG encode
          // on the main thread; back-to-back bursts freeze mid-range phones.
          await new Promise((r) => setTimeout(r, 0))
        }
        setGenStage((s) => Math.min(s + 1, 4))
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

  // Design once → the full placement set: the chosen layout + palette
  // composed in ALL formats the engine knows, from the same source. The picked
  // variant keeps its exact pixels (including any AI Enhance); the other
  // formats are engine-composed fresh from the source photo.
  async function composeSet(first: Variant): Promise<{ fmt: FormatKey; dataUrl: string }[]> {
    await ensureAdFonts()
    let img: HTMLImageElement | null = null
    const src = uploadUrl ?? listing?.heroImage ?? null
    if (src) { try { img = await loadImage(src, !src.startsWith('data:')) } catch { img = null } }
    const order: FormatKey[] = [first.fmt, ...(Object.keys(FORMATS) as FormatKey[]).filter((f) => f !== first.fmt)]
    const set: { fmt: FormatKey; dataUrl: string }[] = []
    for (const f of order) {
      set.push({
        fmt: f,
        dataUrl: f === first.fmt ? first.dataUrl : composeVariant(img, first.layout, PALETTES[first.palette], overlay, f),
      })
      await new Promise((r) => setTimeout(r, 0))
    }
    return set
  }

  async function continueToQr() {
    const first = variants.find((v) => selected.has(v.id))
    if (!first) { toast.info(t('adz.pickFirst')); return }
    if (composingSet) return
    setComposingSet(true)
    try {
      setFinalSet(await composeSet(first))
      setQrApplied(false)
      setStep('qr')
    } catch {
      toast.error(t('adz.err.compose'))
    } finally {
      setComposingSet(false)
    }
  }

  // "Generate full set" — the one-tap outcome: the picked design composed in
  // EVERY placement format, each saved to the Library, then straight to the
  // preview grid where each PNG has its own download. QR and caption stay one
  // Back away for anyone who needs them.
  const [fullSetBusy, setFullSetBusy] = useState(false)
  async function generateFullSet() {
    const first = variants.find((v) => selected.has(v.id))
    if (!first) { toast.info(t('adz.pickFirst')); return }
    if (fullSetBusy || composingSet) return
    setFullSetBusy(true)
    try {
      const set = await composeSet(first)
      setFinalSet(set)
      setQrApplied(false)
      let ok = 0
      for (const item of set) {
        const res = await fetch('/api/freehold/drive/save-image', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: `${overlay.headline.slice(0, 60)} — final ad (${FMT_LABEL[item.fmt]})`, dataUrl: item.dataUrl }),
        }).catch(() => null)
        if (res?.ok) ok++
      }
      if (ok === set.length) toast.success(t('adz.fullset.saved'))
      else if (ok > 0) toast.error(t('adz.err.savePartial'))
      else toast.error(t('adz.err.save'))
      setStep('preview')
    } catch {
      toast.error(t('adz.err.compose'))
    } finally {
      setFullSetBusy(false)
    }
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
    if (finalSet.length === 0 || !qrImage || qrBusy) return
    setQrBusy(true)
    try {
      // The permit QR is compliance — it goes on EVERY placement, not just
      // the one being previewed.
      const stamped: { fmt: FormatKey; dataUrl: string }[] = []
      for (const item of finalSet) {
        stamped.push({ fmt: item.fmt, dataUrl: await stampQr(item.dataUrl, qrImage, qrCorner, qrPct) })
      }
      setFinalSet(stamped)
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

  const FMT_LABEL: Record<FormatKey, string> = { feed: 'Feed 4:5', square: 'Square 1:1', story: 'Story 9:16' }

  async function saveFinal() {
    if (finalSet.length === 0 || saving) return
    setSaving(true)
    let ok = 0
    for (const item of finalSet) {
      const res = await fetch('/api/freehold/drive/save-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `${overlay.headline.slice(0, 60)} — final ad (${FMT_LABEL[item.fmt]})`, dataUrl: item.dataUrl }),
      }).catch(() => null)
      if (res?.ok) ok++
    }
    setSaving(false)
    if (ok === finalSet.length) toast.success(t('adz.savedFinal'))
    else if (ok > 0) toast.error(t('adz.err.savePartial'))
    else toast.error(t('adz.err.save'))
  }

  function downloadSet() {
    finalSet.forEach((item) => download(item.dataUrl, `ad-${item.fmt}.png`))
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  // ── Left rail: SOURCES as visual cards + the filmstrip ────────────────────
  const [projOpen, setProjOpen] = useState(false)
  const activeSrc = uploadUrl ?? listing?.heroImage ?? null
  const filmstrip = Array.from(new Set(
    [listing?.heroImage, uploadUrl, ...frames.map((f) => f.url)].filter(Boolean) as string[],
  ))

  const sourcesRail = (
    <div className="space-y-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('adz.sources.title')}</div>
      <div className="grid grid-cols-2 gap-1.5">
        <SourceCard Icon={Building2} label={t('adz.source.project')} active={!!listingId}
          onClick={() => setProjOpen((o) => !o)} />
        <SourceCard Icon={FileText} label={t('adz.source.brochure')} busy={brochureBusy}
          active={!!brochureFacts.current.name} onClick={() => brochureRef.current?.click()} />
        <SourceCard Icon={Upload} label={t('adz.source.upload')}
          active={!!uploadUrl && !frames.some((f) => f.url === uploadUrl)}
          onClick={() => fileRef.current?.click()} />
        <SourceCard Icon={FolderOpen} label={t('adz.source.drive')} onClick={openDrivePicker} />
        <div className="col-span-2">
          <SourceCard Icon={ImagePlus} label={t('adz.frames.cta')} busy={framesBusy}
            active={frames.length > 0} onClick={generateFrames} wide />
        </div>
      </div>
      {projOpen && (
        <select value={listingId} onChange={(e) => { setListingId(e.target.value); if (e.target.value) setUploadUrl(null) }} className={fieldClass('sm')}>
          <option value="">—</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <p className="text-[10px] leading-relaxed text-slate-500">{t('adz.frames.note')}</p>
      {framesNote && <p className="text-[10px] leading-relaxed text-amber-300">{framesNote}</p>}
      {filmstrip.length > 0 && (
        <div className="border-t border-line pt-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{t('adz.filmstrip.title')}</div>
          <div className="grid grid-cols-3 gap-1.5">
            {filmstrip.map((url) => (
              <button key={url} type="button"
                onClick={() => setUploadUrl(url === listing?.heroImage ? null : url)}
                className={`relative aspect-square overflow-hidden rounded-lg border transition ${activeSrc === url ? 'border-gold ring-2 ring-gold/40' : 'border-line opacity-80 hover:opacity-100'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="text-[11px] leading-relaxed text-slate-500">{t('adz.source.hint')}</p>
    </div>
  )

  // ── Right inspector: Copy · Design · Output ───────────────────────────────
  const inspector = (
    <div className="space-y-3">
      <InspectorSection label={t('adz.insp.copy')}>
        <div className="space-y-3">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('adz.describe.title')}</span>
              <div className="flex gap-1">
                {(['en', 'ar', 'ru'] as SuiteLang[]).map((l) => (
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
              className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-gold/35 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50">
              {describeBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {describeBusy ? t('adz.describe.working') : t('adz.describe.cta')}
            </button>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">{t('adz.describe.note')}</p>
          </div>
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
            <textarea value={overlay.headline} onChange={(e) => setOverlay({ ...overlay, headline: e.target.value })}
              placeholder={t('adz.field.headlinePh')} rows={2}
              className={fieldClass('sm', 'resize-y font-semibold leading-snug')} dir="auto" />
            {headlineWarning && (
              <span className="mt-1 block text-[10px] leading-snug text-amber-300">{headlineWarning}</span>
            )}
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
      </InspectorSection>

      <InspectorSection label={t('adz.insp.design')}>
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('adz.opt.layouts')}</div>
        <div className="flex flex-wrap gap-1.5">
          {LAYOUTS.map((l) => {
            const on = layoutsOn.has(l)
            return (
              <button key={l} type="button"
                onClick={() => setLayoutsOn((prev) => { const n = new Set(prev); if (n.has(l)) { if (n.size > 1) n.delete(l) } else n.add(l); return n })}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${on ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-400 hover:text-slate-200'}`}>
                {t(`adz.layout.${l}`)}
              </button>
            )
          })}
        </div>
        <div className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('adz.opt.palettes')}</div>
        <div className="flex flex-wrap gap-2">
          {PALETTES.map((p, pi) => {
            const on = palettesOn.has(pi)
            return (
              <button key={pi} type="button" title={t(`adz.pal.${pi}`)} aria-label={t(`adz.pal.${pi}`)} aria-pressed={on}
                onClick={() => setPalettesOn((prev) => { const n = new Set(prev); if (n.has(pi)) { if (n.size > 1) n.delete(pi) } else n.add(pi); return n })}
                className={`h-7 w-7 rounded-full border transition ${on ? 'border-gold ring-2 ring-gold/40' : 'border-line-strong opacity-70 hover:opacity-100'}`}
                style={{ background: `linear-gradient(135deg, ${p.bg} 55%, ${p.accent} 55%)` }} />
            )
          })}
        </div>
      </InspectorSection>

      <InspectorSection label={t('adz.insp.output')}>
        <button type="button" data-close-sheet onClick={generate} disabled={!canGenerate || generating}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {t('adz.generate.cta')}
        </button>
        {!hasImage && canGenerate && (
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{t('adz.noImageHint')}</p>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{t('adz.source.desc')}</p>
      </InspectorSection>
    </div>
  )

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

      {step === 'source' && (
        <>
          {sourcesRail}
          {/* Below xl the right inspector column is hidden — the same
              inspector mounts here so tablet and the mobile sheet keep every
              control. Inputs are controlled, so both copies stay in sync. */}
          <div className="border-t border-line pt-3 xl:hidden">{inspector}</div>
        </>
      )}

      {step === 'generate' && (
        <div className="space-y-2.5">
          <p className="text-[11px] leading-relaxed text-slate-500">{t('adz.select.hint')}</p>
          <div className="text-xs font-semibold text-slate-200">{t('adz.select.count', { n: selected.size })}</div>
          {/* The one-tap outcome is the PRIMARY action: pick → every placement
              composed, saved to Drive, downloadable from the tray. */}
          <button type="button" data-close-sheet onClick={generateFullSet} disabled={selected.size === 0 || fullSetBusy || composingSet}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
            {fullSetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutGrid className="h-4 w-4" />}
            {fullSetBusy ? t('adz.fullset.working') : t('adz.fullset.cta')}
          </button>
          <p className="text-[10px] leading-snug text-slate-500">{t('adz.fullset.note')}</p>
          <button type="button" data-close-sheet onClick={continueToQr} disabled={selected.size === 0 || composingSet || fullSetBusy}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
            {composingSet ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {composingSet ? t('adz.set.composing') : t('adz.actions.continue')}
            {!composingSet && <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />}
          </button>
          <button type="button" onClick={() => saveSelected()} disabled={saving || selected.size === 0}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30 disabled:opacity-50">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t('adz.actions.save')}
          </button>
          <p className="text-[10px] leading-snug text-slate-500">{t('adz.set.note')}</p>
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
              {/* Wrapper owns the width — fieldClass bakes in w-full. */}
              <div className="min-w-0 flex-1">
                <input value={qrLink} onChange={(e) => setQrLink(e.target.value)} placeholder={t('adz.qr.linkPh')} className={fieldClass('sm')} />
              </div>
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
                <button type="button" data-close-sheet onClick={applyQr} disabled={qrBusy}
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
          <button type="button" onClick={downloadSet}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-gold/30">
            <Download className="h-3.5 w-3.5" /> {t('adz.preview.download')}
          </button>
          <Link href={`/freehold-intelligence/lead-machine/campaigns/new${listingId ? `?project=${encodeURIComponent(listingId)}` : ''}`}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gold px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright">
            <Megaphone className="h-4 w-4" /> {t('adz.preview.campaign')}
          </Link>
          <button type="button" onClick={() => { setStep('source'); setVariants([]); setSelected(new Set()); setFinalSet([]); setCaption(''); setQrApplied(false) }}
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
    <DriveEditorFrame type="image" title={t('adz.title')} statusNote={t('adz.note')} toolRail={toolRail}
      aiRail={step === 'source' ? inspector : undefined}>
      {/* The hidden pickers mount ONCE at the frame level — the rail renders
          twice (desktop aside + mobile sheet), and duplicated file inputs
          would leave the refs pointing at an unmounted copy. */}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onUpload(e.target.files?.[0] ?? null); e.target.value = '' }} />
      <input ref={brochureRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { onBrochure(e.target.files?.[0] ?? null); e.target.value = '' }} />

      {step === 'source' && (
        /* THE STAGE — the live design is the hero. Same engine, half-scale,
           debounced; the format pills float above it and switch the frame. */
        <div className="relative flex min-h-full flex-col items-center justify-center gap-4 px-4 py-8 sm:px-8">
          <div aria-hidden className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(60% 50% at 50% 45%, rgba(212,175,55,0.06), transparent 70%)' }} />
          <div className="relative z-10 inline-flex rounded-full border border-line bg-surface/80 p-1 shadow-lg shadow-black/30 backdrop-blur">
            {(Object.keys(FORMATS) as FormatKey[]).map((f) => (
              <button key={f} type="button" onClick={() => setFormat(f)}
                className={`rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition ${format === f ? 'bg-gold text-ink' : 'text-slate-400 hover:text-slate-200'}`}>
                {t(`adz.format.${f}`)}
              </button>
            ))}
          </div>
          <div className="relative z-10">
            {livePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={livePreview} alt="" className="max-h-[62vh] w-auto max-w-full rounded-2xl border border-line shadow-2xl shadow-black/60" />
            ) : (
              /* Same footprint as the composed frame — no layout jump when it lands. */
              <div className="grid animate-pulse place-items-center rounded-2xl border border-line bg-surface-2"
                style={{ height: '62vh', aspectRatio: `${FORMATS[format].w} / ${FORMATS[format].h}` }}>
                <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
              </div>
            )}
            {generating && (
              <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-black/70 backdrop-blur-sm">
                <div className="w-[min(80%,280px)]">
                  <div className="flex justify-between text-[10px] text-slate-400">
                    {genStages.map((s, i) => (
                      <span key={s} className={i < genStage ? 'text-emerald-300' : i === genStage ? 'text-gold' : ''}>{s}</span>
                    ))}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${(genStage / 4) * 100}%` }} />
                  </div>
                </div>
              </div>
            )}
          </div>
          <p className="relative z-10 text-[11px] text-slate-500">{t('adz.stage.note')} · {FORMATS[format].w}×{FORMATS[format].h}</p>
        </div>
      )}

      {step !== 'source' && (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
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
                  <div className="text-xs"><div className="font-semibold">{brand.name}</div><div className="text-[10px] text-neutral-500">{t('adz.preview.sponsored')}</div></div>
                </div>
                <div className="whitespace-pre-wrap px-3 pb-2 text-xs leading-relaxed" dir="auto">{caption.slice(0, 220)}{caption.length > 220 ? '…' : ''}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fmtUrl('feed') ?? undefined} alt="" className="w-full object-cover" />
                <div className="flex items-center justify-between bg-neutral-100 px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-neutral-600">{listing ? new URL(listing.landingUrl).hostname : BRAND.domain}</span>
                  <span className="rounded-md bg-neutral-200 px-3 py-1.5 text-[11px] font-bold">{t('adz.preview.learnMore')}</span>
                </div>
              </div>
            </div>
            {/* Story mockup */}
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('adz.preview.story')}</div>
              <div className="relative mx-auto aspect-[9/16] max-w-[280px] overflow-hidden rounded-3xl border border-line bg-black">
                {/* The REAL 9:16 rendition — not the feed design cropped. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fmtUrl('story') ?? undefined} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent p-3">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-gold text-[10px] font-bold text-ink">F</span>
                  <span className="text-[11px] font-semibold text-white">{brand.name}</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10 text-center">
                  <span className="rounded-full bg-white px-4 py-1.5 text-[11px] font-bold text-black">{t('adz.preview.learnMore')}</span>
                </div>
              </div>
            </div>

            {/* Deliverables tray — every placement as a framed card */}
            <div className="lg:col-span-2">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('adz.set.title')}</div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {finalSet.map((item) => (
                  <div key={item.fmt} className="group w-44 shrink-0 overflow-hidden rounded-xl border border-line bg-surface shadow-lg shadow-black/20 transition hover:border-gold/40">
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.dataUrl} alt="" className="w-full object-cover"
                        style={{ aspectRatio: `${FORMATS[item.fmt].w} / ${FORMATS[item.fmt].h}` }} />
                      <span className="absolute start-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                        {t(`adz.format.${item.fmt}`)}
                      </span>
                    </div>
                    <button type="button" onClick={() => download(item.dataUrl, `ad-${item.fmt}.png`)}
                      className="flex w-full items-center justify-center gap-1.5 border-t border-line px-2 py-2 text-[11px] font-semibold text-slate-200 transition hover:bg-gold/10 hover:text-gold">
                      <Download className="h-3 w-3" /> {t('adz.preview.download')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      )}

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

// ── Studio primitives ────────────────────────────────────────────────────────

/** Collapsible inspector section with an uppercase micro-label. */
function InspectorSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details open className="group border-t border-line pt-3 first:border-t-0 first:pt-0">
      <summary className="flex cursor-pointer select-none list-none items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition hover:text-slate-300 [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" />
      </summary>
      <div className="mt-2.5">{children}</div>
    </details>
  )
}

/** A source as a visual card — icon over label, gold when active. */
function SourceCard({ Icon, label, active, busy, wide, onClick }: {
  Icon: React.ElementType
  label: string
  active?: boolean
  busy?: boolean
  wide?: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className={`flex w-full items-center justify-center gap-1.5 rounded-xl border p-2.5 text-center transition ${wide ? '' : 'flex-col'} ${active ? 'border-gold/50 bg-gold/10 text-gold' : 'border-line bg-surface-2/60 text-slate-300 hover:border-gold/30'} disabled:opacity-60`}>
      {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Icon className="h-4 w-4 shrink-0" />}
      <span className="text-[10px] font-semibold leading-tight">{label}</span>
    </button>
  )
}
