'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles, ArrowUp, Loader2, X, Plus, PanelRightClose, PanelRightOpen,
  Check, Rocket, Pencil, Eye, ThumbsUp, ArrowRight, ImageIcon, Copy, ListChecks,
} from 'lucide-react'
import type { ExpertBlock, ExpertAction } from '@/lib/freehold/expert-blocks'
import { EXPERT_SEND, EXPERT_OPEN } from '@/lib/freehold/expert-bus'

type Message = { role: 'user'; content: string } | { role: 'assistant'; blocks: ExpertBlock[] }

const STARTERS = [
  'What should I focus on right now?',
  'Design a landing page for the top ad-ready property.',
  'Which properties should we advertise this week?',
  'Give me a 7-day plan to get the first campaign live.',
]

const PAGE_LABELS: { match: (p: string) => boolean; label: string }[] = [
  { match: (p) => p === '/freehold-intelligence', label: 'Home' },
  { match: (p) => p.startsWith('/freehold-intelligence/lead-machine'), label: 'Lead Machine' },
  { match: (p) => p.startsWith('/freehold-intelligence/crm'), label: 'CRM' },
  { match: (p) => p.startsWith('/freehold-intelligence/inventory'), label: 'Inventory' },
  { match: (p) => p.startsWith('/freehold-intelligence/ads'), label: 'Ads' },
  { match: (p) => p.startsWith('/freehold-intelligence/ai-manager'), label: 'Web Studio' },
  { match: (p) => p.startsWith('/freehold-intelligence/integrations'), label: 'Integrations' },
  { match: (p) => p.startsWith('/freehold-intelligence/analytics'), label: 'Analytics' },
]
const pageLabel = (p: string) => PAGE_LABELS.find((x) => x.match(p))?.label ?? 'Workspace'

const MIN_W = 340
const MAX_W = 760
const DEFAULT_W = 440

// ─── Action button styling ──────────────────────────────────────────────────
const ACTION_ICON: Record<ExpertAction['kind'], React.ElementType> = {
  prompt: ArrowRight, review: Eye, launch: Rocket, edit: Pencil, approve: ThumbsUp, navigate: ArrowRight,
}
function actionClass(style?: string) {
  if (style === 'primary') return 'bg-gold text-[#06080A] hover:bg-[#E8C657] border-transparent'
  if (style === 'danger') return 'border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20'
  return 'border-line-strong bg-surface-2 text-slate-300 hover:border-gold/40 hover:text-white'
}

export function ExpertChat() {
  const pathname = usePathname()
  const [open, setOpen] = useState(true)
  const [width, setWidth] = useState(DEFAULT_W)
  const [value, setValue] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sessionId = useRef(`expert-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const dragging = useRef(false)

  // Restore persisted width + open state
  useEffect(() => {
    const w = Number(localStorage.getItem('fi-expert-width'))
    if (w >= MIN_W && w <= MAX_W) setWidth(w)
    const o = localStorage.getItem('fi-expert-open')
    if (o === '0') setOpen(false)
  }, [])

  useEffect(() => { localStorage.setItem('fi-expert-open', open ? '1' : '0') }, [open])

  useEffect(() => {
    if (!taRef.current) return
    taRef.current.style.height = 'auto'
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 160) + 'px'
  }, [value])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  // ⌘/Ctrl + J toggles, Esc closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setOpen((o) => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ─── Resize handling ──
  const onDragStart = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'
  }, [])
  const onDrag = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const w = Math.min(MAX_W, Math.max(MIN_W, window.innerWidth - e.clientX))
    setWidth(w)
  }, [])
  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
    document.body.style.userSelect = ''
    document.body.style.cursor = ''
    setWidth((w) => { localStorage.setItem('fi-expert-width', String(w)); return w })
  }, [])

  const send = useCallback(async (text?: string) => {
    const message = (text ?? value).trim()
    if (!message || pending) return
    setMessages((m) => [...m, { role: 'user', content: message }])
    setValue('')
    setPending(true)
    try {
      const res = await fetch('/api/freehold/expert/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId: sessionId.current, page: pathname }),
      })
      const data = await res.json()
      const blocks: ExpertBlock[] = data?.data?.blocks ?? [{ type: 'text', content: 'I reviewed the system state. Try a suggested prompt.' }]
      setMessages((m) => [...m, { role: 'assistant', blocks }])
    } catch {
      setMessages((m) => [...m, { role: 'assistant', blocks: [{ type: 'text', content: 'I could not reach the system. Try again in a moment.' }] }])
    } finally {
      setPending(false)
    }
  }, [value, pending, pathname])

  // Listen for messages pushed from any on-page AI box → unified conversation.
  useEffect(() => {
    function onSend(e: Event) {
      const msg = (e as CustomEvent).detail?.message as string | undefined
      setOpen(true)
      if (msg) send(msg)
    }
    function onOpen() { setOpen(true) }
    window.addEventListener(EXPERT_SEND, onSend)
    window.addEventListener(EXPERT_OPEN, onOpen)
    return () => {
      window.removeEventListener(EXPERT_SEND, onSend)
      window.removeEventListener(EXPERT_OPEN, onOpen)
    }
  }, [send])

  function reset() {
    setMessages([]); setValue('')
    sessionId.current = `expert-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800)
  }

  // ─── Collapsed rail ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Freehold Expert"
        data-coach="expert-chat"
        className="hidden h-full w-11 shrink-0 flex-col items-center gap-3 border-l border-line bg-app py-4 transition hover:bg-surface-2 md:flex"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-gold/15 ring-1 ring-gold/30">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
        </span>
        <span className="mt-1 text-xs font-semibold tracking-wider text-slate-500 [writing-mode:vertical-rl]">
          EXPERT
        </span>
        <PanelRightOpen className="mt-auto h-4 w-4 text-slate-600" />
      </button>
    )
  }

  return (
    <>
      {/* Mobile backdrop */}
      <button
        aria-label="Close Expert"
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-[190] bg-black/50 md:hidden"
      />

      <aside
        style={{ width }}
        data-coach="expert-chat"
        className="fixed inset-y-0 right-0 z-[200] flex h-full w-full flex-col border-l border-line bg-app md:static md:z-auto md:w-auto"
      >
        {/* Drag handle (desktop) */}
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDrag}
          onPointerUp={onDragEnd}
          className="absolute left-0 top-0 z-10 hidden h-full w-1.5 -translate-x-1/2 cursor-col-resize md:block"
        >
          <div className="mx-auto h-full w-px bg-surface-2 transition group-hover:bg-gold/40" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gold/15 ring-1 ring-gold/30">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-100">Freehold Expert</div>
              <div className="text-xs text-slate-500">Full-system · {pageLabel(pathname)}</div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {messages.length > 0 && (
              <button onClick={reset} title="New chat" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-surface-2 hover:text-slate-200">
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setOpen(false)} title="Collapse (⌘J)" className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-surface-2 hover:text-slate-200">
              <PanelRightClose className="hidden h-4 w-4 md:block" />
              <X className="h-4 w-4 md:hidden" />
            </button>
          </div>
        </div>

        {/* Conversation */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col">
              <div className="mb-4 rounded-xl border border-gold/15 bg-gold/[0.05] p-4">
                <p className="text-sm leading-relaxed text-slate-300">
                  I'm your full-system partner. Ask me to plan, design a landing page, pick colours,
                  draft a campaign, review or launch — I'll build it right here in the conversation,
                  grounded in your live data.
                </p>
              </div>
              <div className="grid gap-2">
                {STARTERS.map((q) => (
                  <button key={q} onClick={() => send(q)}
                    className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-left text-sm text-slate-300 transition-colors hover:border-gold/30 hover:bg-gold/[0.06] hover:text-white">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="ml-auto max-w-[90%] rounded-xl rounded-br-md border border-line-strong bg-surface-2 px-4 py-2.5 text-sm leading-relaxed text-slate-100">
                    {m.content}
                  </div>
                ) : (
                  <div key={i} className="grid gap-2.5">
                    {m.blocks.map((b, j) => (
                      <BlockView key={j} block={b} idx={`${i}-${j}`} onAction={send} onCopy={copy} copied={copied} />
                    ))}
                  </div>
                ),
              )}
              {pending && (
                <div className="mr-auto flex items-center gap-2 rounded-xl rounded-bl-md border border-gold/20 bg-gold/[0.06] px-4 py-3 text-sm text-slate-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
                  Reading the system & building…
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-line p-3">
          <div
            className="cursor-text rounded-xl border border-white/[0.14] bg-surface-2 p-2 transition-all focus-within:border-gold/60 focus-within:bg-white/[0.07] focus-within:ring-1 focus-within:ring-gold/15"
            onClick={() => taRef.current?.focus()}
          >
            <div className="flex items-end gap-2 px-2 py-1">
              <textarea
                ref={taRef} value={value} onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                rows={1} placeholder="Ask, design, plan, or launch…"
                className="flex-1 cursor-text resize-none bg-transparent py-1 text-sm leading-6 text-white outline-none placeholder:text-slate-500"
              />
              <button onClick={() => send()} disabled={!value.trim() || pending} aria-label="Send"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-[#06080A] transition hover:bg-[#E8C657] disabled:opacity-30">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

// ─── Block renderer ───────────────────────────────────────────────────────────

function BlockView({
  block, idx, onAction, onCopy, copied,
}: {
  block: ExpertBlock
  idx: string
  onAction: (text: string) => void
  onCopy: (text: string, key: string) => void
  copied: string | null
}) {
  switch (block.type) {
    case 'text':
      return (
        <div className="rounded-xl rounded-bl-md border border-gold/15 bg-gold/[0.05] px-4 py-3 text-sm leading-relaxed text-slate-200">
          <div className="whitespace-pre-wrap">{block.content}</div>
        </div>
      )

    case 'plan':
      return (
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
            <ListChecks className="h-3.5 w-3.5" /> {block.title ?? 'Plan'}
          </div>
          <ol className="grid gap-3">
            {block.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/15 text-xs font-bold text-gold">{i + 1}</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-200">{s.step}</div>
                  {s.detail && <div className="mt-0.5 text-xs leading-relaxed text-slate-400">{s.detail}</div>}
                  {s.owner && <div className="mt-1 inline-block rounded-full bg-surface-3 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">{s.owner}</div>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )

    case 'actions':
      return (
        <div className="flex flex-wrap gap-2">
          {block.actions.map((a, i) => {
            const Icon = ACTION_ICON[a.kind] ?? ArrowRight
            if (a.kind === 'navigate' && a.href) {
              return (
                <Link key={i} href={a.href}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${actionClass(a.style)}`}>
                  <Icon className="h-3.5 w-3.5" /> {a.label}
                </Link>
              )
            }
            return (
              <button key={i} onClick={() => onAction(a.prompt || a.label)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${actionClass(a.style)}`}>
                <Icon className="h-3.5 w-3.5" /> {a.label}
              </button>
            )
          })}
        </div>
      )

    case 'color':
      return (
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          {block.label && <div className="mb-3 text-sm font-medium text-slate-300">{block.label}</div>}
          <div className="flex flex-wrap gap-3">
            {block.colors.map((c) => (
              <button key={c} onClick={() => onAction(`Use the accent colour ${c} — apply it and show the result.`)}
                title={c}
                className="group flex flex-col items-center gap-1.5">
                <span className="h-10 w-10 rounded-full ring-2 ring-line-strong transition group-hover:ring-gold/60" style={{ backgroundColor: c }} />
                <span className="text-xs font-medium text-slate-500 group-hover:text-slate-300">{c}</span>
              </button>
            ))}
          </div>
        </div>
      )

    case 'landing': {
      const accent = block.accent || '#D4AF37'
      const full = [
        block.title, block.subhead, '',
        ...block.sections.map((s) => `${s.heading}\n${s.body}`),
        block.cta ? `\nCTA: ${block.cta}` : '',
      ].filter(Boolean).join('\n')
      return (
        <div className="overflow-hidden rounded-xl border border-line-strong bg-ink">
          {/* Hero preview */}
          <div className="relative px-5 py-6" style={{ background: `linear-gradient(135deg, ${accent}1A, transparent 70%)` }}>
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Landing preview</div>
            <h3 className="mt-2 text-lg font-semibold leading-tight text-white">{block.title}</h3>
            {block.subhead && <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{block.subhead}</p>}
            {block.cta && (
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-[#06080A]" style={{ backgroundColor: accent }}>
                {block.cta} <ArrowRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
          {/* Sections */}
          <div className="grid gap-px bg-surface-2">
            {block.sections.map((s, i) => (
              <div key={i} className="bg-ink px-5 py-3">
                <div className="text-sm font-semibold text-slate-200">{s.heading}</div>
                <div className="mt-1 text-sm leading-relaxed text-slate-400">{s.body}</div>
              </div>
            ))}
          </div>
          {/* Toolbar */}
          <div className="flex items-center gap-2 border-t border-line px-3 py-2.5">
            <button onClick={() => onAction('Edit this landing — rewrite the hero headline 3 ways and tighten the sections.')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-white">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
            <button onClick={() => onAction('Launch this landing — give me the publish + tracking + ad-request plan.')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-[#06080A] transition-opacity hover:opacity-90">
              <Rocket className="h-3.5 w-3.5" /> Launch
            </button>
            <button onClick={() => onCopy(full, `landing-${idx}`)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-500 transition-colors hover:text-slate-200">
              {copied === `landing-${idx}` ? <Check className="h-3.5 w-3.5 text-gold" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === `landing-${idx}` ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )
    }

    case 'media':
      return (
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <ImageIcon className="h-3.5 w-3.5 text-gold" /> Media brief
            {block.aspect && <span className="ml-1 rounded bg-surface-3 px-1.5 py-0.5 text-xs text-slate-400">{block.aspect}</span>}
          </div>
          <div className="text-sm font-medium text-slate-200">{block.label}</div>
          <div className="mt-2 rounded-lg border border-line-strong bg-app px-3 py-2.5 text-sm leading-relaxed text-slate-400">{block.prompt}</div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => onCopy(block.prompt, `media-${idx}`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-white">
              {copied === `media-${idx}` ? <Check className="h-3.5 w-3.5 text-gold" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === `media-${idx}` ? 'Copied prompt' : 'Copy prompt'}
            </button>
            <button onClick={() => onAction(`Refine this media brief: "${block.label}". Give 3 stronger variations of the prompt.`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-white">
              <Sparkles className="h-3.5 w-3.5" /> Refine
            </button>
          </div>
        </div>
      )

    case 'path':
      return (
        <Link href={block.href}
          className="group flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 transition-colors hover:border-gold/30 hover:bg-gold/[0.06]">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold/15 text-gold">
            <ArrowRight className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-200 group-hover:text-white">{block.label}</div>
            {block.description && <div className="text-xs text-slate-500">{block.description}</div>}
          </div>
        </Link>
      )

    default:
      return null
  }
}
