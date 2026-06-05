'use client'

import { useState, useMemo } from 'react'
import { CheckSquare, AlertCircle, Clock, MessageSquare, CheckCircle2, ArrowUpRight, Sparkles, X, ThumbsUp, ThumbsDown } from 'lucide-react'
import Link from 'next/link'
import { AiPrompt } from '@/components/freehold/ai-prompt'

type ReviewType = 'approval' | 'decision' | 'correction' | 'access request' | 'comment'
type ReviewPriority = 'critical' | 'high' | 'medium' | 'low'

type ReviewItem = {
  id: string
  type: ReviewType
  priority: ReviewPriority
  project: string
  projectHref?: string
  title: string
  body: string
  owner: string
  requestedBy: string
  dueDate?: string
  linkedTo?: string
}

const INITIAL_ITEMS: ReviewItem[] = [
  {
    id: 'rv_001',
    type: 'access request',
    priority: 'critical',
    project: 'Palm Jumeirah Investor Pack',
    projectHref: '/freehold-intelligence/lead-machine/listings/lm_palm_001',
    title: 'Meta billing owner — blocks ad launch',
    body: 'Campaign launch cannot proceed until the Meta ad account billing owner is confirmed and a valid payment method is attached. This is the top launch blocker across the entire pipeline.',
    owner: 'Owner',
    requestedBy: 'Marketing',
    dueDate: 'Today',
    linkedTo: 'Ad Request · Palm Q2',
  },
  {
    id: 'rv_002',
    type: 'approval',
    priority: 'high',
    project: 'Palm Jumeirah Investor Pack',
    projectHref: '/freehold-intelligence/lead-machine/listings/lm_palm_001',
    title: 'Landing page approval needed',
    body: 'The Palm investor landing is at 84% completion. Hero, payment plan, lead form and WhatsApp flow are all ready. Only tracking confirmation and owner sign-off are outstanding. Approve to move to campaign packaging.',
    owner: 'Owner',
    requestedBy: 'Marketing',
    dueDate: 'Today',
    linkedTo: 'Landing · palm-investor-preview',
  },
  {
    id: 'rv_003',
    type: 'approval',
    priority: 'high',
    project: 'Dubai Hills Yield Campaign',
    projectHref: '/freehold-intelligence/lead-machine/listings/lm_hills_002',
    title: 'Campaign angle approval — investor yield corridor',
    body: 'Marketing needs approval on the Dubai Hills family-investor yield corridor angle before the ad request moves to ready to launch. This is the last gate before campaign packaging can begin.',
    owner: 'Owner',
    requestedBy: 'Marketing',
    dueDate: 'Tomorrow',
    linkedTo: 'Ad Request · Hills Q2',
  },
  {
    id: 'rv_004',
    type: 'correction',
    priority: 'medium',
    project: 'Sobha Hartland II Villas',
    projectHref: '/freehold-intelligence/lead-machine/listings/lm_sobha_007',
    title: 'Verify and update handover date',
    body: 'Handover date shown as Q4 2026, but developer documentation suggests Q2 2027. Incorrect handover dates cause campaign mis-targeting. Confirm with developer and update the listing field.',
    owner: 'Data Manager',
    requestedBy: 'Marketing',
    dueDate: '25 May',
    linkedTo: 'Listing · lm_sobha_007',
  },
  {
    id: 'rv_005',
    type: 'decision',
    priority: 'medium',
    project: 'Business Bay Canal View',
    projectHref: '/freehold-intelligence/lead-machine/listings/lm_bay_003',
    title: 'Select primary campaign audience for Canal View',
    body: 'Two audiences are viable: UAE end-users (families upgrading to Business Bay) and GCC investors (yield-focused). The landing and ad copy diverge significantly by audience. Choose the primary before briefing the campaign.',
    owner: 'Marketing',
    requestedBy: 'Marketing',
    dueDate: '24 May',
    linkedTo: 'Listing · lm_bay_003',
  },
  {
    id: 'rv_006',
    type: 'comment',
    priority: 'low',
    project: 'Dubai Hills Yield Campaign',
    projectHref: '/freehold-intelligence/lead-machine/listings/lm_hills_002',
    title: 'Add payment-plan proof point above lead form',
    body: 'The 70/30 construction-linked payment plan is a strong conversion signal. Adding a one-line callout above the lead form could increase lead quality from paid traffic.',
    owner: 'Marketing',
    requestedBy: 'Marketing',
    linkedTo: 'Landing · Hills yield',
  },
]

const PRIORITY_ORDER: Record<ReviewPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function priorityTone(p: ReviewPriority) {
  if (p === 'critical') return { ring: 'border-red-400/25', bg: 'bg-red-400/[0.05]', text: 'text-red-300', dot: 'bg-red-400', label: 'Critical' }
  if (p === 'high')     return { ring: 'border-[#D4AF37]/25', bg: 'bg-[#D4AF37]/[0.05]', text: 'text-[#F8E7AE]', dot: 'bg-[#D4AF37]', label: 'High' }
  if (p === 'medium')   return { ring: 'border-sky-400/20', bg: 'bg-sky-400/[0.04]', text: 'text-sky-200', dot: 'bg-sky-400', label: 'Medium' }
  return                       { ring: 'border-white/[0.08]', bg: 'bg-[#1A1F2A]', text: 'text-white/50', dot: 'bg-white/30', label: 'Low' }
}

function typeTone(t: ReviewType) {
  if (t === 'approval')       return 'bg-[#D4AF37]/10 border-[#D4AF37]/20 text-emerald-200'
  if (t === 'access request') return 'bg-red-400/10 border-red-400/20 text-red-200'
  if (t === 'decision')       return 'bg-[#D4AF37]/10 border-[#D4AF37]/20 text-[#F8E7AE]'
  if (t === 'correction')     return 'bg-sky-400/10 border-sky-400/20 text-sky-200'
  return                              'bg-white/[0.04] border-white/10 text-white/50'
}

function typeIcon(t: ReviewType) {
  if (t === 'approval' || t === 'decision') return <CheckCircle2 className="h-3.5 w-3.5 text-[#D4AF37]" />
  if (t === 'access request') return <AlertCircle className="h-3.5 w-3.5 text-red-400" />
  if (t === 'correction') return <MessageSquare className="h-3.5 w-3.5 text-white/55" />
  return <Clock className="h-3.5 w-3.5 text-white/30" />
}

type FilterType = 'All' | ReviewType
const TYPE_FILTERS: FilterType[] = ['All', 'approval', 'decision', 'correction', 'access request', 'comment']

type Resolution = { status: 'approved' | 'rejected' }

export default function ReviewRequestsPage() {
  const [items, setItems]               = useState<ReviewItem[]>(INITIAL_ITEMS)
  const [activeType, setActiveType]     = useState<FilterType>('All')
  const [resolutions, setResolutions]   = useState<Record<string, Resolution>>({})
  const [commentName, setCommentName]   = useState('')
  const [commentText, setCommentText]   = useState('')
  const [commentFlash, setCommentFlash] = useState(false)

  const filtered = useMemo(() => {
    const base = items.filter((r) => !resolutions[r.id])
    const typed = activeType === 'All' ? base : base.filter((r) => r.type === activeType)
    return [...typed].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  }, [items, resolutions, activeType])

  const stats = useMemo(() => ({
    total:    items.filter((r) => !resolutions[r.id]).length,
    critical: items.filter((r) => !resolutions[r.id] && r.priority === 'critical').length,
    approvals: items.filter((r) => !resolutions[r.id] && r.type === 'approval').length,
    resolved: Object.keys(resolutions).length,
  }), [items, resolutions])

  function resolve(id: string, status: 'approved' | 'rejected') {
    setResolutions((prev) => ({ ...prev, [id]: { status } }))
  }

  function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return
    const newItem: ReviewItem = {
      id: `rv_${Date.now()}`,
      type: 'comment',
      priority: 'low',
      project: 'General',
      title: commentText.slice(0, 60) + (commentText.length > 60 ? '…' : ''),
      body: commentText,
      owner: commentName || 'Owner',
      requestedBy: commentName || 'Owner',
    }
    setItems((prev) => [...prev, newItem])
    setCommentName('')
    setCommentText('')
    setCommentFlash(true)
    setTimeout(() => setCommentFlash(false), 2500)
  }

  const hasFilter = activeType !== 'All'

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <section>
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <CheckSquare className="h-3.5 w-3.5" /> Reviews
        </div>
        <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
          {stats.total} decisions waiting.
          <br />
          <span className="text-white/35">{stats.critical} are launch blockers.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-[1.65] text-white/60">
          Comments, approvals, corrections, and access requests — sorted by what blocks launch first.
          {stats.resolved > 0 && (
            <span className="ml-2 text-[#D4AF37]/80">{stats.resolved} resolved this session.</span>
          )}
        </p>
      </section>

      {/* Stat tiles */}
      <section className="mt-8 grid grid-cols-4 gap-3">
        <div className="rounded-[18px] border border-red-400/20 bg-red-400/[0.06] p-4 text-center">
          <p className="text-[26px] font-semibold text-red-300">{stats.critical}</p>
          <p className="text-[12px] text-red-400/60 mt-1">Blockers</p>
        </div>
        <div className="rounded-[18px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] p-4 text-center">
          <p className="text-[26px] font-semibold text-[#D4AF37]">{stats.approvals}</p>
          <p className="text-[12px] text-[#D4AF37]/60 mt-1">Approvals</p>
        </div>
        <div className="rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-4 text-center">
          <p className="text-[26px] font-semibold text-white">{stats.total}</p>
          <p className="text-[12px] text-white/35 mt-1">Open</p>
        </div>
        <div className="rounded-[18px] border border-emerald-400/15 bg-[#D4AF37]/[0.04] p-4 text-center">
          <p className="text-[26px] font-semibold text-[#D4AF37]/70">{stats.resolved}</p>
          <p className="text-[12px] text-[#D4AF37]/40 mt-1">Resolved</p>
        </div>
      </section>

      {/* Type filter pills */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-white/35 shrink-0">Filter:</span>
        {TYPE_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveType(f)}
            className={`rounded-full border px-3 py-0.5 text-[13px] font-medium capitalize transition ${
              activeType === f
                ? 'border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#D4AF37]'
                : 'border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/70 hover:border-white/20'
            }`}
          >
            {f}
          </button>
        ))}
        {hasFilter && (
          <button
            onClick={() => setActiveType('All')}
            className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[13px] text-white/40 transition hover:text-white/70"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      <p className="mt-2 text-[13px] text-white/25">{filtered.length} of {stats.total} items shown</p>

      {/* Review items */}
      <section className="mt-4 space-y-4">
        {filtered.length === 0 ? (
          <div className="rounded-[22px] border border-white/[0.05] bg-white/[0.02] py-14 text-center text-sm text-white/25">
            {stats.total === 0 ? 'All items resolved ✓' : 'No items match this filter.'}
          </div>
        ) : (
          filtered.map((item) => {
            const tone = priorityTone(item.priority)
            return (
              <div key={item.id} className={`rounded-[22px] border p-6 ${tone.ring} ${tone.bg}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${tone.ring} ${tone.text}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                      {tone.label}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-medium capitalize ${typeTone(item.type)}`}>
                      {typeIcon(item.type)}
                      {item.type}
                    </span>
                  </div>
                  {item.dueDate && (
                    <div className="flex items-center gap-1.5 text-[13px] text-white/40">
                      <Clock className="h-3 w-3" /> Due {item.dueDate}
                    </div>
                  )}
                </div>

                <h3 className="mt-3 text-[15px] font-semibold text-white">{item.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/65">{item.body}</p>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.05] pt-4">
                  <div className="flex flex-wrap gap-4 text-[12px] text-white/35">
                    <span>Project: <span className="text-white/55">{item.project}</span></span>
                    <span>Owner: <span className="text-white/55">{item.owner}</span></span>
                    {item.linkedTo && <span>Linked: <span className="text-white/55">{item.linkedTo}</span></span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => resolve(item.id, 'approved')}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-3.5 py-1.5 text-[12px] font-medium text-[#D4AF37] transition hover:border-emerald-400/35 hover:bg-[#D4AF37]/10"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => resolve(item.id, 'rejected')}
                      className="inline-flex items-center gap-1.5 rounded-[10px] border border-red-400/20 bg-red-400/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-red-300 transition hover:border-red-400/30 hover:bg-red-400/[0.08]"
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </div>

                {item.projectHref && (
                  <Link
                    href={item.projectHref}
                    className="mt-3 inline-flex items-center gap-1 text-[13px] text-white/30 transition hover:text-[#D4AF37]"
                  >
                    Open project workspace <ArrowUpRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            )
          })
        )}
      </section>

      {/* Add comment */}
      <section className="mt-8 rounded-[22px] border border-white/[0.08] bg-[#1A1F2A] p-6">
        <div className="mb-4 flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.18em] text-white/35">
          <MessageSquare className="h-3.5 w-3.5" /> Add a review comment
        </div>
        {commentFlash && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-4 py-2.5 text-sm text-[#D4AF37]">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Comment added to the review queue.
          </div>
        )}
        <form onSubmit={handleComment} className="space-y-3">
          <input
            value={commentName}
            onChange={(e) => setCommentName(e.target.value)}
            placeholder="Your name"
            className="w-full rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/30 transition"
          />
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a review comment, decision request, or correction note…"
            rows={3}
            className="w-full rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white placeholder:text-white/25 outline-none focus:border-[#D4AF37]/30 transition resize-none"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-[12px] bg-white px-5 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-white/90 disabled:opacity-50"
              disabled={!commentText.trim()}
            >
              Add comment
            </button>
          </div>
        </form>
      </section>

      {/* AI take */}
      <section className="mt-8 rounded-[22px] border border-[#D4AF37]/15 bg-[#D4AF37]/[0.03] px-6 py-7">
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/80 mb-3">
          <Sparkles className="h-3 w-3" /> AI take
        </div>
        <p className="text-[15px] font-medium leading-[1.65] text-white/85">
          Resolve the Meta billing access first — it&apos;s the one item that blocks everything downstream. After that, the Palm landing approval is the next fastest unlock. The Dubai Hills angle approval can happen in parallel.
        </p>
      </section>

      {/* AI prompt */}
      <section className="mt-8">
        <AiPrompt
          placeholder="Ask about approvals, reviews, blockers…"
          suggestions={[
            'What needs my approval today?',
            'What is the fastest path to launch?',
            'Show all landing reviews pending.',
            'Which approvals are time-sensitive?',
          ]}
        />
      </section>

    </div>
  )
}
