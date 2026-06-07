'use client'

import { useState, useRef } from 'react'
import { toast } from 'sonner'
import {
  BookOpen, Plus, Send, Sparkles, Link2, Upload, FileText,
  Share2, MessageSquare, ChevronRight, X, Check,
} from 'lucide-react'
import { agentConnections } from '@/src/features/freehold-intelligence/agent'

type Source = {
  id: string
  label: string
  type: 'area' | 'developer' | 'project' | 'brochure' | 'url' | 'text'
  icon: string
  note?: string
}

type Note = {
  id: string
  title: string
  sources: string[]   // source ids
  chat: { role: 'user' | 'ai'; text: string; ts: string }[]
  createdAt: string
}

const INITIAL_SOURCES: Source[] = [
  { id: 's1',  label: 'Palm Jumeirah',            type: 'area',      icon: '🌴' },
  { id: 's2',  label: 'Dubai Hills Estate',        type: 'area',      icon: '⛳️' },
  { id: 's3',  label: 'Emaar Properties',          type: 'developer', icon: '🏗' },
  { id: 's4',  label: 'Nakheel',                   type: 'developer', icon: '🏝' },
  { id: 's5',  label: 'Palm Signature Villas',     type: 'project',   icon: '🏡', note: 'Phase 2 launching Q3' },
  { id: 's6',  label: 'Dubai Hills Grove',         type: 'project',   icon: '🌿' },
  { id: 's7',  label: 'Palm Investors Brochure',   type: 'brochure',  icon: '📄', note: 'Uploaded 28 May' },
  { id: 's8',  label: 'emaar.com/palm-signature',  type: 'url',       icon: '🔗' },
]

const INITIAL_NOTES: Note[] = [
  {
    id: 'n1',
    title: 'Palm Signature — Investor Pack',
    sources: ['s1', 's3', 's5', 's7'],
    createdAt: '2026-05-25',
    chat: [
      { role: 'user', text: 'Summarise the key investment points for Palm Signature Villas.', ts: '10:00' },
      { role: 'ai',   text: 'Palm Signature Villas offers G+2 villas on the fronds with private beach access. Starting at AED 4.2M. Rental yield projection 6–7.5% based on comparable Palm units. Emaar is offering a 60/40 payment plan. Strong Golden Visa eligibility at AED 2M+ purchase threshold.', ts: '10:00' },
      { role: 'user', text: 'What objections might an investor raise?', ts: '10:05' },
      { role: 'ai',   text: 'Common objections: 1) Service charges on Palm are AED 18–22/sqft, higher than mainland. 2) Liquidity — Palm villas take longer to resell than apartments. 3) Currency exposure for non-AED buyers. Counter: rental demand is structurally strong post-Expo, Palm commands 15–20% premium on resale vs. off-Palm.', ts: '10:05' },
    ],
  },
  {
    id: 'n2',
    title: 'Dubai Hills — Family Pitch',
    sources: ['s2', 's3', 's6'],
    createdAt: '2026-06-01',
    chat: [
      { role: 'user', text: 'Draft a WhatsApp message for a family considering Dubai Hills Grove.', ts: '09:30' },
      { role: 'ai',   text: "Hi [Name] 👋 Just wanted to follow up on Dubai Hills Grove — 3 & 4BR townhouses from AED 2.1M, backing onto the park. School catchment includes GEMS and Repton. Happy to arrange a site visit Saturday morning if that works? 🏡", ts: '09:30' },
    ],
  },
  {
    id: 'n3',
    title: 'Golden Visa — Buyer Guide',
    sources: ['s8'],
    createdAt: '2026-06-03',
    chat: [],
  },
]

const STUDIO_TEMPLATES = [
  { id: 'wa',      label: 'WhatsApp message',  icon: '💬' },
  { id: 'email',   label: 'Email pitch',       icon: '📧' },
  { id: 'caption', label: 'Instagram caption', icon: '📸' },
  { id: 'pdf',     label: 'Property summary',  icon: '📄' },
  { id: 'post',    label: 'LinkedIn post',     icon: '💼' },
  { id: 'script',  label: 'Call script',       icon: '📞' },
]

const SHARE_CONNECTIONS = agentConnections.filter((c) =>
  ['messaging', 'social', 'portal'].includes(c.category) && c.status === 'connected',
)

export default function AgentNotebookPage() {
  const brochureRef = useRef<HTMLInputElement>(null)
  const [notes, setNotes]           = useState<Note[]>(INITIAL_NOTES)
  const [sources, setSources]       = useState<Source[]>(INITIAL_SOURCES)
  const [activeNote, setActiveNote] = useState<Note>(INITIAL_NOTES[0])
  const [chatInput, setChatInput]   = useState('')
  const [tab, setTab]               = useState<'chat' | 'studio'>('chat')
  const [studioTpl, setStudioTpl]   = useState<string | null>(null)
  const [studioOut, setStudioOut]   = useState('')
  const [generating, setGenerating] = useState(false)
  const [chatPending, setChatPending] = useState(false)
  const [shared, setShared]         = useState<string[]>([])

  // Adding a new note
  const [showNewNote, setShowNewNote]   = useState(false)
  const [newNoteTitle, setNewNoteTitle] = useState('')

  // Adding a source
  const [showAddSrc, setShowAddSrc]   = useState(false)
  const [srcInput, setSrcInput]       = useState('')
  const [srcType, setSrcType]         = useState<Source['type']>('url')

  const currentNote = notes.find((n) => n.id === activeNote.id) ?? notes[0]

  async function sendChat() {
    const text = chatInput.trim()
    if (!text || chatPending) return
    const ts = new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })
    const userMsg: Note['chat'][number] = { role: 'user', text, ts }
    setNotes((prev) => prev.map((n) => n.id === currentNote.id ? { ...n, chat: [...n.chat, userMsg] } : n))
    setChatInput('')
    setChatPending(true)
    try {
      const res = await fetch('/api/freehold/server-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          role: 'sales_agent',
          context: {
            noteTitle: currentNote.title,
            sources: sources.filter((s) => currentNote.sources.includes(s.id)).map((s) => s.label),
            skill: 'notebook',
          },
        }),
      })
      const data = await res.json()
      const answer = data?.data?.answer || data?.answer || 'I could not retrieve information from this note right now.'
      const aiReply: Note['chat'][number] = { role: 'ai', text: answer, ts: new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) }
      setNotes((prev) => prev.map((n) => n.id === currentNote.id ? { ...n, chat: [...n.chat, aiReply] } : n))
    } catch {
      const aiReply: Note['chat'][number] = { role: 'ai', text: 'Could not reach the AI — please try again.', ts: new Date().toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) }
      setNotes((prev) => prev.map((n) => n.id === currentNote.id ? { ...n, chat: [...n.chat, aiReply] } : n))
    } finally {
      setChatPending(false)
    }
  }

  async function generateStudio() {
    if (!studioTpl) return
    const tpl = STUDIO_TEMPLATES.find((t) => t.id === studioTpl)
    setGenerating(true)
    setStudioOut('')
    try {
      const sourceLabels = sources.filter((s) => currentNote.sources.includes(s.id)).map((s) => s.label)
      const prompt = `Generate a ${tpl?.label} for the note "${currentNote.title}". Sources: ${sourceLabels.join(', ') || 'general inventory'}. Make it ready to use — professional, UAE real estate context, in English and directly usable.`
      const res = await fetch('/api/freehold/server-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, role: 'sales_agent', context: { noteTitle: currentNote.title, sources: sourceLabels, outputType: tpl?.label } }),
      })
      const data = await res.json()
      setStudioOut(data?.data?.answer || data?.answer || 'Could not generate content — please try again.')
    } catch {
      setStudioOut('Could not reach the AI — please try again.')
    } finally {
      setGenerating(false)
    }
  }

  function shareContent(connId: string) {
    setShared((prev) => [...prev, connId])
    setTimeout(() => setShared((prev) => prev.filter((id) => id !== connId)), 2000)
  }

  function addSource() {
    if (!srcInput.trim()) return
    setSources((prev) => [...prev, {
      id: `s${Date.now()}`,
      label: srcInput.trim(),
      type: srcType,
      icon: srcType === 'url' ? '🔗' : srcType === 'text' ? '📝' : srcType === 'brochure' ? '📄' : '📁',
    }])
    setSrcInput('')
    setShowAddSrc(false)
  }

  function createNote() {
    if (!newNoteTitle.trim()) return
    const n: Note = { id: `n${Date.now()}`, title: newNoteTitle.trim(), sources: [], chat: [], createdAt: new Date().toISOString().slice(0, 10) }
    setNotes((prev) => [...prev, n])
    setActiveNote(n)
    setNewNoteTitle('')
    setShowNewNote(false)
  }

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* Sources sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-[200px] shrink-0 border-r border-line bg-app overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sources</span>
          <button onClick={() => setShowAddSrc(true)} className="text-slate-500 hover:text-slate-300 transition">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {showAddSrc && (
          <div className="border-b border-line p-3 space-y-2">
            <input
              type="text"
              placeholder="URL, keyword or text…"
              value={srcInput}
              onChange={(e) => setSrcInput(e.target.value)}
              className="w-full rounded-[8px] border border-line-strong bg-surface-2 px-2 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-line-strong"
            />
            <div className="flex gap-1 flex-wrap">
              {(['url', 'text', 'brochure', 'area', 'developer', 'project'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSrcType(t)}
                  className={`rounded-full px-2 py-0.5 text-xs font-medium border transition ${srcType === t ? 'border-gold/40 text-gold bg-gold/10' : 'border-line-strong text-slate-500'}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <button onClick={addSource} className="flex-1 rounded-[8px] bg-gold/80 py-1 text-xs font-semibold text-black">Add</button>
              <button onClick={() => setShowAddSrc(false)} className="rounded-[8px] border border-line-strong px-2 py-1 text-xs text-slate-500">✕</button>
            </div>
          </div>
        )}

        <div className="flex-1 px-2 py-2 space-y-0.5">
          {['area', 'developer', 'project', 'brochure', 'url', 'text'].map((type) => {
            const group = sources.filter((s) => s.type === type)
            if (group.length === 0) return null
            return (
              <div key={type}>
                <div className="mt-2 mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-slate-600">{type}</div>
                {group.map((src) => (
                  <div key={src.id} className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 hover:bg-surface-2 cursor-pointer group">
                    <span className="text-sm">{src.icon}</span>
                    <span className="flex-1 truncate text-xs text-slate-400 group-hover:text-slate-200">{src.label}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        <div className="border-t border-line p-2">
          <input
            type="file"
            ref={brochureRef}
            multiple
            className="hidden"
            onChange={() => toast.success('Brochure uploaded — analyzing')}
          />
          <button onClick={() => brochureRef.current?.click()} className="flex w-full items-center gap-2 rounded-[8px] border border-dashed border-line-strong px-3 py-2 text-xs text-slate-500 hover:border-line-strong hover:text-slate-400 transition">
            <Upload className="h-3 w-3" /> Upload brochure
          </button>
          <button onClick={() => toast.success('Add a URL to your research')} className="mt-1 flex w-full items-center gap-2 rounded-[8px] border border-dashed border-line-strong px-3 py-2 text-xs text-slate-500 hover:border-line-strong hover:text-slate-400 transition">
            <Link2 className="h-3 w-3" /> Add URL
          </button>
        </div>
      </aside>

      {/* Notes list */}
      <aside className="hidden sm:flex sm:flex-col w-[220px] shrink-0 border-r border-line bg-app overflow-y-auto">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</span>
          <button onClick={() => setShowNewNote(true)} className="text-slate-500 hover:text-slate-300 transition">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {showNewNote && (
          <div className="border-b border-line p-3 space-y-2">
            <input
              type="text"
              placeholder="Note title…"
              value={newNoteTitle}
              onChange={(e) => setNewNoteTitle(e.target.value)}
              className="w-full rounded-[8px] border border-line-strong bg-surface-2 px-2 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-gold/40"
            />
            <div className="flex gap-1">
              <button onClick={createNote} className="flex-1 rounded-[8px] bg-gold/80 py-1 text-xs font-semibold text-black">Create</button>
              <button onClick={() => setShowNewNote(false)} className="rounded-[8px] border border-line-strong px-2 py-1 text-xs text-slate-500">✕</button>
            </div>
          </div>
        )}

        <div className="flex-1 px-2 py-2 space-y-0.5">
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => { setActiveNote(n); setTab('chat'); setStudioOut(''); setStudioTpl(null) }}
              className={`w-full rounded-[10px] px-3 py-2.5 text-left transition ${currentNote.id === n.id ? 'bg-surface-2' : 'hover:bg-surface-2'}`}
            >
              <div className={`text-sm font-medium ${currentNote.id === n.id ? 'text-white' : 'text-slate-400'}`}>{n.title}</div>
              <div className="mt-0.5 text-xs text-slate-500">{n.sources.length} sources · {n.chat.length / 2 | 0} chats</div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main area */}
      <main className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* Note header */}
        <div className="flex items-center gap-3 border-b border-line px-5 py-3">
          <BookOpen className="h-4 w-4 text-gold/70 shrink-0" />
          <h2 className="text-sm font-semibold text-white flex-1 truncate">{currentNote.title}</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTab('chat')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${tab === 'chat' ? 'bg-surface-2 text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              <MessageSquare className="inline-block h-3 w-3 mr-1" />Chat
            </button>
            <button
              onClick={() => setTab('studio')}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${tab === 'studio' ? 'bg-surface-2 text-white' : 'text-slate-400 hover:text-slate-300'}`}
            >
              <Sparkles className="inline-block h-3 w-3 mr-1" />Studio
            </button>
          </div>
        </div>

        {tab === 'chat' && (
          <>
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {currentNote.chat.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <BookOpen className="h-8 w-8 text-slate-700 mb-3" />
                  <div className="text-sm text-slate-400">Ask anything about your sources</div>
                  <div className="mt-1 text-xs text-slate-600">Powered by your inventory knowledge base</div>
                </div>
              )}
              {currentNote.chat.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-[14px] px-4 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-gold/15 text-slate-100'
                      : 'border border-line bg-surface-2 text-slate-300'
                  }`}>
                    <div className="text-sm leading-relaxed">{msg.text}</div>
                    <div className="mt-1 text-xs text-slate-500">{msg.ts}</div>
                  </div>
                </div>
              ))}
              {chatPending && (
                <div className="flex justify-start">
                  <div className="rounded-[14px] border border-line bg-surface-2 px-4 py-3">
                    <span className="flex gap-1">{[0,1,2].map(i => <span key={i} className="h-1.5 w-1.5 rounded-full bg-gold/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Chat input */}
            <div className="border-t border-line px-5 py-3">
              <div className="flex items-center gap-2 rounded-[14px] border border-line-strong bg-surface-2 px-4 py-2.5">
                <input
                  type="text"
                  placeholder="Ask about your sources…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                  className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                />
                <button onClick={sendChat} disabled={chatPending} className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/80 text-black transition hover:bg-gold disabled:opacity-40">
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}

        {tab === 'studio' && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="mb-4 text-xs text-slate-400">Generate content from "{currentNote.title}"</div>

            {/* Template picker */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STUDIO_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => { setStudioTpl(tpl.id); setStudioOut('') }}
                  className={`flex items-center gap-2.5 rounded-[14px] border px-4 py-3 text-left transition ${
                    studioTpl === tpl.id
                      ? 'border-gold/40 bg-gold/[0.07] text-white'
                      : 'border-line bg-surface-2 text-slate-400 hover:text-slate-300 hover:border-line-strong'
                  }`}
                >
                  <span className="text-lg">{tpl.icon}</span>
                  <span className="text-sm font-medium">{tpl.label}</span>
                </button>
              ))}
            </div>

            {studioTpl && (
              <button
                onClick={generateStudio}
                disabled={generating}
                className="mt-4 flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-gold/90 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {generating ? 'Generating…' : 'Generate'}
              </button>
            )}

            {studioOut && (
              <div className="mt-5">
                <div className="rounded-[14px] border border-line bg-surface-2 px-5 py-4">
                  <div className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">{studioOut}</div>
                </div>

                {/* Share buttons */}
                <div className="mt-4">
                  <div className="mb-2 text-xs text-slate-500 uppercase tracking-wider">Share via</div>
                  <div className="flex flex-wrap gap-2">
                    {SHARE_CONNECTIONS.map((conn) => {
                      const done = shared.includes(conn.id)
                      return (
                        <button
                          key={conn.id}
                          onClick={() => shareContent(conn.id)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            done
                              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-400'
                              : 'border-line-strong text-slate-400 hover:border-line-strong hover:text-slate-300'
                          }`}
                        >
                          <span>{conn.icon}</span>
                          {done ? <Check className="h-3 w-3" /> : conn.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
