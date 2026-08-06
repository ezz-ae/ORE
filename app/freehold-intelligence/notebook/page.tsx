'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { agentWaiting, clearAgentWaiting } from '@/lib/freehold/agent-signal'
import { toast } from 'sonner'
import {
  BookOpen, Pin, Sparkles, MessageSquare, FileText, Megaphone, GitBranch,
  Search, X, Plus, CheckSquare, Square, Upload, Pencil, Send,
  Users, Building2, FolderOpen, ChevronRight, ArrowUp, Loader2,
  BarChart2, Mail, Phone, Globe, FileImage, Layers, Newspaper, History, Trash2,
  Library as LibraryIcon, Image as ImageIcon2, Video, FileDown, Download,
} from 'lucide-react'
import { saveAccountMemory, loadAccountMemory } from '@/lib/freehold/account-memory'
import type { ExpertBlock } from '@/lib/freehold/expert-blocks'
import { useT, useI18n } from '@/lib/i18n/provider'
import { brandName } from '@/lib/freehold/brand'

// ── helpers ──────────────────────────────────────────────────────────────────

function outputTypeIcon(type: string, className = 'h-3.5 w-3.5') {
  if (type === 'ad_copy' || type === 'script') return <Megaphone className={className} />
  if (type === 'comparison') return <GitBranch className={className} />
  if (type === 'brochure' || type === 'pdf') return <FileText className={className} />
  return <MessageSquare className={className} />
}

function relativeTime(iso: string, t: (k: string, v?: Record<string, string | number>) => string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return t('crm.timeMinAgo', { count: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t('crm.timeHrAgo', { count: hrs })
  return t('crm.timeDayAgo', { count: Math.floor(hrs / 24) })
}

// ── data ─────────────────────────────────────────────────────────────────────

// Demo saved-outputs previews are gone — the notebook shows only real,
// DB-persisted outputs (dbOutputs); pinning is a real per-account preference.

type CenterTab = 'chat' | 'expert' | 'library' | 'saved' | 'pinned'

// Read-only view of a stored Expert turn (the side chat's rich blocks,
// flattened to text for the Suite's history reader).
type ExpertStoredTurn = { role: 'user' | 'assistant'; content?: string; blocks?: ExpertBlock[]; createdAt: string }
type ExpertSessionRow = { id: string; title: string; messageCount: number; updatedAt: string }

// The Library — every produced asset in one shelf (reports, notes, ad
// creatives, images, videos, PDFs). Media is URL-based, ready for a
// generative media model to publish into the same store later.
type LibraryKind = 'report' | 'note' | 'creative' | 'image' | 'video' | 'pdf'
type LibraryItem = { id: string; kind: LibraryKind; title: string; content: string | null; url: string | null; createdAt: string }
const LIB_KINDS: LibraryKind[] = ['report', 'note', 'creative', 'image', 'video', 'pdf']
function libIcon(kind: LibraryKind, className = 'h-3.5 w-3.5') {
  if (kind === 'image') return <ImageIcon2 className={className} />
  if (kind === 'video') return <Video className={className} />
  if (kind === 'pdf') return <FileDown className={className} />
  if (kind === 'creative') return <Megaphone className={className} />
  return <FileText className={className} />
}

function expertBlocksText(blocks: ExpertBlock[] | undefined): string {
  if (!blocks?.length) return ''
  return blocks
    .map((b) => {
      if (b.type === 'text') return b.content
      if (b.type === 'plan') return `${b.title || 'Plan'}\n${b.steps.map((s, i) => `${i + 1}. ${s.step}${s.detail ? ` — ${s.detail}` : ''}`).join('\n')}`
      if (b.type === 'landing') return `${b.title}${b.subhead ? `\n${b.subhead}` : ''}\n${b.sections.map((s) => `${s.heading}: ${s.body}`).join('\n')}`
      if (b.type === 'media') return `${b.label}: ${b.prompt}`
      return ''
    })
    .filter(Boolean)
    .join('\n\n')
}

// ── studio generate grid ─────────────────────────────────────────────────────

const GENERATE_TYPES = [
  { key: 'brochure',      labelKey: 'nb.gen.brochure',     icon: <FileText className="h-5 w-5" /> },
  { key: 'ad_copy',       labelKey: 'nb.gen.adCopy',       icon: <Megaphone className="h-5 w-5" /> },
  { key: 'whatsapp',      labelKey: 'nb.gen.whatsapp',     icon: <Phone className="h-5 w-5" /> },
  { key: 'comparison',    labelKey: 'nb.gen.comparison',   icon: <GitBranch className="h-5 w-5" /> },
  { key: 'offer_letter',  labelKey: 'nb.gen.offerLetter',  icon: <FileImage className="h-5 w-5" /> },
  { key: 'script',        labelKey: 'nb.gen.script',       icon: <Layers className="h-5 w-5" /> },
  { key: 'market_report', labelKey: 'nb.gen.marketReport', icon: <BarChart2 className="h-5 w-5" /> },
  { key: 'social_post',   labelKey: 'nb.gen.socialPost',   icon: <Newspaper className="h-5 w-5" /> },
]

// Only real destinations: attach to a lead's CRM timeline, or download the
// output. (Ads/WhatsApp/email "sends" were clipboard+toast fakes — removed.)
const SEND_DESTINATIONS = [
  { key: 'crm',       labelKey: 'nb.dest.crm',      icon: <Users className="h-3.5 w-3.5" /> },
  { key: 'download',  labelKey: 'nb.dest.download', icon: <Download className="h-3.5 w-3.5" /> },
]

// Uploads are user-added sources only — no sample files.

// Per-type generator instructions. The generator runs through the SAME
// grounded pipeline as the chat (live projects, market intel, campaigns,
// uploads), so outputs are built from real workspace data — the instruction
// only sets the deliverable's structure.
const GEN_PROMPTS: Record<string, string> = {
  brochure: 'Produce a complete property BROCHURE draft: a headline, a 2-3 sentence intro, "Key facts" bullets (location, developer, unit mix, prices, handover), "Payment plan" if known, "Amenities", an investment angle paragraph with real numbers from the sources, and a closing call to action. Use [VERIFY BEFORE SENDING] for anything not in the data.',
  ad_copy: 'Produce 3 distinct Meta AD COPY variants. Each: primary text (1-3 short punchy sentences), headline (max 40 chars), description (max 30 chars). Ground every claim in the real data; no invented numbers.',
  whatsapp: 'Produce 3 short WHATSAPP MESSAGES a broker can send: (1) first touch after a lead form, (2) follow-up with one concrete number from the data, (3) viewing invitation. Warm, human, no corporate speak, under 60 words each.',
  comparison: 'Produce a COMPARISON of the most relevant projects from the data: a markdown table (project, area, price from, yield, handover, score) followed by a 3-4 sentence "which one for whom" verdict grounded in the numbers.',
  offer_letter: 'Produce a formal OFFER LETTER draft: buyer/seller placeholders in [brackets], the property details from the data, offer amount placeholder, payment structure, validity period, and standard Dubai conveyancing next steps. Mark every placeholder clearly.',
  script: 'Produce a 30-45 second VIDEO SCRIPT: hook (first 3 seconds), 3 value beats grounded in real numbers from the data, and a call to action. Format as SCENE / VOICEOVER / ON-SCREEN TEXT rows.',
  market_report: 'Produce a MARKET REPORT: headline summary, area-by-area numbers from the market intelligence (yields, median prices), below-market opportunities if present, demand signals from the pipeline data, and a 3-bullet outlook. Every number must come from the provided data.',
  social_post: 'Produce 3 SOCIAL POSTS (Instagram/LinkedIn tone): each with a hook line, 2-3 sentences grounded in a real number from the data, 3-5 relevant hashtags. No generic fluff.',
}

const CHAT_SUGGESTIONS = [
  'nb.suggestion.whatsappHotLead',
  'nb.suggestion.palmVsHills',
  'nb.suggestion.metaAdAngles',
  'nb.suggestion.offerLetterBusinessBay',
]

// ── components ────────────────────────────────────────────────────────────────

function SourceCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="shrink-0 text-slate-400 hover:text-gold transition">
      {checked
        ? <CheckSquare className="h-3.5 w-3.5 text-gold" />
        : <Square className="h-3.5 w-3.5" />}
    </button>
  )
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function NotebookPage() {
  const t = useT()
  const router = useRouter()

  // ── AI Suite: the account's Expert conversations (from ANY page) ──────────
  const [expertSessions, setExpertSessions] = useState<ExpertSessionRow[]>([])
  const [openExpertId, setOpenExpertId] = useState<string | null>(null)
  const [openExpertTurns, setOpenExpertTurns] = useState<ExpertStoredTurn[]>([])
  useEffect(() => {
    fetch('/api/freehold/expert/sessions')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.sessions)) setExpertSessions(d.sessions) })
      .catch(() => {})
  }, [])

  async function toggleExpertSession(id: string) {
    if (openExpertId === id) { setOpenExpertId(null); return }
    setOpenExpertId(id)
    setOpenExpertTurns([])
    try {
      const r = await fetch(`/api/freehold/expert/sessions/${encodeURIComponent(id)}`)
      if (!r.ok) return
      const d = await r.json()
      setOpenExpertTurns(Array.isArray(d.session?.messages) ? d.session.messages : [])
    } catch { /* leave collapsed */ }
  }

  function continueExpertSession(id: string) {
    // Point the account's side chat at this conversation, then go where the
    // panel lives — it restores the session there (any page outside Notebook).
    saveAccountMemory({ expertSession: id })
    router.push('/freehold-intelligence')
  }

  async function deleteExpertSession(id: string) {
    try { await fetch(`/api/freehold/expert/sessions?id=${encodeURIComponent(id)}`, { method: 'DELETE' }) } catch {}
    setExpertSessions((s) => s.filter((x) => x.id !== id))
    if (openExpertId === id) setOpenExpertId(null)
  }

  // ── Library ────────────────────────────────────────────────────────────────
  const [libItems, setLibItems] = useState<LibraryItem[]>([])
  const [libFilter, setLibFilter] = useState<'All' | LibraryKind>('All')
  const [libOpenId, setLibOpenId] = useState<string | null>(null)
  const [libForm, setLibForm] = useState<{ kind: LibraryKind; title: string; url: string }>({ kind: 'image', title: '', url: '' })
  const [libSaving, setLibSaving] = useState(false)
  useEffect(() => {
    fetch('/api/freehold/library')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.items)) setLibItems(d.items) })
      .catch(() => {})
  }, [])
  const libVisible = libFilter === 'All' ? libItems : libItems.filter((i) => i.kind === libFilter)

  async function addLibMedia() {
    if (!libForm.title.trim() || !/^https?:\/\//.test(libForm.url)) { toast.error(t('nb.lib.needUrl')); return }
    setLibSaving(true)
    try {
      const res = await fetch('/api/freehold/library', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: libForm.kind, title: libForm.title.trim(), url: libForm.url.trim() }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error('save failed')
      setLibItems((prev) => [d.item, ...prev])
      setLibForm({ kind: 'image', title: '', url: '' })
      toast.success(t('nb.lib.saved'))
    } catch {
      toast.error(t('nb.lib.saveFailed'))
    } finally { setLibSaving(false) }
  }

  async function deleteLibItem(id: string) {
    // Honest delete — only remove the tile when the server confirms the row
    // is gone, otherwise it would silently reappear on the next load.
    try {
      const res = await fetch(`/api/freehold/library?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.ok) { toast.error(t('nb.lib.deleteFailed')); return }
      setLibItems((prev) => prev.filter((i) => i.id !== id))
    } catch { toast.error(t('nb.lib.deleteFailed')) }
  }
  // left panel
  const [sourceQuery, setSourceQuery] = useState('')
  const [showAddSource, setShowAddSource] = useState(false)
  // LITE: below lg the Sources/Studio rails are bottom sheets — without this
  // they were `hidden lg:flex`, making uploads, source selection and all the
  // generators unreachable on phones.
  const [mobilePanel, setMobilePanel] = useState<null | 'sources' | 'studio'>(null)
  const [addSourceInput, setAddSourceInput] = useState('')
  // Data sources default ON — a fresh notebook must answer from the live
  // workspace, not open as an ungrounded chat that refuses questions.
  const [checkedSources, setCheckedSources] = useState<Record<string, boolean>>({
    all_conversations: true,
    live_projects: true,
    crm_leads: true,
    market_intel: true,
    campaigns: true,
    uploads: false,
  })
  const [isDragOver, setIsDragOver] = useState(false)

  // Real source counts — the Sources panel shows live project + lead totals,
  // not fabricated numbers.
  const [projectCount, setProjectCount] = useState<number | null>(null)
  const [leadCount, setLeadCount] = useState<number | null>(null)
  useEffect(() => {
    fetch('/api/freehold/inventory', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.properties)) setProjectCount(d.properties.length) })
      .catch(() => {})
    fetch('/api/freehold/crm/leads', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { const arr = d?.leads ?? d; if (Array.isArray(arr)) setLeadCount(arr.length) })
      .catch(() => {})
  }, [])

  // Persisted outputs (saved tables / reports) from the DB.
  type SavedOutput = { id: string; title: string; type: string; content: string; created_at: string }
  const [dbOutputs, setDbOutputs] = useState<SavedOutput[]>([])
  // Pins are a real per-ACCOUNT preference — they follow the user anywhere.
  const [pinnedIds, setPinnedIds] = useState<string[]>([])
  function togglePin(id: string) {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      saveAccountMemory({ nbPinned: next })
      return next
    })
  }
  const pinnedOutputs = dbOutputs.filter((o) => pinnedIds.includes(o.id))
  const [openOutput, setOpenOutput] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/freehold/notebook/save-output')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.outputs)) setDbOutputs(d.outputs) })
      .catch(() => {})
  }, [])

  // Real, persisted conversation threads (per-user; management sees the team's).
  type ConvSummary = { id: string; title: string; messages: { role: 'user' | 'assistant'; content: string }[]; updatedAt: string; savedOutputs: unknown[] }
  const [conversations, setConversations] = useState<ConvSummary[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  function loadConversations() {
    fetch('/api/freehold/notebook/conversations')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.conversations)) setConversations(d.conversations) })
      .catch(() => {})
  }
  useEffect(() => { loadConversations() }, [])

  // center panel
  const [centerTab, setCenterTab] = useState<CenterTab>('chat')
  const [chatInput, setChatInput] = useState('')

  /**
   * A question handed over from somewhere else in the system.
   *
   * The machine can now say "I have something worth discussing" and open the
   * conversation here with the question already written. It is SEEDED, not
   * sent: the person reads what they are about to ask and can change it or
   * throw it away. Auto-sending would be the machine talking to itself and
   * showing someone the transcript.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    const ask = new URLSearchParams(window.location.search).get('ask')
    if (!ask) return
    setCenterTab('chat')
    setChatInput(ask.slice(0, 2000))
    // Drop it from the URL so a refresh does not re-ask a stale question.
    window.history.replaceState({}, '', window.location.pathname)
  }, [])
  /**
   * The agent's own opening line, delivered where a conversation happens.
   *
   * It is placed here rather than shown as a badge because a badge is a
   * notification and this is a message — there is a difference, and the
   * difference is whether you can answer it. Placed ONCE: the signal is
   * cleared the moment it lands, so re-opening the notebook does not replay
   * it. Nothing is auto-sent; the agent has spoken and the reply is theirs.
   */
  useEffect(() => {
    const w = agentWaiting()
    if (!w) return
    setCenterTab('chat')
    setChatMessages((prev) =>
      prev.some((m) => m.opened) ? prev : [{ role: 'assistant', content: w.line, opened: true }, ...prev])
    clearAgentWaiting()
  }, [])

  /** `opened` marks the one message the agent started itself. Nothing else in
   *  this thread was unprompted, so it is the only one that gets its own
   *  background — the distinction IS the information. */
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string; opened?: boolean }[]>([])
  const [chatPending, setChatPending] = useState(false)
  /**
   * WHAT IT IS ACTUALLY DOING, not "Thinking…".
   *
   * "Thinking" is true of every second of every request and therefore tells
   * nobody anything. This endpoint answers in one call — there is no stream to
   * report real per-step progress from — so inventing "Analysing…" then
   * "Cross-referencing…" would be a progress bar that is choreography.
   *
   * What IS true and specific is what the question was handed: the sources
   * actually ticked and travelling with it. Naming those is honest, it is
   * different per request, and it tells someone why an answer will or will not
   * know a thing.
   */
  const [workingOn, setWorkingOn] = useState('')
  const [convQuery, setConvQuery] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [notebookTitle, setNotebookTitle] = useState(brandName)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // right panel
  const [activeGenerate, setActiveGenerate] = useState<string | null>(null)
  const [activeSendDest, setActiveSendDest] = useState<string | null>(null)
  const [activeSendOutput, setActiveSendOutput] = useState<string | null>(null)
  const [customSources, setCustomSources] = useState<{ id: string; name: string; content?: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [genInput, setGenInput] = useState('')
  const [genResult, setGenResult] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [genSaving, setGenSaving] = useState(false)
  // Lead context: when the Notebook is opened from a CRM lead (?lead=<id>),
  // "Send to CRM" attaches the output to that lead's timeline (a real edge).
  const { locale } = useI18n()
  const dateLocale = locale === 'ar' ? 'ar-AE' : locale === 'ru' ? 'ru-RU' : 'en-AE'
  const [leadCtx, setLeadCtx] = useState<string | null>(null)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('lead')
    if (id) setLeadCtx(id)
  }, [])

  async function saveGenerated() {
    if (!genResult.trim()) return
    const type = GENERATE_TYPES.find((g) => g.key === activeGenerate)
    setGenSaving(true)
    try {
      const res = await fetch('/api/freehold/library', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'report', title: type ? t(type.labelKey) : t('nb.notebookOutput'), content: genResult }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.item) throw new Error('failed')
      setLibItems((prev) => [d.item, ...prev])
      toast.success(t('nb.savedToLibrary'))
    } catch {
      toast.error(t('nb.saveFailed'))
    } finally { setGenSaving(false) }
  }

  async function runGenerate() {
    const type = GENERATE_TYPES.find((g) => g.key === activeGenerate)
    if (!type) return
    setGenLoading(true); setGenResult('')
    try {
      // The generator uses the SAME grounded pipeline as the chat — live
      // projects, market intelligence, campaign data and the user's uploads —
      // so a brochure or market report is built from real workspace numbers.
      const langName = locale === 'ar' ? 'Arabic' : locale === 'ru' ? 'Russian' : 'English'
      const res = await fetch('/api/freehold/notebook/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ephemeral: true,
          message: `${GEN_PROMPTS[type.key] ?? `Produce a ${t(type.labelKey)}.`}${genInput ? `\n\nOperator brief: ${genInput}` : ''}\n\nWrite the deliverable in ${langName}.`,
          sources: {
            live_projects: !!checkedSources.live_projects,
            crm_leads: !!checkedSources.crm_leads,
            market_intel: !!checkedSources.market_intel,
            campaigns: !!checkedSources.campaigns,
            uploads: !!checkedSources.uploads,
            all_conversations: false,
          },
          uploads: checkedSources.uploads
            ? customSources.filter((src) => checkedSources[src.id] !== false).map((src) => ({ name: src.name, content: src.content }))
            : [],
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.unavailable) { toast.error(t('nb.gen.unavailable')); return }
      const text = data?.answer || data?.message
      if (!res.ok || !text) throw new Error('generation failed')
      setGenResult(text)
    } catch {
      toast.error(t('nb.generationFailed'))
    } finally { setGenLoading(false) }
  }

  // Save the generated output as a Drive doc and jump straight into the
  // editor — brochures and reports become editable documents, not dead text.
  async function saveAndEdit() {
    if (!genResult.trim()) return
    const type = GENERATE_TYPES.find((g) => g.key === activeGenerate)
    setGenSaving(true)
    try {
      const res = await fetch('/api/freehold/library', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'report', title: type ? t(type.labelKey) : t('nb.notebookOutput'), content: genResult }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok || !d?.item?.id) throw new Error('failed')
      router.push(`/freehold-intelligence/drive/editor/doc/${encodeURIComponent(d.item.id)}`)
    } catch {
      toast.error(t('nb.saveFailed'))
      setGenSaving(false)
    }
  }

  // auto-resize textarea
  useEffect(() => {
    if (!taRef.current) return
    taRef.current.style.height = 'auto'
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + 'px'
  }, [chatInput])

  // scroll to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatPending])

  // source toggle
  function toggleSource(key: string) {
    setCheckedSources(prev => ({ ...prev, [key]: !prev[key] }))
  }
  function toggleAll(val: boolean) {
    setCheckedSources(prev => Object.fromEntries(Object.keys(prev).map(k => [k, val])))
  }
  const allChecked = Object.values(checkedSources).every(Boolean)
  const noneChecked = Object.values(checkedSources).every(v => !v)

  // filtered conversations
  const filteredConvs = useMemo(() => {
    const q = convQuery.trim().toLowerCase()
    const base = conversations // API returns most-recent-first
    if (!q) return base
    return base.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.messages.some(m => m.content.toLowerCase().includes(q))
    )
  }, [convQuery, conversations])

  // chat send
  async function sendChat(text?: string) {
    const message = (text ?? chatInput).trim()
    if (!message || chatPending) return
    setChatMessages(m => [...m, { role: 'user', content: message }])
    setChatInput('')
    setChatPending(true)
    {
      const named: string[] = []
      if (checkedSources.live_projects) named.push(t('nb.src.projects'))
      if (checkedSources.crm_leads) named.push(t('nb.src.leads'))
      if (checkedSources.campaigns) named.push(t('nb.src.campaigns'))
      if (checkedSources.market_intel) named.push(t('nb.src.market'))
      if (checkedSources.all_conversations) named.push(t('nb.src.history'))
      const files = checkedSources.uploads
        ? customSources.filter((x) => checkedSources[x.id] !== false).length : 0
      if (files > 0) named.push(t('nb.src.files', { n: files }))
      setWorkingOn(named.length === 0
        ? t('nb.working.nothing')
        : t('nb.working.reading', { what: named.join(t('nb.src.join')) }))
    }
    try {
      // Use the PERSISTING notebook endpoint so the thread is real and shows up
      // in the sidebar / reloads (the old server-ai/chat call was ephemeral).
      const res = await fetch('/api/freehold/notebook/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationId: conversationId ?? undefined,
          // Send the selected sources so the AI grounds on real workspace data.
          sources: {
            live_projects: !!checkedSources.live_projects,
            crm_leads: !!checkedSources.crm_leads,
            market_intel: !!checkedSources.market_intel,
            campaigns: !!checkedSources.campaigns,
            uploads: !!checkedSources.uploads,
            all_conversations: !!checkedSources.all_conversations,
          },
          // Per-file checkboxes are real filters: only ticked files travel.
          uploads: checkedSources.uploads
            ? customSources.filter((s) => checkedSources[s.id] !== false).map((s) => ({ name: s.name, content: s.content }))
            : [],
        }),
      })
      const data = await res.json()
      // `unavailable` means the AI is down — render the translated notice,
      // never the server's hardcoded English.
      const answer = data?.unavailable ? t('nb.chatError') : (data?.answer || data?.message || t('nb.chatFallback'))
      if (data?.conversationId) setConversationId(data.conversationId)
      setChatMessages(m => [...m, { role: 'assistant', content: answer }])
      loadConversations()
    } catch {
      setChatMessages(m => [...m, { role: 'assistant', content: t('nb.chatError') }])
    } finally {
      setChatPending(false)
    }
  }

  // ── Persist the notebook title + attached sources (per browser) so a rename
  //    and dropped/added files survive reload instead of resetting. ──────────
  const [prefsHydrated, setPrefsHydrated] = useState(false)
  useEffect(() => {
    try {
      const t = localStorage.getItem('nb.title')
      if (t) setNotebookTitle(t)
      const s = localStorage.getItem('nb.customSources')
      if (s) {
        const parsed = JSON.parse(s)
        if (Array.isArray(parsed)) setCustomSources(parsed)
      }
    } catch {}
    loadAccountMemory().then((m) => {
      if (typeof m.nbTitle === 'string' && m.nbTitle.trim()) setNotebookTitle(m.nbTitle)
      if (Array.isArray(m.nbPinned)) setPinnedIds(m.nbPinned.filter((x: unknown): x is string => typeof x === 'string'))
    }).catch(() => {})
    setPrefsHydrated(true)
  }, [])
  useEffect(() => {
    if (!prefsHydrated) return
    try { localStorage.setItem('nb.title', notebookTitle) } catch {}
    saveAccountMemory({ nbTitle: notebookTitle })
  }, [notebookTitle, prefsHydrated])
  useEffect(() => {
    if (!prefsHydrated) return
    try { localStorage.setItem('nb.customSources', JSON.stringify(customSources)) } catch {}
  }, [customSources, prefsHydrated])
  // The active thread survives a reload: remember its id and rehydrate the
  // chat from the persisted conversation once the list arrives.
  useEffect(() => {
    if (!prefsHydrated || !conversationId) return
    try { localStorage.setItem('nb.activeConversation', conversationId) } catch {}
  }, [conversationId, prefsHydrated])
  const resumedRef = useRef(false)
  useEffect(() => {
    if (resumedRef.current || !prefsHydrated || conversations.length === 0) return
    if (conversationId || chatMessages.length > 0) { resumedRef.current = true; return }
    let storedId: string | null = null
    try { storedId = localStorage.getItem('nb.activeConversation') } catch {}
    if (!storedId) { resumedRef.current = true; return }
    const conv = conversations.find((c) => c.id === storedId)
    if (conv) {
      setConversationId(conv.id)
      setChatMessages(conv.messages.map((m) => ({ role: m.role, content: m.content })))
    }
    resumedRef.current = true
  }, [prefsHydrated, conversations, conversationId, chatMessages.length])

  /** Load a stored thread into the live chat so it can be continued. */
  function resumeConversation(conv: { id: string; messages: { role: 'user' | 'assistant'; content: string }[] }) {
    setConversationId(conv.id)
    setChatMessages(conv.messages.map((m) => ({ role: m.role, content: m.content })))
    setCenterTab('chat')
  }

  // Accept dropped / picked files: read text for text-like files (so the AI can
  // actually use them), keep binaries as named pointers. Both persist as sources.
  async function addFiles(files: FileList | null) {
    if (!files || !files.length) return
    const TEXT_RE = /\.(txt|md|markdown|csv|json|html?|xml|log|yml|yaml|tsv)$/i
    const additions: { id: string; name: string; content?: string }[] = []
    for (const file of Array.from(files)) {
      let content: string | undefined
      if ((file.type.startsWith('text/') || TEXT_RE.test(file.name)) && file.size < 400_000) {
        try { content = (await file.text()).slice(0, 8000) } catch {}
      }
      additions.push({ id: `src_${Date.now()}_${additions.length}`, name: file.name, content })
    }
    setCustomSources((prev) => [...prev, ...additions])
    setCheckedSources((prev) => ({ ...prev, uploads: true }))
    toast.success(t('nb.sourceAdded'))
  }

  return (
    <div className="relative flex overflow-hidden bg-ink" style={{ height: 'calc(100dvh - 56px)' }}>

      {/* Backdrop for the mobile panel sheets */}
      {mobilePanel && (
        <button
          aria-label={t('common.close')}
          onClick={() => setMobilePanel(null)}
          className="absolute inset-0 z-[125] bg-black/60 lg:hidden"
        />
      )}

      {/* ── LEFT PANEL — Sources ─────────────────────────────────────────── */}
      <aside className={`${mobilePanel === 'sources' ? 'absolute inset-x-0 bottom-0 top-16 z-[130] flex rounded-t-2xl border-t' : 'hidden'} w-auto flex-col overflow-hidden border-line bg-app lg:static lg:flex lg:w-[280px] lg:shrink-0 lg:rounded-none lg:border-t-0 lg:border-r`}>

        {/* header */}
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3.5">
          <span className="text-sm font-semibold text-white">{t('nb.sources')}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowAddSource((v) => !v)} className="flex items-center gap-1 rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1 text-xs text-slate-300 transition hover:border-gold/30 hover:text-gold">
              <Plus className="h-3 w-3" /> {showAddSource ? t('common.cancel') : t('nb.addSource')}
            </button>
            <button onClick={() => setMobilePanel(null)} className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 hover:text-white lg:hidden">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* search */}
        <div className="relative border-b border-line px-3 py-2.5">
          <Search className="absolute start-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={sourceQuery}
            onChange={e => setSourceQuery(e.target.value)}
            placeholder={t('nb.searchSources')}
            className="w-full rounded-lg border border-line bg-surface py-1.5 ps-8 pe-7 text-xs text-white placeholder-slate-500 outline-none transition focus:border-line-strong"
          />
          {sourceQuery && (
            <button onClick={() => setSourceQuery('')} className="absolute end-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Add source inline form */}
        {showAddSource && (
          <form
            className="border-b border-line px-3 py-2.5 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              const url = addSourceInput.trim()
              if (!url) return
              setCustomSources((prev) => [...prev, { id: `src_${Date.now()}`, name: url }])
              setCheckedSources((prev) => ({ ...prev, uploads: true }))
              toast.success(t('nb.sourceAdded'))
              setAddSourceInput('')
              setShowAddSource(false)
            }}
          >
            <input
              autoFocus
              value={addSourceInput}
              onChange={(e) => setAddSourceInput(e.target.value)}
              placeholder={t('nb.pasteUrl')}
              className="flex-1 min-w-0 rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-gold/40"
            />
            <button type="submit" className="shrink-0 rounded-lg bg-gold/80 px-2.5 py-1.5 text-xs font-semibold text-ink">{t('common.add')}</button>
          </form>
        )}

        {/* select all / deselect all */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-2">
          <button
            onClick={() => toggleAll(true)}
            className={`text-xs transition ${allChecked ? 'text-gold' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {t('nb.selectAll')}
          </button>
          <span className="text-slate-700">·</span>
          <button
            onClick={() => toggleAll(false)}
            className={`text-xs transition ${noneChecked ? 'text-gold' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {t('nb.deselectAll')}
          </button>
        </div>

        {/* sources list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">

          {/* All Conversations */}
          <div className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-2 transition cursor-pointer"
            onClick={() => toggleSource('all_conversations')}>
            <SourceCheckbox checked={!!checkedSources.all_conversations} onChange={() => toggleSource('all_conversations')} />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-100">{t('nb.allConversations')}</span>
                  <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-slate-400">{conversations.length}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500 truncate">{t('nb.allNotebookThreads')}</p>
              </div>
            </div>
          </div>

          {/* Individual conversations (when all_conversations is checked) */}
          {checkedSources.all_conversations && (
            <div className="ml-6 space-y-0.5 pb-1">
              {filteredConvs.map(conv => (
                <Link
                  key={conv.id}
                  href={`/freehold-intelligence/notebook/${conv.id}`}
                  className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-slate-400 hover:bg-surface-2 hover:text-slate-200 transition"
                >
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <span className="truncate">{conv.title}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Live Projects */}
          <div className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-2 transition cursor-pointer"
            onClick={() => toggleSource('live_projects')}>
            <SourceCheckbox checked={!!checkedSources.live_projects} onChange={() => toggleSource('live_projects')} />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-100">{t('nb.liveProjects')}</span>
                  <Link
                    href="/freehold-intelligence/inventory"
                    onClick={e => e.stopPropagation()}
                    className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-gold transition"
                  >
                    {t('nb.inventoryLink')}
                  </Link>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500 truncate">{projectCount == null ? '—' : t('nb.projectRecords', { count: projectCount })}</p>
              </div>
            </div>
          </div>

          {/* CRM Leads */}
          <div className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-2 transition cursor-pointer"
            onClick={() => toggleSource('crm_leads')}>
            <SourceCheckbox checked={!!checkedSources.crm_leads} onChange={() => toggleSource('crm_leads')} />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-100">{t('nb.crmLeads')}</span>
                  <Link
                    href="/freehold-intelligence/crm"
                    onClick={e => e.stopPropagation()}
                    className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-gold transition"
                  >
                    {t('nb.crmLink')}
                  </Link>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500 truncate">{leadCount == null ? '—' : t('nb.activeLeads', { count: leadCount })}</p>
              </div>
            </div>
          </div>

          {/* Market intelligence */}
          <div className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-2 transition cursor-pointer"
            onClick={() => toggleSource('market_intel')}>
            <SourceCheckbox checked={!!checkedSources.market_intel} onChange={() => toggleSource('market_intel')} />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <BarChart2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <span className="text-xs font-medium text-slate-100">{t('nb.marketIntel')}</span>
                <p className="mt-0.5 text-[10px] text-slate-500 truncate">{t('nb.marketIntelSub')}</p>
              </div>
            </div>
          </div>

          {/* Campaign performance */}
          <div className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-2 transition cursor-pointer"
            onClick={() => toggleSource('campaigns')}>
            <SourceCheckbox checked={!!checkedSources.campaigns} onChange={() => toggleSource('campaigns')} />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Megaphone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <span className="text-xs font-medium text-slate-100">{t('nb.campaignPerf')}</span>
                <p className="mt-0.5 text-[10px] text-slate-500 truncate">{t('nb.campaignPerfSub')}</p>
              </div>
            </div>
          </div>

          {/* Uploads */}
          <div className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-2 transition cursor-pointer"
            onClick={() => toggleSource('uploads')}>
            <SourceCheckbox checked={!!checkedSources.uploads} onChange={() => toggleSource('uploads')} />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-slate-100">{t('nb.uploads')}</span>
                  <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-slate-400">{customSources.length}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500 truncate">{t('nb.pdfsDocuments')}</p>
              </div>
            </div>
          </div>

          {/* Individual uploads */}
          {checkedSources.uploads && (
            <div className="ml-6 space-y-0.5 pb-1">
              {customSources.map(s => (
                <div
                  key={s.id}
                  className="flex items-center gap-1.5 rounded px-2 py-1.5 hover:bg-surface-2 transition cursor-pointer"
                  onClick={() => toggleSource(s.id)}
                >
                  <SourceCheckbox checked={!!checkedSources[s.id]} onChange={() => toggleSource(s.id)} />
                  <FileText className="h-3 w-3 shrink-0 text-slate-500" />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-300">{s.name}</p>
                    <p className="text-[10px] text-slate-600">{t('nb.addedSource')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* drop zone */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => { addFiles(e.target.files); e.target.value = '' }}
        />
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => { e.preventDefault(); setIsDragOver(false); addFiles(e.dataTransfer.files) }}
          className={[
            'mx-3 mb-3 flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-4 text-center transition cursor-pointer',
            isDragOver
              ? 'border-gold/50 bg-gold/5 text-gold'
              : 'border-line text-slate-600 hover:border-line-strong hover:text-slate-400',
          ].join(' ')}
        >
          <Upload className="h-4 w-4" />
          <p className="text-xs leading-tight">{t('nb.dropFilesHere')}<br /><span className="text-slate-700">{t('nb.orClickToUpload')}</span></p>
        </div>

      </aside>

      {/* ── CENTER PANEL — Chat / Outputs ─────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-line">

        {/* title bar */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-6 py-3.5">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-gold/70" />
            {editingTitle ? (
              <input
                autoFocus
                value={notebookTitle}
                onChange={e => setNotebookTitle(e.target.value)}
                onBlur={() => { if (!notebookTitle.trim()) setNotebookTitle(brandName); setEditingTitle(false) }}
                onKeyDown={e => { if (e.key === 'Enter') { if (!notebookTitle.trim()) setNotebookTitle(brandName); setEditingTitle(false) } }}
                className="rounded border border-gold/30 bg-transparent px-2 py-0.5 text-sm font-semibold text-white outline-none"
              />
            ) : (
              <span className="text-sm font-semibold text-white">{notebookTitle}</span>
            )}
            <button
              onClick={() => setEditingTitle(true)}
              className="text-slate-600 hover:text-slate-400 transition"
              aria-label={t('nb.editTitle')}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {((['chat', 'expert', 'library', 'saved', 'pinned'] as CenterTab[])).map(tab => (
              <button
                key={tab}
                onClick={() => setCenterTab(tab)}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition',
                  centerTab === tab
                    ? 'bg-surface-2 text-white'
                    : 'text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                {tab === 'saved' ? t('nb.savedOutputs') : tab === 'pinned' ? t('nb.pinned') : tab === 'expert' ? t('nb.expertChats') : tab === 'library' ? t('nb.library') : t('nb.chat')}
              </button>
            ))}
          </div>
        </div>

        {/* ── tab: chat ── */}
        {centerTab === 'chat' && (
          <>
            {/* messages */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center gap-3">
                  <Sparkles className="h-8 w-8 text-gold/30" />
                  <p className="text-sm text-slate-500 max-w-xs">
                    {t('nb.chatEmptyState')}
                  </p>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === 'user'
                      ? 'ml-8 rounded-2xl border border-line bg-surface px-4 py-3'
                      : m.opened
                        // A MODEL DOES NOT START CONVERSATIONS. Every chat
                        // anyone has used opens because a person typed first,
                        // so a message that simply appeared has to look unlike
                        // a reply or it reads as one that lost its question.
                        // One arrival, once — no looping motion afterwards.
                        ? 'agent-opened mr-8 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.05] px-4 py-3'
                        : 'mr-8 rounded-2xl border border-gold/12 bg-gold/[0.04] px-4 py-3'
                  }
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    {m.role === 'assistant'
                      ? <Sparkles className="h-3 w-3 text-gold/60" />
                      : <div className="h-3 w-3 rounded-full bg-surface-3" />}
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {m.role === 'assistant' ? t('nb.freeholdAi') : t('nb.you')}
                    </span>
                    {m.opened && (
                      <span className="text-[10px] font-medium text-slate-500">{t('nb.agentOpened')}</span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-[1.7] text-slate-100">{m.content}</p>
                </div>
              ))}
              {chatPending && (
                <div className="mr-8 flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                  <span className="text-xs text-slate-500">{workingOn || t('nb.thinking')}</span>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* suggestions + input */}
            <div className="border-t border-line px-4 py-4 space-y-3">
              {chatMessages.length === 0 && (
                <div className="flex flex-wrap gap-2">
                  {CHAT_SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => sendChat(t(s))}
                      className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-slate-400 transition hover:border-gold/25 hover:text-slate-200"
                    >
                      {t(s)}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-3 rounded-2xl border border-line-strong bg-surface px-4 py-3 transition focus-within:border-gold/30">
                <Sparkles className="mb-0.5 h-4 w-4 shrink-0 text-gold/50" />
                <textarea
                  ref={taRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat() } }}
                  rows={1}
                  placeholder={t('nb.composerPlaceholder')}
                  className="flex-1 resize-none bg-transparent text-sm leading-7 text-white outline-none placeholder:text-slate-600"
                />
                <button
                  onClick={() => sendChat()}
                  disabled={!chatInput.trim() || chatPending}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold text-ink transition hover:bg-gold-bright disabled:opacity-30"
                >
                  {chatPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── tab: Expert conversations — the side chat's full memory ── */}
        {centerTab === 'expert' && (
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {expertSessions.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-500">
                <History className="h-6 w-6 opacity-30" />
                <p className="text-sm">{t('nb.noExpertChats')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {expertSessions.map((s) => {
                  const isOpen = openExpertId === s.id
                  return (
                    <div key={s.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                      <div className="flex items-center gap-3 p-4">
                        <button onClick={() => toggleExpertSession(s.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gold/20 bg-gold/[0.06]">
                            <Sparkles className="h-3.5 w-3.5 text-gold" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-white">{s.title}</div>
                            <div className="mt-0.5 text-xs text-slate-500">
                              {t('nb.msgCount', { count: s.messageCount })} · {relativeTime(s.updatedAt, t)}
                            </div>
                          </div>
                          <ChevronRight className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </button>
                        <button
                          onClick={() => continueExpertSession(s.id)}
                          className="shrink-0 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90"
                        >
                          {t('nb.continueChat')}
                        </button>
                        <button
                          onClick={() => deleteExpertSession(s.id)}
                          title={t('common.delete')}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-red-400/10 hover:text-red-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {isOpen && (
                        <div className="max-h-96 space-y-2.5 overflow-y-auto border-t border-line bg-white/[0.02] p-4">
                          {openExpertTurns.length === 0 ? (
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('common.loading')}
                            </div>
                          ) : openExpertTurns.map((m, i) => (
                            <div
                              key={i}
                              className={
                                m.role === 'user'
                                  ? 'ml-8 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5'
                                  : 'mr-8 rounded-xl border border-gold/12 bg-gold/[0.04] px-3.5 py-2.5'
                              }
                            >
                              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-200">
                                {m.role === 'user' ? (m.content ?? '') : expertBlocksText(m.blocks)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── tab: Library — every produced asset on one shelf ── */}
        {centerTab === 'library' && (
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {/* Kind filter */}
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {(['All', ...LIB_KINDS] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setLibFilter(k as 'All' | LibraryKind)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition ${
                    libFilter === k ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line bg-surface text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {k === 'All' ? t('nb.lib.all') : t(`nb.lib.kind.${k}`)}
                </button>
              ))}
            </div>

            {/* Add media by URL — the shelf a media model will publish into */}
            <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
              <select
                value={libForm.kind}
                onChange={(e) => setLibForm((f) => ({ ...f, kind: e.target.value as LibraryKind }))}
                className="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-white outline-none"
              >
                {(['image', 'video', 'pdf'] as LibraryKind[]).map((k) => (
                  <option key={k} value={k}>{t(`nb.lib.kind.${k}`)}</option>
                ))}
              </select>
              <input
                value={libForm.title}
                onChange={(e) => setLibForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={t('nb.lib.titlePlaceholder')}
                className="min-w-[120px] flex-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-gold/40"
              />
              <input
                value={libForm.url}
                onChange={(e) => setLibForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://…"
                className="min-w-[160px] flex-[2] rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-white placeholder-slate-500 outline-none focus:border-gold/40"
              />
              <button
                onClick={addLibMedia}
                disabled={libSaving}
                className="rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
              >
                {libSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('common.add')}
              </button>
            </div>

            {libVisible.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-500">
                <LibraryIcon className="h-6 w-6 opacity-30" />
                <p className="text-sm">{t('nb.lib.empty')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {libVisible.map((item) => {
                  const isOpen = libOpenId === item.id
                  return (
                    <div key={item.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-2 text-slate-300">
                          {libIcon(item.kind)}
                        </div>
                        <button
                          onClick={() => item.content && setLibOpenId(isOpen ? null : item.id)}
                          className="min-w-0 flex-1 text-start"
                        >
                          <div className="truncate text-sm font-semibold text-white">{item.title}</div>
                          <div className="mt-0.5 text-xs capitalize text-slate-500">
                            {t(`nb.lib.kind.${item.kind}`)} · {relativeTime(item.createdAt, t)}
                          </div>
                        </button>
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noreferrer"
                            className="shrink-0 rounded-full border border-line-strong bg-surface-2 px-3 py-1 text-xs text-slate-200 transition hover:border-gold/40 hover:text-white">
                            {t('nb.lib.open')}
                          </a>
                        )}
                        <button onClick={() => deleteLibItem(item.id)}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-red-400/10 hover:text-red-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {isOpen && item.content && (
                        <div className="border-t border-line bg-white/[0.02] p-3">
                          {item.content.trimStart().startsWith('<') ? (
                            <iframe
                              title={item.title}
                              sandbox=""
                              srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#181613;padding:12px">${item.content}</body>`}
                              className="h-64 w-full rounded-lg border border-line bg-surface"
                            />
                          ) : (
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-app p-3 text-xs leading-relaxed text-slate-300">{item.content}</pre>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── tab: saved outputs ── */}
        {centerTab === 'saved' && (
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="mb-4 relative">
              <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={convQuery}
                onChange={e => setConvQuery(e.target.value)}
                placeholder={t('nb.searchConversations')}
                className="w-full rounded-xl border border-line bg-surface py-2 ps-9 pe-4 text-xs text-white placeholder-slate-500 outline-none transition focus:border-line-strong"
              />
            </div>

            {/* Persisted outputs — saved tables & reports from across the app */}
            {dbOutputs.length > 0 && (
              <div className="mb-5 space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('nb.savedReports')}</div>
                {dbOutputs.map(o => {
                  const isOpen = openOutput === o.id
                  const isHtml = o.type === 'comparison' || o.type === 'report' || o.content.trimStart().startsWith('<')
                  return (
                    <div key={o.id} className="overflow-hidden rounded-xl border border-line bg-surface">
                      <button
                        onClick={() => setOpenOutput(isOpen ? null : o.id)}
                        className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-surface-2"
                      >
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-2">
                          {outputTypeIcon(o.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-white">{o.title}</div>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                            <span className="capitalize">{o.type.replace(/_/g, ' ')}</span>
                            <span>·</span>
                            <span>{relativeTime(o.created_at, t)}</span>
                          </div>
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          title={pinnedIds.includes(o.id) ? t('nb.unpin') : t('nb.pin')}
                          onClick={(e) => { e.stopPropagation(); togglePin(o.id) }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); togglePin(o.id) } }}
                          className={`shrink-0 rounded-md p-1 transition ${pinnedIds.includes(o.id) ? 'text-gold' : 'text-slate-600 hover:text-gold'}`}
                        >
                          <Pin className="h-3.5 w-3.5" />
                        </span>
                        <ChevronRight className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="border-t border-line bg-white/[0.02] p-3">
                          {isHtml ? (
                            <iframe
                              title={o.title}
                              sandbox=""
                              srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#181613;padding:12px">${o.content}</body>`}
                              className="h-64 w-full rounded-lg border border-line bg-surface"
                            />
                          ) : (
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-app p-3 text-xs leading-relaxed text-slate-300">{o.content}</pre>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="space-y-2">
              {filteredConvs.map(conv => {
                const lastMsg = conv.messages[conv.messages.length - 1]
                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => resumeConversation(conv)}
                    className="group flex w-full items-start gap-3.5 rounded-xl border border-line bg-surface p-4 text-start transition hover:border-gold/20"
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-2">
                      <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-sm font-semibold text-white">{conv.title}</h3>
                        <span className="shrink-0 text-xs text-slate-500">{relativeTime(conv.updatedAt, t)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                        {lastMsg.role === 'assistant' ? t('nb.aiPrefix') : t('nb.youPrefix')}{lastMsg.content.slice(0, 100)}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span>{t('nb.msgCount', { count: conv.messages.length })}</span>
                        <span className="text-gold/60">{t('nb.tapToContinue')}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── tab: pinned ── */}
        {centerTab === 'pinned' && (
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {pinnedOutputs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-slate-500">
                <Pin className="h-6 w-6 opacity-30" />
                <p className="text-sm">{t('nb.noPinnedOutputs')}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pinnedOutputs.map(output => {
                  const isHtml = output.type === 'comparison' || output.type === 'report' || output.content.trimStart().startsWith('<')
                  return (
                    <div key={output.id} className="rounded-xl border border-gold/15 bg-gold/[0.03] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-gold/70">
                          {outputTypeIcon(output.type)}
                          <span className="capitalize">{output.type.replace(/_/g, ' ')}</span>
                        </div>
                        <button type="button" onClick={() => togglePin(output.id)} title={t('nb.unpin')} className="shrink-0 text-gold transition hover:opacity-70">
                          <Pin className="h-3 w-3" />
                        </button>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold text-white">{output.title}</h3>
                      {isHtml ? (
                        <iframe
                          title={output.title}
                          sandbox=""
                          srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#181613;padding:12px">${output.content}</body>`}
                          className="mt-2 h-48 w-full rounded-lg border border-line bg-surface"
                        />
                      ) : (
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-app p-3 text-xs leading-relaxed text-slate-300">{output.content}</pre>
                      )}
                      <div className="mt-2 text-xs text-slate-500">{relativeTime(output.created_at, t)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── RIGHT PANEL — Studio ─────────────────────────────────────────── */}
      <aside className={`${mobilePanel === 'studio' ? 'absolute inset-x-0 bottom-0 top-16 z-[130] flex rounded-t-2xl border-t' : 'hidden'} w-auto flex-col overflow-hidden border-line bg-surface lg:static lg:flex lg:w-[320px] lg:shrink-0 lg:rounded-none lg:border-t-0 lg:border-l`}>

        {/* header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
          <span className="text-sm font-semibold text-white">{t('nb.studio')}</span>
          <button onClick={() => setMobilePanel(null)} className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 hover:text-white lg:hidden">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* generate section */}
          <div className="border-b border-line px-4 py-4">
            <p className="mb-3 text-xs font-medium text-slate-400">{t('nb.generate')}</p>
            <div className="grid grid-cols-4 gap-2">
              {GENERATE_TYPES.map(g => (
                <button
                  key={g.key}
                  onClick={() => setActiveGenerate(activeGenerate === g.key ? null : g.key)}
                  className={[
                    'flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition',
                    activeGenerate === g.key
                      ? 'border-gold/40 bg-gold/10 text-gold'
                      : 'border-line bg-surface-2 text-slate-400 hover:border-line-strong hover:text-slate-200',
                  ].join(' ')}
                >
                  {g.icon}
                  <span className="text-[10px] leading-tight">{t(g.labelKey)}</span>
                </button>
              ))}
            </div>

            {activeGenerate && (
              <div className="mt-3 rounded-xl border border-gold/20 bg-gold/[0.04] p-3">
                <p className="mb-2 text-xs font-medium text-gold/80 capitalize">
                  {(() => { const lk = GENERATE_TYPES.find(g => g.key === activeGenerate)?.labelKey; return lk ? t(lk) : '' })()}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    value={genInput}
                    onChange={e => setGenInput(e.target.value)}
                    placeholder={t('nb.describeToGenerate')}
                    className="flex-1 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none transition focus:border-gold/30"
                    onKeyDown={e => { if (e.key === 'Enter' && !genLoading) runGenerate() }}
                  />
                  <button
                    onClick={runGenerate}
                    disabled={genLoading}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gold text-ink transition hover:bg-gold-bright disabled:opacity-50"
                  >
                    {genLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {genResult && (
                  <div className="mt-2 rounded-lg border border-line bg-surface p-2.5">
                    <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">{genResult}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <button
                        onClick={saveGenerated}
                        disabled={genSaving}
                        className="text-[10px] font-medium text-gold/80 hover:text-gold disabled:opacity-50"
                      >
                        {genSaving ? t('nb.saving') : t('nb.saveToLibrary')}
                      </button>
                      <button
                        onClick={saveAndEdit}
                        disabled={genSaving}
                        className="text-[10px] font-medium text-gold/80 hover:text-gold disabled:opacity-50"
                      >
                        {t('nb.editInDrive')}
                      </button>
                      <button
                        onClick={() => { navigator.clipboard.writeText(genResult).catch(() => {}); toast.success(t('nb.copied')) }}
                        className="text-[10px] font-medium text-slate-400 hover:text-slate-200"
                      >
                        {t('nb.copyToClipboard')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* recent outputs */}
          <div className="px-4 py-4">
            <p className="mb-3 text-xs font-medium text-slate-400">{t('nb.recentOutputs')}</p>
            {dbOutputs.length === 0 ? (
              <p className="text-xs text-slate-500">{t('nb.noOutputsYet')}</p>
            ) : (
            <div className="space-y-2">
              {dbOutputs.slice(0, 6).map(output => (
                <div
                  key={output.id}
                  className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3 transition hover:border-line-strong"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line-strong text-slate-400">
                    {outputTypeIcon(output.type, 'h-3 w-3')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-100">{output.title}</span>
                    <span className="mt-0.5 block text-[10px] text-slate-500">{new Date(output.created_at).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })}</span>
                  </div>
                  <button
                    onClick={() => setActiveSendOutput(activeSendOutput === output.id ? null : output.id)}
                    className="shrink-0 rounded-lg border border-line-strong bg-surface-2 px-2 py-1 text-[10px] text-slate-400 transition hover:border-gold/30 hover:text-gold"
                  >
                    {t('nb.send')}
                  </button>
                </div>
              ))}
            </div>
            )}
          </div>

          {/* send to */}
          {activeSendOutput && (
            <div className="border-t border-line px-4 py-4">
              <p className="mb-2 text-xs font-medium text-slate-400">{t('nb.sendTo')}</p>
              <div className="flex flex-wrap gap-2">
                {SEND_DESTINATIONS.map(d => (
                  <button
                    key={d.key}
                    onClick={() => setActiveSendDest(activeSendDest === d.key ? null : d.key)}
                    className={[
                      'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition',
                      activeSendDest === d.key
                        ? 'border-gold/40 bg-gold/10 text-gold'
                        : 'border-line-strong text-slate-400 hover:border-line-strong hover:text-slate-200',
                    ].join(' ')}
                  >
                    {d.icon} {t(d.labelKey)}
                  </button>
                ))}
              </div>
              {activeSendDest === 'crm' && (
                <p className="mt-2 text-xs text-slate-500">
                  {leadCtx ? t('nb.crmAttachHint') : t('nb.crmNoLeadHint')}
                </p>
              )}
              {activeSendDest && (
                <button
                  onClick={async () => {
                    const output = dbOutputs.find(o => o.id === activeSendOutput)
                    const dest = SEND_DESTINATIONS.find(d => d.key === activeSendDest)
                    const destLabel = dest ? t(dest.labelKey) : t('nb.destinationFallback')
                    const title = output?.title ?? t('nb.notebookOutput')
                    const fullText = `${title}\n\n${output?.content ?? ''}`.trim()

                    // Real edge: attach the output to the originating lead's CRM timeline.
                    if (activeSendDest === 'crm') {
                      if (!leadCtx) { toast.error(t('nb.crmNoLeadHint')); return }
                      try {
                        const res = await fetch('/api/freehold/crm/activity', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ leadId: leadCtx, activityType: 'note', description: `[Notebook] ${fullText}` }),
                        })
                        if (!res.ok) throw new Error('failed')
                        toast.success(t('nb.sentTo', { label: destLabel }))
                        setActiveSendDest(null); setActiveSendOutput(null)
                      } catch {
                        toast.error(t('nb.sendFailed'))
                      }
                      return
                    }

                    // Download the output as a text file (the only remaining
                    // non-CRM destination).
                    const blob = new Blob([fullText], { type: 'text/plain' })
                    const url = URL.createObjectURL(blob); const a = document.createElement('a')
                    a.href = url; a.download = `${(output?.title ?? 'output').replace(/\s+/g, '-').toLowerCase()}.txt`
                    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
                    toast.success(t('nb.sentTo', { label: destLabel }))
                    setActiveSendDest(null); setActiveSendOutput(null)
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-gold-bright"
                >
                  <Send className="h-3.5 w-3.5" />
                  {t('nb.sendToLabel', { label: (() => { const lk = SEND_DESTINATIONS.find(d => d.key === activeSendDest)?.labelKey; return lk ? t(lk) : '' })() })}
                </button>
              )}
            </div>
          )}

        </div>
      </aside>

      {/* Mobile rails — Sources & Studio open as bottom sheets below lg */}
      {!mobilePanel && (
        <div className="absolute inset-x-0 bottom-4 z-[120] flex justify-center gap-2 lg:hidden">
          <button
            onClick={() => setMobilePanel('sources')}
            className="flex items-center gap-1.5 rounded-full border border-line-strong bg-chrome/95 px-4 py-2 text-xs font-semibold text-slate-200 shadow-xl shadow-black/40 backdrop-blur-xl"
          >
            <Search className="h-3.5 w-3.5 text-gold" /> {t('nb.sources')}
          </button>
          <button
            onClick={() => setMobilePanel('studio')}
            className="flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-semibold text-ink shadow-xl shadow-black/40"
          >
            <Sparkles className="h-3.5 w-3.5" /> {t('nb.studio')}
          </button>
        </div>
      )}

      <style jsx global>{`
        @keyframes agentArrive {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: none; }
        }
        .agent-opened { animation: agentArrive 0.35s ease-out 1; }
        @media (prefers-reduced-motion: reduce) { .agent-opened { animation: none; } }
      `}</style>
    </div>
  )
}
