'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, MessageSquare, ClipboardList, AlertCircle, Send } from 'lucide-react'

interface Requirement {
  id: string
  title: string
  description: string
  nextAction: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: string
}

interface Comment {
  id: string
  type: string
  owner: string
  body: string
  expectedOutput: string
}

interface Props {
  requirements: Requirement[]
  comments: Comment[]
  projectName: string
}

function severityClass(severity: string, resolved: boolean) {
  if (resolved) return 'border-slate-800 bg-slate-900 opacity-60'
  if (severity === 'critical') return 'border-red-400/20 bg-red-400/[0.05]'
  if (severity === 'high')     return 'border-[#D4AF37]/20 bg-[#D4AF37]/[0.05]'
  return 'border-slate-800 bg-slate-900'
}

function severityTextClass(severity: string, resolved: boolean) {
  if (resolved) return 'text-slate-500'
  if (severity === 'critical') return 'text-red-300'
  if (severity === 'high')     return 'text-[#F8E7AE]'
  return 'text-slate-400'
}

export function ListingWorkspace({ requirements, comments, projectName }: Props) {
  const [tab, setTab] = useState<'requirements' | 'comments'>('requirements')
  const [resolved, setResolved] = useState<Set<string>>(new Set())
  const [localComments, setLocalComments] = useState(comments)
  const [draft, setDraft] = useState('')
  const [flash, setFlash] = useState<string | null>(null)

  function toggleResolved(id: string) {
    setResolved((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        triggerFlash('Requirement reopened')
      } else {
        next.add(id)
        triggerFlash('Marked as resolved')
      }
      return next
    })
  }

  function triggerFlash(msg: string) {
    setFlash(msg)
  }

  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(null), 2400)
    return () => clearTimeout(t)
  }, [flash])

  function postComment() {
    const body = draft.trim()
    if (!body) return
    setLocalComments((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        type: 'note',
        owner: 'You',
        body,
        expectedOutput: '',
      },
    ])
    setDraft('')
    triggerFlash('Comment added')
  }

  const unresolvedCount = requirements.filter((r) => !resolved.has(r.id)).length

  return (
    <>
      {/* Tab bar */}
      <div className="mt-8 flex items-center gap-1 border-b border-slate-800 pb-0">
        <button
          type="button"
          onClick={() => setTab('requirements')}
          className={[
            'flex items-center gap-2 px-4 py-3 text-[14px] font-medium transition border-b-2',
            tab === 'requirements'
              ? 'border-[#D4AF37] text-white'
              : 'border-transparent text-slate-500 hover:text-slate-300',
          ].join(' ')}
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Requirements
          {unresolvedCount > 0 && (
            <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-xs font-semibold text-red-400 leading-none">
              {unresolvedCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('comments')}
          className={[
            'flex items-center gap-2 px-4 py-3 text-[14px] font-medium transition border-b-2',
            tab === 'comments'
              ? 'border-[#D4AF37] text-white'
              : 'border-transparent text-slate-500 hover:text-slate-300',
          ].join(' ')}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Comments
          <span className="rounded-full border border-slate-800 bg-slate-800/40 px-1.5 py-0.5 text-xs font-medium text-slate-500 leading-none">
            {localComments.length}
          </span>
        </button>
      </div>

      {/* Requirements tab */}
      {tab === 'requirements' && requirements.length > 0 && (
        <div className="mt-6 space-y-3">
          {requirements.map((req) => {
            const isResolved = resolved.has(req.id)
            return (
              <div
                key={req.id}
                className={`rounded-[18px] border p-5 transition-all ${severityClass(req.severity, isResolved)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`text-[14px] font-semibold leading-snug ${severityTextClass(req.severity, isResolved)}`}>
                      {req.title}
                    </p>
                    {!isResolved && (
                      <>
                        <p className={`mt-1.5 text-sm leading-relaxed ${severityTextClass(req.severity, isResolved)} opacity-80`}>
                          {req.description}
                        </p>
                        <p className={`mt-2 text-xs opacity-60 ${severityTextClass(req.severity, isResolved)}`}>
                          → {req.nextAction}
                        </p>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleResolved(req.id)}
                    className={[
                      'shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                      isResolved
                        ? 'border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#D4AF37]'
                        : 'border-slate-800 bg-slate-800/40 text-slate-500 hover:text-slate-300',
                    ].join(' ')}
                  >
                    {isResolved
                      ? <><CheckCircle2 className="h-3.5 w-3.5" /> Resolved</>
                      : <><Circle className="h-3.5 w-3.5" /> Resolve</>
                    }
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Comments tab */}
      {tab === 'comments' && (
        <div className="mt-6 space-y-4">
          {/* Existing comments */}
          {localComments.map((comment) => (
            <div key={comment.id} className="rounded-[18px] border border-slate-800 bg-slate-900 p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-slate-800 bg-slate-800/40 px-2.5 py-0.5 text-xs text-slate-500 capitalize">
                  {comment.type}
                </span>
                <span className="text-sm text-slate-500">{comment.owner}</span>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-100">{comment.body}</p>
              {comment.expectedOutput && (
                <p className="mt-2 text-xs text-slate-500">Expected: {comment.expectedOutput}</p>
              )}
            </div>
          ))}

          {/* Add comment form */}
          <div className="rounded-[18px] border border-slate-800 bg-slate-900 p-5">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500 mb-3">
              Add note
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment() }}
              placeholder={`Note about ${projectName}…`}
              rows={3}
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3 text-[14px] text-slate-100 placeholder:text-slate-600 focus:border-[#D4AF37]/40 focus:outline-none transition"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-600">⌘↵ to post</span>
              <button
                type="button"
                onClick={postComment}
                disabled={!draft.trim()}
                className="flex items-center gap-2 rounded-lg border border-[#D4AF37]/25 bg-[#D4AF37]/[0.08] px-4 py-2 text-sm font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Send className="h-3.5 w-3.5" />
                Post
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flash toast */}
      {flash && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#D4AF37]/30 bg-slate-900/95 px-5 py-2.5 text-sm font-medium text-[#D4AF37] shadow-xl backdrop-blur">
          {flash}
        </div>
      )}
    </>
  )
}
