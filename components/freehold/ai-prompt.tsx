'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, ArrowUp, Loader2 } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; content: string }

export function AiPrompt({
  placeholder = 'Ask anything about your business',
  suggestions = [],
  context,
  skill,
}: {
  placeholder?: string
  suggestions?: string[]
  context?: Record<string, unknown>
  skill?: string
}) {
  const [value, setValue] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!taRef.current) return
    taRef.current.style.height = 'auto'
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 180) + 'px'
  }, [value])

  async function send(text?: string) {
    const message = (text ?? value).trim()
    if (!message || pending) return
    setMessages((m) => [...m, { role: 'user', content: message }])
    setValue('')
    setPending(true)
    try {
      const res = await fetch('/api/freehold/server-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, role: 'owner', ...(context ? { context } : {}), ...(skill ? { skill } : {}) }),
      })
      const data = await res.json()
      const answer =
        data?.data?.answer ||
        data?.answer ||
        data?.message ||
        data?.reply ||
        'I reviewed the private server state. Try one of the suggested prompts below.'
      setMessages((m) => [...m, { role: 'assistant', content: answer }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'I could not reach the server. Try again in a moment.' }])
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid gap-4">
      {messages.length > 0 && (
        <div className="grid gap-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === 'user'
                  ? 'rounded-3xl border border-white/[0.06] bg-white/[0.025] px-5 py-4 text-[15px] leading-relaxed text-white/85'
                  : 'rounded-3xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.04] px-5 py-4 text-[15px] leading-relaxed text-white/85'
              }
            >
              <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
                {m.role === 'user' ? 'You' : 'Freehold AI'}
              </div>
              {m.content}
            </div>
          ))}
          {pending && (
            <div className="flex items-center gap-2 px-5 py-3 text-sm text-white/45">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Thinking through your private server state…
            </div>
          )}
        </div>
      )}

      <div className="rounded-[28px] border border-white/[0.08] bg-white/[0.025] p-2 shadow-[0_20px_60px_-30px_rgba(212,175,55,0.18)] transition focus-within:border-[#D4AF37]/35 focus-within:bg-white/[0.045]">
        <div className="flex items-end gap-3 px-4 py-3">
          <Sparkles className="mt-1 h-5 w-5 shrink-0 text-[#D4AF37]" />
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            rows={1}
            placeholder={placeholder}
            className="flex-1 resize-none bg-transparent text-base leading-7 text-white outline-none placeholder:text-white/30"
          />
          <button
            onClick={() => send()}
            disabled={!value.trim() || pending}
            aria-label="Send"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#D4AF37] text-[#06080A] transition hover:bg-[#E8C657] disabled:opacity-30"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="rounded-full border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-[13px] text-white/60 transition hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/[0.06] hover:text-white"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
