'use client'

import { useState } from 'react'
import {
  Phone, MessageSquare, FileText, ChevronRight,
  Calendar, CheckCircle2, X, AlertCircle, Search,
  ArrowRight, ExternalLink,
} from 'lucide-react'
import {
  agentPipelineLeads, PIPELINE_STAGES,
  type AgentPipelineLead, type PipelineStage,
} from '@/src/features/freehold-intelligence/agent'

function urgencyDot(u: string) {
  if (u === 'critical') return 'bg-red-400'
  if (u === 'high')     return 'bg-[#D4AF37]'
  if (u === 'medium')   return 'bg-sky-400'
  return 'bg-white/25'
}

function urgencyBorder(u: string) {
  if (u === 'critical') return 'border-l-red-400/60'
  if (u === 'high')     return 'border-l-[#D4AF37]/50'
  if (u === 'medium')   return 'border-l-sky-400/40'
  return 'border-l-white/10'
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = diff / 3_600_000
  if (h < 1)   return `${Math.round(h * 60)}m ago`
  if (h < 24)  return `${Math.round(h)}h ago`
  const d = Math.round(h / 24)
  if (d === 1) return 'yesterday'
  return `${d}d ago`
}

function nextStage(stage: PipelineStage): PipelineStage | null {
  const order: PipelineStage[] = ['new', 'contacted', 'qualified', 'viewing', 'offer', 'closed']
  const i = order.indexOf(stage)
  return i >= 0 && i < order.length - 1 ? order[i + 1] : null
}

function stageConfig(id: PipelineStage) {
  return PIPELINE_STAGES.find((s) => s.id === id) ?? PIPELINE_STAGES[0]
}

function LeadCard({
  lead,
  stages,
  onAdvance,
  onSelect,
  compact,
}: {
  lead: AgentPipelineLead
  stages: typeof PIPELINE_STAGES
  onAdvance: (id: string, stage: PipelineStage) => void
  onSelect: (lead: AgentPipelineLead) => void
  compact?: boolean
}) {
  const cfg   = stageConfig(lead.pipelineStage)
  const next  = nextStage(lead.pipelineStage)
  const nextCfg = next ? stageConfig(next) : null

  return (
    <div
      className={`relative overflow-hidden rounded-[18px] border border-l-4 bg-[#131B2B] transition hover:border-t-white/[0.12] ${urgencyBorder(lead.urgency)} border-white/[0.08]`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`h-2 w-2 shrink-0 rounded-full ${urgencyDot(lead.urgency)}`} />
            <button
              onClick={() => onSelect(lead)}
              className="truncate text-[14px] font-semibold text-white hover:text-[#D4AF37] transition-colors text-left"
            >
              {lead.name}
            </button>
          </div>
          <div className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.colorText} ${cfg.border} bg-white/[0.03]`}>
            {lead.intentScore}
          </div>
        </div>

        {/* Property + source */}
        <div className="mt-1.5 text-[12px] text-white/45">{lead.property}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/25">
          <span>{lead.budget}</span>
          <span>·</span>
          <span>{lead.source}</span>
          <span>·</span>
          <span>{timeAgo(lead.lastContact)}</span>
        </div>

        {/* Viewing badge */}
        {lead.hasViewingScheduled && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-orange-400">
            <Calendar className="h-3 w-3" />
            Viewing {new Date(lead.viewingDate!).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}
          </div>
        )}

        {/* Offer amount */}
        {lead.offerAmount && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-[#D4AF37]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#D4AF37]" />
            Offer: AED {lead.offerAmount.toLocaleString()}
          </div>
        )}

        {/* HubSpot badge */}
        {lead.hubspotId && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-orange-400/15 bg-orange-400/[0.07] px-1.5 py-0.5 text-[10px] text-orange-300/70">
            🔶 HS {lead.hubspotId}
          </div>
        )}

        {/* Note */}
        {lead.note && !compact && (
          <p className="mt-2 text-[12px] leading-[1.5] text-white/40 line-clamp-2">{lead.note}</p>
        )}

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          <a
            href={`tel:${lead.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/55 transition hover:border-[#D4AF37]/30 hover:text-[#D4AF37]"
          >
            <Phone className="h-3 w-3" /> Call
          </a>
          <a
            href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/55 transition hover:border-emerald-400/30 hover:text-emerald-400"
          >
            <MessageSquare className="h-3 w-3" /> WhatsApp
          </a>
          <button
            onClick={() => onSelect(lead)}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/55 transition hover:border-sky-400/30 hover:text-sky-400"
          >
            <FileText className="h-3 w-3" /> Note
          </button>

          {next && nextCfg && lead.pipelineStage !== 'closed' && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdvance(lead.id, next) }}
              className={`ml-auto flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-100 ${nextCfg.colorText} ${nextCfg.border} bg-white/[0.03]`}
            >
              → {nextCfg.label}
            </button>
          )}
          {lead.pipelineStage === 'closed' && (
            <div className="ml-auto flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Closed
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailPanel({
  lead,
  onClose,
  onAdvance,
}: {
  lead: AgentPipelineLead
  onClose: () => void
  onAdvance: (id: string, stage: PipelineStage) => void
}) {
  const [note, setNote] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const cfg  = stageConfig(lead.pipelineStage)
  const next = nextStage(lead.pipelineStage)
  const nextCfg = next ? stageConfig(next) : null

  function saveNote() {
    if (!note.trim()) return
    setNoteSaved(true)
    setNote('')
    setTimeout(() => setNoteSaved(false), 3000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-h-[90vh] overflow-y-auto rounded-t-[28px] border border-white/[0.08] bg-[#0D1422] sm:m-4 sm:max-h-[85vh] sm:w-[420px] sm:rounded-[28px]">
        {/* Panel header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-white/[0.06] bg-[#0D1422]/95 px-5 py-4 backdrop-blur">
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${urgencyDot(lead.urgency)}`} />
              <span className="text-[14px] font-semibold text-white">{lead.name}</span>
            </div>
            <div className={`mt-0.5 text-[12px] font-medium ${cfg.colorText}`}>{cfg.label}</div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Contact */}
          <div className="grid grid-cols-2 gap-2">
            <a href={`tel:${lead.phone}`} className="flex items-center gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] font-medium text-white/65 transition hover:border-[#D4AF37]/30 hover:text-[#D4AF37]">
              <Phone className="h-3.5 w-3.5" /> {lead.phone}
            </a>
            <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[12px] font-medium text-white/65 transition hover:border-emerald-400/30 hover:text-emerald-400">
              <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
            </a>
          </div>

          {/* Details */}
          <div className="rounded-[16px] border border-white/[0.06] bg-white/[0.02] p-4 space-y-2.5">
            {[
              { label: 'Property', value: lead.property },
              { label: 'Budget',   value: lead.budget   },
              { label: 'Source',   value: lead.source   },
              { label: 'Intent',   value: `${lead.intentScore}/100` },
              { label: 'Last contact', value: timeAgo(lead.lastContact) },
              ...(lead.hubspotId ? [{ label: 'HubSpot ID', value: lead.hubspotId }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between gap-3">
                <span className="text-[12px] text-white/30 shrink-0">{label}</span>
                <span className="text-[12px] text-white/70 text-right">{value}</span>
              </div>
            ))}
          </div>

          {/* Current note */}
          {lead.note && (
            <div className="rounded-[16px] border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-[11px] uppercase tracking-[0.15em] text-white/25 mb-2">Latest note</div>
              <p className="text-[13px] text-white/65 leading-[1.55]">{lead.note}</p>
            </div>
          )}

          {/* Viewing / Offer */}
          {lead.hasViewingScheduled && (
            <div className="flex items-center gap-3 rounded-[14px] border border-orange-400/20 bg-orange-400/[0.06] px-4 py-3">
              <Calendar className="h-4 w-4 text-orange-400 shrink-0" />
              <div>
                <div className="text-[13px] font-medium text-orange-300">Viewing scheduled</div>
                <div className="text-[12px] text-white/40">{new Date(lead.viewingDate!).toLocaleDateString('en-AE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              </div>
            </div>
          )}
          {lead.offerAmount && (
            <div className="flex items-center gap-3 rounded-[14px] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-4 py-3">
              <span className="text-[16px]">🔥</span>
              <div>
                <div className="text-[13px] font-medium text-[#F8E7AE]">Active offer</div>
                <div className="text-[12px] text-white/40">AED {lead.offerAmount.toLocaleString()} · Counter pending</div>
              </div>
            </div>
          )}

          {/* Add note */}
          <div>
            <div className="text-[11px] uppercase tracking-[0.15em] text-white/25 mb-2">Add note</div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Quick note about this lead…"
              rows={3}
              className="w-full resize-none rounded-[14px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[13px] text-white/80 placeholder-white/20 outline-none focus:border-[#D4AF37]/30 transition"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={saveNote}
                className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-1.5 text-[12px] font-semibold text-[#D4AF37] transition hover:bg-[#D4AF37]/15"
              >
                Save note → HubSpot
              </button>
              {noteSaved && <span className="text-[12px] text-emerald-400">✓ Saved</span>}
            </div>
          </div>

          {/* Stage advance */}
          {next && nextCfg && lead.pipelineStage !== 'closed' && (
            <button
              onClick={() => { onAdvance(lead.id, next); onClose() }}
              className={`w-full flex items-center justify-center gap-2 rounded-[14px] border px-4 py-3 text-[13px] font-semibold transition hover:opacity-90 ${nextCfg.colorText} ${nextCfg.border} bg-white/[0.04]`}
            >
              <ArrowRight className="h-4 w-4" />
              Move to {nextCfg.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AgentLeadsPage() {
  const [leads, setLeads]             = useState<AgentPipelineLead[]>(agentPipelineLeads)
  const [activeStage, setActiveStage] = useState<PipelineStage | 'all'>('all')
  const [selected, setSelected]       = useState<AgentPipelineLead | null>(null)
  const [search, setSearch]           = useState('')

  function advance(id: string, stage: PipelineStage) {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, pipelineStage: stage } : l))
  }

  const activePipeline = PIPELINE_STAGES.filter((s) => s.id !== 'closed')
  const q = search.trim().toLowerCase()

  const filtered = leads.filter((l) => {
    if (activeStage !== 'all' && l.pipelineStage !== activeStage) return false
    if (q) return l.name.toLowerCase().includes(q) || l.property.toLowerCase().includes(q) || l.source.toLowerCase().includes(q)
    return true
  })

  const criticals = leads.filter((l) => l.urgency === 'critical' && l.pipelineStage !== 'closed').length
  const offerCount = leads.filter((l) => l.pipelineStage === 'offer').length

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight text-white/90">My Leads</h1>
          <p className="mt-1 text-[13px] text-white/40">
            {leads.filter(l => l.pipelineStage !== 'closed').length} active ·{' '}
            {criticals > 0 && <span className="text-red-400">{criticals} critical · </span>}
            {offerCount > 0 && <span className="text-[#D4AF37]">{offerCount} in offer · </span>}
            {leads.filter(l => l.pipelineStage === 'closed').length} closed
          </p>
        </section>
        <div className="flex h-9 items-center gap-2 rounded-[12px] border border-white/[0.08] bg-white/[0.03] px-3">
          <Search className="h-3.5 w-3.5 text-white/30" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
            className="w-40 bg-transparent text-[13px] text-white/80 placeholder-white/25 outline-none"
          />
        </div>
      </div>

      {/* ─── Mobile: stage pills + filtered list ─── */}
      <div className="mt-6 lg:hidden">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {[{ id: 'all' as const, label: 'All', colorText: 'text-white/60', colorBg: 'bg-white/30', border: 'border-white/10' }, ...PIPELINE_STAGES].map((s) => {
            const count = s.id === 'all' ? leads.length : leads.filter(l => l.pipelineStage === s.id).length
            const active = activeStage === s.id
            return (
              <button
                key={s.id}
                onClick={() => setActiveStage(s.id)}
                className={[
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition whitespace-nowrap',
                  active
                    ? `${s.colorText} ${s.border} bg-white/[0.06]`
                    : 'border-white/[0.08] text-white/35 hover:text-white/55',
                ].join(' ')}
              >
                {s.label}
                {count > 0 && <span className={`rounded-full px-1 text-[10px] font-bold ${active ? s.colorText : 'text-white/30'}`}>{count}</span>}
              </button>
            )
          })}
        </div>
        <div className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-white/30">No leads in this stage.</div>
          ) : (
            filtered.map((lead) => (
              <LeadCard key={lead.id} lead={lead} stages={PIPELINE_STAGES} onAdvance={advance} onSelect={setSelected} />
            ))
          )}
        </div>
      </div>

      {/* ─── Desktop: Kanban ─── */}
      <div className="mt-6 hidden lg:block">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageLeads = leads.filter((l) => l.pipelineStage === stage.id)
            return (
              <div key={stage.id} className="w-[240px] shrink-0">
                {/* Column header */}
                <div className={`mb-3 flex items-center justify-between rounded-[12px] border px-3 py-2 ${stage.border} bg-white/[0.02]`}>
                  <span className={`text-[12px] font-semibold ${stage.colorText}`}>{stage.label}</span>
                  <span className={`rounded-full px-1.5 text-[11px] font-bold ${stage.colorText}`}>{stageLeads.length}</span>
                </div>
                {/* Lead cards */}
                <div className="space-y-2.5">
                  {stageLeads.length === 0 && (
                    <div className="flex items-center justify-center rounded-[14px] border border-dashed border-white/[0.06] py-6 text-[12px] text-white/20">
                      Empty
                    </div>
                  )}
                  {stageLeads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} stages={PIPELINE_STAGES} onAdvance={advance} onSelect={setSelected} compact />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          lead={leads.find((l) => l.id === selected.id) ?? selected}
          onClose={() => setSelected(null)}
          onAdvance={advance}
        />
      )}
    </div>
  )
}
