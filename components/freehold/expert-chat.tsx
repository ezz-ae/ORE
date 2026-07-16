'use client'

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles, ArrowUp, Loader2, X, Plus, PanelRightClose, PanelRightOpen,
  Check, Rocket, Pencil, Eye, ThumbsUp, ArrowRight, ImageIcon, Copy, ListChecks,
  BookmarkPlus, History, Trash2, ChevronDown, Mic, Paperclip, Camera, Square,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ExpertBlock, ExpertAction } from '@/lib/freehold/expert-blocks'
import {
  EXPERT_SEND, EXPERT_OPEN, EXPERT_EDITOR_CHANGED,
  getExpertEditor, type ExpertEditorSurface, type ExpertContextRef,
} from '@/lib/freehold/expert-bus'
import { loadAccountMemory, saveAccountMemory, saveAccountMemoryDebounced } from '@/lib/freehold/account-memory'
import { useT } from '@/lib/i18n/provider'

/** Serialize assistant blocks into a self-contained HTML fragment for the Notebook. */
function blocksToHtml(blocks: ExpertBlock[]): { html: string; title: string } {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  let title = 'Expert note'
  const parts: string[] = []
  for (const b of blocks) {
    if (b.type === 'text') {
      if (title === 'Expert note') title = b.content.slice(0, 60)
      parts.push(`<p style="margin:0 0 12px;line-height:1.6">${esc(b.content)}</p>`)
    } else if (b.type === 'plan') {
      title = b.title || 'Plan'
      parts.push(`<h3 style="margin:16px 0 8px">${esc(b.title || 'Plan')}</h3><ol style="padding-left:18px;line-height:1.6">${b.steps.map((s) => `<li><strong>${esc(s.step)}</strong>${s.detail ? `<br><span style="color:#94a3b8">${esc(s.detail)}</span>` : ''}</li>`).join('')}</ol>`)
    } else if (b.type === 'landing') {
      title = b.title || 'Landing'
      parts.push(`<h3 style="margin:16px 0 4px">${esc(b.title)}</h3>${b.subhead ? `<p style="color:#94a3b8;margin:0 0 8px">${esc(b.subhead)}</p>` : ''}${b.sections.map((s) => `<h4 style="margin:10px 0 2px">${esc(s.heading)}</h4><p style="margin:0 0 8px;line-height:1.6">${esc(s.body)}</p>`).join('')}`)
    } else if (b.type === 'media') {
      parts.push(`<h4 style="margin:10px 0 2px">${esc(b.label)}</h4><p style="margin:0 0 8px;color:#94a3b8;line-height:1.6">${esc(b.prompt)}</p>`)
    }
  }
  return { html: `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#e2e8f0">${parts.join('') || '<p>(empty)</p>'}</div>`, title }
}

type Message = { role: 'user'; content: string; ref?: ExpertContextRef } | { role: 'assistant'; blocks: ExpertBlock[]; toolsUsed?: string[] }

type SessionSummary = { id: string; title: string; messageCount: number; updatedAt: string }

type StoredTurn = { role: 'user' | 'assistant'; content?: string; blocks?: ExpertBlock[] }

const toMessages = (turns: StoredTurn[]): Message[] =>
  turns.map((m) =>
    m.role === 'user'
      ? ({ role: 'user', content: m.content ?? '' } as Message)
      : ({ role: 'assistant', blocks: Array.isArray(m.blocks) ? m.blocks : [] } as Message),
  )

const STARTER_KEYS = [
  'expert.starter1',
  'expert.starter2',
  'expert.starter3',
  'expert.starter4',
]

// Page-aware starters: the chat is an operator, so its opening actions match
// the surface the user is standing on — ads pages offer ad actions, the
// notebook offers deliverables, the CRM offers pipeline moves. Falls back to
// the general starters elsewhere. Tools stay role-gated server-side.
const PAGE_STARTERS: { match: (p: string) => boolean; keys: string[] }[] = [
  {
    match: (p) => p.includes('/lead-machine/audiences'),
    keys: ['expert.st.aud1', 'expert.st.aud2', 'expert.st.aud3'],
  },
  {
    match: (p) => p.includes('/lead-machine/campaigns') || p.includes('/ads-live'),
    keys: ['expert.st.camp1', 'expert.st.camp2', 'expert.st.camp3'],
  },
  {
    match: (p) => p.includes('/lead-machine/landings'),
    keys: ['expert.st.land1', 'expert.st.land2', 'expert.st.land3'],
  },
  {
    match: (p) => p.includes('/lead-machine/forms'),
    keys: ['expert.st.form1', 'expert.st.form2', 'expert.st.camp1'],
  },
  {
    match: (p) => p.includes('/crm'),
    keys: ['expert.st.crm1', 'expert.st.crm2', 'expert.st.crm3'],
  },
]

function startersForPath(pathname: string | null): string[] {
  const p = pathname ?? ''
  return PAGE_STARTERS.find((e) => e.match(p))?.keys ?? STARTER_KEYS
}

const PAGE_LABELS: { match: (p: string) => boolean; labelKey: string }[] = [
  { match: (p) => p === '/freehold-intelligence', labelKey: 'nav.home' },
  { match: (p) => p.startsWith('/freehold-intelligence/lead-machine'), labelKey: 'expert.pageLeadMachine' },
  { match: (p) => p.startsWith('/freehold-intelligence/crm'), labelKey: 'nav.crm' },
  { match: (p) => p.startsWith('/freehold-intelligence/inventory'), labelKey: 'nav.inventory' },
  { match: (p) => p.startsWith('/freehold-intelligence/ads'), labelKey: 'nav.ads' },
  { match: (p) => p.startsWith('/freehold-intelligence/ai-manager'), labelKey: 'nav.ai-manager' },
  { match: (p) => p.startsWith('/freehold-intelligence/integrations'), labelKey: 'nav.integrations' },
  { match: (p) => p.startsWith('/freehold-intelligence/analytics'), labelKey: 'nav.analytics' },
]
const pageLabelKey = (p: string) => PAGE_LABELS.find((x) => x.match(p))?.labelKey ?? 'expert.pageWorkspace'

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
  const t = useT()
  const pathname = usePathname()
  const [open, setOpen] = useState(true)
  const [width, setWidth] = useState(DEFAULT_W)
  const [value, setValue] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [savedIdx, setSavedIdx] = useState<number | null>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // A paste that contains a newline arrives as a burst of keydown events in
  // some environments (remote-desktop clients, clipboard-manager/autotype
  // tools) rather than one atomic paste event — without this guard, the Enter
  // handler below reads that embedded newline as "send now" mid-paste and
  // cuts the message off. Sits true for one tick after a real paste event.
  const pastingRef = useRef(false)
  // Empty = "no conversation yet": the server mints an id on the first turn
  // and we adopt it, so every conversation is durable from message one.
  const sessionId = useRef('')
  const dragging = useRef(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const historyRef = useRef<HTMLDivElement>(null)

  // Restore persisted width + open state — this device first (instant), then
  // the ACCOUNT, so the panel looks the way the user left it on any device.
  // On PHONES the panel is a full-screen overlay, so it never opens by
  // itself — only via the Expert button (a desktop "open" preference must
  // not swallow a phone's first screen).
  const layoutHydrated = useRef(false)
  useLayoutEffect(() => {
    const isPhone = window.matchMedia('(max-width: 767px)').matches
    const w = Number(localStorage.getItem('fi-expert-width'))
    if (w >= MIN_W && w <= MAX_W) setWidth(w)
    const o = localStorage.getItem('fi-expert-open')
    if (o === '0' || isPhone) setOpen(false)
    loadAccountMemory().then((m) => {
      if (typeof m.expertWidth === 'number' && m.expertWidth >= MIN_W && m.expertWidth <= MAX_W) setWidth(m.expertWidth)
      if (typeof m.expertOpen === 'boolean' && !isPhone) setOpen(m.expertOpen)
      layoutHydrated.current = true
    })
  }, [])

  useEffect(() => {
    localStorage.setItem('fi-expert-open', open ? '1' : '0')
    // Phones never persist "open" — the account preference is a desktop layout.
    if (layoutHydrated.current && window.matchMedia('(min-width: 768px)').matches) {
      saveAccountMemoryDebounced('expertOpen', open, 800)
    }
  }, [open])

  // Session memory: resume the account's current conversation on any device —
  // a chat started on the laptop continues on the phone, reloads included.
  useEffect(() => {
    let cancelled = false
    loadAccountMemory().then(async (m) => {
      const sid = typeof m.expertSession === 'string' ? m.expertSession : ''
      if (!sid || cancelled) return
      sessionId.current = sid
      try {
        const r = await fetch(`/api/freehold/expert/sessions/${encodeURIComponent(sid)}`)
        if (!r.ok || cancelled) return
        const d = await r.json()
        const restored = toMessages(d.session?.messages ?? [])
        if (restored.length && !cancelled) setMessages((cur) => (cur.length ? cur : restored))
      } catch { /* start fresh */ }
    })
    return () => { cancelled = true }
  }, [])

  // Load the recent-conversations list when the history menu opens.
  useEffect(() => {
    if (!historyOpen) return
    fetch('/api/freehold/expert/sessions')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (Array.isArray(d?.sessions)) setSessions(d.sessions) })
      .catch(() => {})
  }, [historyOpen])

  // Close the history menu on outside click.
  useEffect(() => {
    if (!historyOpen) return
    function onClick(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) setHistoryOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [historyOpen])

  async function openSession(id: string) {
    setHistoryOpen(false)
    try {
      const r = await fetch(`/api/freehold/expert/sessions/${encodeURIComponent(id)}`)
      if (!r.ok) return
      const d = await r.json()
      sessionId.current = id
      setMessages(toMessages(d.session?.messages ?? []))
      saveAccountMemory({ expertSession: id })
    } catch { /* keep current conversation */ }
  }

  async function removeSession(id: string) {
    try { await fetch(`/api/freehold/expert/sessions?id=${encodeURIComponent(id)}`, { method: 'DELETE' }) } catch {}
    setSessions((s) => s.filter((x) => x.id !== id))
    if (sessionId.current === id) {
      sessionId.current = ''
      setMessages([])
      saveAccountMemory({ expertSession: null })
    }
  }

  // useLayoutEffect (not useEffect) so a large paste resizes before the
  // browser paints — otherwise the box visibly jumps height for one frame.
  useLayoutEffect(() => {
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
    setWidth((w) => {
      localStorage.setItem('fi-expert-width', String(w))
      saveAccountMemoryDebounced('expertWidth', w, 500)
      return w
    })
  }, [])

  // ── Composer superpowers: mode / voice note / file / screenshot ────────────
  const [mode, setMode] = useState<'auto' | 'code' | 'marketing' | 'sales'>('auto')
  useEffect(() => {
    const saved = localStorage.getItem('fi-expert-mode')
    if (saved === 'code' || saved === 'marketing' || saved === 'sales') setMode(saved)
  }, [])
  function cycleMode() {
    const order = ['auto', 'code', 'marketing', 'sales'] as const
    setMode((m) => {
      const next = order[(order.indexOf(m) + 1) % order.length]
      localStorage.setItem('fi-expert-mode', next)
      return next
    })
  }

  // Attachment (any extension): text-like files carry their content; images
  // and PDFs are READ by real vision/extraction (same Gemini path the
  // screenshot button uses) so the model can act on them; other binaries
  // travel as a named pointer. One slot, clearable.
  const [attachment, setAttachment] = useState<{ name: string; content?: string } | null>(null)
  const [attaching, setAttaching] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  async function onPickFile(file: File | null) {
    if (!file) return
    const TEXT_RE = /\.(txt|md|markdown|csv|json|html?|xml|log|yml|yaml|tsv|ts|tsx|js|jsx|css)$/i
    // Text: carry the content straight to the model.
    if ((file.type.startsWith('text/') || TEXT_RE.test(file.name)) && file.size < 400_000) {
      try { setAttachment({ name: file.name, content: (await file.text()).slice(0, 8000) }); return } catch { /* fall through to pointer */ }
    }
    // Image / PDF: run REAL Gemini vision (image) or fact-extraction (pdf) so
    // "make an ad from this" or "use these figures" actually works.
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    if ((isImage || isPdf) && file.size < 8_000_000) {
      setAttaching(true)
      try {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(file)
        })
        const res = await fetch('/api/freehold/expert/ingest', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: isPdf ? 'pdf' : 'image', data: dataUrl }),
        })
        const d = await res.json().catch(() => ({}))
        if (d.unavailable) { toast.error(t('expert.ingestUnavailable')); setAttachment({ name: file.name }); return }
        if (!res.ok || !d.text) { toast.error(d.error || t('expert.ingestFailed')); setAttachment({ name: file.name }); return }
        setAttachment({ name: file.name, content: d.text })
      } catch { toast.error(t('expert.ingestFailed')); setAttachment({ name: file.name }) }
      finally { setAttaching(false) }
      return
    }
    // Other binaries: honest name-only pointer.
    setAttachment({ name: file.name })
  }

  // Voice note → REAL server-side transcription (Gemini audio).
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  async function toggleRecord() {
    if (recording) { recRef.current?.stop(); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      recRef.current = rec
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop())
        setRecording(false)
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        if (!blob.size) return
        setTranscribing(true)
        try {
          const dataUrl: string = await new Promise((resolve, reject) => {
            const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(blob)
          })
          const res = await fetch('/api/freehold/expert/ingest', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'audio', data: dataUrl }),
          })
          const d = await res.json().catch(() => ({}))
          if (d.unavailable) { toast.error(t('expert.ingestUnavailable')); return }
          if (!res.ok || !d.text) { toast.error(d.error || t('expert.ingestFailed')); return }
          setValue((v) => (v ? `${v} ${d.text}` : d.text))
          taRef.current?.focus()
        } catch { toast.error(t('expert.ingestFailed')) } finally { setTranscribing(false) }
      }
      rec.start()
      setRecording(true)
    } catch { toast.error(t('expert.micDenied')) }
  }

  // Screenshot → capture a frame, let the user MARK an area (red box) + add a
  // note, then a REAL vision pass describes it for the coordinator.
  const [shot, setShot] = useState<string | null>(null)
  const [shotNote, setShotNote] = useState('')
  const [shotBusy, setShotBusy] = useState(false)
  const shotCanvasRef = useRef<HTMLCanvasElement>(null)
  const shotImgRef = useRef<HTMLImageElement | null>(null)
  const shotRect = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const shotDragging = useRef(false)

  const drawShot = useCallback(() => {
    const canvas = shotCanvasRef.current, img = shotImgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const r = shotRect.current
    if (r) {
      ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3
      ctx.strokeRect(Math.min(r.x0, r.x1), Math.min(r.y0, r.y1), Math.abs(r.x1 - r.x0), Math.abs(r.y1 - r.y0))
    }
  }, [])
  useEffect(() => {
    if (!shot) return
    const img = new Image()
    img.onload = () => {
      shotImgRef.current = img
      const canvas = shotCanvasRef.current
      if (canvas) { canvas.width = img.width; canvas.height = img.height }
      drawShot()
    }
    img.src = shot
  }, [shot, drawShot])

  async function captureScreenshot() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      const track = stream.getVideoTracks()[0]
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()
      await new Promise((r) => setTimeout(r, 250)) // let the first frame settle
      const scale = Math.min(1, 1280 / (video.videoWidth || 1280))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round((video.videoWidth || 1280) * scale)
      canvas.height = Math.round((video.videoHeight || 720) * scale)
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
      track.stop(); stream.getTracks().forEach((tr) => tr.stop())
      shotRect.current = null
      setShotNote('')
      setShot(canvas.toDataURL('image/jpeg', 0.85))
    } catch { /* user cancelled the share picker — nothing to do */ }
  }

  function shotPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = shotCanvasRef.current as HTMLCanvasElement
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  async function attachScreenshot() {
    const canvas = shotCanvasRef.current
    if (!canvas) return
    setShotBusy(true)
    try {
      const res = await fetch('/api/freehold/expert/ingest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'image', data: canvas.toDataURL('image/jpeg', 0.85), note: shotNote.trim() || undefined }),
      })
      const d = await res.json().catch(() => ({}))
      if (d.unavailable) { toast.error(t('expert.ingestUnavailable')); return }
      if (!res.ok || !d.text) { toast.error(d.error || t('expert.ingestFailed')); return }
      setAttachment({ name: t('expert.screenshotName'), content: d.text })
      setShot(null)
    } catch { toast.error(t('expert.ingestFailed')) } finally { setShotBusy(false) }
  }

  // ── ONE chat: when a Drive editor is open it registers here, and typing in
  //    this chat EDITS the open artifact (reversible in the editor strip).
  const [editor, setEditor] = useState<ExpertEditorSurface | null>(null)
  const [editMode, setEditMode] = useState(true)
  const [editUndoTick, setEditUndoTick] = useState(0) // re-render after undo
  useEffect(() => {
    const sync = () => { setEditor(getExpertEditor()); setEditMode(true) }
    sync()
    window.addEventListener(EXPERT_EDITOR_CHANGED, sync)
    return () => window.removeEventListener(EXPERT_EDITOR_CHANGED, sync)
  }, [])

  const send = useCallback(async (text?: string, ref?: ExpertContextRef) => {
    const message = (text ?? value).trim()
    if (!message || pending) return

    // Editor lane: apply the instruction to the OPEN artifact via its
    // registered state machine (same real endpoint, undo preserved there).
    // These turns are local to the editing session — not persisted server-side.
    if (editor && editMode) {
      setMessages((m) => [...m, { role: 'user', content: message }])
      setValue('')
      setPending(true)
      try {
        const r = await editor.apply(message)
        setMessages((m) => [...m, { role: 'assistant', blocks: [{ type: 'text', content: r.summary || t('expert.editNoResult') }] }])
      } catch {
        setMessages((m) => [...m, { role: 'assistant', blocks: [{ type: 'text', content: t('expert.fallbackErr') }] }])
      } finally {
        setPending(false)
        setEditUndoTick((n) => n + 1)
      }
      return
    }

    setMessages((m) => [...m, { role: 'user', content: message, ref }])
    setValue('')
    setPending(true)
    // The attachment travels with THIS message, then the slot clears.
    const att = attachment
    setAttachment(null)
    try {
      const res = await fetch('/api/freehold/expert/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message, sessionId: sessionId.current, page: pathname,
          context: {
            ...(mode !== 'auto' ? { chatMode: mode } : {}),
            ...(att ? { attachment: att } : {}),
            ...(ref ? { ref } : {}),
          },
        }),
      })
      const data = await res.json()
      const blocks: ExpertBlock[] = data?.data?.blocks ?? [{ type: 'text', content: t('expert.fallbackOk') }]
      const toolsUsed: string[] = Array.isArray(data?.data?.toolsUsed) ? data.data.toolsUsed : []
      setMessages((m) => [...m, { role: 'assistant', blocks, toolsUsed }])
      // Adopt the durable session id the server persisted this turn under —
      // and remember it on the ACCOUNT so the conversation follows the user.
      const sid = data?.data?.sessionId
      if (typeof sid === 'string' && sid) {
        sessionId.current = sid
        saveAccountMemoryDebounced('expertSession', sid, 800)
      }
    } catch {
      setMessages((m) => [...m, { role: 'assistant', blocks: [{ type: 'text', content: t('expert.fallbackErr') }] }])
    } finally {
      setPending(false)
    }
  }, [value, pending, pathname, t, mode, attachment, editor, editMode])

  // Listen for messages pushed from any on-page AI box → unified conversation.
  useEffect(() => {
    function onSend(e: Event) {
      const detail = (e as CustomEvent).detail as { message?: string; ref?: ExpertContextRef } | undefined
      setOpen(true)
      if (detail?.message) send(detail.message, detail.ref)
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
    // New conversation: the server mints the next id on the first message.
    sessionId.current = ''
    saveAccountMemory({ expertSession: null })
  }

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800)
  }

  async function saveToNotebook(blocks: ExpertBlock[], idx: number) {
    try {
      const { html, title } = blocksToHtml(blocks)
      const res = await fetch('/api/freehold/notebook/save-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type: 'note', content: html }),
      })
      if (!res.ok) throw new Error('save failed')
      setSavedIdx(idx)
      toast.success(t('expert.saveOk'))
      setTimeout(() => setSavedIdx((s) => (s === idx ? null : s)), 2500)
    } catch {
      toast.error(t('expert.saveErr'))
    }
  }

  // The Notebook and Creative Studio are their own focused workspaces — don't
  // dock a second chat there (the Studio is a full-bleed canvas showcase).
  if (
    pathname?.startsWith('/freehold-intelligence/notebook') ||
    pathname?.startsWith('/freehold-intelligence/creative-studio')
  ) return null

  // ─── Collapsed rail ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label={t('expert.openAria')}
        data-coach="expert-chat"
        className="hidden h-full w-11 shrink-0 flex-col items-center gap-3 border-s border-line bg-app py-4 transition hover:bg-surface-2 md:flex"
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
        aria-label={t('expert.closeAria')}
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-[190] bg-black/50 md:hidden"
      />

      <aside
        style={{ width }}
        data-coach="expert-chat"
        className="fixed inset-y-0 end-0 z-[200] flex h-full w-full flex-col border-s border-line bg-app md:static md:z-auto md:w-auto"
      >
        {/* Drag handle (desktop) */}
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDrag}
          onPointerUp={onDragEnd}
          className="absolute start-0 top-0 z-10 hidden h-full w-1.5 -translate-x-1/2 cursor-col-resize md:block"
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
              <div className="text-sm font-semibold text-slate-100">{t('expert.title')}</div>
              <div className="text-xs text-slate-500">{t('expert.subtitle', { page: t(pageLabelKey(pathname)) })}</div>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {/* Chat history — every conversation is remembered by the account */}
            <div ref={historyRef} className="relative">
              <button onClick={() => setHistoryOpen((o) => !o)} title={t('expert.history')} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-surface-2 hover:text-slate-200">
                <History className="h-4 w-4" />
              </button>
              {historyOpen && (
                <div className="absolute end-0 top-9 z-30 max-h-80 w-72 overflow-y-auto rounded-xl border border-line bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.7)]">
                  <div className="border-b border-line px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('expert.history')}</div>
                  {sessions.length === 0 ? (
                    <div className="px-3.5 py-4 text-sm text-slate-500">{t('expert.noHistory')}</div>
                  ) : sessions.map((s) => (
                    <div key={s.id} className={`group flex items-center gap-2 border-b border-white/[0.04] px-2 py-1 ${s.id === sessionId.current ? 'bg-gold/[0.06]' : ''}`}>
                      <button onClick={() => openSession(s.id)} className="min-w-0 flex-1 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-white/[0.04]">
                        <div className="truncate text-sm text-slate-200">{s.title}</div>
                        <div className="text-[11px] text-slate-500">{Math.ceil(s.messageCount / 2)} ✦</div>
                      </button>
                      <button onClick={() => removeSession(s.id)} title={t('common.delete')} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-600 opacity-0 transition group-hover:opacity-100 hover:bg-red-400/10 hover:text-red-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {messages.length > 0 && (
              <button onClick={reset} title={t('expert.newChat')} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-surface-2 hover:text-slate-200">
                <Plus className="h-4 w-4" />
              </button>
            )}
            <button onClick={() => setOpen(false)} title={t('expert.collapse')} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-surface-2 hover:text-slate-200">
              <PanelRightClose className="hidden h-4 w-4 md:block" />
              <X className="h-4 w-4 md:hidden" />
            </button>
          </div>
        </div>

        {/* Conversation */}
        {/* min-w-0 overrides the flex default (min-width:auto) — without it
            an oversized descendant (a long unbroken string) stretches this
            panel wider than its set width instead of wrapping/scrolling. */}
        <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-3.5 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col">
              <div className="mb-4 rounded-xl border border-gold/15 bg-gold/[0.05] p-4">
                <p className="text-sm leading-relaxed text-slate-300">
                  {t('expert.intro')}
                </p>
              </div>
              <div className="grid gap-2">
                {startersForPath(pathname).map((k) => (
                  <button key={k} onClick={() => send(t(k))}
                    className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-left text-sm text-slate-300 transition-colors hover:border-gold/30 hover:bg-gold/[0.06] hover:text-white">
                    {t(k)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              {messages.map((m, i) =>
                m.role === 'user' ? (
                  <div key={i} className="ms-auto grid max-w-[90%] justify-items-end gap-1">
                    {m.ref && (
                      <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-gold/25 bg-gold/[0.08] px-2.5 py-1 text-[11px] font-medium text-gold">
                        {t(`expert.ref.${m.ref.kind}`)}: {m.ref.label}
                      </span>
                    )}
                    <div className="max-w-full break-words rounded-xl rounded-ee-md border border-line-strong bg-surface-2 px-4 py-2.5 text-sm leading-relaxed text-slate-100">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="grid gap-2.5">
                    {/* Real tool activity — the agent's actual work this turn,
                        visible instead of buried in the response envelope. */}
                    {m.toolsUsed && m.toolsUsed.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('expert.toolsRan')}</span>
                        {m.toolsUsed.map((name, k) => (
                          <span key={`${name}-${k}`} className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[10px] font-medium text-gold">
                            {name.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.blocks.map((b, j) => {
                      const view = <BlockView key={j} block={b} idx={`${i}-${j}`} onAction={send} onCopy={copy} copied={copied} />
                      // Canvas accordion: big outputs (plans, landing drafts)
                      // from EARLIER turns fold away so the conversation stays
                      // light — the newest canvas is always open.
                      const isBig = b.type === 'plan' || b.type === 'landing'
                      const isLatest = i >= messages.length - 2
                      if (!isBig || isLatest) return view
                      const label = (b.type === 'plan' ? b.title : b.type === 'landing' ? b.title : '') || t('expert.canvas')
                      return <CanvasAccordion key={j} label={label}>{view}</CanvasAccordion>
                    })}
                    <button
                      onClick={() => saveToNotebook(m.blocks, i)}
                      className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-surface-2 hover:text-slate-200"
                    >
                      {savedIdx === i ? <Check className="h-3.5 w-3.5 text-gold" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                      {savedIdx === i ? t('expert.saved') : t('expert.save')}
                    </button>
                  </div>
                ),
              )}
              {pending && (
                <div className="mr-auto flex items-center gap-2 rounded-xl rounded-bl-md border border-gold/20 bg-gold/[0.06] px-4 py-3 text-sm text-slate-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" />
                  {t('expert.pending')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Screenshot marker — capture arrived; let the user box an area + note. */}
        {shot && (
          <div className="shrink-0 border-t border-line bg-surface p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">{t('expert.shotMarkTitle')}</span>
              <button onClick={() => setShot(null)} className="text-slate-500 hover:text-slate-300"><X className="h-4 w-4" /></button>
            </div>
            <canvas
              ref={shotCanvasRef}
              className="w-full cursor-crosshair touch-none rounded-lg border border-line"
              onPointerDown={(e) => { const p = shotPoint(e); shotRect.current = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; shotDragging.current = true; drawShot() }}
              onPointerMove={(e) => { if (!shotDragging.current || !shotRect.current) return; const p = shotPoint(e); shotRect.current = { ...shotRect.current, x1: p.x, y1: p.y }; drawShot() }}
              onPointerUp={() => { shotDragging.current = false }}
            />
            <input
              value={shotNote} onChange={(e) => setShotNote(e.target.value)}
              placeholder={t('expert.shotNotePh')}
              className="mt-2 w-full rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-gold/40"
            />
            <div className="mt-2 flex items-center gap-2">
              <button onClick={attachScreenshot} disabled={shotBusy}
                className="flex items-center gap-1.5 rounded-full bg-gold px-3.5 py-1.5 text-xs font-semibold text-[#06080A] transition hover:bg-[#E8C657] disabled:opacity-50">
                {shotBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} {t('expert.shotAttach')}
              </button>
              <button onClick={() => setShot(null)} className="rounded-full border border-line px-3.5 py-1.5 text-xs text-slate-400 transition hover:text-slate-200">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Composer */}
        <div className="shrink-0 border-t border-line p-3">
          <div
            className="cursor-text rounded-xl border border-white/[0.14] bg-surface-2 p-2 transition-all focus-within:border-gold/60 focus-within:bg-white/[0.07] focus-within:ring-1 focus-within:ring-gold/15"
            onClick={() => taRef.current?.focus()}
          >
            <div className="flex items-end gap-2 px-2 py-1">
              <textarea
                ref={taRef} value={value} onChange={(e) => setValue(e.target.value)}
                onPaste={() => {
                  pastingRef.current = true
                  // Cleared after the paste's own keydown/input events have
                  // already fired, so only THIS paste's Enter (if any) is skipped.
                  setTimeout(() => { pastingRef.current = false }, 0)
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing || pastingRef.current) return
                  e.preventDefault(); send()
                }}
                rows={1} placeholder={t('expert.composerPlaceholder')}
                className="flex-1 cursor-text resize-none bg-transparent py-1 text-sm leading-6 text-white outline-none placeholder:text-slate-500"
              />
              <button onClick={() => send()} disabled={!value.trim() || pending} aria-label={t('expert.sendAria')}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-[#06080A] transition hover:bg-[#E8C657] disabled:opacity-30">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
            {/* Editing lane: quick-edit presets for the OPEN artifact */}
            {editor && editMode && editor.presets().length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-2 pb-1" onClick={(e) => e.stopPropagation()}>
                {editor.presets().slice(0, 6).map((p) => (
                  <button key={p.label} type="button" onClick={() => { setValue(p.instruction); taRef.current?.focus() }}
                    className="rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] text-slate-300 transition hover:border-gold/30 hover:text-gold">
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            {/* Superpowers: editing chip · mode chip · voice note · file · screenshot */}
            <div className="flex flex-wrap items-center gap-1.5 px-2 pb-1 pt-0.5" onClick={(e) => e.stopPropagation()}>
              {editor && (
                <button type="button" onClick={() => setEditMode((v) => !v)} title={t('expert.editToggleTitle')}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${editMode ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line text-slate-500 hover:text-slate-300'}`}>
                  <Pencil className="h-3 w-3" /> {t('expert.editingChip', { title: editor.title })}
                </button>
              )}
              {editor && editMode && editUndoTick >= 0 && editor.canUndo() && (
                <button type="button" onClick={() => { editor.undo(); setEditUndoTick((n) => n + 1) }}
                  className="rounded-full border border-line px-2.5 py-1 text-[10px] text-slate-400 transition hover:text-slate-200">
                  {t('expert.editUndo')}
                </button>
              )}
              <button type="button" onClick={cycleMode} title={t('expert.modeTitle')}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${mode === 'auto' ? 'border-line text-slate-500 hover:text-slate-300' : 'border-gold/40 bg-gold/10 text-gold'}`}>
                {t(`expert.mode.${mode}`)}
              </button>
              <button type="button" onClick={toggleRecord} disabled={transcribing} title={t('expert.voiceTitle')}
                className={`grid h-7 w-7 place-items-center rounded-full transition ${recording ? 'animate-pulse bg-red-500/20 text-red-400' : 'text-slate-500 hover:bg-surface-3 hover:text-slate-200'}`}>
                {transcribing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : recording ? <Square className="h-3 w-3" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={attaching} title={t('expert.attachTitle')}
                className="grid h-7 w-7 place-items-center rounded-full text-slate-500 transition hover:bg-surface-3 hover:text-slate-200 disabled:opacity-50">
                {attaching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
              </button>
              <button type="button" onClick={captureScreenshot} title={t('expert.shotTitle')}
                className="grid h-7 w-7 place-items-center rounded-full text-slate-500 transition hover:bg-surface-3 hover:text-slate-200">
                <Camera className="h-3.5 w-3.5" />
              </button>
              <input ref={fileRef} type="file" className="hidden"
                onChange={(e) => { onPickFile(e.target.files?.[0] ?? null); e.target.value = '' }} />
              {attachment && (
                <span className="flex min-w-0 items-center gap-1 rounded-full border border-gold/30 bg-gold/[0.08] px-2 py-0.5 text-[10px] text-gold">
                  <Paperclip className="h-3 w-3 shrink-0" />
                  <span className="max-w-[120px] truncate">{attachment.name}</span>
                  <button type="button" onClick={() => setAttachment(null)} className="ms-0.5 text-gold/70 hover:text-gold">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

// ─── Canvas accordion — folds earlier big outputs, one tap to reopen ─────────

function CanvasAccordion({ label, children }: { label: string; children: React.ReactNode }) {
  const [openC, setOpenC] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2">
      <button
        onClick={() => setOpenC((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition hover:bg-white/[0.03]"
      >
        <ListChecks className="h-3.5 w-3.5 shrink-0 text-gold" />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${openC ? 'rotate-180' : ''}`} />
      </button>
      {openC && <div className="border-t border-line p-2">{children}</div>}
    </div>
  )
}

// ─── Block renderer ───────────────────────────────────────────────────────────

// The Expert is instructed to write plain business language, but models still
// slip in markdown tokens. Render bold + bullets properly and swallow the rest
// so the reader never sees ** / # / backticks.
function PlainText({ content }: { content: string }) {
  const lines = content.replace(/`+/g, '').split('\n')
  return (
    <div className="space-y-1">
      {lines.map((raw, i) => {
        const line = raw.replace(/^#{1,4}\s+/, '')
        if (!line.trim()) return <div key={i} className="h-1.5" />
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
        const body = bullet ? bullet[1] : line
        const segs = body.split(/\*\*([^*]+)\*\*/g)
        const nodes = segs.map((s, j) => (j % 2 === 1 ? <strong key={j} className="font-semibold text-white">{s}</strong> : s))
        return bullet ? (
          <div key={i} className="flex gap-2"><span className="shrink-0 text-gold">•</span><span className="min-w-0 flex-1">{nodes}</span></div>
        ) : (
          <div key={i}>{nodes}</div>
        )
      })}
    </div>
  )
}

function BlockView({
  block, idx, onAction, onCopy, copied,
}: {
  block: ExpertBlock
  idx: string
  onAction: (text: string) => void
  onCopy: (text: string, key: string) => void
  copied: string | null
}) {
  const t = useT()
  switch (block.type) {
    case 'text':
      return (
        <div className="min-w-0 max-w-full rounded-xl rounded-bl-md border border-gold/15 bg-gold/[0.05] px-4 py-3 text-sm leading-relaxed text-slate-200">
          <div className="whitespace-pre-wrap break-words">{block.content}</div>
        </div>
      )

    case 'plan':
      return (
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold">
            <ListChecks className="h-3.5 w-3.5" /> {block.title ?? t('expert.plan')}
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
              <button key={c} onClick={() => onAction(t('expert.useColorPrompt', { color: c }))}
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
            <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>{t('expert.landingPreview')}</div>
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
            <button onClick={() => onAction(t('expert.editLandingPrompt'))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-white">
              <Pencil className="h-3.5 w-3.5" /> {t('expert.edit')}
            </button>
            <button onClick={() => onAction(t('expert.launchLandingPrompt'))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-[#06080A] transition-opacity hover:opacity-90">
              <Rocket className="h-3.5 w-3.5" /> {t('expert.launch')}
            </button>
            <button onClick={() => onCopy(full, `landing-${idx}`)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-slate-500 transition-colors hover:text-slate-200">
              {copied === `landing-${idx}` ? <Check className="h-3.5 w-3.5 text-gold" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === `landing-${idx}` ? t('expert.copied') : t('expert.copy')}
            </button>
          </div>
        </div>
      )
    }

    case 'media':
      return (
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <ImageIcon className="h-3.5 w-3.5 text-gold" /> {t('expert.mediaBrief')}
            {block.aspect && <span className="ml-1 rounded bg-surface-3 px-1.5 py-0.5 text-xs text-slate-400">{block.aspect}</span>}
          </div>
          <div className="text-sm font-medium text-slate-200">{block.label}</div>
          <div className="mt-2 rounded-lg border border-line-strong bg-app px-3 py-2.5 text-sm leading-relaxed text-slate-400">{block.prompt}</div>
          <div className="mt-3 flex gap-2">
            <button onClick={() => onCopy(block.prompt, `media-${idx}`)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-white">
              {copied === `media-${idx}` ? <Check className="h-3.5 w-3.5 text-gold" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === `media-${idx}` ? t('expert.copiedPrompt') : t('expert.copyPrompt')}
            </button>
            <button onClick={() => onAction(t('expert.refineMediaPrompt', { label: block.label }))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:text-white">
              <Sparkles className="h-3.5 w-3.5" /> {t('expert.refine')}
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
