'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles, ArrowUp, Loader2, X, MessageSquare, Plus } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; content: string }

const STARTERS = [
  'What should I focus on right now?',
  'Which properties should we advertise this week?',
  'What is blocking launch?',
  'Give me a 7-day plan to get the first campaign live.',
]

const PAGE_LABELS: { match: (p: string) => boolean; label: string }[] = [
  { match: (p) => p === '/freehold-intelligence', label: 'Home' },
  { match: (p) => p.startsWith('/freehold-intelligence/lead-machine'), label: 'Lead Machine' },
  { match: (p) => p.startsWith('/freehold-intelligence/crm'), label: 'CRM' },
  { match: (p) => p.startsWith('/freehold-intelligence/inventory'), label: 'Inventory' },
  { match: (p) => p.startsWith('/freehold-intelligence/ads'), label: 'Ads' },
  { match: (p) => p.startsWith('/freehold-intelligence/ai-manager'), label: 'Web Manager' },
  { match: (p) => p.startsWith('/freehold-intelligence/integrations'), label: 'Integrations' },
  { match: (p) => p.startsWith('/freehold-intelligence/analytics'), label: 'Analytics' },
]

function pageLabel(pathname: string): string {
  return PAGE_LABELS.find((p) => p.match(pathname))?.label ?? 'Workspace'
}

export function ExpertChat() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sessionId = useRef(`expert-${Date.now()}-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    if (!taRef.current) return
    taRef.current.style.height = 'auto'
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 160) + 'px'
  }, [value])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  // Keyboard shortcut: ⌘/Ctrl + J toggles the Expert
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setOpen((o) => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function send(text?: string) {
    const message = (text ?? value).trim()
    if (!message || pending) return
    setMessages((m) => [...m, { role: 'user', content: message }])
    setValue('')
    setPending(true)
    try {
      const res = await fetch('/api/freehold/expert/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          role: 'owner',
          sessionId: sessionId.current,
          page: pathname,
        }),
      })
      const data = await res.json()
      const answer =
        data?.data?.answer ||
        data?.answer ||
        'I reviewed the system state. Try one of the suggested prompts.'
      setMessages((m) => [...m, { role: 'assistant', content: answer }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'I could not reach the system. Try again in a moment.' }])
    } finally {
      setPending(false)
    }
  }

  function reset() {
    setMessages([])
    setValue('')
    sessionId.current = `expert-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open Freehold Expert"
          className="group fixed bottom-5 right-5 z-[200] flex items-center gap-2.5 rounded-full border border-[#D4AF37]/30 bg-[#0E1422]/95 py-3 pl-3.5 pr-4 shadow-[0_20px_60px_-20px_rgba(212,175,55,0.45)] backdrop-blur-xl transition hover:border-[#D4AF37]/55 hover:bg-[#131B2B]"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#D4AF37] text-[#06080A]">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="text-[13px] font-semibold text-white/85">Ask the Expert</span>
          <kbd className="ml-1 hidden rounded border border-white/[0.12] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-white/35 sm:block">
            ⌘J
          </kbd>
        </button>
      )}

      {/* Backdrop on mobile */}
      {open && (
        <button
          aria-label="Close Expert"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[190] bg-black/40 backdrop-blur-[2px] md:hidden"
        />
      )}

      {/* Right-side dock */}
      <aside
        className={[
          'fixed right-0 top-0 z-[200] flex h-full w-full flex-col border-l border-white/[0.08] bg-[#0A0E18]/98 backdrop-blur-2xl shadow-[-30px_0_80px_-40px_rgba(0,0,0,0.8)] transition-transform duration-300 ease-out sm:w-[400px]',
          open ? 'translate-x-0' : 'translate-x-full pointer-events-none',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.07] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[#D4AF37]/15 ring-1 ring-[#D4AF37]/30">
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
            </span>
            <div>
              <div className="text-[13px] font-semibold text-white/90">Freehold Expert</div>
              <div className="text-[10px] text-white/30">Full-system · {pageLabel(pathname)}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={reset}
                title="New chat"
                className="grid h-8 w-8 place-items-center rounded-lg text-white/35 transition hover:bg-white/[0.05] hover:text-white/70"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              title="Close"
              className="grid h-8 w-8 place-items-center rounded-lg text-white/35 transition hover:bg-white/[0.05] hover:text-white/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col">
              <div className="mb-5 rounded-2xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] p-4">
                <div className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[#D4AF37]/80">
                  <MessageSquare className="h-3 w-3" /> Your operating partner
                </div>
                <p className="text-[13px] leading-relaxed text-white/55">
                  I see the whole business — inventory, web, domain, design, CRM, ads, planning and
                  execution. Ask me anything and I'll ground it in your live system state.
                </p>
              </div>
              <div className="grid gap-2">
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5 text-left text-[13px] text-white/60 transition hover:border-[#D4AF37]/25 hover:bg-[#D4AF37]/[0.05] hover:text-white"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.role === 'user'
                      ? 'ml-auto max-w-[88%] rounded-2xl rounded-br-md border border-white/[0.06] bg-white/[0.04] px-4 py-3 text-[14px] leading-relaxed text-white/85'
                      : 'mr-auto max-w-[92%] rounded-2xl rounded-bl-md border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] px-4 py-3 text-[14px] leading-relaxed text-white/85'
                  }
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              ))}
              {pending && (
                <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-md border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] px-4 py-3 text-[13px] text-white/45">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#D4AF37]" />
                  Reading the system state…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-white/[0.07] p-3">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-1.5 transition focus-within:border-[#D4AF37]/35 focus-within:bg-white/[0.04]">
            <div className="flex items-end gap-2 px-2.5 py-1.5">
              <textarea
                ref={taRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                rows={1}
                placeholder="Ask the Expert anything…"
                className="flex-1 resize-none bg-transparent py-1 text-[14px] leading-6 text-white outline-none placeholder:text-white/30"
              />
              <button
                onClick={() => send()}
                disabled={!value.trim() || pending}
                aria-label="Send"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#D4AF37] text-[#06080A] transition hover:bg-[#E8C657] disabled:opacity-30"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="mt-1.5 px-1 text-center text-[10px] text-white/20">
            Grounded in live inventory, CRM, ads, integrations & server state
          </div>
        </div>
      </aside>
    </>
  )
}
