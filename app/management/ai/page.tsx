'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Bot, Send, Plus, Clock, Lightbulb, Database,
  Sparkles, ChevronRight, ToggleLeft, ToggleRight,
  MessageSquare, TrendingUp, Users, Building2,
  Megaphone, DollarSign, RefreshCw, History,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant'
  text: string
  timestamp: string
}

interface Conversation {
  id: number
  title: string
  date: string
  preview: string
}

// ─── Static data ─────────────────────────────────────────────────────────────

const CONTEXT_CHIPS = [
  { label: 'Active Deals',  value: '12',          icon: TrendingUp,  color: 'text-emerald-400' },
  { label: 'Pipeline',      value: 'AED 8.4M',    icon: DollarSign,  color: 'text-[#D4AF37]'  },
  { label: 'Team',          value: '12 agents',   icon: Users,       color: 'text-violet-400'  },
  { label: 'Last Sync',     value: '2 min ago',   icon: RefreshCw,   color: 'text-sky-400'     },
]

const CONTEXT_TOGGLES = [
  { id: 'crm',       label: 'Include CRM data',    defaultOn: true  },
  { id: 'finance',   label: 'Include Finance',      defaultOn: true  },
  { id: 'marketing', label: 'Include Marketing',    defaultOn: true  },
  { id: 'inventory', label: 'Include Inventory',    defaultOn: true  },
]

const HISTORY: Conversation[] = [
  { id: 1, title: 'Team performance review',        date: 'Today, 09:15',      preview: 'Sara leads with 3 deals closed…'         },
  { id: 2, title: 'Meta vs Google ROI analysis',    date: 'Yesterday, 14:30',  preview: 'Meta CPL at AED 38 outperforms…'          },
  { id: 3, title: 'Dubai Hills market brief',        date: 'Jun 4, 11:00',      preview: 'Prices up 4.2% QoQ, demand steady…'       },
  { id: 4, title: 'Q2 board meeting summary',        date: 'Jun 3, 16:45',      preview: 'Revenue AED 1.8M, targets on track…'     },
  { id: 5, title: 'Pipeline risk assessment',        date: 'Jun 2, 10:20',      preview: '2 deals flagged as high-risk due to…'    },
  { id: 6, title: 'Inventory gap — Palm units',      date: 'Jun 1, 08:55',      preview: '14 premium Palm listings not shared…'    },
]

const SUGGESTIONS = [
  { id: 1, text: 'What are the top 3 decisions I should make today?',     icon: Lightbulb    },
  { id: 2, text: 'Which deals are at risk of falling through?',           icon: TrendingUp   },
  { id: 3, text: 'Which marketing channel gives best ROI?',               icon: Megaphone    },
  { id: 4, text: 'Summarize team performance this week',                  icon: Users        },
  { id: 5, text: 'What\'s the market doing in Dubai Hills?',              icon: Building2    },
  { id: 6, text: 'Generate a board meeting summary for this month',       icon: MessageSquare },
]

const MOCK_RESPONSES: Record<string, string> = {
  decisions: `Here are your top 3 decisions for today:\n\n1. Follow up on the Palm Jumeirah counter-offer from Ahmed Hassan — the window closes at 6 PM. Sara is available to call.\n\n2. Review the Google Ads campaign "Palm Q3" which launched overnight. CTR is 1.2% below target — consider adjusting the creative.\n\n3. Approve the 2 pending invoices before the 12 PM finance cut-off to avoid payment delays.\n\nShould I draft a call script for Ahmed Hassan or pull up the Google Ads breakdown?`,
  risk: `I have identified 3 deals with elevated risk:\n\n**Ahmed Hassan — Palm Jumeirah villa (AED 4.2M)**\nCounter-proposal has been waiting 3 days. Likelihood of drop-off increases 40% after 72 hrs.\n\n**Fatima Al Rashid — Downtown apartment (AED 1.8M)**\nMortgage pre-approval expires in 6 days. Finance team not yet engaged.\n\n**Corporate client — JBR offices (AED 2.4M)**\nSilent for 8 days following last viewing. Recommend a market update call.\n\nWould you like me to draft follow-up messages for any of these?`,
  marketing: `Marketing ROI summary as of today:\n\n**Meta (Facebook/Instagram)** — CPL AED 38, conversion 4.2% — Best performer\n**Google Search** — CPL AED 67, conversion 3.1% — Solid for branded terms\n**Property Finder** — CPL AED 124, conversion 1.8% — Expensive, selective use\n**Referrals** — CPL AED 0, conversion 18% — Under-leveraged\n\nRecommendation: Shift 15% of Google budget to Meta and launch a referral incentive programme. Estimated pipeline increase: AED 600K monthly.`,
  team: `Team performance this week (Jun 2–6):\n\n**Sara Al Mansoori** — 1 deal closed (AED 2.1M), 8 follow-ups ✦ Top performer\n**Ahmad Khalil** — 6 leads contacted, 2 viewings scheduled, strong pipeline\n**Layla Hassan** — 3 calls, 1 viewing — below target, consider a check-in\n**Omar Farooq** — 2 deals in negotiation, AED 3.2M combined — promising week\n\nOverall: Team is tracking 82% of weekly KPIs. Layla and new joiners need attention.`,
  market: `Dubai Hills Estate — Market Brief (June 2026):\n\n• Average villa price: AED 6.8M (+4.2% QoQ)\n• Average apartment: AED 1.95M (+2.8% QoQ)\n• Days on market avg: 34 days (down from 41 in Q1)\n• Inventory: 312 active listings, 18% fewer than last quarter\n• Top buyer profile: European investors, 30–45, second home\n\nOpportunity: Limited 5-bed villa supply (only 14 available). Owners pricing aggressively. Now is a strong time to list premium inventory.`,
  board: `**Board Meeting Summary — May 2026**\n\nPrepared by AI Advisor · June 6, 2026\n\n**Revenue:** AED 1.82M MTD (↑ 18% vs April)\n**Deals Closed:** 7 transactions totalling AED 12.4M\n**Pipeline:** AED 8.4M active, 12 deals in progress\n**Marketing:** AED 48,200 spend · 127 qualified leads · CPL AED 38\n**Team:** 12 agents, 9 active this month · Top performer: Sara Al Mansoori\n\n**Key highlights:** Q2 on track to exceed AED 5M revenue target. Meta outperforming all channels. Palm Jumeirah inventory gap identified — action required.\n\nWould you like me to format this as a PDF-ready report?`,
}

function getMockResponse(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes('decision') || lower.includes('today'))     return MOCK_RESPONSES.decisions
  if (lower.includes('risk') || lower.includes('falling'))       return MOCK_RESPONSES.risk
  if (lower.includes('marketing') || lower.includes('roi') || lower.includes('channel')) return MOCK_RESPONSES.marketing
  if (lower.includes('team') || lower.includes('performance'))   return MOCK_RESPONSES.team
  if (lower.includes('dubai hills') || lower.includes('market')) return MOCK_RESPONSES.market
  if (lower.includes('board') || lower.includes('summary'))      return MOCK_RESPONSES.board
  return `Understood. Based on your current data — 12 active deals worth AED 8.4M, 14 new leads today, Meta CPL at AED 38 — here is my analysis:\n\n"${input}"\n\nThis touches on several key areas of your business. Your pipeline is healthy but concentrated in Palm Jumeirah and Dubai Hills. I recommend reviewing deal timelines and ensuring each agent has a clear next action logged in the CRM.\n\nWould you like me to go deeper on any specific deal, agent, or market area?`
}

function formatTime() {
  return new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AIChatPage() {
  const [activeTab, setActiveTab] = useState<'data' | 'history' | 'suggestions'>('data')
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(CONTEXT_TOGGLES.map(t => [t.id, t.defaultOn]))
  )
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: 'Good morning. I have analyzed your current data: 12 active deals worth AED 8.4M, 14 new leads today, and your Meta campaign is performing at CPL AED 38. What would you like to focus on?',
      timestamp: '09:00',
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [activeConversation, setActiveConversation] = useState<number | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  function toggleContext(id: string) {
    setToggles(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function sendMessage(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg) return
    setInput('')
    const userMsg: Message = { role: 'user', text: msg, timestamp: formatTime() }
    setMessages(prev => [...prev, userMsg])
    setIsTyping(true)
    setTimeout(() => {
      const response = getMockResponse(msg)
      setMessages(prev => [...prev, { role: 'assistant', text: response, timestamp: formatTime() }])
      setIsTyping(false)
    }, 1200)
  }

  function newConversation() {
    setMessages([
      {
        role: 'assistant',
        text: 'New conversation started. I\'m ready to help. You have 12 active deals, AED 8.4M pipeline, and 14 new leads today. What would you like to explore?',
        timestamp: formatTime(),
      },
    ])
    setInput('')
    setActiveConversation(null)
  }

  function loadConversation(conv: Conversation) {
    setActiveConversation(conv.id)
    setMessages([
      { role: 'assistant', text: `Loaded: "${conv.title}"\n\n${conv.preview}\n\nThis conversation is from ${conv.date}. Would you like to continue where we left off?`, timestamp: conv.date },
    ])
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0D1117]">

      {/* Sticky header */}
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-800 bg-[#090C12]/95 px-6 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D4AF37]/30 bg-[#D4AF37]/10">
            <Bot className="h-4 w-4 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">AI Advisor</h1>
            <p className="text-xs text-slate-500 leading-none mt-0.5">Decision support &amp; market intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-0.5 text-xs font-medium text-[#D4AF37]">
            GPT-4 Turbo
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live data
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={newConversation}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            New conversation
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left context panel */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-800 bg-[#090C12] lg:flex overflow-hidden">

          {/* Tab bar */}
          <div className="flex border-b border-slate-800">
            {(['data', 'history', 'suggestions'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'flex-1 py-3 text-xs font-medium capitalize transition-colors',
                  activeTab === tab
                    ? 'border-b-2 border-[#D4AF37] text-[#D4AF37]'
                    : 'text-slate-500 hover:text-slate-300',
                ].join(' ')}
              >
                {tab === 'data' ? 'Data' : tab === 'history' ? 'History' : 'Suggestions'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">

            {/* Data tab */}
            {activeTab === 'data' && (
              <div className="p-4 space-y-4">
                <div>
                  <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Live Context</p>
                  <div className="grid grid-cols-2 gap-2">
                    {CONTEXT_CHIPS.map(chip => (
                      <div key={chip.label} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                        <chip.icon className={`h-3.5 w-3.5 mb-1.5 ${chip.color}`} />
                        <p className="text-sm font-semibold text-white leading-tight">{chip.value}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{chip.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Context Toggles</p>
                  <div className="space-y-1">
                    {CONTEXT_TOGGLES.map(toggle => (
                      <button
                        key={toggle.id}
                        onClick={() => toggleContext(toggle.id)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition hover:bg-slate-800/50"
                      >
                        <div className="flex items-center gap-2.5">
                          <Database className="h-3.5 w-3.5 text-slate-500" />
                          <span className="text-sm text-slate-300">{toggle.label}</span>
                        </div>
                        {toggles[toggle.id]
                          ? <ToggleRight className="h-5 w-5 text-[#D4AF37]" />
                          : <ToggleLeft className="h-5 w-5 text-slate-600" />
                        }
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    AI has access to{' '}
                    <span className="text-slate-300 font-medium">
                      {Object.values(toggles).filter(Boolean).length} of 4
                    </span>{' '}
                    data sources. More context = better answers.
                  </p>
                </div>
              </div>
            )}

            {/* History tab */}
            {activeTab === 'history' && (
              <div className="p-3 space-y-1">
                <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Recent conversations</p>
                {HISTORY.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => loadConversation(conv)}
                    className={[
                      'w-full rounded-lg p-3 text-left transition hover:bg-slate-800/60',
                      activeConversation === conv.id ? 'bg-slate-800/80 border border-slate-700' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-slate-200 truncate pr-2">{conv.title}</p>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                    </div>
                    <p className="text-xs text-slate-500 truncate">{conv.preview}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Clock className="h-3 w-3 text-slate-700" />
                      <span className="text-xs text-slate-600">{conv.date}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Suggestions tab */}
            {activeTab === 'suggestions' && (
              <div className="p-3 space-y-2">
                <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">Quick questions</p>
                {SUGGESTIONS.map(sug => (
                  <button
                    key={sug.id}
                    onClick={() => sendMessage(sug.text)}
                    className="flex w-full items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-left transition hover:border-[#D4AF37]/30 hover:bg-slate-800/60"
                  >
                    <sug.icon className="h-4 w-4 shrink-0 text-[#D4AF37] mt-0.5" />
                    <span className="text-sm text-slate-300 leading-snug">{sug.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main chat area */}
        <div className="flex flex-1 flex-col overflow-hidden">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={['flex gap-3 max-w-3xl', msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''].join(' ')}
              >
                {/* Avatar */}
                <div className={[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  msg.role === 'assistant'
                    ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/25'
                    : 'bg-slate-700 text-slate-200',
                ].join(' ')}>
                  {msg.role === 'assistant'
                    ? <Sparkles className="h-4 w-4" />
                    : <span className="text-xs">M</span>
                  }
                </div>

                {/* Bubble */}
                <div className={[
                  'rounded-2xl px-4 py-3 text-sm leading-relaxed max-w-[80%]',
                  msg.role === 'assistant'
                    ? 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-sm'
                    : 'bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-white rounded-tr-sm',
                ].join(' ')}>
                  {msg.text.split('\n').map((line, j) => {
                    const boldLine = line.replace(/\*\*(.*?)\*\*/g, (_, m) => m)
                    return (
                      <span key={j}>
                        {line.startsWith('**') && line.endsWith('**')
                          ? <strong className="font-semibold text-white">{line.replace(/\*\*/g, '')}</strong>
                          : boldLine
                        }
                        {j < msg.text.split('\n').length - 1 && <br />}
                      </span>
                    )
                  })}
                  <p className="mt-1.5 text-xs text-slate-600">{msg.timestamp}</p>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex gap-3 max-w-3xl">
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

          {/* Suggestion pills (quick access row) */}
          <div className="border-t border-slate-800/50 px-4 py-2.5">
            <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
              {SUGGESTIONS.slice(0, 4).map(sug => (
                <button
                  key={sug.id}
                  onClick={() => sendMessage(sug.text)}
                  className="shrink-0 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400 transition hover:border-[#D4AF37]/40 hover:bg-slate-800 hover:text-slate-200 whitespace-nowrap"
                >
                  {sug.text.length > 42 ? sug.text.slice(0, 42) + '…' : sug.text}
                </button>
              ))}
            </div>
          </div>

          {/* Input bar */}
          <div className="border-t border-slate-800 bg-[#090C12]/80 px-4 py-4 backdrop-blur-xl">
            <form
              onSubmit={e => { e.preventDefault(); sendMessage() }}
              className="flex gap-3 items-end"
            >
              <div className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 focus-within:border-[#D4AF37]/40 transition-colors">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  placeholder="Ask about your business, deals, market, team…"
                  rows={1}
                  className="w-full resize-none bg-transparent text-sm text-white placeholder:text-slate-600 outline-none leading-relaxed"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37] text-[#0D1117] transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <p className="mt-2 text-center text-xs text-slate-700">
              Press Enter to send · Shift+Enter for new line · AI uses live CRM &amp; market data
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
