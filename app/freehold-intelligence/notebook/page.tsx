'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  BookOpen, Pin, Sparkles, MessageSquare, FileText, Megaphone, GitBranch,
  Search, X, Hash, Plus, CheckSquare, Square, Upload, Pencil, Send,
  Users, Building2, FolderOpen, ChevronRight, ArrowUp, Loader2,
  BarChart2, Mail, Phone, Globe, FileImage, Layers, Newspaper,
} from 'lucide-react'
import { notebookConversations } from '@/src/features/freehold-intelligence/server-session'

// ── helpers ──────────────────────────────────────────────────────────────────

function outputTypeIcon(type: string, className = 'h-3.5 w-3.5') {
  if (type === 'ad_copy' || type === 'script') return <Megaphone className={className} />
  if (type === 'comparison') return <GitBranch className={className} />
  if (type === 'brochure' || type === 'pdf') return <FileText className={className} />
  return <MessageSquare className={className} />
}

function statusTone(status: string) {
  if (status === 'approved') return 'text-gold border-gold/20 bg-gold/10'
  if (status === 'sent_for_review') return 'text-[#F8E7AE] border-gold/20 bg-gold/10'
  if (status === 'saved') return 'text-sky-200 border-sky-400/20 bg-sky-400/10'
  return 'text-slate-400 border-line-strong bg-surface-2'
}

function relativeTime(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// ── data ─────────────────────────────────────────────────────────────────────

const allOutputs = notebookConversations.flatMap(c => c.savedOutputs)
const pinnedOutputs = allOutputs.filter(o => o.pinned)

type CenterTab = 'chat' | 'saved' | 'pinned'

// ── studio generate grid ─────────────────────────────────────────────────────

const GENERATE_TYPES = [
  { key: 'brochure',      label: 'Brochure',       icon: <FileText className="h-5 w-5" /> },
  { key: 'ad_copy',       label: 'Ad Copy',         icon: <Megaphone className="h-5 w-5" /> },
  { key: 'whatsapp',      label: 'WhatsApp',        icon: <Phone className="h-5 w-5" /> },
  { key: 'comparison',    label: 'Comparison',      icon: <GitBranch className="h-5 w-5" /> },
  { key: 'offer_letter',  label: 'Offer Letter',    icon: <FileImage className="h-5 w-5" /> },
  { key: 'script',        label: 'Script',          icon: <Layers className="h-5 w-5" /> },
  { key: 'market_report', label: 'Market Report',   icon: <BarChart2 className="h-5 w-5" /> },
  { key: 'social_post',   label: 'Social Post',     icon: <Newspaper className="h-5 w-5" /> },
]

const SEND_DESTINATIONS = [
  { key: 'crm',       label: 'CRM',       icon: <Users className="h-3.5 w-3.5" /> },
  { key: 'ads_live',  label: 'Ads Live',  icon: <Globe className="h-3.5 w-3.5" /> },
  { key: 'whatsapp',  label: 'WhatsApp',  icon: <Phone className="h-3.5 w-3.5" /> },
  { key: 'email',     label: 'Email',     icon: <Mail className="h-3.5 w-3.5" /> },
]

const MOCK_UPLOADS = [
  { id: 'upload_1', name: 'Palm_Investor_Pack_v3.pdf', type: 'pdf', size: '2.4 MB' },
  { id: 'upload_2', name: 'Dubai_Hills_Brochure.pdf',  type: 'pdf', size: '1.8 MB' },
  { id: 'upload_3', name: 'Market_Report_Q2_2026.pdf', type: 'pdf', size: '4.1 MB' },
]

const CHAT_SUGGESTIONS = [
  'Draft a WhatsApp for the hottest lead.',
  'Comparison: Palm vs Hills for AED 2.5M investor.',
  'Three Meta ad angles for Dubai Hills.',
  'Offer letter for Business Bay entry.',
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
  // left panel
  const [sourceQuery, setSourceQuery] = useState('')
  const [showAddSource, setShowAddSource] = useState(false)
  const [addSourceInput, setAddSourceInput] = useState('')
  const [checkedSources, setCheckedSources] = useState<Record<string, boolean>>({
    all_conversations: true,
    live_projects: false,
    crm_leads: false,
    uploads: false,
    ...Object.fromEntries(MOCK_UPLOADS.map(u => [u.id, false])),
  })
  const [isDragOver, setIsDragOver] = useState(false)

  // Persisted outputs (saved tables / reports) from the DB.
  type SavedOutput = { id: string; title: string; type: string; content: string; created_at: string }
  const [dbOutputs, setDbOutputs] = useState<SavedOutput[]>([])
  const [openOutput, setOpenOutput] = useState<string | null>(null)
  useEffect(() => {
    fetch('/api/freehold/notebook/save-output')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.outputs)) setDbOutputs(d.outputs) })
      .catch(() => {})
  }, [])

  // center panel
  const [centerTab, setCenterTab] = useState<CenterTab>('chat')
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const [chatPending, setChatPending] = useState(false)
  const [convQuery, setConvQuery] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [notebookTitle, setNotebookTitle] = useState('Freehold Intelligence')
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  // right panel
  const [activeGenerate, setActiveGenerate] = useState<string | null>(null)
  const [activeSendDest, setActiveSendDest] = useState<string | null>(null)
  const [activeSendOutput, setActiveSendOutput] = useState<string | null>(null)
  const [customSources, setCustomSources] = useState<{ id: string; name: string }[]>([])
  const [genInput, setGenInput] = useState('')
  const [genResult, setGenResult] = useState('')
  const [genLoading, setGenLoading] = useState(false)

  async function runGenerate() {
    const type = GENERATE_TYPES.find((g) => g.key === activeGenerate)
    if (!type) return
    setGenLoading(true); setGenResult('')
    try {
      const res = await fetch('/api/freehold/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Generate a ${type.label} for a Dubai real-estate workspace. ${genInput || ''}`.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.text) throw new Error(data?.error || 'Generation failed')
      setGenResult(data.text)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally { setGenLoading(false) }
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
    const base = [...notebookConversations].reverse()
    if (!q) return base
    return base.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.messages.some(m => m.content.toLowerCase().includes(q))
    )
  }, [convQuery])

  // chat send
  async function sendChat(text?: string) {
    const message = (text ?? chatInput).trim()
    if (!message || chatPending) return
    setChatMessages(m => [...m, { role: 'user', content: message }])
    setChatInput('')
    setChatPending(true)
    try {
      const res = await fetch('/api/freehold/server-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, role: 'owner' }),
      })
      const data = await res.json()
      const answer =
        data?.data?.answer || data?.answer || data?.message || data?.reply ||
        'I reviewed your notebook sources. Try one of the suggested prompts.'
      setChatMessages(m => [...m, { role: 'assistant', content: answer }])
    } catch {
      setChatMessages(m => [...m, { role: 'assistant', content: 'Could not reach the server. Try again in a moment.' }])
    } finally {
      setChatPending(false)
    }
  }

  return (
    <div className="flex overflow-hidden bg-ink" style={{ height: 'calc(100dvh - 56px)' }}>

      {/* ── LEFT PANEL — Sources ─────────────────────────────────────────── */}
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-line bg-app overflow-hidden lg:flex">

        {/* header */}
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3.5">
          <span className="text-sm font-semibold text-white">Sources</span>
          <button onClick={() => setShowAddSource((v) => !v)} className="flex items-center gap-1 rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1 text-xs text-slate-300 transition hover:border-gold/30 hover:text-gold">
            <Plus className="h-3 w-3" /> {showAddSource ? 'Cancel' : 'Add source'}
          </button>
        </div>

        {/* search */}
        <div className="relative border-b border-line px-3 py-2.5">
          <Search className="absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input
            value={sourceQuery}
            onChange={e => setSourceQuery(e.target.value)}
            placeholder="Search sources…"
            className="w-full rounded-lg border border-line bg-surface py-1.5 pl-8 pr-7 text-xs text-white placeholder-slate-500 outline-none transition focus:border-line-strong"
          />
          {sourceQuery && (
            <button onClick={() => setSourceQuery('')} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
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
              toast.success('Source added')
              setAddSourceInput('')
              setShowAddSource(false)
            }}
          >
            <input
              autoFocus
              value={addSourceInput}
              onChange={(e) => setAddSourceInput(e.target.value)}
              placeholder="Paste a URL…"
              className="flex-1 min-w-0 rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-gold/40"
            />
            <button type="submit" className="shrink-0 rounded-lg bg-gold/80 px-2.5 py-1.5 text-xs font-semibold text-black">Add</button>
          </form>
        )}

        {/* select all / deselect all */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-2">
          <button
            onClick={() => toggleAll(true)}
            className={`text-xs transition ${allChecked ? 'text-gold' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Select all
          </button>
          <span className="text-slate-700">·</span>
          <button
            onClick={() => toggleAll(false)}
            className={`text-xs transition ${noneChecked ? 'text-gold' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Deselect all
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
                  <span className="text-xs font-medium text-slate-100">All Conversations</span>
                  <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-slate-400">{notebookConversations.length}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500 truncate">All notebook threads</p>
              </div>
            </div>
          </div>

          {/* Individual conversations (when all_conversations is checked) */}
          {checkedSources.all_conversations && (
            <div className="ml-6 space-y-0.5 pb-1">
              {notebookConversations.map(conv => (
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
                  <span className="text-xs font-medium text-slate-100">Live Projects</span>
                  <Link
                    href="/freehold-intelligence/inventory"
                    onClick={e => e.stopPropagation()}
                    className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-gold transition"
                  >
                    Inventory ↗
                  </Link>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500 truncate">933 project records</p>
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
                  <span className="text-xs font-medium text-slate-100">CRM Leads</span>
                  <Link
                    href="/freehold-intelligence/crm"
                    onClick={e => e.stopPropagation()}
                    className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-gold transition"
                  >
                    CRM ↗
                  </Link>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500 truncate">18 active leads</p>
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
                  <span className="text-xs font-medium text-slate-100">Uploads</span>
                  <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-slate-400">{MOCK_UPLOADS.length}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-slate-500 truncate">PDFs & documents</p>
              </div>
            </div>
          </div>

          {/* Individual uploads */}
          {checkedSources.uploads && (
            <div className="ml-6 space-y-0.5 pb-1">
              {MOCK_UPLOADS.map(u => (
                <div
                  key={u.id}
                  className="flex items-center gap-1.5 rounded px-2 py-1.5 hover:bg-surface-2 transition cursor-pointer"
                  onClick={() => toggleSource(u.id)}
                >
                  <SourceCheckbox checked={!!checkedSources[u.id]} onChange={() => toggleSource(u.id)} />
                  <FileText className="h-3 w-3 shrink-0 text-slate-500" />
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-300">{u.name}</p>
                    <p className="text-[10px] text-slate-600">{u.size}</p>
                  </div>
                </div>
              ))}
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
                    <p className="text-[10px] text-slate-600">added source</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => { e.preventDefault(); setIsDragOver(false) }}
          className={[
            'mx-3 mb-3 flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-4 text-center transition cursor-pointer',
            isDragOver
              ? 'border-gold/50 bg-gold/5 text-gold'
              : 'border-line text-slate-600 hover:border-line-strong hover:text-slate-400',
          ].join(' ')}
        >
          <Upload className="h-4 w-4" />
          <p className="text-xs leading-tight">Drop files here<br /><span className="text-slate-700">or click to upload</span></p>
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
                onBlur={() => setEditingTitle(false)}
                onKeyDown={e => { if (e.key === 'Enter') setEditingTitle(false) }}
                className="rounded border border-gold/30 bg-transparent px-2 py-0.5 text-sm font-semibold text-white outline-none"
              />
            ) : (
              <span className="text-sm font-semibold text-white">{notebookTitle}</span>
            )}
            <button
              onClick={() => setEditingTitle(true)}
              className="text-slate-600 hover:text-slate-400 transition"
              aria-label="Edit title"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            {((['chat', 'saved', 'pinned'] as CenterTab[])).map(tab => (
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
                {tab === 'saved' ? 'Saved Outputs' : tab === 'pinned' ? 'Pinned' : 'Chat'}
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
                    Ask anything about your projects, leads, or campaigns. Your active sources are used as context.
                  </p>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === 'user'
                      ? 'ml-8 rounded-2xl border border-line bg-surface px-4 py-3'
                      : 'mr-8 rounded-2xl border border-gold/12 bg-gold/[0.04] px-4 py-3'
                  }
                >
                  <div className="mb-1.5 flex items-center gap-1.5">
                    {m.role === 'assistant'
                      ? <Sparkles className="h-3 w-3 text-gold/60" />
                      : <div className="h-3 w-3 rounded-full bg-surface-3" />}
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {m.role === 'assistant' ? 'Freehold AI' : 'You'}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-[1.7] text-slate-100">{m.content}</p>
                </div>
              ))}
              {chatPending && (
                <div className="mr-8 flex items-center gap-2 rounded-2xl border border-gold/12 bg-gold/[0.04] px-4 py-3">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gold/60" />
                  <span className="text-xs text-slate-500">Thinking…</span>
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
                      onClick={() => sendChat(s)}
                      className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-slate-400 transition hover:border-gold/25 hover:text-slate-200"
                    >
                      {s}
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
                  placeholder="Generate an offer, comparison, WhatsApp message, ad copy…"
                  className="flex-1 resize-none bg-transparent text-sm leading-7 text-white outline-none placeholder:text-slate-600"
                />
                <button
                  onClick={() => sendChat()}
                  disabled={!chatInput.trim() || chatPending}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gold text-ink transition hover:bg-[#E8C657] disabled:opacity-30"
                >
                  {chatPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── tab: saved outputs ── */}
        {centerTab === 'saved' && (
          <div className="flex-1 overflow-y-auto px-5 py-5">
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={convQuery}
                onChange={e => setConvQuery(e.target.value)}
                placeholder="Search conversations…"
                className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 outline-none transition focus:border-line-strong"
              />
            </div>

            {/* Persisted outputs — saved tables & reports from across the app */}
            {dbOutputs.length > 0 && (
              <div className="mb-5 space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Saved tables & reports</div>
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
                            <span>{relativeTime(o.created_at)}</span>
                          </div>
                        </div>
                        <ChevronRight className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                      </button>
                      {isOpen && (
                        <div className="border-t border-line bg-white/[0.02] p-3">
                          {isHtml ? (
                            <iframe
                              title={o.title}
                              sandbox=""
                              srcDoc={`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0B131F;padding:12px">${o.content}</body>`}
                              className="h-64 w-full rounded-lg border border-line bg-[#0B131F]"
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
                const outputCount = conv.savedOutputs.length
                return (
                  <Link
                    key={conv.id}
                    href={`/freehold-intelligence/notebook/${conv.id}`}
                    className="group flex items-start gap-3.5 rounded-xl border border-line bg-surface p-4 transition hover:border-gold/20"
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-2">
                      <Sparkles className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-sm font-semibold text-white">{conv.title}</h3>
                        <span className="shrink-0 text-xs text-slate-500">{relativeTime(conv.updatedAt)}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                        {lastMsg.role === 'assistant' ? 'AI: ' : 'You: '}{lastMsg.content.slice(0, 100)}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span>{conv.messages.length} msgs</span>
                        {outputCount > 0 && <span className="text-gold/60">{outputCount} outputs</span>}
                      </div>
                    </div>
                  </Link>
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
                <p className="text-sm">No pinned outputs yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pinnedOutputs.map(output => (
                  <Link
                    key={output.id}
                    href={`/freehold-intelligence/notebook/${output.conversationId}`}
                    className="group block rounded-xl border border-gold/15 bg-gold/[0.03] p-4 transition hover:border-gold/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gold/70">
                        {outputTypeIcon(output.type)}
                        <span className="capitalize">{output.type.replace(/_/g, ' ')}</span>
                      </div>
                      <Pin className="h-3 w-3 shrink-0 text-gold" />
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-white">{output.title}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-[1.6] text-slate-400">{output.content}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusTone(output.status)}`}>
                        {output.status.replace(/_/g, ' ')}
                      </span>
                      {output.tags.slice(0, 3).map(t => (
                        <span key={t} className="flex items-center gap-0.5 text-xs text-slate-500">
                          <Hash className="h-2.5 w-2.5" />{t}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── RIGHT PANEL — Studio ─────────────────────────────────────────── */}
      <aside className="hidden w-[320px] shrink-0 flex-col overflow-hidden border-l border-line bg-surface lg:flex">

        {/* header */}
        <div className="border-b border-line px-4 py-3.5">
          <span className="text-sm font-semibold text-white">Studio</span>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* generate section */}
          <div className="border-b border-line px-4 py-4">
            <p className="mb-3 text-xs font-medium text-slate-400">Generate</p>
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
                  <span className="text-[10px] leading-tight">{g.label}</span>
                </button>
              ))}
            </div>

            {activeGenerate && (
              <div className="mt-3 rounded-xl border border-gold/20 bg-gold/[0.04] p-3">
                <p className="mb-2 text-xs font-medium text-gold/80 capitalize">
                  {GENERATE_TYPES.find(g => g.key === activeGenerate)?.label}
                </p>
                <div className="flex items-center gap-2">
                  <input
                    value={genInput}
                    onChange={e => setGenInput(e.target.value)}
                    placeholder="Describe what to generate…"
                    className="flex-1 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs text-white placeholder-slate-600 outline-none transition focus:border-gold/30"
                    onKeyDown={e => { if (e.key === 'Enter' && !genLoading) runGenerate() }}
                  />
                  <button
                    onClick={runGenerate}
                    disabled={genLoading}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gold text-ink transition hover:bg-[#E8C657] disabled:opacity-50"
                  >
                    {genLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
                  </button>
                </div>
                {genResult && (
                  <div className="mt-2 rounded-lg border border-line bg-surface p-2.5">
                    <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300">{genResult}</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(genResult).catch(() => {}); toast.success('Copied') }}
                      className="mt-2 text-[10px] font-medium text-gold/80 hover:text-gold"
                    >
                      Copy to clipboard
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* recent outputs */}
          <div className="px-4 py-4">
            <p className="mb-3 text-xs font-medium text-slate-400">Recent Outputs</p>
            <div className="space-y-2">
              {allOutputs.slice(0, 6).map(output => (
                <div
                  key={output.id}
                  className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3 transition hover:border-line-strong"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-line-strong text-slate-400">
                    {outputTypeIcon(output.type, 'h-3 w-3')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-medium text-slate-100">{output.title}</span>
                      {output.pinned && <Pin className="h-2.5 w-2.5 shrink-0 text-gold" />}
                    </div>
                    <span className={`mt-0.5 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize ${statusTone(output.status)}`}>
                      {output.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveSendOutput(activeSendOutput === output.id ? null : output.id)}
                    className="shrink-0 rounded-lg border border-line-strong bg-surface-2 px-2 py-1 text-[10px] text-slate-400 transition hover:border-gold/30 hover:text-gold"
                  >
                    Send
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* send to */}
          {activeSendOutput && (
            <div className="border-t border-line px-4 py-4">
              <p className="mb-2 text-xs font-medium text-slate-400">Send to…</p>
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
                    {d.icon} {d.label}
                  </button>
                ))}
              </div>
              {activeSendDest && (
                <button
                  onClick={() => {
                    const output = allOutputs.find(o => o.id === activeSendOutput)
                    const dest = SEND_DESTINATIONS.find(d => d.key === activeSendDest)
                    const text = `${output?.title ?? 'Notebook output'} (${output?.type ?? 'note'})`
                    if (activeSendDest === 'download') {
                      const blob = new Blob([text], { type: 'text/plain' })
                      const url = URL.createObjectURL(blob); const a = document.createElement('a')
                      a.href = url; a.download = `${(output?.title ?? 'output').replace(/\s+/g, '-').toLowerCase()}.txt`
                      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
                    } else {
                      navigator.clipboard.writeText(text).catch(() => {})
                    }
                    toast.success(`Sent to ${dest?.label ?? 'destination'}`)
                    setActiveSendDest(null); setActiveSendOutput(null)
                  }}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#E8C657]"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send to {SEND_DESTINATIONS.find(d => d.key === activeSendDest)?.label}
                </button>
              )}
            </div>
          )}

        </div>
      </aside>

    </div>
  )
}
