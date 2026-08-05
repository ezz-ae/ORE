'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Sparkles, Loader2, ExternalLink, RefreshCw, Eye, EyeOff, FlaskConical, CheckCircle2, AlertTriangle, XCircle, X, Wand2, ChevronDown, ChevronUp, Layers, Copy, Trash2, GripVertical, Undo2, Redo2, Pencil, CalendarClock, TrendingUp, PackageX, Crosshair, Download } from 'lucide-react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { useT, useI18n } from '@/lib/i18n/provider'
import { registerExpertEditor, unregisterExpertEditor, sendToExpert, openExpert, type ExpertEditorSurface } from '@/lib/freehold/expert-bus'
import { useSession } from '@/lib/freehold/use-session'
import { useAutosaveDraft } from '@/lib/freehold/use-autosave-draft'
import { Send } from 'lucide-react'
import { LANDING_TEMPLATES } from '@/lib/landing-templates'

type Landing = {
  slug: string
  projectSlug: string
  headline: string
  subheadline: string
  heroImage: string
  ctaText: string
  status: 'draft' | 'published' | 'archived'
  publishFrom: string
  publishTo: string
  autoUpdatePricing: boolean
  seoTitle: string
  seoDescription: string
  ogImage: string
  updatedAt: string | null
  sections?: LpSection[]
}

type LpSection = { type: string; data: Record<string, unknown> }


// Wireframe schematic per section type — shows the SHAPE of a section before
// it is added (title bars, tile grids, form fields), never fake content.
function SectionThumb({ type }: { type: string }) {
  const bar = (w: string, h = 'h-1.5') => <div className={`${h} ${w} rounded-full bg-slate-600`} />
  const tile = (n: number, cols: string, ratio = 'h-6') =>
    <div className={`grid ${cols} gap-1`}>{Array.from({ length: n }, (_, i) => <div key={i} className={`${ratio} rounded bg-slate-700/70`} />)}</div>
  let body: React.ReactNode
  switch (type) {
    case 'hero': body = <div className="space-y-1.5">{bar('w-3/4', 'h-2.5')}{bar('w-1/2')}<div className="h-3 w-16 rounded-full bg-gold/60" /></div>; break
    case 'gallery': body = tile(6, 'grid-cols-3'); break
    case 'units': body = <div className="space-y-1">{tile(3, 'grid-cols-1', 'h-3.5')}</div>; break
    case 'key-facts': body = tile(4, 'grid-cols-4', 'h-7'); break
    case 'payment-plan': body = tile(3, 'grid-cols-3', 'h-8'); break
    case 'roi': body = <div className="flex gap-1"><div className="h-10 w-1/3 rounded bg-gold/40" /><div className="flex-1">{tile(3, 'grid-cols-3', 'h-10')}</div></div>; break
    case 'why-dubai': body = tile(6, 'grid-cols-3', 'h-5'); break
    case 'golden-visa': body = <div className="space-y-1.5"><div className="h-3 w-10 rounded-full bg-gold/50" />{bar('w-5/6')}{bar('w-2/3')}</div>; break
    case 'amenities': body = <div className="flex flex-wrap gap-1">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-2.5 w-9 rounded-full bg-slate-700/70" />)}</div>; break
    case 'location': body = <div className="space-y-1.5"><div className="h-7 w-full rounded bg-slate-700/70" />{bar('w-2/3')}{bar('w-1/2')}</div>; break
    case 'developer-profile': body = <div className="flex gap-2"><div className="h-7 w-7 rounded-full bg-slate-600" /><div className="flex-1 space-y-1.5 pt-1">{bar('w-3/4')}{bar('w-1/2')}</div></div>; break
    case 'social-proof': body = tile(3, 'grid-cols-3', 'h-9'); break
    case 'market-intelligence': body = <div className="rounded border border-slate-700 p-1.5">{bar('w-5/6')}<div className="mt-1" />{bar('w-2/3')}</div>; break
    case 'ai-concierge': body = <div className="space-y-1"><div className="h-3 w-2/3 rounded-lg rounded-bl-none bg-slate-700/70" /><div className="ms-auto h-3 w-1/2 rounded-lg rounded-br-none bg-gold/40" /></div>; break
    case 'faq': body = <div className="space-y-1">{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex items-center justify-between rounded border border-slate-700 px-1.5 py-1">{bar('w-2/3', 'h-1')}<span className="text-[8px] text-slate-500">＋</span></div>)}</div>; break
    case 'download-brochure': body = <div className="flex items-center justify-between rounded border border-gold/30 bg-gold/[0.06] px-2 py-2">{bar('w-1/2')}<div className="h-3 w-10 rounded-full bg-gold/60" /></div>; break
    case 'lead-form': body = <div className="space-y-1">{tile(2, 'grid-cols-1', 'h-3')}<div className="h-3 w-14 rounded-full bg-gold/60" /></div>; break
    case 'neighborhood': case 'description': default: body = <div className="space-y-1.5">{bar('w-1/3', 'h-2')}{bar('w-full')}{bar('w-5/6')}{bar('w-2/3')}</div>
  }
  return <div className="rounded-lg border border-line bg-[#0c0d12] p-2.5">{body}</div>
}

type LpCheck = { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string }
type TestReport = { ok: boolean; url?: string; passed?: number; warned?: number; failed?: number; checks: LpCheck[] }

// Fields the AI edit panel is allowed to touch — must match the ai-edit route.
const AI_FIELDS = ['headline', 'subheadline', 'ctaText', 'seoTitle', 'seoDescription'] as const
type AiField = (typeof AI_FIELDS)[number]
type AiTurn = { instruction: string; note: string; fields: AiField[] }

// ── Per-type block fields ─────────────────────────────────────────────────────
// Mirrors EXACTLY what the live page renders per section (app/lp/[slug]/page.tsx)
// so every visible word of every content block is editable here. `alt` lists the
// alternate data keys the renderer also accepts — we edit whichever one the
// section already stores.
type FieldDef =
  | { kind: 'text' | 'long' | 'number' | 'lines'; key: string; alt?: string[] }
  | { kind: 'pairs'; key: string; alt?: string[]; a: string; b: string; bAlt?: string[]; bLong?: boolean }

const TITLE: FieldDef = { kind: 'text', key: 'title' }
const SUBTITLE: FieldDef = { kind: 'long', key: 'subtitle' }

const SECTION_FIELDS: Record<string, FieldDef[]> = {
  hero: [TITLE, SUBTITLE, { kind: 'text', key: 'eyebrow' }, { kind: 'lines', key: 'chips' }],
  description: [TITLE, { kind: 'long', key: 'body', alt: ['description', 'content'] }, { kind: 'lines', key: 'highlights' }],
  gallery: [TITLE, { kind: 'lines', key: 'labels', alt: ['rooms', 'views'] }, { kind: 'lines', key: 'images', alt: ['photos', 'gallery'] }],
  units: [TITLE],
  'key-facts': [{ kind: 'pairs', key: 'items', a: 'label', b: 'value' }],
  'payment-plan': [
    { kind: 'number', key: 'downPayment' }, { kind: 'number', key: 'duringConstruction' },
    { kind: 'number', key: 'onHandover' }, { kind: 'number', key: 'postHandover' },
  ],
  roi: [{ kind: 'number', key: 'rentalYield', alt: ['expectedRoi'] }, { kind: 'number', key: 'startPriceAed' }],
  location: [
    { kind: 'text', key: 'area' }, TITLE, SUBTITLE,
    { kind: 'pairs', key: 'distances', alt: ['landmarks'], a: 'label', b: 'time', bAlt: ['distance', 'value'] },
    { kind: 'lines', key: 'highlights' },
  ],
  'why-dubai': [], // fully standard, pre-translated content — nothing to edit
  'golden-visa': [{ kind: 'lines', key: 'benefits' }, { kind: 'text', key: 'threshold' }],
  amenities: [{ kind: 'lines', key: 'items' }],
  'developer-profile': [
    { kind: 'text', key: 'name', alt: ['developer'] },
    { kind: 'long', key: 'description', alt: ['about'] },
    { kind: 'pairs', key: 'stats', a: 'label', b: 'value' },
  ],
  'social-proof': [{ kind: 'pairs', key: 'testimonials', alt: ['items'], a: 'name', b: 'quote', bLong: true }],
  neighborhood: [{ kind: 'text', key: 'area' }, { kind: 'long', key: 'description', alt: ['body', 'about'] }, { kind: 'lines', key: 'highlights' }],
  'market-intelligence': [{ kind: 'long', key: 'summary' }, { kind: 'lines', key: 'bullets' }],
  'ai-concierge': [TITLE, SUBTITLE, { kind: 'lines', key: 'prompts' }],
  faq: [{ kind: 'pairs', key: 'items', a: 'question', b: 'answer', bLong: true }],
  'download-brochure': [TITLE, SUBTITLE],
  'lead-form': [TITLE, SUBTITLE],
}
const DEFAULT_FIELDS: FieldDef[] = [TITLE, SUBTITLE]
const fieldsFor = (type: string): FieldDef[] => SECTION_FIELDS[type] ?? DEFAULT_FIELDS
const asStr = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))

// ── Trackable QR code (offline/roadshow attribution) ────────────────────────
// The public host is resolved server-side via lib/site.ts's getSiteUrl() (the
// app's canonical-domain helper — same one the agent-profile QR code uses)
// and handed to this client component through the landing-load API response
// (see `siteBaseUrl` state below). We deliberately do NOT read
// NEXT_PUBLIC_BASE_URL here: per .env.example that var is documented for
// internal API self-calls & emails (e.g. the Vercel deployment URL), not the
// public canonical domain a printed flyer's QR code needs — and reading any
// NEXT_PUBLIC_* var from client code also requires it to be baked in at
// *build* time to have any effect, which getSiteUrl() (called server-side, on
// every request) avoids.
const slugifyLabel = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
// utm_source=qr + utm_medium=offline is already recognized end-to-end by the
// lead-capture tracker and ROI reporting — no backend change needed here.
function buildQrTargetUrl(siteBaseUrl: string, slug: string, label: string) {
  const campaign = slugifyLabel(label)
  return `${siteBaseUrl}/lp/${slug}?utm_source=qr&utm_medium=offline${campaign ? `&utm_campaign=${encodeURIComponent(campaign)}` : ''}`
}

export default function LandingEditorPage() {
  const t = useT()
  const { dir } = useI18n()
  const params = useParams<{ slug: string }>()
  const slug = String(params?.slug || '')

  // Brokers can't edit the live page — they open it in PROPOSAL mode: a draft
  // copy they save + send for approval. Any non-broker account (Cor/Bashar/Yamen)
  // edits and publishes directly.
  const { ready: sessionReady, user } = useSession()
  const proposalMode = sessionReady && !!user && user.role === 'broker'
  const [requestId, setRequestId] = useState<string | null>(null)
  const [proposalNote, setProposalNote] = useState('')
  const [sending, setSending] = useState(false)
  // A fields-only proposal must NOT ship a full sections snapshot (which would
  // revert intervening layout edits on approve). Track whether the broker touched
  // the layout/section content, and only propose sections when they did.
  const [sectionsTouched, setSectionsTouched] = useState(false)

  const [form, setForm] = useState<Landing | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  // Publish-state menu — where the destructive action lives (never a toolbar button).
  const [moreOpen, setMoreOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [regen, setRegen] = useState(false)
  const [previewKey, setPreviewKey] = useState(0)
  // Trackable QR (offline/roadshow attribution) — optional campaign label,
  // client-generated PNG. Purely additive UI: no lead-capture/tracking change.
  // `siteBaseUrl` comes from the load() API response (server-resolved via
  // getSiteUrl() — see comment above buildQrTargetUrl); it's populated before
  // `loading` ever flips false, so the QR section never renders with a stale
  // fallback host.
  const [qrLabel, setQrLabel] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrBusy, setQrBusy] = useState(false)
  const [siteBaseUrl, setSiteBaseUrl] = useState('')
  const qrTargetUrl = buildQrTargetUrl(siteBaseUrl, slug, qrLabel)
  const previewRef = useRef<HTMLIFrameElement | null>(null)
  // Show WHERE a section lives: scroll the live preview to it and flash a ring.
  function locateSection(i: number) {
    previewRef.current?.contentWindow?.postMessage({ source: 'fh-lpe-editor', locate: i }, window.location.origin)
  }
  const [notFound, setNotFound] = useState(false)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<TestReport | null>(null)
  // All-green reports collapse to one line; issues auto-expand the list.
  const [testOpen, setTestOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(true)
  const [aiInstruction, setAiInstruction] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiTurns, setAiTurns] = useState<AiTurn[]>([])
  // One-level snapshot so an AI edit driven from the side chat is reversible.
  const [aiUndo, setAiUndo] = useState<{ fields: Record<AiField, string>; sections: LpSection[] } | null>(null)
  // Draft-everything: true once the user touches anything (fields or layout).
  const [edited, setEdited] = useState(false)
  // Unsaved landing edits autosave (and flush on tab close) → resumable from
  // the Drive "Continue editing" shelf. Cleared on Save/Publish.
  const { clearDraft } = useAutosaveDraft({
    kind: 'landing', refKey: slug, href: `/freehold-intelligence/inventory/landings/${slug}/edit`,
    title: form?.headline, active: edited, data: form ?? {},
  })

  // Overlay a broker's own resumable proposal (fields + sections) onto the live
  // content, so re-opening the editor picks up where they left off.
  const overlayDraft = (base: Landing, draft: { proposedFields?: Record<string, unknown>; proposedSections?: LpSection[] | null } | null): Landing => {
    if (!draft) return base
    const out: Landing = { ...base }
    const f = draft.proposedFields || {}
    for (const k of ['headline', 'subheadline', 'ctaText', 'seoTitle', 'seoDescription', 'heroImage'] as const) {
      if (typeof f[k] === 'string') out[k] = f[k] as string
    }
    if (Array.isArray(draft.proposedSections) && draft.proposedSections.length) out.sections = draft.proposedSections
    return out
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (proposalMode) {
        const res = await fetch(`/api/freehold/landing-edits/for-landing?slug=${encodeURIComponent(slug)}`, { cache: 'no-store' })
        const d = await res.json()
        if (res.ok && d.landing) {
          const draft = d.draft as { id: string; proposedFields?: Record<string, unknown>; proposedSections?: LpSection[] | null; note?: string | null } | null
          setForm(overlayDraft(d.landing as Landing, draft))
          setRequestId(draft?.id ?? null)
          setProposalNote(draft?.note ?? '')
          // A resumed draft that already carried section edits keeps proposing them.
          setSectionsTouched(Array.isArray(draft?.proposedSections) && (draft?.proposedSections?.length ?? 0) > 0)
          setEdited(false)
          if (typeof d.siteUrl === 'string' && d.siteUrl) setSiteBaseUrl(d.siteUrl)
        } else setNotFound(true)
        return
      }
      const res = await fetch(`/api/crm/landing-pages/${slug}`, { cache: 'no-store' })
      const d = await res.json()
      if (res.ok && d.landing) {
        setForm(d.landing as Landing)
        setEdited(false)
        if (typeof d.siteUrl === 'string' && d.siteUrl) setSiteBaseUrl(d.siteUrl)
      }
      else setNotFound(true)
    } catch { setNotFound(true) }
    finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, proposalMode])

  // Wait for the session so the right load path (proposal vs direct) runs once.
  useEffect(() => { if (slug && sessionReady) load() }, [slug, sessionReady, load])

  // On-canvas edits (stage 1): the preview iframe posts headline/subheadline
  // edits typed directly on the design. Update the form AND the stored hero
  // section (when one exists) so the saved page shows exactly what was typed.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return
      const d = e.data as { source?: string; field?: string; value?: string }
      if (d?.source !== 'fh-lpe' || typeof d.value !== 'string') return
      if (d.field !== 'headline' && d.field !== 'subheadline' && d.field !== 'ctaText') return
      const field = d.field
      const v = d.value.trim()
      setForm((prev) => {
        if (!prev) return prev
        // Only the hero's own texts mirror into the stored hero section — the
        // CTA is a top-level field with no section counterpart.
        if (field === 'ctaText') return { ...prev, ctaText: v }
        const heroKey = field === 'headline' ? 'title' : 'subtitle'
        const sections = Array.isArray(prev.sections)
          ? prev.sections.map((sec) => (sec.type === 'hero' ? { ...sec, data: { ...sec.data, [heroKey]: v } } : sec))
          : prev.sections
        return { ...prev, [field]: v, sections }
      })
      setEdited(true)
      if (field !== 'ctaText') setSectionsTouched(true)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // The landing test runs automatically on entry (staff editor only) — its
  // findings surface as the guidance panel, so nobody has to remember a button.
  const autoTested = useRef(false)
  useEffect(() => {
    if (form && !proposalMode && !autoTested.current) { autoTested.current = true; void runTest() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, proposalMode])

  function set<K extends keyof Landing>(k: K, v: Landing[K]) {
    setEdited(true)
    setForm((prev) => (prev ? { ...prev, [k]: v } : prev))
  }

  // Discard unsaved edits — reload the last saved state (only offered when dirty).
  function discard() {
    clearDraft()
    setEdited(false)
    void load()
  }

  async function save(nextStatus?: 'draft' | 'published' | 'archived') {
    if (!form) return
    setSaving(true)
    try {
      const res = await fetch(`/api/crm/landing-pages/${slug}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: nextStatus ?? form.status }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || t('lpe.saveFailed')); return }
      if (d.landing) setForm(d.landing as Landing)
      setEdited(false); clearDraft()
      setPreviewKey((k) => k + 1)
      toast.success(d.landing?.status === 'pending_publish' ? t('lpe.pendingPublish') : t('lpe.saved'))
    } catch { toast.error(t('lpe.saveFailed')) }
    finally { setSaving(false) }
  }

  // Broker proposal: save/send a DRAFT copy to the approval queue. Never touches
  // the live page — an approver publishes it. `submit` sends it for approval.
  async function saveProposal(submit: boolean) {
    if (!form) return
    if (submit) setSending(true); else setSaving(true)
    try {
      const res = await fetch('/api/freehold/landing-edits', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          landingSlug: slug,
          projectSlug: form.projectSlug || undefined,
          proposedFields: {
            headline: form.headline, subheadline: form.subheadline, ctaText: form.ctaText,
            seoTitle: form.seoTitle, seoDescription: form.seoDescription, heroImage: form.heroImage,
          },
          // Only include sections when the broker actually edited them — a
          // fields-only proposal leaves the live layout untouched on approve.
          proposedSections: sectionsTouched ? (form.sections ?? []) : undefined,
          note: proposalNote,
          submit,
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || t('lpe.saveFailed')); return }
      if (d.request?.id) setRequestId(d.request.id)
      setEdited(false); clearDraft()
      toast.success(submit ? t('lpe.proposal.sent') : t('lpe.proposal.savedDraft'))
    } catch { toast.error(t('lpe.saveFailed')) }
    finally { if (submit) setSending(false); else setSaving(false) }
  }

  async function regenerate() {
    if (!form) return
    setRegen(true)
    try {
      const res = await fetch('/api/crm/landing-pages/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectSlug: form.projectSlug || slug, slug, audience: 'generic' }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || d.detail || t('lpe.regenFailed')); return }
      await load()
      setPreviewKey((k) => k + 1)
      toast.success(t('lpe.regenDone'))
    } catch { toast.error(t('lpe.regenFailed')) }
    finally { setRegen(false) }
  }

  // Trackable QR — re-encodes client-side (same 'qrcode' package/options as the
  // permit QR in the drive image editor) whenever the target URL changes, i.e.
  // on mount and whenever the operator edits the campaign label.
  useEffect(() => {
    let cancelled = false
    setQrBusy(true)
    QRCode.toDataURL(qrTargetUrl, { margin: 1, width: 640, color: { dark: '#000000', light: '#ffffff' } })
      .then((url) => { if (!cancelled) setQrDataUrl(url) })
      .catch(() => { if (!cancelled) toast.error(t('lpe.qr.failed')) })
      .finally(() => { if (!cancelled) setQrBusy(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrTargetUrl])

  function downloadQrPng() {
    if (!qrDataUrl) return
    const campaign = slugifyLabel(qrLabel)
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `${slug}-qr${campaign ? `-${campaign}` : ''}.png`
    a.click()
  }

  function copyQrUrl() {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(qrTargetUrl).then(() => toast.success(t('lpe.qr.copied'))).catch(() => {})
  }

  // Delete the landing page — typed "delete" confirmation, then the page is
  // gone and the user returns to the landings list.
  async function doDelete() {
    if (deleteConfirm.trim().toLowerCase() !== 'delete') return
    setDeleting(true)
    try {
      const res = await fetch(`/api/crm/landing-pages/${slug}`, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error || t('lpe.del.failed')); setDeleting(false); return }
      toast.success(t('lpe.del.done'))
      window.location.href = '/freehold-intelligence/inventory/landings'
    } catch { toast.error(t('lpe.del.failed')); setDeleting(false) }
  }

  // Landing pre-flight — real server-side checks against the live /lp/<slug>.
  async function runTest() {
    setTesting(true)
    try {
      const res = await fetch(`/api/crm/landing-pages/${slug}/test`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || t('lpe.test.failed')); return }
      setTest(d as TestReport)
    } catch { toast.error(t('lpe.test.failed')) }
    finally { setTesting(false) }
  }

  // AI chat-to-edit — instruction → Gemini → concrete field edits applied live.
  // HEADLESS: the ONE Expert side chat is this page's instruction box (the
  // surface is registered below). Returns a factual summary the chat reports,
  // and snapshots the page first so the edit is reversible from the chat.
  async function askAi(raw?: string): Promise<{ ok: boolean; summary: string }> {
    const instruction = (raw ?? aiInstruction).trim()
    if (!instruction || !form || aiBusy) return { ok: false, summary: '' }
    setAiBusy(true)
    try {
      const res = await fetch(`/api/crm/landing-pages/${slug}/ai-edit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          current: {
            headline: form.headline,
            subheadline: form.subheadline,
            ctaText: form.ctaText,
            seoTitle: form.seoTitle,
            seoDescription: form.seoDescription,
          },
          sections: form.sections?.map((s) => s.type) ?? [],
        }),
      })
      const d = await res.json()
      if (res.status !== 200) { const m = d.error || t('lpe.ai.failed'); toast.error(m); return { ok: false, summary: m } }
      if (d.unavailable) { const m = t('lpe.ai.unavailable'); toast.error(m); return { ok: false, summary: m } }
      const changes = (d.changes ?? {}) as Partial<Record<AiField, string>>
      const applied = AI_FIELDS.filter((f) => typeof changes[f] === 'string' && changes[f])
      // Layout ops (reorder / show-hide sections) the AI proposed on the canvas.
      const layout = d.layout as { order?: string[]; hide?: string[]; show?: string[] } | undefined
      const layoutTouched = !!layout && ((layout.order?.length ?? 0) + (layout.hide?.length ?? 0) + (layout.show?.length ?? 0) > 0)
      if (applied.length === 0 && !layoutTouched) { const m = t('lpe.ai.noChanges'); toast.error(m); return { ok: false, summary: m } }
      // Snapshot the exact state BEFORE mutating so the chat can undo it.
      setAiUndo({
        fields: {
          headline: form.headline, subheadline: form.subheadline, ctaText: form.ctaText,
          seoTitle: form.seoTitle, seoDescription: form.seoDescription,
        },
        sections: form.sections ? form.sections.map((s) => ({ type: s.type, data: { ...s.data } })) : [],
      })
      for (const f of applied) set(f, changes[f] as string)
      if (layoutTouched && form.sections) {
        const order = layout!.order ?? []
        const hide = new Set(layout!.hide ?? [])
        const show = new Set(layout!.show ?? [])
        const idx = (ty: string) => { const k = order.indexOf(ty); return k === -1 ? 999 : k }
        const next = [...form.sections]
          .map((s, i) => ({ s, i }))
          .sort((a, b) => (order.length ? idx(a.s.type) - idx(b.s.type) || a.i - b.i : a.i - b.i))
          .map(({ s }) => (hide.has(s.type) ? { ...s, data: { ...s.data, _hidden: true } } : show.has(s.type) ? { ...s, data: { ...s.data, _hidden: false } } : s))
        setSections(next)
      }
      setAiTurns((prev) => [...prev, { instruction, note: String(d.note || ''), fields: applied }].slice(-5))
      setAiInstruction('')
      const summary = layoutTouched && applied.length === 0
        ? t('lpe.ai.layoutApplied')
        : t('lpe.ai.applied').replace('{count}', String(applied.length))
      toast.success(summary)
      return { ok: true, summary: d.note ? `${summary} — ${d.note}` : summary }
    } catch { const m = t('lpe.ai.failed'); toast.error(m); return { ok: false, summary: m } }
    finally { setAiBusy(false) }
  }

  // Reverse the last AI edit driven from the chat (fields + layout together).
  function undoAi(): boolean {
    if (!aiUndo || !form) return false
    setForm((prev) => (prev ? { ...prev, ...aiUndo.fields, sections: aiUndo.sections } : prev))
    setAiUndo(null)
    return true
  }

  // ── Register this page as the ONE Expert chat's edit surface ────────────────
  // Typing in the side chat now edits THIS landing page live (no second chat
  // panel). Refs keep the registration stable while calling the latest state.
  const askAiRef = useRef(askAi); askAiRef.current = askAi
  const undoAiRef = useRef(undoAi); undoAiRef.current = undoAi
  const canUndoRef = useRef(false); canUndoRef.current = aiUndo !== null
  const tRef = useRef(t); tRef.current = t
  const titleRef = useRef(''); titleRef.current = form?.headline || form?.slug || t('lpe.ai.artifact')
  useEffect(() => {
    // The AI edit surface writes to the live page (admin-only) — never register
    // it in broker proposal mode.
    if (!form || proposalMode) return
    const surface: ExpertEditorSurface = {
      kind: 'landing',
      title: titleRef.current,
      presets: () => ['punchier', 'arabic', 'seo', 'layout'].map((k) => {
        const label = tRef.current(`lpe.ai.chip.${k}`)
        return { label, instruction: label }
      }),
      apply: (instruction) => askAiRef.current(instruction),
      canUndo: () => canUndoRef.current,
      undo: () => undoAiRef.current(),
    }
    registerExpertEditor(surface)
    return () => unregisterExpertEditor(surface)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!form])

  // ── Layout canvas — reorder / show-hide the page's real section blocks ──────
  const [layoutSaving, setLayoutSaving] = useState(false)
  function sectionLabel(type: string) {
    return type.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  function setSections(next: LpSection[]) { setEdited(true); setSectionsTouched(true); setForm((prev) => (prev ? { ...prev, sections: next } : prev)) }
  // Undo / redo — structural canvas changes (reorder, add, remove, hide, AI) push
  // the prior state; text edits stay untracked to avoid per-keystroke history.
  const [past, setPast] = useState<LpSection[][]>([])
  const [futureStack, setFutureStack] = useState<LpSection[][]>([])
  function applySections(next: LpSection[]) {
    setPast((p) => [...p.slice(-29), form?.sections ?? []])
    setFutureStack([])
    setSections(next)
  }
  function undoLayout() {
    if (!past.length || !form) return
    const prev = past[past.length - 1]
    setFutureStack((f) => [form.sections ?? [], ...f].slice(0, 30))
    setPast((p) => p.slice(0, -1))
    setSections(prev)
  }
  function redoLayout() {
    if (!futureStack.length || !form) return
    const nextState = futureStack[0]
    setPast((p) => [...p.slice(-29), form.sections ?? []])
    setFutureStack((f) => f.slice(1))
    setSections(nextState)
  }
  function moveSection(i: number, dir: -1 | 1) {
    if (!form?.sections) return
    const j = i + dir
    if (j < 0 || j >= form.sections.length) return
    const next = [...form.sections]
    ;[next[i], next[j]] = [next[j], next[i]]
    applySections(next)
  }
  function toggleSection(i: number) {
    if (!form?.sections) return
    const next = form.sections.map((s, k) => (k === i ? { ...s, data: { ...s.data, _hidden: !s.data?._hidden } } : s))
    applySections(next)
  }
  function removeSection(i: number) {
    if (!form?.sections) return
    applySections(form.sections.filter((_, k) => k !== i))
    setExpanded(null)
  }
  function duplicateSection(i: number) {
    if (!form?.sections) return
    const copy = { type: form.sections[i].type, data: { ...form.sections[i].data } }
    const next = [...form.sections]
    next.splice(i + 1, 0, copy)
    applySections(next)
  }
  function addSection(type: string) {
    if (!form?.sections || !type) return
    applySections([...form.sections, { type, data: { title: '', subtitle: '' } }])
  }
  // Insert a whole template's block skeleton at the end of the page. Hero is a
  // page-level singleton, so it's skipped when one already exists; every other
  // block (lead-form, gallery, etc.) may legitimately repeat and is appended.
  function insertTemplate(key: string) {
    if (!form?.sections || !key) return
    const tpl = LANDING_TEMPLATES.find((x) => x.key === key)
    if (!tpl) return
    const hasHero = form.sections.some((s) => s.type === 'hero')
    const blocks = tpl.sections
      .filter((type) => !(type === 'hero' && hasHero))
      .map((type) => ({ type, data: {} as Record<string, unknown> }))
    applySections([...form.sections, ...blocks])
    toast.success(t('lpe.layout.tplInserted', { name: t(tpl.nameKey) }))
  }
  function setSectionField(i: number, key: string, value: unknown) {
    if (!form?.sections) return
    setSections(form.sections.map((s, k) => (k === i ? { ...s, data: { ...s.data, [key]: value } } : s)))
  }
  const [expanded, setExpanded] = useState<number | null>(null)

  // Schema-driven block editor — renders the exact fields the live page shows
  // for this section type. Kept inside the component so the `.fld` styles apply.
  function renderBlockField(i: number, data: Record<string, unknown>, def: FieldDef) {
    const key = [def.key, ...(def.alt ?? [])].find((k) => data[k] !== undefined && data[k] !== null) ?? def.key
    const raw = data[key]
    const label = t(`lpe.fld.${def.key}`)
    const lbl = 'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500'
    if (def.kind === 'text' || def.kind === 'number') {
      return (
        <div key={def.key}>
          <label className={lbl}>{label}</label>
          <input type={def.kind === 'number' ? 'number' : 'text'} className="fld" value={asStr(raw)}
            onChange={(e) => setSectionField(i, key, def.kind === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />
        </div>
      )
    }
    if (def.kind === 'long') {
      return (
        <div key={def.key}>
          <label className={lbl}>{label}</label>
          <textarea rows={2} className="fld resize-none" value={asStr(raw)} onChange={(e) => setSectionField(i, key, e.target.value)} />
        </div>
      )
    }
    if (def.kind === 'lines') {
      const lines = Array.isArray(raw) ? (raw as unknown[]).map(asStr) : []
      return (
        <div key={def.key}>
          <label className={lbl}>{label} <span className="normal-case tracking-normal text-slate-600">· {t('lpe.fld.linesHint')}</span></label>
          <textarea rows={3} className="fld resize-none" value={lines.join('\n')} onChange={(e) => setSectionField(i, key, e.target.value.split('\n'))} />
        </div>
      )
    }
    // pairs — rows of two linked texts (label/value, question/answer, name/quote)
    if (def.kind !== 'pairs') return null
    const rows = Array.isArray(raw) ? (raw as unknown[]).filter((r): r is Record<string, unknown> => !!r && typeof r === 'object') : []
    const setRows = (next: Record<string, unknown>[]) => setSectionField(i, key, next)
    return (
      <div key={def.key}>
        <label className={lbl}>{label}</label>
        <div className="space-y-1.5">
          {rows.map((row, r) => {
            const bKey = [def.b, ...(def.bAlt ?? [])].find((k) => row[k] !== undefined) ?? def.b
            const edit = (k: string, v: string) => setRows(rows.map((x, n) => (n === r ? { ...x, [k]: v } : x)))
            return (
              <div key={r} className="flex items-start gap-1.5">
                <input className="fld shrink-0" style={{ width: '38%' }} placeholder={t(`lpe.fld.${def.a}`)} value={asStr(row[def.a])} onChange={(e) => edit(def.a, e.target.value)} />
                {def.bLong ? (
                  <textarea rows={2} className="fld resize-none" placeholder={t(`lpe.fld.${def.b}`)} value={asStr(row[bKey])} onChange={(e) => edit(bKey, e.target.value)} />
                ) : (
                  <input className="fld" placeholder={t(`lpe.fld.${def.b}`)} value={asStr(row[bKey])} onChange={(e) => edit(bKey, e.target.value)} />
                )}
                <button type="button" onClick={() => setRows(rows.filter((_, n) => n !== r))} title={t('lpe.layout.remove')} className="mt-2.5 shrink-0 text-slate-500 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            )
          })}
          <button type="button" onClick={() => setRows([...rows, { [def.a]: '', [def.b]: '' }])}
            className="rounded-lg border border-line px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-gold/40 hover:text-white">
            + {t('lpe.fld.addRow')}
          </button>
        </div>
      </div>
    )
  }
  // Content sections the marketer can add to a page (hero is intentionally omitted).
  const ADD_TYPES = ['description', 'key-facts', 'payment-plan', 'roi', 'why-dubai', 'golden-visa', 'amenities', 'location', 'developer-profile', 'social-proof', 'neighborhood', 'faq', 'download-brochure', 'lead-form']
  // Native HTML5 drag-and-drop reorder (arrows stay for touch / a11y).
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  function onDropSection() {
    if (dragIndex === null || overIndex === null || dragIndex === overIndex || !form?.sections) { setDragIndex(null); setOverIndex(null); return }
    const next = [...form.sections]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(overIndex, 0, moved)
    applySections(next)
    setDragIndex(null); setOverIndex(null)
  }
  async function saveLayout() {
    if (!form?.sections) return
    setLayoutSaving(true)
    try {
      const res = await fetch(`/api/crm/landing-pages/${slug}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: form.sections }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || t('lpe.saveFailed')); return }
      if (d.landing?.sections) setSections(d.landing.sections as LpSection[])
      setPreviewKey((k) => k + 1)
      toast.success(t('lpe.layout.saved'))
    } catch { toast.error(t('lpe.saveFailed')) }
    finally { setLayoutSaving(false) }
  }

  if (loading) return <div className="flex items-center gap-2 p-10 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}</div>
  if (notFound || !form) return (
    <div className="mx-auto max-w-md p-10 text-center">
      <p className="text-sm text-slate-400">{t('lpe.notFound')}</p>
      <Link href="/freehold-intelligence/inventory/landings" className="mt-4 inline-flex items-center gap-1.5 text-sm text-gold hover:opacity-80"><ArrowLeft className="h-4 w-4" /> {t('lpe.backToLandings')}</Link>
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6" dir={dir}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link href="/freehold-intelligence/inventory/landings" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> {t('lpe.backToLandings')}</Link>
          <h1 className="mt-2 truncate text-xl font-semibold text-white">{t('lpe.title')}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
            <span className="font-mono">/lp/{slug}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${form.status === 'published' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}`}>{t(`lpe.status.${form.status}`)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {proposalMode ? (
            <>
              <button type="button" onClick={() => saveProposal(false)} disabled={saving || sending} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:text-white disabled:opacity-60">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t('lpe.proposal.saveDraft')}
              </button>
              <button type="button" onClick={() => saveProposal(true)} disabled={saving || sending} className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-60">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {t('lpe.proposal.send')}
              </button>
            </>
          ) : (
            <>
              {/* Pre-final tools live apart from the commit cluster. The landing
                  test runs automatically on entry AND can be re-run manually here
                  (e.g. after edits) — either way its findings render as the same
                  guidance panel below. */}
              <button type="button" onClick={regenerate} disabled={regen} className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-60">
                {regen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {t('lpe.regen')}
              </button>
              <button type="button" onClick={() => void runTest()} disabled={testing} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:text-white disabled:opacity-60">
                {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />} {t('lpe.test.run')}
              </button>
              <button type="button" onClick={() => setScheduleOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:text-white">
                <CalendarClock className="h-3.5 w-3.5" /> {t('lpe.schedule.btn')}
              </button>

              <span className="mx-1 hidden h-6 w-px bg-line sm:block" />

              {/* Commit cluster: Discard appears only with edits; Save edits is
                  gray until an edit exists, then takes the primary yellow. */}
              {edited && (
                <button type="button" onClick={discard} disabled={saving} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-400 transition hover:text-white disabled:opacity-60">
                  <Undo2 className="h-3.5 w-3.5" /> {t('lpe.discard')}
                </button>
              )}
              <button type="button" onClick={() => save()} disabled={saving || !edited}
                className={edited
                  ? 'inline-flex items-center gap-1.5 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-60'
                  : 'inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-xs font-semibold text-slate-500'}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t('lpe.saveEdits')}
              </button>
              <div className="relative">
                <button type="button" onClick={() => setMoreOpen((o) => !o)} disabled={saving}
                  className={edited
                    ? 'inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:text-white disabled:opacity-60'
                    : 'inline-flex items-center gap-1 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-60'}>
                  {form.status === 'published' ? t('lpe.unpublish') : t('lpe.publish')} <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {moreOpen && (
                  <>
                    <div className="fixed inset-0 z-[110]" onClick={() => setMoreOpen(false)} />
                    <div className="absolute end-0 z-[111] mt-2 w-52 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
                      <button type="button" onClick={() => { setMoreOpen(false); void save(form.status === 'published' ? 'draft' : 'published') }}
                        className="block w-full px-4 py-2.5 text-start text-xs font-semibold text-slate-200 transition hover:bg-surface-2">
                        {form.status === 'published' ? t('lpe.unpublish') : t('lpe.publish')}
                      </button>
                      {form.status !== 'archived' && (
                        <button type="button" onClick={() => { setMoreOpen(false); void save('archived') }}
                          className="block w-full border-t border-line px-4 py-2.5 text-start text-xs font-semibold text-slate-200 transition hover:bg-surface-2">
                          {t('lpe.archive')}
                        </button>
                      )}
                      {/* Destructive action is deliberately buried here — never a
                          toolbar button — and still requires typing DELETE. */}
                      <button type="button" onClick={() => { setMoreOpen(false); setDeleteConfirm(''); setDeleteOpen(true) }}
                        className="block w-full border-t border-line px-4 py-2.5 text-start text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10">
                        {t('lpe.del.btn')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {proposalMode && (
        <div className="mb-5 rounded-2xl border border-gold/25 bg-gold/[0.05] p-4">
          <div className="flex items-start gap-2 text-sm text-gold">
            <Send className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">{t('lpe.proposal.bannerTitle')}</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-slate-300">{t('lpe.proposal.bannerBody')}</p>
            </div>
          </div>
          <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('lpe.proposal.noteLabel')}</label>
          <textarea rows={2} value={proposalNote} onChange={(e) => setProposalNote(e.target.value)}
            placeholder={t('lpe.proposal.notePh')}
            className="mt-1 w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-gold/40" />
          <Link href="/freehold-intelligence/inventory/landings/requests" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-gold/80 transition hover:text-gold">
            {t('lper.mineTitle')} →
          </Link>
        </div>
      )}

      {test && (() => {
        const allGreen = (test.failed ?? 0) === 0 && (test.warned ?? 0) === 0
        const expanded = testOpen || !allGreen
        return (
        <div className={`mb-5 rounded-2xl border p-4 ${allGreen ? 'border-emerald-500/25 bg-emerald-500/[0.04]' : 'border-line bg-surface-2/60'}`}>
          <div className={`flex items-center justify-between gap-2 ${expanded ? 'mb-3' : ''}`}>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              {allGreen ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <FlaskConical className="h-4 w-4 text-gold" />} {t('lpe.test.title')}
              <span className="text-xs font-normal text-slate-500">
                {t('lpe.test.summary')
                  .replace('{pass}', String(test.passed ?? 0))
                  .replace('{warn}', String(test.warned ?? 0))
                  .replace('{fail}', String(test.failed ?? 0))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {allGreen && (
                <button type="button" onClick={() => setTestOpen((v) => !v)} className="text-xs text-slate-400 transition hover:text-white">
                  {expanded ? t('lpe.test.hide') : t('lpe.test.details')}
                </button>
              )}
              <button type="button" onClick={() => { setTest(null); setTestOpen(false) }} className="text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
          </div>
          {expanded && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {test.checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 rounded-lg bg-surface/60 px-3 py-2">
                {c.status === 'pass' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  : c.status === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200">{c.label}</p>
                  <p className="truncate text-[11px] text-slate-500">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          )}
        </div>
        )
      })()}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* Editor */}
        <div className="space-y-5">
          {/* AI chat-to-edit — hidden in broker proposal mode (admin-only route) */}
          {!proposalMode && (
          <div className="rounded-2xl border border-gold/25 bg-gold/[0.04] p-4">
            <button type="button" onClick={() => setAiOpen((o) => !o)} className="flex w-full items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/90">
                <Wand2 className="h-4 w-4" /> {t('lpe.ai.title')}
              </span>
              <ChevronDown className={`h-4 w-4 text-gold/70 transition ${aiOpen ? 'rotate-180' : ''}`} />
            </button>
            {aiOpen && (
              <div className="mt-3 space-y-3">
                <p className="text-[11px] leading-relaxed text-slate-400">{t('lpe.ai.chatHint')}</p>
                <button
                  type="button"
                  onClick={() => openExpert()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright"
                >
                  <Sparkles className="h-3.5 w-3.5" /> {t('lpe.ai.openChat')}
                </button>
                <div className="flex flex-wrap gap-1.5">
                  {[t('lpe.ai.chip.punchier'), t('lpe.ai.chip.arabic'), t('lpe.ai.chip.seo'), t('lpe.ai.chip.layout')].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => sendToExpert(chip)}
                      disabled={aiBusy}
                      className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-gold/40 hover:text-white disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                {aiBusy && (
                  <p className="flex items-center gap-1.5 text-[11px] text-gold/80"><Loader2 className="h-3 w-3 animate-spin" /> {t('lpe.ai.working')}</p>
                )}
                {aiTurns.length > 0 && (
                  <ul className="space-y-1.5 border-t border-line/60 pt-3">
                    {aiTurns.map((turn, i) => (
                      <li key={i} className="rounded-lg bg-surface/60 px-3 py-2">
                        <p className="flex items-start gap-1.5 text-[11px] text-slate-400"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-gold/70" /> {turn.instruction}</p>
                        {turn.note && <p className="mt-1 text-[11px] text-slate-300">{turn.note}</p>}
                        <p className="mt-1 text-[10px] text-slate-500">{t('lpe.ai.updated')}: {turn.fields.map((f) => t(`lpe.f.${f === 'ctaText' ? 'cta' : f === 'seoDescription' ? 'seoDesc' : f}`)).join(', ')}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          )}

          {/* Layout canvas — reorder / show-hide the page's real section blocks */}
          {form.sections && form.sections.length > 0 && (
            <div className="rounded-2xl border border-line bg-surface-2/40 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <Layers className="h-4 w-4" /> {t('lpe.layout.title')}
                </span>
                <div className="flex items-center gap-1.5">
                  <button type="button" onClick={undoLayout} disabled={past.length === 0} title={t('lpe.layout.undo')} className="rounded-full border border-line p-1.5 text-slate-400 transition hover:text-white disabled:opacity-30"><Undo2 className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={redoLayout} disabled={futureStack.length === 0} title={t('lpe.layout.redo')} className="rounded-full border border-line p-1.5 text-slate-400 transition hover:text-white disabled:opacity-30"><Redo2 className="h-3.5 w-3.5" /></button>
                  {!proposalMode && (
                    <button type="button" onClick={saveLayout} disabled={layoutSaving} className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[11px] font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-60">
                      {layoutSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {t('lpe.layout.save')}
                    </button>
                  )}
                </div>
              </div>
              <ul className="space-y-1.5">
                {form.sections.map((s, i) => {
                  const hidden = s.data?._hidden === true
                  const open = expanded === i
                  return (
                    <li key={`${s.type}-${i}`}
                      onDragOver={(e) => { e.preventDefault(); if (overIndex !== i) setOverIndex(i) }}
                      onDrop={onDropSection}
                      className={`rounded-lg border px-2.5 py-1.5 transition ${hidden ? 'border-line/60 bg-surface/40 opacity-60' : 'border-line bg-surface/70'} ${dragIndex !== null && overIndex === i && dragIndex !== i ? 'ring-1 ring-gold/50' : ''} ${dragIndex === i ? 'opacity-40' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span
                          draggable
                          onDragStart={() => setDragIndex(i)}
                          onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
                          title={t('lpe.layout.drag')}
                          className="cursor-grab text-slate-600 hover:text-slate-300 active:cursor-grabbing"><GripVertical className="h-4 w-4" /></span>
                        <span className="flex flex-col">
                          <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} className="text-slate-500 hover:text-white disabled:opacity-30"><ChevronUp className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => moveSection(i, 1)} disabled={i === form.sections!.length - 1} className="text-slate-500 hover:text-white disabled:opacity-30"><ChevronDown className="h-3.5 w-3.5" /></button>
                        </span>
                        <button type="button" onClick={() => { setExpanded(open ? null : i); if (!open) locateSection(i) }} title={t('lpe.layout.editContent')} className="group flex min-w-0 flex-1 items-center gap-1.5 text-start text-xs text-slate-200 hover:text-white">
                          <span className="truncate">{sectionLabel(s.type)}</span>
                          <Pencil className={`h-3 w-3 shrink-0 transition ${open ? 'text-gold' : 'text-slate-600 group-hover:text-gold'}`} />
                        </button>
                        <button type="button" onClick={() => locateSection(i)} title={t('lpe.layout.locate')} className="text-slate-500 hover:text-gold"><Crosshair className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => duplicateSection(i)} title={t('lpe.layout.duplicate')} className="text-slate-500 hover:text-white"><Copy className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => toggleSection(i)} title={hidden ? t('lpe.layout.show') : t('lpe.layout.hide')} className="text-slate-500 hover:text-white">
                          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        <button type="button" onClick={() => removeSection(i)} title={t('lpe.layout.remove')} className="text-slate-500 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      {open && (
                        <div className="mt-2 space-y-2.5 border-t border-line pt-2.5">
                          {fieldsFor(s.type).length === 0
                            ? <p className="text-[11px] leading-relaxed text-slate-500">{t('lpe.fld.builtIn')}</p>
                            : fieldsFor(s.type).map((f) => renderBlockField(i, s.data ?? {}, f))}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setAddOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20">
                  + {t('lpe.layout.add')}
                </button>
                <select value="" onChange={(e) => { insertTemplate(e.target.value); e.target.value = '' }} className="fld max-w-[220px] text-xs" title={t('lpe.layout.insertTplHint')}>
                  <option value="">{t('lpe.layout.insertTpl')}</option>
                  {LANDING_TEMPLATES.map((tpl) => <option key={tpl.key} value={tpl.key}>{t(tpl.nameKey)}</option>)}
                </select>
              </div>
              <p className="mt-2 text-[11px] text-slate-500">{t('lpe.layout.hint')}</p>
            </div>
          )}

          <Section title={t('lpe.grp.content')}>
            <Field label={t('lpe.f.headline')}><input className="fld" value={form.headline} onChange={(e) => set('headline', e.target.value)} /></Field>
            <Field label={t('lpe.f.subheadline')}><textarea rows={2} className="fld resize-none" value={form.subheadline} onChange={(e) => set('subheadline', e.target.value)} /></Field>
            <Field label={t('lpe.f.cta')}><input className="fld" value={form.ctaText} onChange={(e) => set('ctaText', e.target.value)} /></Field>
            <Field label={t('lpe.f.heroImage')}>
              <input className="fld" value={form.heroImage} onChange={(e) => set('heroImage', e.target.value)} placeholder="https://…" />
              {form.heroImage && form.heroImage !== '/logo.png' && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.heroImage} alt="" className="mt-2 h-20 w-full rounded-lg object-cover" />
              )}
            </Field>
          </Section>

          <Section title={t('lpe.grp.seo')}>
            <Field label={t('lpe.f.seoTitle')}><input className="fld" value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} /></Field>
            <Field label={t('lpe.f.seoDesc')}><textarea rows={2} className="fld resize-none" value={form.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} /></Field>
            <Field label={t('lpe.f.ogImage')}><input className="fld" value={form.ogImage} onChange={(e) => set('ogImage', e.target.value)} placeholder="https://…" /></Field>
          </Section>

          {/* Auto-update pricing — the killer option: the live page price
              tracks the project's current market price instead of a frozen
              editor value. */}
          <Section title={t('lpe.grp.smart')}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2/50 p-3">
              <input type="checkbox" checked={form.autoUpdatePricing} onChange={(e) => set('autoUpdatePricing', e.target.checked)} className="mt-0.5" />
              <span>
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white"><TrendingUp className="h-3.5 w-3.5 text-gold" /> {t('lpe.autoPrice.title')}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{t('lpe.autoPrice.body')}</span>
              </span>
            </label>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{t('lpe.trackingMoved')}</p>
          </Section>

          {/* Trackable QR code — offline/roadshow attribution. Encodes the live
              URL with utm_source=qr&utm_medium=offline(+campaign) so a scanned
              lead is automatically attributed in ROI reporting; no backend
              tracking change, this is generation-only. */}
          <Section title={t('lpe.grp.qr')}>
            <p className="text-[11px] leading-relaxed text-slate-500">{t('lpe.qr.hint')}</p>
            <Field label={t('lpe.qr.labelLabel')}>
              <input className="fld" value={qrLabel} onChange={(e) => setQrLabel(e.target.value)} placeholder={t('lpe.qr.labelPh')} />
            </Field>
            <div className="flex flex-col items-start gap-3 rounded-xl border border-line bg-surface-2/50 p-3 sm:flex-row">
              <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white p-1.5">
                {qrDataUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={qrDataUrl} alt={t('lpe.grp.qr')} className="h-full w-full object-contain" />
                  : <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <button type="button" onClick={downloadQrPng} disabled={!qrDataUrl || qrBusy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-50">
                  <Download className="h-3.5 w-3.5" /> {t('lpe.qr.download')}
                </button>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('lpe.qr.urlLabel')}</label>
                  <div className="flex items-center gap-1.5">
                    <code dir="ltr" className="min-w-0 flex-1 select-all truncate rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px] text-slate-300">{qrTargetUrl}</code>
                    <button type="button" onClick={copyQrUrl} title={t('lpe.qr.copy')} className="shrink-0 rounded-lg border border-line p-1.5 text-slate-400 transition hover:text-white"><Copy className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400"><Eye className="h-3.5 w-3.5" /> {t('lpe.livePreview')}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPreviewKey((k) => k + 1)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"><RefreshCw className="h-3 w-3" /> {t('lpe.refresh')}</button>
              <a href={`/lp/${slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-gold/70 hover:text-gold">{t('lpe.openTab')} <ExternalLink className="h-3 w-3" /></a>
            </div>
          </div>
          <iframe ref={previewRef} key={previewKey} src={`/lp/${slug}?lpe=1`} title="preview" className="h-[70vh] w-full rounded-2xl border-4 border-surface-3 bg-white shadow-2xl lg:h-[calc(100%-2rem)]" />
          <p className="mt-2 text-[11px] text-slate-600">{t('lpe.previewNote')} · <span className="text-gold/70">{t('lpe.canvasHint')}</span></p>
        </div>
      </div>

      {/* Schedule run — pick a window OR keep it live until the project sells out */}
      {scheduleOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setScheduleOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-[15px] font-semibold text-white"><CalendarClock className="h-4 w-4 text-gold" /> {t('lpe.schedule.title')}</div>
            <p className="mt-1 text-[12px] text-slate-500">{t('lpe.schedule.sub')}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Field label={t('lpe.f.publishFrom')}><input type="datetime-local" className="fld" value={form.publishFrom} onChange={(e) => set('publishFrom', e.target.value)} /></Field>
              <Field label={t('lpe.f.publishTo')}><input type="datetime-local" className="fld" value={form.publishTo} onChange={(e) => set('publishTo', e.target.value)} /></Field>
            </div>
            <p className="mt-3 flex items-start gap-2.5 rounded-xl border border-line bg-surface-2/50 p-3 text-[12px] leading-relaxed text-slate-400">
              <PackageX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" /> {t('lpe.schedule.soldOutNote')}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setScheduleOpen(false)} className="rounded-full border border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:text-white">{t('common.cancel')}</button>
              <button type="button" onClick={() => { setScheduleOpen(false); void save() }} className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright">{t('lpe.schedule.apply')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add-section gallery — a wireframe preview per type, so the user SEES
          what a section looks like before adding it (no more add-and-delete). */}
      {addOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setAddOpen(false)}>
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-[15px] font-semibold text-white">{t('lpe.layout.add')}</div>
              <button type="button" onClick={() => setAddOpen(false)} className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:text-white">{t('common.cancel')}</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {ADD_TYPES.map((ty) => (
                <button key={ty} type="button"
                  onClick={() => {
                    const idx = form.sections?.length ?? 0
                    addSection(ty); setAddOpen(false)
                    setTimeout(() => locateSection(idx), 600)
                  }}
                  className="group rounded-xl border border-line bg-surface-2 p-3 text-start transition hover:border-gold/40">
                  <SectionThumb type={ty} />
                  <div className="mt-2 text-xs font-semibold text-slate-200 group-hover:text-white">{sectionLabel(ty)}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Delete — typed confirmation */}
      {deleteOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setDeleteOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-[15px] font-semibold text-white"><Trash2 className="h-4 w-4 text-rose-400" /> {t('lpe.del.title')}</div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-slate-400">{t('lpe.del.warn')}</p>
            <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={t('lpe.del.placeholder')} className="fld mt-3" autoFocus />
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => setDeleteOpen(false)} className="rounded-full border border-line bg-surface-2 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:text-white">{t('common.cancel')}</button>
              {/* The safer path is offered first: archive — off air, data kept.
                  Landings wired to ad campaigns can ONLY be archived (the API
                  refuses their deletion with a 409). */}
              {form.status !== 'archived' && (
                <button type="button" onClick={() => { setDeleteOpen(false); void save('archived') }}
                  className="rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright">
                  {t('lpe.del.archiveInstead')}
                </button>
              )}
              <button type="button" onClick={doDelete} disabled={deleteConfirm.trim().toLowerCase() !== 'delete' || deleting}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-400 disabled:opacity-40">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} {t('lpe.del.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`.fld{width:100%;border-radius:12px;border:1px solid var(--line,#26262b);background:var(--surface-2,#151518);padding:10px 12px;font-size:14px;color:#fff;outline:none}.fld::placeholder{color:#64748b}.fld:focus{border-color:rgba(212,175,55,.4)}`}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold/80">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
      {children}
    </div>
  )
}
