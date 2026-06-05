'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Copy, AlertCircle, CheckCircle2, ArrowUpRight, Phone, Mail, User, GitMerge } from 'lucide-react'
import { crmLeads } from '@/src/features/freehold-intelligence/server-session'
import { AiPrompt } from '@/components/freehold/ai-prompt'

type DuplicateCluster = {
  id: string
  confidence: 'high' | 'medium' | 'low'
  matchReason: string[]
  primary: { id: string; name: string; phone: string; email: string; source: string; stage: string; intentScore: number; assignedAgent: string; arrivedAt: string }
  duplicate: { id: string; name: string; phone: string; email: string; source: string; stage: string; intentScore: number; assignedAgent: string; arrivedAt: string }
}

const leads = crmLeads

// Clusters built from real `duplicateRisk: true` leads + inline patterns
const CLUSTERS: DuplicateCluster[] = [
  {
    id: 'dup_001',
    confidence: 'high',
    matchReason: ['Same phone number', 'Different campaign source'],
    primary: {
      id: 'lead_002',
      name: 'Sara Khan',
      phone: '+971 50 000 0002',
      email: 'sara@example.com',
      source: 'Market tracker',
      stage: 'New',
      intentScore: 78,
      assignedAgent: 'Omar',
      arrivedAt: '2026-05-21T12:05:00+04:00',
    },
    duplicate: {
      id: 'lead_dup_002a',
      name: 'Sara K.',
      phone: '+971 50 000 0002',
      email: 'sara.khan@gmail.com',
      source: 'Palm investor landing',
      stage: 'New',
      intentScore: 65,
      assignedAgent: 'Unassigned',
      arrivedAt: '2026-05-20T09:30:00+04:00',
    },
  },
  {
    id: 'dup_002',
    confidence: 'medium',
    matchReason: ['Same email domain', 'Similar name variation'],
    primary: {
      id: 'lead_dup_003a',
      name: 'Mohammed Al Farsi',
      phone: '+971 50 000 0201',
      email: 'm.alfarsi@work.ae',
      source: 'Dubai Hills landing',
      stage: 'Follow-up',
      intentScore: 72,
      assignedAgent: 'Ahmad K.',
      arrivedAt: '2026-05-19T14:00:00+04:00',
    },
    duplicate: {
      id: 'lead_dup_003b',
      name: 'M. Alfarsi',
      phone: '+971 55 000 0201',
      email: 'm.alfarsi@work.ae',
      source: 'Google Ads — Hills Q2',
      stage: 'New',
      intentScore: 58,
      assignedAgent: 'Layla',
      arrivedAt: '2026-05-22T10:15:00+04:00',
    },
  },
  {
    id: 'dup_003',
    confidence: 'low',
    matchReason: ['Name similarity', 'Same area interest'],
    primary: {
      id: 'lead_dup_004a',
      name: 'James Whitfield',
      phone: '+971 50 000 0006',
      email: 'jwhitfield@example.com',
      source: 'Secondary market mailer',
      stage: 'Follow-up',
      intentScore: 59,
      assignedAgent: 'Rami T.',
      arrivedAt: '2026-05-18T11:00:00+04:00',
    },
    duplicate: {
      id: 'lead_dup_004b',
      name: 'J. Whitfield',
      phone: '+971 50 000 0099',
      email: 'whitfield.james@email.com',
      source: 'WhatsApp inbound',
      stage: 'New',
      intentScore: 44,
      assignedAgent: 'Unassigned',
      arrivedAt: '2026-05-23T08:00:00+04:00',
    },
  },
]

const CONFIDENCE_CONFIG = {
  high:   { label: 'High confidence', border: 'border-red-400/20',    bg: 'bg-red-400/[0.04]',     text: 'text-red-300',     dot: 'bg-red-400' },
  medium: { label: 'Medium confidence', border: 'border-orange-400/20', bg: 'bg-orange-400/[0.04]', text: 'text-orange-300',  dot: 'bg-orange-400' },
  low:    { label: 'Low confidence', border: 'border-white/[0.08]',   bg: 'bg-[#131B2B]',          text: 'text-white/40',    dot: 'bg-white/25' },
}

function LeadCard({ lead, isPrimary }: { lead: DuplicateCluster['primary']; isPrimary: boolean }) {
  return (
    <div className={`flex-1 rounded-[14px] border p-4 ${isPrimary ? 'border-[#D4AF37]/15 bg-[#D4AF37]/[0.03]' : 'border-white/[0.08] bg-white/[0.02]'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[12px] font-semibold uppercase tracking-[0.18em] ${isPrimary ? 'text-[#D4AF37]/70' : 'text-white/30'}`}>
          {isPrimary ? 'Primary' : 'Possible duplicate'}
        </span>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[12px] text-white/40">
          {lead.stage}
        </span>
      </div>
      <div className="mt-2 text-[15px] font-semibold text-white">{lead.name}</div>
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-2 text-[12px] text-white/50">
          <Phone className="h-3 w-3 shrink-0 text-white/25" /> {lead.phone}
        </div>
        <div className="flex items-center gap-2 text-[12px] text-white/50">
          <Mail className="h-3 w-3 shrink-0 text-white/25" /> {lead.email}
        </div>
        <div className="flex items-center gap-2 text-[12px] text-white/50">
          <User className="h-3 w-3 shrink-0 text-white/25" /> {lead.assignedAgent}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[13px] text-white/35">{lead.source}</span>
        <span className="text-[13px] font-semibold text-white/60">Score {lead.intentScore}</span>
      </div>
    </div>
  )
}

type ConfidenceFilter = 'All' | 'high' | 'medium' | 'low'

export default function CrmDuplicatesPage() {
  const [resolved, setResolved] = useState<Record<string, 'merged' | 'dismissed'>>({})
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('All')
  const [flash, setFlash] = useState<string | null>(null)

  const atRisk = leads.filter((l) => l.duplicateRisk).length

  const visibleClusters = useMemo(() => {
    return CLUSTERS.filter((c) => {
      if (resolved[c.id]) return false
      if (confidenceFilter !== 'All' && c.confidence !== confidenceFilter) return false
      return true
    })
  }, [resolved, confidenceFilter])

  const mergedCount = Object.values(resolved).filter((v) => v === 'merged').length
  const highConf = visibleClusters.filter((c) => c.confidence === 'high').length

  function triggerFlash(msg: string) {
    setFlash(msg)
    setTimeout(() => setFlash(null), 2500)
  }

  function handleMerge(id: string, name: string) {
    setResolved((prev) => ({ ...prev, [id]: 'merged' }))
    triggerFlash(`Merged: ${name} — primary record kept`)
  }

  function handleDismiss(id: string) {
    setResolved((prev) => ({ ...prev, [id]: 'dismissed' }))
    triggerFlash('Marked as not a duplicate')
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <section>
        <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
          <Copy className="h-3.5 w-3.5" /> Duplicates
        </div>
        <h1 className="mt-5 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
          Duplicate leads<br /><span className="text-white/35">{visibleClusters.length} cluster{visibleClusters.length !== 1 ? 's' : ''} remaining.</span>
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/60">
          Duplicate leads waste agent time and split the contact history. Merge keeps the primary record and combines timeline, notes, and stage.
        </p>
      </section>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Clusters remaining',  value: visibleClusters.length,  color: 'text-white' },
          { label: 'High confidence',     value: highConf,                color: 'text-red-300' },
          { label: 'At-risk leads',       value: atRisk,                  color: 'text-orange-300' },
          { label: 'Merged this session', value: mergedCount,             color: 'text-[#D4AF37]' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-4">
            <div className={`text-[28px] font-semibold leading-none ${stat.color}`}>{stat.value}</div>
            <div className="mt-1.5 text-[13px] text-white/40">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Alert */}
      {highConf > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-[18px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <div className="text-[13px] font-semibold text-white">{highConf} high-confidence duplicate{highConf !== 1 ? 's' : ''} need immediate review</div>
            <p className="mt-1 text-[12px] text-white/55">
              These records share a phone number across two different campaign sources. Both records may be receiving follow-up from different agents without either agent knowing.
            </p>
          </div>
        </div>
      )}

      {/* Clusters */}
      <section className="mt-12">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div>
            <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">Duplicate clusters</div>
            <h2 className="mt-1 text-xl font-semibold text-white">Review and resolve</h2>
          </div>
          <div className="ml-auto flex gap-1.5">
            {(['All', 'high', 'medium', 'low'] as ConfidenceFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setConfidenceFilter(f)}
                className={[
                  'rounded-full px-3 py-1 text-[13px] font-medium capitalize transition border',
                  confidenceFilter === f
                    ? 'border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#D4AF37]'
                    : 'border-white/[0.08] text-white/40 hover:text-white/65',
                ].join(' ')}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {visibleClusters.length === 0 ? (
          <div className="rounded-[22px] border border-emerald-400/15 bg-[#D4AF37]/[0.04] py-14 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-[#D4AF37]" />
            <div className="mt-3 text-[15px] font-semibold text-white">All clear — no duplicate clusters remaining</div>
            <div className="mt-1 text-[13px] text-white/45">{mergedCount} merged this session.</div>
          </div>
        ) : (
          <div className="mt-2 space-y-4">
            {visibleClusters.map((cluster) => {
              const conf = CONFIDENCE_CONFIG[cluster.confidence]
              return (
                <div key={cluster.id} className={`rounded-[22px] border p-5 sm:p-6 ${conf.border} ${conf.bg}`}>

                  {/* Cluster header */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className={`h-2 w-2 rounded-full ${conf.dot}`} />
                      <span className={`text-[12px] font-semibold ${conf.text}`}>{conf.label}</span>
                      <span className="text-white/20">·</span>
                      <div className="flex flex-wrap gap-1.5">
                        {cluster.matchReason.map((r) => (
                          <span key={r} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[12px] text-white/45">{r}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Lead cards */}
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <LeadCard lead={cluster.primary} isPrimary={true} />
                    <div className="flex items-center justify-center">
                      <GitMerge className="h-5 w-5 text-white/20" />
                    </div>
                    <LeadCard lead={cluster.duplicate} isPrimary={false} />
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleMerge(cluster.id, cluster.primary.name)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.08] px-4 py-1.5 text-[12px] font-medium text-[#D4AF37] transition hover:bg-[#D4AF37]/15 active:scale-95"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Merge into primary
                    </button>
                    <button
                      onClick={() => handleDismiss(cluster.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-1.5 text-[12px] font-medium text-white/50 transition hover:bg-white/[0.07] hover:text-white/70 active:scale-95"
                    >
                      Not a duplicate
                    </button>
                    <Link
                      href={`/freehold-intelligence/crm/leads/${cluster.primary.id}`}
                      className="ml-auto inline-flex items-center gap-1 text-[13px] text-[#D4AF37]/60 transition hover:text-[#D4AF37]"
                    >
                      Open primary <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {flash && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#D4AF37]/25 bg-[#131B2B] px-5 py-2.5 text-[13px] font-medium text-[#D4AF37] shadow-xl">
          {flash}
        </div>
      )}

      {/* Resolution guide */}
      <section className="mt-14">
        <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">How it works</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Merge behaviour</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { step: '01', title: 'Primary wins', body: 'The primary record keeps its stage, intent score, assigned agent, and source attribution.' },
            { step: '02', title: 'Timeline merges', body: 'All calls, notes, WhatsApp events, and stage changes from both records are combined into one timeline.' },
            { step: '03', title: 'Duplicate archived', body: 'The duplicate record is marked as merged and removed from active queues. Nothing is deleted.' },
          ].map((item) => (
            <div key={item.step} className="rounded-[18px] border border-white/[0.08] bg-[#131B2B] p-5">
              <div className="text-[13px] font-semibold text-[#D4AF37]/60">{item.step}</div>
              <div className="mt-2 text-[14px] font-semibold text-white">{item.title}</div>
              <p className="mt-1.5 text-[12px] text-white/50">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about duplicate resolution, merge rules…"
          suggestions={[
            'How do I decide which record is the primary?',
            'What happens to the agent assignment after a merge?',
            'Show all leads with duplicate risk flags.',
          ]}
        />
      </section>

    </div>
  )
}
