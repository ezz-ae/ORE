'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { BookOpen, Pin, Sparkles, ArrowUpRight, MessageSquare, FileText, Megaphone, GitBranch, Hash, Search, X } from 'lucide-react'
import { notebookConversations } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

function outputTypeIcon(type: string) {
  if (type === 'ad_copy' || type === 'script') return <Megaphone className="h-3 w-3" />
  if (type === 'comparison') return <GitBranch className="h-3 w-3" />
  if (type === 'brochure' || type === 'pdf') return <FileText className="h-3 w-3" />
  return <MessageSquare className="h-3 w-3" />
}

function statusTone(status: string) {
  if (status === 'approved') return 'text-[#D4AF37] border-[#D4AF37]/20 bg-[#D4AF37]/10'
  if (status === 'sent_for_review') return 'text-[#F8E7AE] border-[#D4AF37]/20 bg-[#D4AF37]/10'
  if (status === 'saved') return 'text-sky-200 border-sky-400/20 bg-sky-400/10'
  return 'text-slate-400 border-slate-700 bg-slate-800/50'
}

function relativeTime(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const allOutputs = notebookConversations.flatMap(c => c.savedOutputs)
const pinnedOutputs = allOutputs.filter(o => o.pinned)
const totalMessages = notebookConversations.reduce((s, c) => s + c.messages.length, 0)

type OutputType = 'All' | 'ad_copy' | 'script' | 'comparison' | 'brochure' | 'pdf' | 'message'
type OutputStatus = 'All' | 'approved' | 'sent_for_review' | 'saved' | 'draft'

const OUTPUT_TYPES: { key: OutputType; label: string }[] = [
  { key: 'All',        label: 'All'        },
  { key: 'ad_copy',    label: 'Ad copy'    },
  { key: 'comparison', label: 'Comparison' },
  { key: 'brochure',   label: 'Brochure'   },
  { key: 'script',     label: 'Script'     },
  { key: 'message',    label: 'Message'    },
]

const STATUS_FILTERS: { key: OutputStatus; label: string }[] = [
  { key: 'All',             label: 'All'            },
  { key: 'approved',        label: 'Approved'       },
  { key: 'sent_for_review', label: 'In review'      },
  { key: 'saved',           label: 'Saved'          },
  { key: 'draft',           label: 'Draft'          },
]

export default function NotebookPage() {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<OutputType>('All')
  const [statusFilter, setStatusFilter] = useState<OutputStatus>('All')

  const filteredConversations = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = [...notebookConversations].reverse()
    if (!q) return base
    return base.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      c.messages.some((m) => m.content.toLowerCase().includes(q))
    )
  }, [query])

  const filteredOutputs = useMemo(() => {
    return allOutputs.filter((o) => {
      if (typeFilter !== 'All' && o.type !== typeFilter) return false
      if (statusFilter !== 'All' && o.status !== statusFilter) return false
      return true
    })
  }, [typeFilter, statusFilter])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#D4AF37]/85">
          <BookOpen className="h-3.5 w-3.5" /> Notebook
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          Generate, save,
          <br />
          <span className="text-slate-400">send what matters.</span>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-[1.65] text-slate-300">
          Brochures, ad copy, WhatsApp drafts, comparisons, offer letters — all grounded in live project, lead, and campaign context. Everything saved here is ready to use.
        </p>
      </section>

      {/* Stats */}
      <section className="mt-8 grid grid-cols-3 gap-3">
        <div className="rounded-[18px] border border-slate-800 bg-slate-900 p-4 text-center">
          <p className="text-[26px] font-semibold text-white">{notebookConversations.length}</p>
          <p className="mt-1 text-xs text-slate-500">Conversations</p>
        </div>
        <div className="rounded-[18px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.05] p-4 text-center">
          <p className="text-[26px] font-semibold text-[#F8E7AE]">{allOutputs.length}</p>
          <p className="mt-1 text-xs text-[#D4AF37]/60">Saved outputs</p>
        </div>
        <div className="rounded-[18px] border border-slate-800 bg-slate-900 p-4 text-center">
          <p className="text-[26px] font-semibold text-white">{totalMessages}</p>
          <p className="mt-1 text-xs text-slate-500">Messages</p>
        </div>
      </section>

      {/* New conversation prompt */}
      <section className="mt-8">
        <AiPrompt
          placeholder="Generate an offer, comparison, WhatsApp message, ad copy…"
          suggestions={[
            'Draft a WhatsApp for the hottest lead.',
            'Comparison: Palm vs Hills for AED 2.5M investor.',
            'Three Meta ad angles for Dubai Hills.',
            'Offer letter for Business Bay entry.',
          ]}
        />
      </section>

      {/* Pinned outputs */}
      {pinnedOutputs.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#D4AF37]/80">
            <Pin className="h-3 w-3" /> Pinned outputs
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {pinnedOutputs.map(output => (
              <Link
                key={output.id}
                href={`/freehold-intelligence/notebook/${output.conversationId}`}
                className="group rounded-[22px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.03] p-5 transition hover:border-[#D4AF37]/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-[#D4AF37]/70">
                    {outputTypeIcon(output.type)}
                    <span className="capitalize">{output.type.replace(/_/g, ' ')}</span>
                  </div>
                  <Pin className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />
                </div>
                <h3 className="mt-2 text-sm font-semibold text-white">{output.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-xs leading-[1.6] text-slate-400">{output.content}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${statusTone(output.status)}`}>
                    {output.status.replace(/_/g, ' ')}
                  </span>
                  {output.tags.slice(0, 3).map(t => (
                    <span key={t} className="flex items-center gap-0.5 text-sm text-slate-500">
                      <Hash className="h-2.5 w-2.5" />{t}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Conversations — with search */}
      <section className="mt-12">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Threads</div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-white">
              {filteredConversations.length} of {notebookConversations.length} conversation{notebookConversations.length !== 1 ? 's' : ''}
            </h2>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            className="w-full rounded-[14px] border border-slate-800 bg-slate-900 py-2.5 pl-10 pr-10 text-sm text-white placeholder-slate-500 outline-none transition focus:border-[#D4AF37]/30 focus:bg-slate-800/60"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {filteredConversations.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">No conversations match your search.</div>
        ) : (
          <div className="space-y-3">
            {filteredConversations.map(conv => {
              const lastMsg = conv.messages[conv.messages.length - 1]
              const outputCount = conv.savedOutputs.length
              return (
                <Link
                  key={conv.id}
                  href={`/freehold-intelligence/notebook/${conv.id}`}
                  className="group flex items-start gap-5 rounded-[22px] border border-slate-800 bg-slate-900 p-5 transition hover:border-[#D4AF37]/20 sm:p-6"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-700 bg-slate-800/60 transition group-hover:border-[#D4AF37]/20">
                    <Sparkles className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="truncate text-sm font-semibold text-white">{conv.title}</h3>
                      <div className="flex shrink-0 items-center gap-2 text-sm text-slate-500">
                        <span>{relativeTime(conv.updatedAt)}</span>
                        <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:text-[#D4AF37]" />
                      </div>
                    </div>

                    <p className="mt-1 line-clamp-1 text-xs text-slate-400">
                      {lastMsg.role === 'assistant' ? 'AI: ' : 'You: '}{lastMsg.content.slice(0, 120)}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span>{conv.messages.length} messages</span>
                      {outputCount > 0 && (
                        <span className="text-[#D4AF37]/60">{outputCount} saved output{outputCount !== 1 ? 's' : ''}</span>
                      )}
                      {conv.relatedProjectIds.length > 0 && (
                        <span>{conv.relatedProjectIds.length} project{conv.relatedProjectIds.length !== 1 ? 's' : ''}</span>
                      )}
                      {conv.relatedLeadIds.length > 0 && (
                        <span>{conv.relatedLeadIds.length} lead{conv.relatedLeadIds.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* All saved outputs — with type + status filters */}
      <section className="mt-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {filteredOutputs.length} of {allOutputs.length} saved output{allOutputs.length !== 1 ? 's' : ''}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {OUTPUT_TYPES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={[
                  'rounded-full px-3 py-1 text-sm font-medium transition',
                  typeFilter === key
                    ? 'border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#D4AF37]'
                    : 'border border-slate-800 text-slate-400 hover:text-slate-100',
                ].join(' ')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={[
                'rounded-full px-3 py-1 text-sm font-medium transition',
                statusFilter === key
                  ? 'bg-slate-700/50 text-white'
                  : 'text-slate-400 hover:text-slate-100',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {filteredOutputs.length === 0 ? (
          <div className="rounded-[22px] border border-slate-800 py-12 text-center text-sm text-slate-400">
            No outputs match these filters.
          </div>
        ) : (
          <div className="overflow-hidden rounded-[22px] border border-slate-800 bg-slate-900">
            <div className="divide-y divide-slate-800">
              {filteredOutputs.map(output => (
                <Link
                  key={output.id}
                  href={`/freehold-intelligence/notebook/${output.conversationId}`}
                  className="flex items-center gap-4 px-6 py-4 transition hover:bg-slate-800/50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-400">
                    {outputTypeIcon(output.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-100">{output.title}</span>
                      {output.pinned && <Pin className="h-3 w-3 shrink-0 text-[#D4AF37]" />}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">{output.content.slice(0, 100)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`hidden rounded-full border px-2 py-0.5 text-xs font-medium capitalize sm:inline-flex ${statusTone(output.status)}`}>
                      {output.status.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-slate-500">{relativeTime(output.createdAt)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

    </div>
  )
}
