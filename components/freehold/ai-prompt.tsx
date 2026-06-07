'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, ArrowUp } from 'lucide-react'
import { sendToExpert } from '@/lib/freehold/expert-bus'

/**
 * On-page AI entry box. Instead of holding its own separate conversation,
 * it routes every prompt into the single docked Expert panel on the right —
 * so the workspace has ONE AI conversation, not many disconnected ones.
 */
export function AiPrompt({
  placeholder = 'Ask anything about your business',
  suggestions = [],
}: {
  placeholder?: string
  suggestions?: string[]
  // context / skill kept for call-site compatibility; the unified Expert
  // panel owns system context, so they are intentionally ignored here.
  context?: Record<string, unknown>
  skill?: string
}) {
  const [value, setValue] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!taRef.current) return
    taRef.current.style.height = 'auto'
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 180) + 'px'
  }, [value])

  function send(text?: string) {
    const message = (text ?? value).trim()
    if (!message) return
    sendToExpert(message)
    setValue('')
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-2xl border border-line-strong bg-surface-2 p-2 transition-colors focus-within:border-gold/40 focus-within:bg-surface-2">
        <div className="flex items-end gap-3 px-3 py-2">
          <Sparkles className="mt-1.5 h-5 w-5 shrink-0 text-gold" />
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            rows={1}
            placeholder={placeholder}
            className="flex-1 resize-none bg-transparent text-base leading-7 text-white outline-none placeholder:text-slate-500"
          />
          <button
            onClick={() => send()}
            disabled={!value.trim()}
            aria-label="Send to Freehold Expert"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold text-ink transition hover:bg-[#E8C657] disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="rounded-full border border-line bg-surface-2 px-4 py-2 text-sm text-slate-400 transition-colors hover:border-gold/30 hover:bg-gold/[0.06] hover:text-white"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
