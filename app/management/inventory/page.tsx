'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Plus, Search, CheckSquare, Square, FileText, Table2,
  FileType, ChevronDown, ChevronRight, Upload, Send,
  Paperclip, Sparkles, Brain, Building2, MessageSquare,
  Copy, ArrowRight, LayoutGrid, FileBarChart2, Mail,
  Megaphone, FileCheck, TrendingUp, Share2, Star,
  Clock, MoreHorizontal, Database, Layers, RefreshCw,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  text: string
  timestamp: string
}

interface Output {
  id: number
  title: string
  type: string
  typeColor: string
  preview: string
  timestamp: string
}

// ─── Static data ─────────────────────────────────────────────────────────────

const UPLOADED_FILES = [
  { id: 1, name: 'EMAAR_Q2_2026.pdf',           icon: FileText,  size: '2.4 MB',  type: 'pdf'   },
  { id: 2, name: 'DLD_Transactions_May.xlsx',   icon: Table2,    size: '1.1 MB',  type: 'xlsx'  },
  { id: 3, name: 'Palm_Prices_Analysis.docx',   icon: FileType,  size: '840 KB',  type: 'docx'  },
  { id: 4, name: 'Competitor_Matrix.pdf',        icon: FileText,  size: '3.2 MB',  type: 'pdf'   },
]

const OUTPUT_TYPES = [
  { id: 'brochure',   label: 'Property Brochure',  icon: FileText,      color: 'text-violet-400 bg-violet-400/10 border-violet-400/20'  },
  { id: 'whatsapp',   label: 'WhatsApp Message',   icon: MessageSquare, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  { id: 'email',      label: 'Email Campaign',     icon: Mail,          color: 'text-sky-400 bg-sky-400/10 border-sky-400/20'           },
  { id: 'ad',         label: 'Ad Copy',            icon: Megaphone,     color: 'text-orange-400 bg-orange-400/10 border-orange-400/20'  },
  { id: 'report',     label: 'Comparison Report',  icon: FileBarChart2, color: 'text-pink-400 bg-pink-400/10 border-pink-400/20'        },
  { id: 'offer',      label: 'Offer Letter',       icon: FileCheck,     color: 'text-amber-400 bg-amber-400/10 border-amber-400/20'     },
  { id: 'analysis',   label: 'Market Analysis',    icon: TrendingUp,    color: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20'    },
  { id: 'social',     label: 'Social Post',        icon: Share2,        color: 'text-rose-400 bg-rose-400/10 border-rose-400/20'        },
]

const RECENT_OUTPUTS: Output[] = [
  { id: 1, title: 'Palm Jumeirah 5BR Villa — Brochure',     type: 'Brochure',    typeColor: 'text-violet-400 bg-violet-400/10',  preview: 'Luxury 5-bedroom villa with private pool, 8,200 sqft…',     timestamp: '10 min ago'  },
  { id: 2, title: 'WhatsApp blast — Top 3 leads today',     type: 'WhatsApp',    typeColor: 'text-emerald-400 bg-emerald-400/10', preview: 'Hi [Name], we have 3 premium properties matching your…',    timestamp: '32 min ago'  },
  { id: 3, title: 'Downtown vs Business Bay — Q2 2026',     type: 'Report',      typeColor: 'text-pink-400 bg-pink-400/10',       preview: 'Downtown avg AED 2,100/sqft vs Business Bay AED 1,740…',   timestamp: '1 hr ago'    },
  { id: 4, title: 'Meta Ad Copy — Dubai Hills offplan',     type: 'Ad Copy',     typeColor: 'text-orange-400 bg-orange-400/10',  preview: 'Live in Dubai\'s most prestigious community. 2BR from…',   timestamp: '2 hrs ago'   },
  { id: 5, title: 'Market analysis — JVC apartments June',  type: 'Analysis',    typeColor: 'text-[#D4AF37] bg-[#D4AF37]/10',   preview: 'JVC recorded 214 transactions in May, up 18% MoM. Avg…',  timestamp: 'Yesterday'   },
]

const SEND_TO_OPTIONS: Record<string, { label: string; color: string }[]> = {
  Brochure:  [{ label: '→ CRM', color: 'text-sky-400' }, { label: '→ WhatsApp', color: 'text-emerald-400' }],
  WhatsApp:  [{ label: '→ WhatsApp', color: 'text-emerald-400' }, { label: '→ CRM', color: 'text-sky-400' }],
  Report:    [{ label: '→ CRM', color: 'text-sky-400' }, { label: '→ Email', color: 'text-violet-400' }],
  'Ad Copy': [{ label: '→ Ads', color: 'text-orange-400' }, { label: '→ CRM', color: 'text-sky-400' }],
  Analysis:  [{ label: '→ CRM', color: 'text-sky-400' }, { label: '→ WhatsApp', color: 'text-emerald-400' }],
}

const STARTER_PROMPTS = [
  { id: 1, text: 'Best properties to push this week'                   },
  { id: 2, text: 'Compare Palm vs Downtown for investors'              },
  { id: 3, text: 'Write 5 WhatsApp messages for top leads'            },
  { id: 4, text: 'Which listings have been sitting 30+ days?'         },
]

const MOCK_RESPONSES: Record<string, string> = {
  push: `Top 5 properties to push this week (ranked by score):\n\n**1. Palm Jumeirah — Signature Villa, 5BR | AED 8.2M**\nJust reduced from AED 8.6M. Motivated seller. 3 active leads matched. High photo quality. Recommendation: Feature in Meta campaign.\n\n**2. Dubai Hills — Golf View 3BR | AED 3.4M**\nFirst listing in 90 days in this micro-location. 6 similar leads in CRM. Generate brochure now.\n\n**3. Downtown — High Floor 2BR | AED 2.1M**\nHand-over in 45 days. 2 investors asking about payment plans. Follow up today.\n\nWould you like me to generate brochures or WhatsApp messages for any of these?`,
  compare: `**Palm Jumeirah vs Downtown Dubai — Investor Comparison (June 2026)**\n\n| Metric              | Palm Jumeirah   | Downtown Dubai  |\n|---------------------|-----------------|------------------|\n| Avg Price/sqft      | AED 3,200       | AED 2,850        |\n| Rental Yield        | 4.8%            | 5.6%             |\n| Capital Growth QoQ  | +6.1%           | +4.2%            |\n| Liquidity (DOM)     | 38 days avg     | 27 days avg      |\n| Foreign Ownership   | 100% freehold   | 100% freehold    |\n\nVerdict: Downtown offers higher yield and faster liquidity. Palm is better for capital appreciation over 3–5 years. For investors targeting rental income, Downtown wins today.`,
  whatsapp: `Here are 5 WhatsApp message templates for your top leads:\n\n**1. Hot lead — Ahmad (interested in Palm villa)**\n"Good morning Ahmad! A Palm Jumeirah 5BR villa just dropped to AED 8.2M — AED 400K below market. Given your brief I thought of you first. Can I arrange a viewing this week?"\n\n**2. Cold re-engagement — Fatima (no reply in 14 days)**\n"Hi Fatima, hope you're well! Thought you'd want to see this: a Downtown 2BR just listed at AED 2.1M with 5-year payment plan. Perfect match for what we discussed. Shall I send the brochure?"\n\n**3. New lead — Corporate enquiry**\n"Welcome! I'm sending you our curated selection for commercial office spaces in DIFC and JLT. We have 3 options under AED 3M. When is a good time to connect?"\n\n**4. Follow-up — Post viewing**\n"It was great showing you the Dubai Hills villa today. I've attached the full price history and community ROI report. Let me know your thoughts — happy to discuss terms."\n\n**5. Off-plan push — General pipeline**\n"Exclusive alert: Emaar just released 12 new 1BR units in Dubai Hills starting AED 1.1M. Off-plan, 80/20 payment plan, Q3 2028 handover. Shall I reserve one for you to review?"`,
  sitting: `Listings sitting 30+ days — Action required:\n\n**Critical (60+ days)**\n• JBR 3BR Sea View | AED 4.8M | 74 days | Price above market by est. 8%\n• Business Bay Office Floor | AED 6.2M | 61 days | Needs virtual tour\n\n**High Priority (30–59 days)**\n• DIFC 1BR Studio | AED 1.45M | 48 days | Only 4 photo views — refresh photos\n• Palm Garden Villa 4BR | AED 7.1M | 41 days | 12 saves but no enquiries — check description\n• Silicon Oasis 2BR | AED 850K | 33 days | Price matches market; add WhatsApp CTA\n\nRecommendation: Price-reduce the JBR listing by 5% and re-launch with new photos. Generate a "Price Reduced" social post. Want me to draft those now?`,
}

function getMockResponse(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes('push') || lower.includes('best') || lower.includes('week'))   return MOCK_RESPONSES.push
  if (lower.includes('compare') || lower.includes('palm') || lower.includes('downtown')) return MOCK_RESPONSES.compare
  if (lower.includes('whatsapp') || lower.includes('message'))                       return MOCK_RESPONSES.whatsapp
  if (lower.includes('sitting') || lower.includes('30') || lower.includes('days'))  return MOCK_RESPONSES.sitting
  return `Analyzing your inventory of 2,813 listings and all connected sources for: "${input}"\n\nBased on current data: your live inventory shows strong demand in Palm Jumeirah (42 active enquiries) and Dubai Hills (31 enquiries). DLD transaction data confirms prices holding steady with a 3.2% QoQ increase.\n\nYour uploaded files have been cross-referenced. Would you like a specific report, brochure, or message generated based on these findings?`
}

function formatTime() {
  return new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function InventoryIntelligencePage() {
  // Sources state
  const [liveInventoryChecked, setLiveInventoryChecked] = useState(true)
  const [crmChecked, setCrmChecked] = useState(true)
  const [filesChecked, setFilesChecked] = useState<Record<number, boolean>>(
    Object.fromEntries(UPLOADED_FILES.map(f => [f.id, true]))
  )
  const [filesExpanded, setFilesExpanded] = useState(true)
  const [sourceSearch, setSourceSearch] = useState('')

  // Chat state
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'I have analyzed all your sources: 2,813 live listings, 487 CRM leads, 12 active deals, and 4 uploaded documents including the EMAAR Q2 report and DLD May transactions.\n\nI am ready to help you find the best properties to push, generate marketing content, compare markets, or identify inventory issues.\n\nWhat would you like to explore?',
      timestamp: '09:00',
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Studio state
  const [selectedOutputType, setSelectedOutputType] = useState<string | null>(null)
  const [sendToVisible, setSendToVisible] = useState<number | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  function sendMessage(text?: string) {
    const msg = (text ?? chatInput).trim()
    if (!msg) return
    setChatInput('')
    setMessages(prev => [...prev, { role: 'user', text: msg, timestamp: formatTime() }])
    setIsTyping(true)
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'assistant', text: getMockResponse(msg), timestamp: formatTime() }])
      setIsTyping(false)
    }, 1400)
  }

  function toggleFile(id: number) {
    setFilesChecked(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const activeSourceCount = [
    liveInventoryChecked,
    crmChecked,
    ...Object.values(filesChecked),
  ].filter(Boolean).length

  return (
    <div className="flex h-screen overflow-hidden bg-[#0D1117]">

      {/* ── LEFT: Sources Panel ── */}
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-slate-800 bg-[#090C12] lg:flex overflow-hidden">

        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-white">Sources</span>
            <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-xs text-slate-500">{activeSourceCount}</span>
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1.5 text-xs font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15">
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2.5 border-b border-slate-800/50">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-slate-600 shrink-0" />
            <input
              value={sourceSearch}
              onChange={e => setSourceSearch(e.target.value)}
              placeholder="Search sources…"
              className="flex-1 bg-transparent text-xs text-slate-300 placeholder:text-slate-600 outline-none"
            />
          </div>
        </div>

        {/* Source list */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">

          {/* Live Inventory */}
          <div
            className={[
              'rounded-lg border p-3 transition cursor-pointer',
              liveInventoryChecked ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-slate-800 bg-slate-900/50',
            ].join(' ')}
            onClick={() => setLiveInventoryChecked(v => !v)}
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              {liveInventoryChecked
                ? <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0" />
                : <Square className="h-4 w-4 text-slate-600 shrink-0" />
              }
              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-sm font-medium text-slate-200">Live Inventory</span>
            </div>
            <p className="pl-[52px] text-xs text-slate-500">2,813 listings</p>
            <div className="mt-1.5 pl-[52px] flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-500">Live sync</span>
            </div>
          </div>

          {/* CRM Data */}
          <div
            className={[
              'rounded-lg border p-3 transition cursor-pointer',
              crmChecked ? 'border-sky-500/20 bg-sky-500/5' : 'border-slate-800 bg-slate-900/50',
            ].join(' ')}
            onClick={() => setCrmChecked(v => !v)}
          >
            <div className="flex items-center gap-2.5 mb-1.5">
              {crmChecked
                ? <CheckSquare className="h-4 w-4 text-sky-400 shrink-0" />
                : <Square className="h-4 w-4 text-slate-600 shrink-0" />
              }
              <Database className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-sm font-medium text-slate-200">CRM Data</span>
            </div>
            <p className="pl-[52px] text-xs text-slate-500">487 leads · 12 active deals</p>
          </div>

          {/* Uploaded Files */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/30 overflow-hidden">
            <button
              onClick={() => setFilesExpanded(v => !v)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-slate-800/30 transition"
            >
              {filesExpanded
                ? <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                : <ChevronRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              }
              <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-sm font-medium text-slate-200 flex-1">Uploaded Files</span>
              <span className="text-xs text-slate-600">{UPLOADED_FILES.length}</span>
            </button>

            {filesExpanded && (
              <div className="border-t border-slate-800/50 divide-y divide-slate-800/50">
                {UPLOADED_FILES.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-slate-800/30 transition"
                    onClick={() => toggleFile(file.id)}
                  >
                    {filesChecked[file.id]
                      ? <CheckSquare className="h-4 w-4 text-[#D4AF37] shrink-0" />
                      : <Square className="h-4 w-4 text-slate-600 shrink-0" />
                    }
                    <file.icon className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-300 truncate">{file.name}</p>
                      <p className="text-xs text-slate-600">{file.size}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upload button */}
        <div className="border-t border-slate-800 p-3">
          <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-900/30 py-2.5 text-xs font-medium text-slate-500 transition hover:border-slate-600 hover:bg-slate-800/50 hover:text-slate-300">
            <Upload className="h-3.5 w-3.5" />
            Upload document
          </button>
          <p className="mt-1.5 text-center text-xs text-slate-700">PDF, Excel, Word, CSV</p>
        </div>
      </aside>

      {/* ── MIDDLE: Chat Panel ── */}
      <main className="flex flex-1 flex-col overflow-hidden border-r border-slate-800">

        {/* Header */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-[#090C12]/80 px-5 backdrop-blur-xl">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 shrink-0">
            <Brain className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Inventory Intelligence</h1>
            <p className="text-xs text-slate-500 leading-none mt-0.5">Marketing Agency · AI-powered</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeSourceCount} sources active
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={['flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : ''].join(' ')}
            >
              <div className={[
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                msg.role === 'assistant'
                  ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/25'
                  : 'bg-slate-700 text-slate-200',
              ].join(' ')}>
                {msg.role === 'assistant' ? <Sparkles className="h-4 w-4" /> : <span className="text-xs">M</span>}
              </div>
              <div className={[
                'rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[85%]',
                msg.role === 'assistant'
                  ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm'
                  : 'bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-white rounded-tr-sm',
              ].join(' ')}>
                {msg.text.split('\n').map((line, j, arr) => {
                  const isBoldLine = line.startsWith('**') && line.endsWith('**')
                  return (
                    <span key={j}>
                      {isBoldLine
                        ? <strong className="font-semibold text-white block mt-2 first:mt-0">{line.replace(/\*\*/g, '')}</strong>
                        : line.replace(/\*\*(.*?)\*\*/g, '$1')
                      }
                      {!isBoldLine && j < arr.length - 1 && <br />}
                    </span>
                  )
                })}
                <p className="mt-2 text-xs text-slate-600">{msg.timestamp}</p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/25">
                <Sparkles className="h-4 w-4 text-[#D4AF37]" />
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-slate-900 border border-slate-800 px-4 py-3">
                <div className="flex gap-1 items-center h-5">
                  <span className="h-2 w-2 rounded-full bg-slate-600 animate-bounce [animation-delay:0ms]" />
                  <span className="h-2 w-2 rounded-full bg-slate-600 animate-bounce [animation-delay:150ms]" />
                  <span className="h-2 w-2 rounded-full bg-slate-600 animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Starter prompts */}
        <div className="border-t border-slate-800/50 px-5 py-2.5">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
            {STARTER_PROMPTS.map(p => (
              <button
                key={p.id}
                onClick={() => sendMessage(p.text)}
                className="shrink-0 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400 whitespace-nowrap transition hover:border-[#D4AF37]/40 hover:bg-slate-800 hover:text-slate-200"
              >
                {p.text}
              </button>
            ))}
          </div>
        </div>

        {/* Input bar */}
        <div className="border-t border-slate-800 bg-[#090C12]/80 px-4 py-3 backdrop-blur-xl">
          <form
            onSubmit={e => { e.preventDefault(); sendMessage() }}
            className="flex items-end gap-2"
          >
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/50 text-slate-500 transition hover:border-slate-600 hover:text-slate-300"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <div className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 focus-within:border-[#D4AF37]/40 transition-colors">
              <textarea
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                }}
                placeholder="Ask about inventory, generate content, compare markets…"
                rows={1}
                className="w-full resize-none bg-transparent text-sm text-white placeholder:text-slate-600 outline-none leading-relaxed"
              />
            </div>
            <button
              type="submit"
              disabled={!chatInput.trim() || isTyping}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37] text-[#0D1117] transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="mt-1.5 text-center text-xs text-slate-700">
            12 conversations in memory · Sources: {activeSourceCount} active
          </p>
        </div>
      </main>

      {/* ── RIGHT: Studio Panel ── */}
      <aside className="hidden w-[320px] shrink-0 flex-col border-l border-slate-800 bg-[#090C12] xl:flex overflow-hidden">

        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800 px-4">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-white">Studio</span>
          </div>
          <button className="flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1.5 text-xs font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15">
            Generate
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* Output type grid */}
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Output Type</p>
            <div className="grid grid-cols-2 gap-2">
              {OUTPUT_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedOutputType(selectedOutputType === type.id ? null : type.id)}
                  className={[
                    'flex flex-col items-center gap-2 rounded-xl border p-3 text-center text-xs font-medium transition',
                    selectedOutputType === type.id
                      ? `${type.color} ring-1 ring-current`
                      : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:bg-slate-800/60 hover:text-slate-200',
                  ].join(' ')}
                >
                  <type.icon className="h-4 w-4" />
                  {type.label}
                </button>
              ))}
            </div>
            {selectedOutputType && (
              <button
                onClick={() => sendMessage(`Generate a ${OUTPUT_TYPES.find(t => t.id === selectedOutputType)?.label} based on current inventory and context`)}
                className="mt-2 w-full rounded-lg bg-[#D4AF37] py-2.5 text-xs font-semibold text-[#0D1117] transition hover:opacity-90"
              >
                Generate {OUTPUT_TYPES.find(t => t.id === selectedOutputType)?.label}
              </button>
            )}
          </div>

          {/* Recent outputs */}
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Recent Outputs</p>
            <div className="space-y-2">
              {RECENT_OUTPUTS.map(output => (
                <div
                  key={output.id}
                  className="rounded-xl border border-slate-800 bg-slate-900/50 p-3"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <p className="text-xs font-medium text-slate-200 leading-snug flex-1">{output.title}</p>
                    <button className="shrink-0 text-slate-600 hover:text-slate-400 transition">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${output.typeColor}`}>
                      {output.type}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-600">
                      <Clock className="h-3 w-3" />
                      {output.timestamp}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-2.5">
                    {output.preview}
                  </p>

                  {/* Send to app row */}
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => setSendToVisible(sendToVisible === output.id ? null : output.id)}
                      className="flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/50 px-2 py-1 text-xs text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
                    >
                      Send to App
                      <ArrowRight className="h-3 w-3" />
                    </button>
                    {sendToVisible === output.id && (SEND_TO_OPTIONS[output.type] ?? SEND_TO_OPTIONS['Analysis']).map(dest => (
                      <button
                        key={dest.label}
                        onClick={() => setSendToVisible(null)}
                        className={`rounded-md border border-slate-700 bg-slate-800/50 px-2 py-1 text-xs font-medium transition hover:border-slate-600 hover:bg-slate-800 ${dest.color}`}
                      >
                        {dest.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Quick Actions</p>
            <div className="space-y-1">
              {[
                { label: 'Copy last output',       icon: Copy,       action: () => {} },
                { label: 'Export as PDF',          icon: FileText,   action: () => {} },
                { label: 'Send all to CRM',        icon: Database,   action: () => {} },
                { label: 'Refresh data sources',   icon: RefreshCw,  action: () => {} },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={action.action}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium text-slate-400 transition hover:bg-slate-800/60 hover:text-slate-200"
                >
                  <action.icon className="h-3.5 w-3.5 text-slate-600" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Memory indicator */}
        <div className="border-t border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
            <Star className="h-3.5 w-3.5 text-[#D4AF37] shrink-0" />
            <span className="text-xs text-slate-500">12 conversations in memory</span>
            <span className="ml-auto text-xs font-medium text-[#D4AF37]">AI PRO</span>
          </div>
        </div>
      </aside>
    </div>
  )
}
