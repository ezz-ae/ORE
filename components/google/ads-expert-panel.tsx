'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, ChevronDown, ChevronUp, Sparkles, Bot, RotateCcw, AlertCircle } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  ts: number
}

export interface MarketingContext {
  platform?: string
  [key: string]: unknown
}

interface Props {
  context?: MarketingContext
  initiallyOpen?: boolean
  /** Where this panel lives — affects suggested prompts */
  scope?: 'google-ads' | 'meta-ads' | 'social' | 'general'
}

const PROMPTS: Record<NonNullable<Props['scope']>, string[]> = {
  'google-ads': [
    'Which campaigns should I pause to save budget?',
    'Suggest keywords I might be missing for Dubai real estate.',
    'How can I improve my Quality Score?',
    'What bidding strategy works best for lead generation here?',
    'Write me 3 headlines for a luxury apartment campaign.',
  ],
  'meta-ads': [
    'Review my current creatives and suggest improvements.',
    'What audiences should I target for off-plan Dubai properties?',
    'Write carousel ad copy for a waterfront development.',
    'How should I structure a retargeting funnel here?',
    'What daily budget allocation makes sense across campaigns?',
  ],
  'social': [
    'Write 5 LinkedIn post ideas for our latest project launch.',
    'What hashtag strategy works for Dubai real estate on Instagram?',
    'Create an Instagram Reel script for a property tour.',
    'Suggest a content calendar for the next 2 weeks.',
    'How should we position our brand vs competitors on social?',
  ],
  'general': [
    'Give me a full-funnel digital marketing strategy for our listings.',
    'Where should we allocate budget across Google, Meta, and social?',
    'What landing page improvements would boost conversion?',
    'Analyze our overall marketing mix and suggest optimizations.',
    'Design a lead generation flow for off-plan property buyers.',
  ],
}

function generateSessionId() {
  return `mkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function MarketingExpertPanel({ context, initiallyOpen = true, scope = 'general' }: Props) {
  const [open, setOpen]           = useState(initiallyOpen)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [configErr, setConfigErr] = useState(false)
  const sessionId = useRef(generateSessionId())
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: trimmed, ts: Date.now() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/google/ads-agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:   trimmed,
          sessionId: sessionId.current,
          context:   context as Record<string, unknown>,
        }),
      })

      const data = await res.json() as { response?: string; error?: string; type?: string }
      if (!res.ok || data.error) {
        if (data.type === 'config') setConfigErr(true)
        setError(data.error ?? 'Agent unavailable')
        return
      }

      const agentMsg: Message = {
        id:      crypto.randomUUID(),
        role:    'agent',
        content: data.response ?? '(no response)',
        ts:      Date.now(),
      }
      setMessages((prev) => [...prev, agentMsg])
    } catch {
      setError('Network error — could not reach Marketing Expert')
    } finally {
      setLoading(false)
    }
  }, [loading, context])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const clearConversation = () => {
    setMessages([])
    setError(null)
    setConfigErr(false)
    sessionId.current = generateSessionId()
  }

  const prompts = PROMPTS[scope]

  return (
    <div className="mt-10 overflow-hidden rounded-[20px] border border-[#4285F4]/20 bg-[#131B2B]">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02]"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4285F4]/20 to-[#D4AF37]/10">
          <Sparkles className="h-4 w-4 text-[#4285F4]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[14px] font-semibold text-white">Marketing Expert</span>
            <span className="rounded-full border border-[#4285F4]/20 bg-[#4285F4]/10 px-2 py-0.5 text-[10px] font-medium text-[#4285F4]">
              Vertex AI
            </span>
            <span className="rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-2 py-0.5 text-[10px] font-medium text-[#D4AF37]">
              Marketing Agency
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-white/35 truncate">
            Web design · Google &amp; Meta Ads · Social · Content · Full funnel
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); clearConversation() }}
            className="mr-2 rounded-lg p-1.5 text-white/25 transition hover:text-white/60"
            title="Clear conversation"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
        {open
          ? <ChevronUp className="h-4 w-4 shrink-0 text-white/30" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-white/30" />
        }
      </button>

      {open && (
        <div className="border-t border-white/[0.06]">
          {/* Config error banner */}
          {configErr && (
            <div className="mx-4 mt-3 flex items-start gap-2 rounded-[12px] border border-red-400/20 bg-red-400/[0.05] px-3 py-2.5">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              <p className="text-[12px] text-white/60">
                Set <code className="rounded bg-white/[0.07] px-1 text-red-300/80">VERTEX_AI_API_KEY</code> in your environment variables to enable the Marketing Expert agent.
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="h-72 overflow-y-auto px-4 pt-3 pb-2 space-y-3 scroll-smooth">
            {messages.length === 0 && (
              <div className="pt-2 pb-1">
                <div className="mb-3 flex items-center gap-2 text-[12px] text-white/30">
                  <Bot className="h-3.5 w-3.5" />
                  Ask about ads, content, web design, or marketing strategy
                </div>
                <div className="flex flex-wrap gap-2">
                  {prompts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => send(p)}
                      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/50 transition hover:border-[#4285F4]/25 hover:text-white/80"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {msg.role === 'agent' && (
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4285F4]/20 to-[#D4AF37]/10">
                    <Sparkles className="h-3 w-3 text-[#4285F4]" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-[14px] px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#4285F4]/15 text-white/85'
                      : 'bg-white/[0.04] text-white/80'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4285F4]/20 to-[#D4AF37]/10">
                  <Sparkles className="h-3 w-3 text-[#4285F4]" />
                </div>
                <div className="flex gap-1 rounded-[14px] bg-white/[0.04] px-3.5 py-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-[#4285F4]/50 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {error && !configErr && (
              <div className="flex items-center gap-2 text-[12px] text-red-400/70">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/[0.06] px-3 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about strategy, copy, keywords, creatives…"
                rows={1}
                disabled={loading || configErr}
                className="flex-1 resize-none rounded-[12px] border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-[13px] text-white/80 placeholder-white/25 outline-none transition focus:border-[#4285F4]/30 disabled:opacity-40"
                style={{ maxHeight: '5rem', minHeight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => send(input)}
                disabled={!input.trim() || loading || configErr}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#4285F4] text-white transition hover:bg-[#5A97F5] disabled:opacity-35"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-white/20">
              Enter to send · Shift+Enter for newline
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
