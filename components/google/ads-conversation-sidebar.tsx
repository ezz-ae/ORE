'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Send, Sparkles, Bot, RotateCcw, AlertCircle,
  Copy, Check, ExternalLink, ChevronRight, ChevronLeft,
} from 'lucide-react'
import { useAdsContext } from '@/lib/google/ads-context'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  ts: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateSessionId() {
  return `ads-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Detect RSA-structured copy (Headline N: / Description N: format) */
function isRsaCopy(text: string): boolean {
  return /Headline\s*\d+:/i.test(text) && /Description\s*\d+:/i.test(text)
}

/** Parse RSA copy from agent message into headlines + descriptions arrays */
function parseRsaCopy(text: string): { headlines: string[]; descriptions: string[] } | null {
  const headlines: string[] = []
  const descriptions: string[] = []
  for (const line of text.split('\n')) {
    const h = line.match(/^Headline\s*\d+:\s*(.+)/i)
    const d = line.match(/^Description\s*\d+:\s*(.+)/i)
    if (h) headlines.push(h[1].trim())
    if (d) descriptions.push(d[1].trim())
  }
  if (!headlines.length && !descriptions.length) return null
  return { headlines, descriptions }
}

/** Scope label + suggested prompts derived from the current path */
function pathToScope(pathname: string): { label: string; prompts: string[] } {
  if (pathname.includes('/campaigns/')) return {
    label: 'Campaign Detail',
    prompts: [
      'How can I improve this campaign\'s Quality Score?',
      'Suggest bid adjustments for better ROI.',
      'What ad schedule would maximise leads here?',
    ],
  }
  if (pathname.includes('/campaigns')) return {
    label: 'Campaigns',
    prompts: [
      'Which campaigns should I pause to save budget?',
      'How do I structure a Performance Max campaign for off-plan apartments?',
      'What bidding strategy works best for lead generation?',
    ],
  }
  if (pathname.includes('/keywords')) return {
    label: 'Keywords',
    prompts: [
      'Suggest high-intent keywords for Dubai luxury apartments.',
      'What negative keywords should I add to reduce wasted spend?',
      'Explain broad vs exact match for real estate ads.',
    ],
  }
  if (pathname.includes('/ads/generate')) return {
    label: 'RSA Generator',
    prompts: [
      'Write 5 RSA headlines for a waterfront apartment campaign.',
      'Give me descriptions targeting off-plan investors.',
      'How do I improve RSA ad strength?',
    ],
  }
  if (pathname.includes('/ads')) return {
    label: 'Ads',
    prompts: [
      'Write RSA headlines for a Dubai luxury apartment campaign.',
      'Which ad elements most affect Quality Score?',
      'How should I A/B test ad copy effectively?',
    ],
  }
  if (pathname.includes('/audiences')) return {
    label: 'Audiences',
    prompts: [
      'What audiences should I target for off-plan Dubai properties?',
      'How should I structure a remarketing funnel for real estate?',
      'Explain Customer Match for real estate lead nurturing.',
    ],
  }
  if (pathname.includes('/reports')) return {
    label: 'Reports',
    prompts: [
      'What does a healthy CTR look like for real estate Google Ads?',
      'How do I interpret the search terms report?',
      'Explain auction insights and what to do if competitors are outbidding me.',
    ],
  }
  if (pathname.includes('/extensions')) return {
    label: 'Extensions',
    prompts: [
      'Which extensions work best for lead generation?',
      'Write sitelink text for a luxury apartment development.',
      'How do callout extensions impact Quality Score?',
    ],
  }
  return {
    label: 'Google Ads',
    prompts: [
      'Give me a 30-day optimisation roadmap for our account.',
      'Where should we allocate budget across Search and Performance Max?',
      'What landing page changes would boost our conversion rate?',
      'Write RSA headlines for a Dubai off-plan apartment campaign.',
      'Analyse our marketing mix and recommend next steps.',
    ],
  }
}

// ─── Copy button with check feedback ─────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button" onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] text-white/40 transition hover:border-white/[0.15] hover:text-white/70"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : label}
    </button>
  )
}

// ─── Main sidebar ─────────────────────────────────────────────────────────────

export function AdsConversationSidebar() {
  const pathname                  = usePathname()
  const router                    = useRouter()
  const { adsContext }            = useAdsContext()
  const { label: scopeLabel, prompts } = pathToScope(pathname)

  const [open, setOpen]           = useState(true)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [configErr, setConfigErr] = useState(false)
  const sessionId                 = useRef(generateSessionId())
  const bottomRef                 = useRef<HTMLDivElement>(null)
  const inputRef                  = useRef<HTMLTextAreaElement>(null)
  // Track whether we've already sent the context for this session
  const contextSentRef            = useRef(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Reset context-sent flag whenever the session resets
  const resetSession = () => {
    setMessages([]); setError(null); setConfigErr(false)
    sessionId.current = generateSessionId()
    contextSentRef.current = false
  }

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', content: trimmed, ts: Date.now() }])
    setInput('')
    setLoading(true)
    setError(null)

    // Inject live account context on the first message only
    const shouldSendContext = adsContext && !contextSentRef.current
    if (shouldSendContext) contextSentRef.current = true

    try {
      const res = await fetch('/api/google/ads-agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:   trimmed,
          sessionId: sessionId.current,
          context:   shouldSendContext ? adsContext : undefined,
        }),
      })
      const data = await res.json() as { response?: string; error?: string; type?: string }
      if (!res.ok || data.error) {
        if (data.type === 'config') setConfigErr(true)
        setError(data.error ?? 'Agent unavailable')
        return
      }
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(), role: 'agent',
        content: data.response ?? '(no response)', ts: Date.now(),
      }])
    } catch {
      setError('Network error — could not reach Marketing Expert')
    } finally {
      setLoading(false)
    }
  }, [loading, adsContext])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  /** Store RSA copy in sessionStorage and navigate to the generator */
  const sendToRsaGenerator = (text: string) => {
    const parsed = parseRsaCopy(text)
    if (parsed) {
      sessionStorage.setItem('rsa-prefill', JSON.stringify({ ...parsed, source: 'marketing-expert' }))
    }
    router.push('/freehold-intelligence/lead-machine/google/ads/generate')
  }

  // ── Collapsed ───────────────────────────────────────────────────────────────
  if (!open) {
    return (
      <div className="hidden xl:flex w-10 shrink-0 flex-col items-center border-l border-white/[0.06] bg-[#0B0F1A] pt-4 sticky top-14 h-[calc(100vh-3.5rem)]">
        <button
          type="button" onClick={() => setOpen(true)} title="Open Marketing Expert"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-white/30 transition hover:bg-white/[0.08] hover:text-white/70"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="mt-4"><Sparkles className="h-3.5 w-3.5 text-[#4285F4]/40" /></div>
      </div>
    )
  }

  // ── Expanded ─────────────────────────────────────────────────────────────────
  return (
    <aside className="hidden xl:flex w-[360px] shrink-0 flex-col border-l border-white/[0.06] bg-[#0B0F1A] sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3 shrink-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4285F4]/20 to-[#D4AF37]/10">
          <Sparkles className="h-3.5 w-3.5 text-[#4285F4]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-white leading-none">Marketing Expert</span>
            <span className="rounded-full border border-[#4285F4]/20 bg-[#4285F4]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#4285F4]">AI</span>
            {adsContext && (
              <span className="rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#D4AF37]" title="Live account data loaded">
                live
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-white/30 truncate">{scopeLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button type="button" onClick={resetSession}
              className="rounded-lg p-1.5 text-white/25 transition hover:text-white/60" title="Clear">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-white/25 transition hover:text-white/60" title="Collapse">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Config error */}
      {configErr && (
        <div className="mx-3 mt-3 flex items-start gap-2 rounded-[10px] border border-red-400/20 bg-red-400/[0.05] px-3 py-2 shrink-0">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
          <p className="text-[11px] text-white/55">
            Set <code className="rounded bg-white/[0.07] px-1 text-red-300/80">VERTEX_AI_SERVICE_ACCOUNT_JSON</code> in Vercel env vars.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-2 space-y-3 scroll-smooth">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="pt-1">
            <div className="mb-3 flex items-center gap-1.5 text-[11px] text-white/25">
              <Bot className="h-3.5 w-3.5" />
              {adsContext
                ? 'Live account data loaded — ask anything'
                : 'Ask about ads, copy, strategy, or keywords'}
            </div>
            <div className="space-y-1.5">
              {prompts.map((p) => (
                <button key={p} type="button" onClick={() => send(p)} disabled={loading}
                  className="w-full rounded-[10px] border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left text-[12px] text-white/45 transition hover:border-[#4285F4]/20 hover:bg-white/[0.04] hover:text-white/70 disabled:opacity-40">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {msg.role === 'agent' && (
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4285F4]/20 to-[#D4AF37]/10">
                <Sparkles className="h-2.5 w-2.5 text-[#4285F4]" />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className={`rounded-[12px] px-3 py-2.5 text-[12px] leading-relaxed whitespace-pre-wrap break-words ${
                msg.role === 'user'
                  ? 'bg-[#4285F4]/15 text-white/80 ml-4'
                  : 'bg-white/[0.04] text-white/75'
              }`}>
                {msg.content}
              </div>

              {/* Agent message actions */}
              {msg.role === 'agent' && (
                <div className="flex flex-wrap items-center gap-1.5 pl-1">
                  <CopyButton text={msg.content} />
                  {isRsaCopy(msg.content) && (
                    <button
                      type="button"
                      onClick={() => sendToRsaGenerator(msg.content)}
                      className="inline-flex items-center gap-1 rounded-md border border-[#4285F4]/20 bg-[#4285F4]/10 px-2 py-1 text-[11px] text-[#4285F4]/80 transition hover:border-[#4285F4]/40 hover:text-[#4285F4]"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      Send to RSA Generator
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4285F4]/20 to-[#D4AF37]/10">
              <Sparkles className="h-2.5 w-2.5 text-[#4285F4]" />
            </div>
            <div className="flex gap-1 rounded-[12px] bg-white/[0.04] px-3 py-2.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#4285F4]/50 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !configErr && (
          <div className="flex items-center gap-2 text-[11px] text-red-400/70 px-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />{error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/[0.06] px-3 py-3 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef} value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about strategy, copy, keywords…"
            rows={1} disabled={loading || configErr}
            className="flex-1 resize-none rounded-[10px] border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] text-white/75 placeholder-white/20 outline-none transition focus:border-[#4285F4]/30 disabled:opacity-40"
            style={{ maxHeight: '4.5rem', minHeight: '2.25rem' }}
          />
          <button type="button" onClick={() => send(input)}
            disabled={!input.trim() || loading || configErr}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#4285F4] text-white transition hover:bg-[#5A97F5] disabled:opacity-35">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-white/15">Enter to send · Shift+Enter for newline</p>
      </div>
    </aside>
  )
}
