'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Send, Sparkles, BookOpen, ChevronRight,
  CheckCheck, Check, Clock, Phone, Brain, Zap,
  MessageSquareMore, RefreshCw, X, Copy, LayoutGrid,
  AlertCircle, Wifi, WifiOff,
} from 'lucide-react'
import { crmLeads } from '@/src/features/freehold-intelligence/server-session'
import { inventoryProperties } from '@/src/features/freehold-intelligence/inventory'
import {
  waConversations,
  type WAMessage,
  type WAExtractedData,
  type WAConversation,
} from '@/src/features/freehold-intelligence/whatsapp-conversations'
import { notFound } from 'next/navigation'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' })
}
function fmtDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const diff = (today.getTime() - d.getTime()) / 86400000
  if (diff < 1) return 'Today'
  if (diff < 2) return 'Yesterday'
  return d.toLocaleDateString('en-AE', { dateStyle: 'medium' })
}
function groupByDate(messages: WAMessage[]) {
  const groups: { date: string; messages: WAMessage[] }[] = []
  let currentDate = ''
  for (const msg of messages) {
    const date = fmtDate(msg.timestamp)
    if (date !== currentDate) { groups.push({ date, messages: [] }); currentDate = date }
    groups[groups.length - 1].messages.push(msg)
  }
  return groups
}

const STAGE_COLOR: Record<string, string> = {
  new: 'text-sky-400', contacted: 'text-amber-400', qualified: 'text-violet-400',
  viewing: 'text-blue-400', negotiation: 'text-orange-400', closed: 'text-emerald-400', lost: 'text-red-400/50',
}
const TEMP_COLOR: Record<string, string> = {
  priority: 'text-[#D4AF37]', hot: 'text-red-400', warm: 'text-amber-400', cold: 'text-white/30',
}
function fmtPrice(n: number | null) {
  if (!n) return '—'
  return n >= 1e6 ? `AED ${(n / 1e6).toFixed(1)}M` : `AED ${(n / 1000).toFixed(0)}K`
}

// ── Status icons ─────────────────────────────────────────────────────────────

function MsgStatusIcon({ status }: { status: WAMessage['status'] }) {
  if (status === 'read')      return <CheckCheck className="h-3 w-3 text-sky-400" />
  if (status === 'delivered') return <CheckCheck className="h-3 w-3 text-white/30" />
  if (status === 'sent')      return <Check className="h-3 w-3 text-white/30" />
  if (status === 'pending')   return <Clock className="h-3 w-3 text-white/20" />
  return <AlertCircle className="h-3 w-3 text-red-400" />
}

// ── Recap modal ───────────────────────────────────────────────────────────────

interface RecapData {
  summary: string
  keyPoints: string[]
  nextSteps: string[]
  extractedData: Partial<WAExtractedData>
  notebookEntry: { title: string; body: string; tags: string[] }
}

function RecapModal({ data, onClose, onSave }: { data: RecapData; onClose: () => void; onSave: () => void }) {
  const [saved, setSaved] = useState(false)
  function handleSave() { setSaved(true); onSave() }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-[20px] border border-white/[0.1] bg-[#0F1624] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-[#D4AF37]" />
            <span className="text-[14px] font-semibold text-white">AI Conversation Recap</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-white/40 transition hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
          {/* Summary */}
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[#D4AF37]/70">Summary</div>
            <p className="text-[13px] leading-relaxed text-white/80">{data.summary}</p>
          </div>
          {/* Key points */}
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/35">Key Points</div>
            <ul className="space-y-1.5">
              {data.keyPoints.map((pt, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-white/70">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#D4AF37]" />
                  {pt}
                </li>
              ))}
            </ul>
          </div>
          {/* Next steps */}
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/35">Next Steps</div>
            <ol className="space-y-1.5">
              {data.nextSteps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-white/70">
                  <span className="shrink-0 text-[11px] font-bold text-[#D4AF37]/60">{i + 1}.</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
          {/* Extracted data */}
          {data.extractedData && (
            <div>
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/35">Extracted Data</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(data.extractedData)
                  .filter(([k, v]) => v && k !== 'confidence')
                  .map(([k, v]) => (
                    <div key={k} className="rounded-[10px] border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                      <div className="text-[10px] text-white/25 capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</div>
                      <div className="mt-0.5 text-[12px] text-white/70">{String(v)}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          {/* Notebook entry preview */}
          <div className="rounded-[12px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] p-4">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-[#D4AF37]/70">
              <BookOpen className="h-3 w-3" /> Notebook entry preview
            </div>
            <div className="text-[12px] font-medium text-white/80">{data.notebookEntry.title}</div>
            <div className="mt-1.5 text-[11px] leading-relaxed text-white/45 line-clamp-3">{data.notebookEntry.body}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {data.notebookEntry.tags.map((t) => (
                <span key={t} className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/35">{t}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 border-t border-white/[0.07] px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-full border border-white/[0.1] py-2 text-[13px] text-white/50 transition hover:text-white">
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={saved}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[13px] font-medium transition ${
              saved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#D4AF37] text-[#06080A] hover:bg-[#F0CB67]'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            {saved ? 'Saved to Notebook' : 'Save to Notebook'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WhatsAppConversationPage({ params }: { params: { id: string } }) {
  const lead = crmLeads.find((l) => l.id === params.id)
  if (!lead) return notFound()

  // Find or create conversation
  const existingConv = waConversations.find((c) => c.leadId === params.id)
  const initMessages: WAMessage[] = existingConv?.messages ?? []
  const initExtracted: Partial<WAExtractedData> = existingConv?.extractedData ?? {}

  const [messages, setMessages] = useState<WAMessage[]>(initMessages)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  // AI assist state
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // Extracted data state
  const [extracted, setExtracted] = useState<Partial<WAExtractedData>>(initExtracted)
  const [extractedApplied, setExtractedApplied] = useState(false)

  // Recap state
  const [recapLoading, setRecapLoading] = useState(false)
  const [recapData, setRecapData] = useState<RecapData | null>(null)
  const [notebookSaved, setNotebookSaved] = useState(false)

  // Inventory matches (top 3 by area/price match)
  const inventoryMatches = inventoryProperties
    .filter((p) => {
      const minBudget = extracted.budgetMin ?? 0
      const maxBudget = extracted.budgetMax ?? Infinity
      const priceOk = p.startingPriceAED !== null
        ? (p.startingPriceAED >= minBudget * 0.7 && (p.startingPriceAED ?? 0) <= maxBudget * 1.2)
        : true
      const areaOk = extracted.location
        ? p.area.toLowerCase().includes(extracted.location.toLowerCase().split('/')[0].trim())
        : true
      return priceOk || areaOk
    })
    .sort((a, b) => b.adReadiness - a.adReadiness)
    .slice(0, 3)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ────────────────────────────────────────────────────────────

  async function handleSend() {
    const body = input.trim()
    if (!body || sending) return
    setSending(true)
    setInput('')

    const optimistic: WAMessage = {
      id: `local_${Date.now()}`,
      direction: 'outbound',
      type: 'text',
      body,
      timestamp: new Date().toISOString(),
      status: 'pending',
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: lead!.phone, body }),
      })
      const result = await res.json() as { status: string; messageId: string | null }
      setMessages((prev) =>
        prev.map((m) => m.id === optimistic.id
          ? { ...m, status: result.status === 'sent' ? 'sent' : 'failed', id: result.messageId ?? m.id }
          : m,
        ),
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === optimistic.id ? { ...m, status: 'failed' } : m),
      )
    }
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ── AI Suggest ──────────────────────────────────────────────────────────────

  const getAiSuggestions = useCallback(async () => {
    setAiLoading(true)
    setAiError(null)
    setSuggestions([])
    try {
      const res = await fetch('/api/whatsapp/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messages.slice(-20),
          lead: {
            name: lead.name,
            pipelineStage: (lead as Record<string, unknown>).pipelineStage ?? lead.stage,
            temperature: (lead as Record<string, unknown>).temperature ?? 'warm',
            budgetAED: lead.budgetAED,
            projectInterest: (lead as Record<string, unknown>).projectInterest ?? lead.projectInterest ?? '',
            assignedAgent: lead.assignedAgent,
            intentScore: lead.intentScore,
          },
          inventoryContext: inventoryMatches.map((p) => ({
            name: p.name, area: p.area, startingPriceAED: p.startingPriceAED,
            roi: p.roi, bedrooms: p.bedrooms, paymentPlan: p.paymentPlan, handoverYear: p.handoverYear,
          })),
        }),
      })
      if (!res.ok) { setAiError('AI service unavailable'); return }
      const data = await res.json() as { suggestions: string[]; extractedData: Partial<WAExtractedData> }
      setSuggestions(data.suggestions ?? [])
      if (data.extractedData) setExtracted((prev) => ({ ...prev, ...data.extractedData }))
    } catch {
      setAiError('Failed to connect to AI service')
    } finally {
      setAiLoading(false)
    }
  }, [messages, lead, inventoryMatches])

  // ── Recap ────────────────────────────────────────────────────────────────────

  async function getRecap() {
    setRecapLoading(true)
    try {
      const res = await fetch('/api/whatsapp/recap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, leadName: lead!.name, leadId: lead!.id }),
      })
      const data = await res.json() as RecapData
      setRecapData(data)
    } catch {
      // show error gracefully
    } finally {
      setRecapLoading(false)
    }
  }

  const grouped = groupByDate(messages)
  const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound')

  return (
    <div className="flex h-[calc(100vh-100px)] flex-col overflow-hidden">

      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#0B0F1A]/90 px-4 backdrop-blur-xl">
        <Link href={`/freehold-intelligence/crm/leads/${lead.id}`}
          className="flex items-center gap-1.5 text-[12px] text-white/40 transition hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> {lead.name}
        </Link>
        <div className="h-4 w-px bg-white/[0.07]" />
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
            <MessageSquareMore className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div>
            <span className="text-[13px] font-semibold text-white">{lead.name}</span>
            <span className="ml-2 text-[12px] text-white/35">{lead.phone}</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1 text-[11px] font-medium text-emerald-400">
            {process.env.NEXT_PUBLIC_WA_CONFIGURED === 'true'
              ? <><Wifi className="h-3 w-3" /> Connected</>
              : <><WifiOff className="h-3 w-3 text-amber-400" /><span className="text-amber-400">Demo mode</span></>
            }
          </div>
          <button onClick={getRecap} disabled={recapLoading || messages.length === 0}
            className="flex items-center gap-1.5 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.07] px-3 py-1.5 text-[11px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15 disabled:opacity-40">
            {recapLoading
              ? <><RefreshCw className="h-3 w-3 animate-spin" /> Generating…</>
              : <><Brain className="h-3 w-3" /> Get Recap</>
            }
          </button>
        </div>
      </div>

      {/* Body: three columns */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: AI assist ─────────────────────────────────────────────── */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-white/[0.06] bg-[#0B0F1A] xl:flex">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-white/35">
              <Sparkles className="h-3 w-3" /> AI Assist
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {/* Suggest button */}
            <button onClick={getAiSuggestions} disabled={aiLoading}
              className="w-full flex items-center justify-center gap-2 rounded-[12px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.07] py-2.5 text-[12px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15 disabled:opacity-50">
              {aiLoading
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Analysing…</>
                : <><Sparkles className="h-3.5 w-3.5" /> Suggest Replies</>
              }
            </button>

            {aiError && (
              <div className="rounded-[10px] border border-red-400/15 bg-red-400/[0.05] px-3 py-2 text-[11px] text-red-400/80">
                {aiError}
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-white/25 px-1">Suggested replies</div>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => setInput(s)}
                    className="w-full rounded-[12px] border border-white/[0.07] bg-white/[0.02] p-3 text-left text-[12px] leading-relaxed text-white/70 transition hover:border-[#D4AF37]/25 hover:text-white/90 active:scale-[0.98]">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {suggestions.length === 0 && !aiLoading && (
              <div className="rounded-[12px] border border-dashed border-white/[0.08] px-3 py-6 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-white/10" />
                <p className="mt-2 text-[11px] text-white/25">Click "Suggest Replies" to get AI-generated responses based on the conversation context and inventory.</p>
              </div>
            )}

            {/* Sentiment / next action */}
            {lastInbound && (
              <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
                <div className="text-[10px] font-medium uppercase tracking-wider text-white/25">Last message</div>
                <p className="text-[11px] leading-relaxed text-white/55 italic">"{lastInbound.body.slice(0, 120)}{lastInbound.body.length > 120 ? '…' : ''}"</p>
                <div className="text-[10px] text-white/30">{fmtTime(lastInbound.timestamp)}</div>
              </div>
            )}

            {/* Notebook link */}
            <Link href={`/freehold-intelligence/notebook?lead=${lead.id}`}
              className="flex items-center justify-between rounded-[12px] border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-[12px] text-white/45 transition hover:text-white/80">
              <div className="flex items-center gap-2">
                <BookOpen className="h-3.5 w-3.5" /> Open Notebook
              </div>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>

            {notebookSaved && (
              <div className="rounded-[10px] border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2 text-[11px] text-emerald-400">
                Recap saved to notebook
              </div>
            )}
          </div>
        </aside>

        {/* ── Center: chat ────────────────────────────────────────────────── */}
        <div className="flex flex-1 flex-col overflow-hidden bg-[#0C1120]"
          style={{ backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(16,185,129,0.04) 0%, transparent 60%)' }}>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <MessageSquareMore className="h-8 w-8 text-emerald-400/40" />
                </div>
                <p className="text-[14px] font-medium text-white/40">No messages yet</p>
                <p className="max-w-xs text-[12px] text-white/25">Send the first message to start the conversation. Use AI Suggest for a great opener.</p>
              </div>
            )}

            {grouped.map((group) => (
              <div key={group.date}>
                {/* Date divider */}
                <div className="my-4 flex items-center gap-3">
                  <div className="flex-1 border-t border-white/[0.06]" />
                  <span className="text-[11px] font-medium text-white/25">{group.date}</span>
                  <div className="flex-1 border-t border-white/[0.06]" />
                </div>

                {/* Messages in group */}
                <div className="space-y-1">
                  {group.messages.map((msg) => {
                    const isOut = msg.direction === 'outbound'
                    return (
                      <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                        <div className={`group relative max-w-[75%] ${isOut ? 'order-2' : ''}`}>
                          <div className={`rounded-[16px] px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                            isOut
                              ? 'rounded-tr-[4px] bg-emerald-600/25 text-white/90'
                              : 'rounded-tl-[4px] border border-white/[0.07] bg-[#1A2540] text-white/85'
                          }`}>
                            {/* Preserve newlines */}
                            {msg.body.split('\n').map((line, i) => (
                              <span key={i}>{line}{i < msg.body.split('\n').length - 1 ? <br /> : null}</span>
                            ))}
                          </div>
                          <div className={`mt-0.5 flex items-center gap-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
                            <span className="text-[10px] text-white/20">{fmtTime(msg.timestamp)}</span>
                            {isOut && <MsgStatusIcon status={msg.status} />}
                          </div>
                          {/* Copy on hover */}
                          <button onClick={() => navigator.clipboard.writeText(msg.body)}
                            className="absolute -right-8 top-2 hidden rounded-full p-1 text-white/25 transition hover:text-white/60 group-hover:flex">
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="shrink-0 border-t border-white/[0.07] bg-[#0B0F1A]/95 px-4 py-3 backdrop-blur-xl">
            {/* Quick AI suggestion strip (mobile / when visible) */}
            {suggestions.length > 0 && (
              <div className="mb-2 flex gap-2 overflow-x-auto pb-1 xl:hidden">
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => setInput(s)}
                    className="shrink-0 max-w-[200px] truncate rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.07] px-3 py-1 text-[11px] text-[#D4AF37] transition hover:bg-[#D4AF37]/15">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <button onClick={getAiSuggestions} disabled={aiLoading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.07] text-[#D4AF37] transition hover:bg-[#D4AF37]/15 disabled:opacity-50 xl:hidden">
                <Sparkles className="h-4 w-4" />
              </button>
              <div className="flex flex-1 items-end rounded-[14px] border border-white/[0.09] bg-white/[0.04] px-3 py-2 focus-within:border-[#D4AF37]/30">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message… (Enter to send)"
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-[13px] text-white placeholder:text-white/25 focus:outline-none"
                  style={{ maxHeight: 120 }}
                />
              </div>
              <button onClick={handleSend} disabled={!input.trim() || sending}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white transition hover:bg-emerald-400 disabled:opacity-40">
                {sending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: lead intel ────────────────────────────────────────────── */}
        <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-white/[0.06] bg-[#0B0F1A] lg:flex">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-white/35">Lead Intelligence</div>
          </div>

          <div className="flex-1 px-3 py-3 space-y-3">

            {/* Lead profile */}
            <div className="rounded-[14px] border border-white/[0.07] bg-[#131B2B] p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white/[0.07] text-[11px] font-bold text-white/60">
                  {lead.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-semibold text-white/90">{lead.name}</div>
                  <div className="text-[11px] text-white/35">{lead.phone}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-[8px] bg-white/[0.03] px-2.5 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-white/25">Stage</div>
                  <div className={`text-[11px] font-medium capitalize ${STAGE_COLOR[(lead as Record<string,unknown>).pipelineStage as string ?? ''] ?? 'text-white/60'}`}>
                    {((lead as Record<string,unknown>).pipelineStage as string) ?? lead.stage}
                  </div>
                </div>
                <div className="rounded-[8px] bg-white/[0.03] px-2.5 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-white/25">Temperature</div>
                  <div className={`text-[11px] font-medium capitalize ${TEMP_COLOR[(lead as Record<string,unknown>).temperature as string ?? ''] ?? 'text-white/60'}`}>
                    {((lead as Record<string,unknown>).temperature as string) ?? 'warm'}
                  </div>
                </div>
                <div className="rounded-[8px] bg-white/[0.03] px-2.5 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-white/25">Intent</div>
                  <div className="text-[11px] font-semibold text-[#D4AF37]">{lead.intentScore}</div>
                </div>
                <div className="rounded-[8px] bg-white/[0.03] px-2.5 py-1.5">
                  <div className="text-[9px] uppercase tracking-wider text-white/25">Agent</div>
                  <div className="truncate text-[11px] text-white/60">{lead.assignedAgent.split(' ')[0]}</div>
                </div>
              </div>
            </div>

            {/* Extracted data */}
            <div className="rounded-[14px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.03] p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[#D4AF37]/70">
                  <Zap className="h-3 w-3" /> Extracted from chat
                </div>
                {extracted.confidence !== undefined && (
                  <span className="text-[10px] text-[#D4AF37]/50">{extracted.confidence}% confidence</span>
                )}
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Budget', value: extracted.budget },
                  { label: 'Location', value: extracted.location },
                  { label: 'Type', value: extracted.propertyType },
                  { label: 'Bedrooms', value: extracted.bedrooms },
                  { label: 'Timeline', value: extracted.timeline },
                  { label: 'Payment', value: extracted.paymentMethod },
                  { label: 'Purpose', value: extracted.purpose !== 'unknown' ? extracted.purpose : null },
                ].filter((r) => r.value).map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-white/30">{label}</span>
                    <span className="truncate text-right text-[11px] font-medium text-white/75">{String(value)}</span>
                  </div>
                ))}
                {!Object.values(extracted).some(Boolean) && (
                  <p className="text-[11px] text-white/25">No data extracted yet. Click "Suggest Replies" to analyse the conversation.</p>
                )}
              </div>
              {Object.values(extracted).some(Boolean) && (
                <button
                  onClick={() => setExtractedApplied(true)}
                  disabled={extractedApplied}
                  className={`mt-3 w-full rounded-full py-1.5 text-[11px] font-medium transition ${
                    extractedApplied
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-[#D4AF37] text-[#06080A] hover:bg-[#F0CB67]'
                  }`}>
                  {extractedApplied ? '✓ Applied to CRM' : 'Apply to CRM'}
                </button>
              )}
            </div>

            {/* Inventory matches */}
            <div className="rounded-[14px] border border-white/[0.07] bg-[#131B2B] p-3.5">
              <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-white/35">
                <LayoutGrid className="h-3 w-3" /> Matching Properties
              </div>
              {inventoryMatches.length > 0 ? (
                <div className="space-y-2">
                  {inventoryMatches.map((p) => (
                    <Link key={p.id} href={`/freehold-intelligence/inventory/${p.id}`}
                      className="group block rounded-[10px] border border-white/[0.05] bg-white/[0.02] p-2.5 transition hover:border-[#D4AF37]/20">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[11px] font-medium text-white/80 group-hover:text-white">{p.name}</div>
                          <div className="text-[10px] text-white/35">{p.area} · {p.bedrooms}</div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[11px] font-semibold text-[#D4AF37]">{fmtPrice(p.startingPriceAED)}</div>
                          {p.roi && <div className="text-[10px] text-white/35">{p.roi}% ROI</div>}
                        </div>
                      </div>
                      {/* Send as message */}
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          setInput(`I'd like to share a property with you: ${p.name} in ${p.area}. Starting from ${fmtPrice(p.startingPriceAED)}, ${p.bedrooms} bedrooms, ${p.roi ? p.roi + '% estimated ROI, ' : ''}${p.paymentPlan ?? ''}. Would you like more details?`)
                        }}
                        className="mt-1.5 w-full rounded-full border border-[#D4AF37]/15 py-1 text-[10px] text-[#D4AF37]/60 transition hover:bg-[#D4AF37]/[0.07] hover:text-[#D4AF37]">
                        Send to lead
                      </button>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-white/25">Matching properties will appear once budget and location are extracted from the conversation.</p>
              )}
            </div>

            {/* Phone */}
            <a href={`tel:${lead.phone}`}
              className="flex items-center gap-2.5 rounded-[14px] border border-white/[0.07] bg-[#131B2B] px-3.5 py-3 transition hover:border-[#D4AF37]/20">
              <Phone className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />
              <span className="text-[12px] text-white/60">Call {lead.phone}</span>
            </a>

          </div>
        </aside>

      </div>

      {/* Recap modal */}
      {recapData && (
        <RecapModal
          data={recapData}
          onClose={() => setRecapData(null)}
          onSave={() => { setNotebookSaved(true); setRecapData(null) }}
        />
      )}
    </div>
  )
}
