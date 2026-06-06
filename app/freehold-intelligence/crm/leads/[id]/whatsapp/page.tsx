'use client'

import {
  useState, useEffect, useRef, useCallback,
} from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft, Send, Sparkles, BookOpen, Brain,
  Phone, RefreshCw, LogOut, Wifi, WifiOff,
  SmilePlus, Paperclip, Mic, MoreVertical,
  Check, CheckCheck, Clock, X, Copy,
  ChevronDown, AlertCircle,
} from 'lucide-react'
import { crmLeads } from '@/src/features/freehold-intelligence/server-session'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'

// ── Types ────────────────────────────────────────────────────────────────────

interface WAStatus {
  status: 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
  qrDataUrl: string | null
  connectedPhone: string | null
  connectedName: string | null
}

interface WAMessage {
  id: string
  from: string
  to: string
  body: string
  timestamp: number
  fromMe: boolean
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'error'
  type: string
}

interface AISuggestion {
  suggestions: string[]
  extractedData?: {
    budget?: string
    location?: string
    bedrooms?: string
    timeline?: string
    purpose?: string
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString('en-AE', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai',
  })
}
function fmtDate(ts: number) {
  const d = new Date(ts * 1000)
  const today = new Date()
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-AE', { dateStyle: 'long' })
}
function groupByDate(messages: WAMessage[]) {
  const groups: { label: string; messages: WAMessage[] }[] = []
  let cur = ''
  for (const m of messages) {
    const label = fmtDate(m.timestamp)
    if (label !== cur) { groups.push({ label, messages: [] }); cur = label }
    groups[groups.length - 1].messages.push(m)
  }
  return groups
}
function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

// ── Status icon ───────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: WAMessage['status'] }) {
  if (status === 'read')      return <CheckCheck className="h-3.5 w-3.5 text-sky-400" />
  if (status === 'delivered') return <CheckCheck className="h-3.5 w-3.5 text-white/40" />
  if (status === 'sent')      return <Check className="h-3.5 w-3.5 text-white/40" />
  if (status === 'error')     return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
  return <Clock className="h-3.5 w-3.5 text-white/25" />
}

// ── QR Setup Screen ───────────────────────────────────────────────────────────

function QRSetup({ status, onRetry }: { status: WAStatus; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
        <svg viewBox="0 0 24 24" className="h-8 w-8 fill-emerald-400" aria-hidden>
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.113.55 4.1 1.513 5.826L0 24l6.335-1.492A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-4.991-1.366l-.358-.212-3.76.885.924-3.661-.233-.376A9.772 9.772 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
        </svg>
      </div>

      {status.status === 'qr_ready' && status.qrDataUrl ? (
        <>
          <div>
            <h2 className="text-[18px] font-semibold text-white">Scan with your phone</h2>
            <p className="mt-1 text-[13px] text-white/40">
              Open WhatsApp → ⋮ Menu → Linked Devices → Link a Device
            </p>
          </div>
          <div className="rounded-[20px] border-4 border-white/90 bg-white p-3 shadow-2xl">
            <Image src={status.qrDataUrl} alt="WhatsApp QR code" width={240} height={240} unoptimized />
          </div>
          <p className="text-[12px] text-white/30">QR expires in 60 seconds. Scan quickly.</p>
        </>
      ) : status.status === 'connecting' ? (
        <>
          <h2 className="text-[18px] font-semibold text-white">Connecting…</h2>
          <p className="text-[13px] text-white/40">Generating QR code, please wait.</p>
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
        </>
      ) : (
        <>
          <h2 className="text-[18px] font-semibold text-white">Connect WhatsApp</h2>
          <p className="max-w-xs text-[13px] text-white/40">
            Link your WhatsApp to the CRM once. All your conversations will appear here in real-time. No API or business account required.
          </p>
          <button onClick={onRetry}
            className="rounded-full bg-emerald-500 px-6 py-2.5 text-[13px] font-semibold text-white transition hover:bg-emerald-400">
            Connect WhatsApp
          </button>
        </>
      )}
    </div>
  )
}

// ── AI Suggestions Panel ──────────────────────────────────────────────────────

function AiPanel({
  leadName, phone, messages, inventoryCtx, onSelect, onClose,
}: {
  leadName: string
  phone: string
  messages: WAMessage[]
  inventoryCtx: typeof inventoryProperties
  onSelect: (text: string) => void
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setLoading(true); setError(null); setSuggestions([])
    try {
      const res = await fetch('/api/whatsapp/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.slice(-20).map((m) => ({
            id: m.id, direction: m.fromMe ? 'outbound' : 'inbound',
            type: 'text', body: m.body,
            timestamp: new Date(m.timestamp * 1000).toISOString(),
            status: m.status,
          })),
          lead: { name: leadName, phone },
          inventoryContext: inventoryCtx.slice(0, 5).map((p) => ({
            name: p.name, area: p.area, startingPriceAED: p.startingPriceAED,
            roi: p.roi, bedrooms: p.bedrooms, paymentPlan: p.paymentPlan, handoverYear: p.handoverYear,
          })),
        }),
      })
      const data = await res.json() as AISuggestion
      setSuggestions(data.suggestions ?? [])
    } catch {
      setError('Could not reach AI — check ANTHROPIC_API_KEY')
    } finally {
      setLoading(false)
    }
  }, [messages, leadName, phone, inventoryCtx])

  useEffect(() => { generate() }, [])

  return (
    <div className="flex w-72 shrink-0 flex-col border-l border-slate-800 bg-[#0A0E14]">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
          <Sparkles className="h-4 w-4 text-[#D4AF37]" /> AI Replies
        </div>
        <button onClick={onClose} className="rounded p-1 text-white/35 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
        {loading && (
          <div className="flex items-center gap-2 py-4 text-[13px] text-white/35">
            <RefreshCw className="h-4 w-4 animate-spin" /> Analysing conversation…
          </div>
        )}
        {error && <p className="text-[12px] text-red-400/80">{error}</p>}
        {suggestions.map((s, i) => (
          <button key={i} onClick={() => onSelect(s)}
            className="w-full rounded-[14px] border border-slate-800 bg-slate-900 px-3.5 py-3 text-left text-xs leading-relaxed text-slate-300 transition hover:border-[#D4AF37]/30 hover:text-white active:scale-[0.98]">
            {s}
          </button>
        ))}
        {!loading && !error && suggestions.length === 0 && (
          <p className="py-4 text-center text-[12px] text-white/25">No suggestions generated.</p>
        )}
        <button onClick={generate} disabled={loading}
          className="mt-1 w-full rounded-full border border-white/[0.08] py-2 text-[12px] text-white/40 transition hover:text-white/70 disabled:opacity-40">
          {loading ? 'Generating…' : '↻ Regenerate'}
        </button>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WhatsAppPage({ params }: { params: { id: string } }) {
  const lead = crmLeads.find((l) => l.id === params.id)
  if (!lead) return null

  const phone = lead.phone.replace(/\D/g, '')

  // ── State ──────────────────────────────────────────────────────────────────
  const [waStatus, setWaStatus] = useState<WAStatus>({
    status: 'disconnected', qrDataUrl: null, connectedPhone: null, connectedName: null,
  })
  const [messages, setMessages] = useState<WAMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showAI, setShowAI] = useState(false)
  const [copied, setCopied] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // ── Inventory matches ──────────────────────────────────────────────────────
  const invMatches = inventoryProperties
    .filter((p) => {
      const budget = lead.budgetAED ?? ''
      const nums = budget.match(/[\d.]+/g)?.map(Number) ?? []
      const max = nums[1] ? nums[1] * 1_000_000 : nums[0] ? nums[0] * 1_000_000 : Infinity
      return p.startingPriceAED ? p.startingPriceAED <= max * 1.2 : true
    })
    .sort((a, b) => b.adReadiness - a.adReadiness)
    .slice(0, 3)

  // ── Fetch WA status ────────────────────────────────────────────────────────
  const pollStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp/status')
      const data = await res.json() as WAStatus
      setWaStatus(data)
    } catch { /* network error — ignore */ }
  }, [])

  // ── Fetch message history ──────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/whatsapp/history?phone=${phone}`)
      const data = await res.json() as { messages: WAMessage[] }
      setMessages(data.messages ?? [])
    } catch { /* ignore */ }
  }, [phone])

  // ── SSE real-time stream ───────────────────────────────────────────────────
  const connectStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }
    const es = new EventSource(`/api/whatsapp/stream?phone=${phone}`)
    es.addEventListener('message', (e: MessageEvent) => {
      const msg = JSON.parse(e.data) as WAMessage
      setMessages((prev) => {
        const exists = prev.find((m) => m.id === msg.id)
        if (exists) {
          // update status if we already have this message
          return prev.map((m) => m.id === msg.id ? { ...m, status: msg.status } : m)
        }
        return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp)
      })
    })
    es.onerror = () => {
      // SSE reconnects automatically — close and let browser retry
      es.close()
      setTimeout(connectStream, 5000)
    }
    eventSourceRef.current = es
  }, [phone])

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    pollStatus()
    const interval = setInterval(() => {
      pollStatus()
      if (waStatus.status === 'connected') fetchHistory()
    }, 3000)
    return () => clearInterval(interval)
  }, [pollStatus, fetchHistory, waStatus.status])

  useEffect(() => {
    if (waStatus.status === 'connected') {
      fetchHistory()
      connectStream()
    }
    return () => { eventSourceRef.current?.close() }
  }, [waStatus.status, fetchHistory, connectStream])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send ──────────────────────────────────────────────────────────────────
  async function handleSend() {
    const body = input.trim()
    if (!body || sending) return
    setSending(true)
    setInput('')

    const optimistic: WAMessage = {
      id: `opt_${Date.now()}`,
      from: '', to: phone,
      body, timestamp: Math.floor(Date.now() / 1000),
      fromMe: true, status: 'pending', type: 'text',
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: lead!.phone, body }),
      })
      const sent = await res.json() as WAMessage
      setMessages((prev) =>
        prev.map((m) => m.id === optimistic.id ? { ...sent, status: 'sent' } : m),
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === optimistic.id ? { ...m, status: 'error' } : m),
      )
    }
    setSending(false)
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  async function disconnect() {
    await fetch('/api/whatsapp/disconnect', { method: 'POST' })
    setWaStatus({ status: 'disconnected', qrDataUrl: null, connectedPhone: null, connectedName: null })
    setMessages([])
    eventSourceRef.current?.close()
  }

  const grouped = groupByDate(messages)
  const isConnected = waStatus.status === 'connected'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-100px)] overflow-hidden bg-[#111B21]">

      {/* ── Left sidebar: lead + inventory ───────────────────────────────── */}
      <aside className="hidden w-[340px] shrink-0 flex-col border-r border-white/[0.07] bg-[#202C33] lg:flex">

        {/* Sidebar header */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3.5">
          <Link href={`/freehold-intelligence/crm/leads/${lead.id}`}
            className="rounded-full p-1 text-white/40 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2A3942] text-[13px] font-bold text-white/70">
            {initials(lead.name)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-white">{lead.name}</div>
            <div className="text-[12px] text-white/40">{lead.phone}</div>
          </div>
          {isConnected && (
            <button onClick={disconnect} title="Disconnect WhatsApp"
              className="ml-auto rounded-full p-1.5 text-white/25 transition hover:text-red-400">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Lead info */}
          <div className="border-b border-white/[0.05] px-4 py-4 space-y-2.5">
            <div className="text-[10px] font-medium uppercase tracking-wider text-white/25">Lead Details</div>
            {[
              { label: 'Stage',    value: lead.pipelineStage },
              { label: 'Budget',   value: lead.budgetAED },
              { label: 'Interest', value: lead.projectInterest },
              { label: 'Agent',    value: lead.assignedAgent },
              { label: 'Intent',   value: `${lead.intentScore}/100` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between gap-3 text-[12px]">
                <span className="text-white/30">{label}</span>
                <span className="truncate text-right text-white/65">{value}</span>
              </div>
            ))}
          </div>

          {/* AI next action */}
          <div className="border-b border-white/[0.05] px-4 py-3.5">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[#D4AF37]/60">
              <Brain className="h-3 w-3" /> AI Next Action
            </div>
            <p className="text-[12px] leading-relaxed text-white/60">{lead.nextBestAction}</p>
          </div>

          {/* Inventory matches */}
          <div className="px-4 py-3.5">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/25">Properties to Share</div>
            <div className="space-y-2">
              {invMatches.map((p) => (
                <button key={p.id}
                  onClick={() => setInput(
                    `I'd like to share a property that matches your requirements:\n\n*${p.name}* — ${p.area}\nFrom ${p.startingPriceAED ? `AED ${(p.startingPriceAED / 1e6).toFixed(1)}M` : 'price on request'} · ${p.bedrooms} BR${p.roi ? ` · ${p.roi}% ROI` : ''}\n${p.paymentPlan ?? ''}\n\nWould you like to know more?`,
                  )}
                  className="group w-full rounded-[12px] border border-white/[0.07] bg-[#2A3942] px-3 py-2.5 text-left transition hover:border-emerald-500/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-medium text-white/80 group-hover:text-white">{p.name}</div>
                      <div className="text-[10px] text-white/35">{p.area} · {p.bedrooms}</div>
                    </div>
                    {p.startingPriceAED && (
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] font-semibold text-emerald-400">
                          AED {(p.startingPriceAED / 1e6).toFixed(1)}M
                        </div>
                        {p.roi && <div className="text-[10px] text-white/30">{p.roi}%</div>}
                      </div>
                    )}
                  </div>
                  <div className="mt-1.5 text-[10px] text-emerald-400/50 group-hover:text-emerald-400">
                    ↑ Click to compose message
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Notebook */}
          <div className="border-t border-white/[0.05] px-4 py-3">
            <Link href={`/freehold-intelligence/notebook?lead=${lead.id}`}
              className="flex items-center gap-2 text-[12px] text-white/35 transition hover:text-[#D4AF37]">
              <BookOpen className="h-3.5 w-3.5" /> View in Notebook
            </Link>
          </div>
        </div>
      </aside>

      {/* ── Main chat area ───────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Chat header — WhatsApp Web style */}
        <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#202C33] px-4">
          <Link href={`/freehold-intelligence/crm/leads/${lead.id}`}
            className="flex-shrink-0 rounded-full p-1 text-white/40 transition hover:text-white lg:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2A3942] text-[13px] font-bold text-white/70">
            {initials(lead.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-white">{lead.name}</div>
            <div className="flex items-center gap-1.5 text-[12px]">
              {isConnected ? (
                <><Wifi className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">Connected</span></>
              ) : (
                <><WifiOff className="h-3 w-3 text-white/30" /><span className="text-white/30">Not connected</span></>
              )}
              {waStatus.connectedPhone && (
                <span className="ml-1 text-white/20">· via {waStatus.connectedPhone}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <a href={`tel:${lead.phone}`}
              className="rounded-full p-2 text-white/40 transition hover:bg-white/[0.06] hover:text-white">
              <Phone className="h-4 w-4" />
            </a>
            <button onClick={() => setShowAI((v) => !v)}
              className={`rounded-full p-2 transition hover:bg-white/[0.06] ${showAI ? 'text-[#D4AF37]' : 'text-white/40 hover:text-white'}`}>
              <Sparkles className="h-4 w-4" />
            </button>
            <button className="rounded-full p-2 text-white/40 transition hover:bg-white/[0.06] hover:text-white">
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Message area */}
        <div className="relative flex flex-1 overflow-hidden">

          {/* Chat messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)`,
              backgroundSize: '20px 20px',
            }}
          >
            {!isConnected ? (
              <QRSetup status={waStatus} onRetry={() => fetch('/api/whatsapp/status')} />
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <svg viewBox="0 0 24 24" className="h-8 w-8 fill-emerald-400/40" aria-hidden>
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.113.55 4.1 1.513 5.826L0 24l6.335-1.492A11.933 11.933 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-4.991-1.366l-.358-.212-3.76.885.924-3.661-.233-.376A9.772 9.772 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182c5.43 0 9.818 4.388 9.818 9.818 0 5.43-4.388 9.818-9.818 9.818z"/>
                  </svg>
                </div>
                <p className="mt-3 text-[14px] font-medium text-white/40">No messages yet</p>
                <p className="mt-1 max-w-xs text-[12px] text-white/25">Send a message to {lead.name} or wait for them to reach out.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {grouped.map((group) => (
                  <div key={group.label}>
                    {/* Date chip */}
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full bg-[#182229] px-3 py-1 text-[11px] text-white/40 shadow">
                        {group.label}
                      </span>
                    </div>

                    {group.messages.map((msg, i) => {
                      const isMe = msg.fromMe
                      const prevSame = i > 0 && group.messages[i - 1].fromMe === isMe
                      return (
                        <div key={msg.id}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${prevSame ? 'mt-0.5' : 'mt-2'}`}>
                          <div className={`group relative max-w-[65%] min-w-[80px] ${isMe ? '' : ''}`}>
                            {/* Bubble */}
                            <div className={`rounded-[18px] px-3.5 py-2 shadow-sm ${
                              isMe
                                ? 'rounded-tr-[4px] bg-[#005C4B] text-white'
                                : 'rounded-tl-[4px] bg-[#202C33] text-white'
                            }`}>
                              <p className="whitespace-pre-wrap text-[13.5px] leading-[1.55]">{msg.body}</p>
                              <div className={`mt-0.5 flex items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <span className="text-[10px] text-white/35">{fmtTime(msg.timestamp)}</span>
                                {isMe && <StatusIcon status={msg.status} />}
                              </div>
                            </div>
                            {/* Hover copy */}
                            <button
                              onClick={() => { navigator.clipboard.writeText(msg.body); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                              className={`absolute -top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-[#2A3942] text-white/40 transition hover:text-white group-hover:flex ${isMe ? '-left-8' : '-right-8'}`}>
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* AI suggestions panel (slides in from right) */}
          {showAI && isConnected && (
            <AiPanel
              leadName={lead.name}
              phone={lead.phone}
              messages={messages}
              inventoryCtx={invMatches}
              onSelect={(text) => { setInput(text); setShowAI(false); inputRef.current?.focus() }}
              onClose={() => setShowAI(false)}
            />
          )}
        </div>

        {/* Input bar — WhatsApp Web style */}
        {isConnected && (
          <div className="shrink-0 bg-[#202C33] px-4 py-3">
            {/* AI suggestion strip */}
            {input === '' && (
              <button onClick={() => setShowAI(true)}
                className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-[#D4AF37]/20 py-1.5 text-[11px] text-[#D4AF37]/50 transition hover:border-[#D4AF37]/40 hover:text-[#D4AF37]">
                <Sparkles className="h-3 w-3" /> Ask AI to suggest a reply
              </button>
            )}

            <div className="flex items-end gap-2">
              {/* Emoji */}
              <button className="shrink-0 rounded-full p-2 text-white/40 transition hover:text-white/70">
                <SmilePlus className="h-5 w-5" />
              </button>
              {/* Attachment */}
              <button className="shrink-0 rounded-full p-2 text-white/40 transition hover:text-white/70">
                <Paperclip className="h-5 w-5" />
              </button>

              {/* Text input */}
              <div className="flex flex-1 items-end rounded-[22px] bg-[#2A3942] px-4 py-2.5">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Type a message"
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-[14px] text-white placeholder:text-white/30 focus:outline-none"
                  style={{ maxHeight: 120, lineHeight: '1.4' }}
                />
              </div>

              {/* Send / Mic */}
              {input.trim() ? (
                <button onClick={handleSend} disabled={sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white transition hover:bg-emerald-400 disabled:opacity-50">
                  {sending
                    ? <RefreshCw className="h-5 w-5 animate-spin" />
                    : <Send className="h-4.5 w-4.5" />
                  }
                </button>
              ) : (
                <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00A884] text-white transition hover:bg-emerald-400">
                  <Mic className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Copied toast */}
      {copied && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#2A3942] px-4 py-2 text-[12px] text-white/70 shadow-lg">
          Copied
        </div>
      )}
    </div>
  )
}
