'use client'

import { useState, useRef, type DragEvent } from 'react'
import Link from 'next/link'
import { MoveHorizontal } from 'lucide-react'
import {
  crmLeads,
  type CRMLeadIntelligence,
  type PipelineStage,
} from '@/src/features/freehold-intelligence/server-session'

// ─── Stage config ──────────────────────────────────────────────────────────────

type StageConfig = { id: PipelineStage; label: string; dot: string; color: string }

const STAGES: StageConfig[] = [
  { id: 'new',         label: 'New',         dot: 'bg-sky-400',     color: 'text-sky-400'     },
  { id: 'contacted',   label: 'Contacted',   dot: 'bg-amber-400',   color: 'text-amber-400'   },
  { id: 'qualified',   label: 'Qualified',   dot: 'bg-violet-400',  color: 'text-violet-400'  },
  { id: 'viewing',     label: 'Viewing',     dot: 'bg-blue-400',    color: 'text-blue-400'    },
  { id: 'negotiation', label: 'Negotiation', dot: 'bg-orange-400',  color: 'text-orange-400'  },
  { id: 'closed',      label: 'Closed',      dot: 'bg-emerald-400', color: 'text-emerald-400' },
  { id: 'lost',        label: 'Lost',        dot: 'bg-red-400/50',  color: 'text-red-400/50'  },
]

// ─── Temperature config ────────────────────────────────────────────────────────

const TEMP_BADGE: Record<string, string> = {
  priority: 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/25',
  hot:      'bg-red-400/10 text-red-400 border-red-400/20',
  warm:     'bg-amber-400/10 text-amber-400 border-amber-400/20',
  cold:     'bg-slate-800/50 text-slate-500 border-slate-700',
}
const TEMP_LABEL: Record<string, string> = {
  priority: '★ Priority',
  hot:      '● Hot',
  warm:     '◎ Warm',
  cold:     '○ Cold',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
}

// ─── State init ───────────────────────────────────────────────────────────────

type StageMap = Record<PipelineStage, CRMLeadIntelligence[]>

function buildMap(): StageMap {
  const m = {} as StageMap
  STAGES.forEach(s => { m[s.id] = [] })
  crmLeads.forEach(l => { m[l.pipelineStage] = [...(m[l.pipelineStage] ?? []), l] })
  return m
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CrmBoardPage() {
  const [stageMap, setStageMap] = useState<StageMap>(buildMap)
  const [draggingId, setDraggingId]   = useState<string | null>(null)
  const [dragOverStage, setDragOver]  = useState<PipelineStage | null>(null)
  const fromStage = useRef<PipelineStage | null>(null)

  function onDragStart(id: string, stage: PipelineStage) {
    setDraggingId(id)
    fromStage.current = stage
  }

  function onDragOver(e: DragEvent, stage: PipelineStage) {
    e.preventDefault()
    setDragOver(stage)
  }

  function onDrop(e: DragEvent, to: PipelineStage) {
    e.preventDefault()
    const from = fromStage.current
    if (!draggingId || !from || from === to) { reset(); return }
    setStageMap(prev => {
      const lead = prev[from].find(l => l.id === draggingId)
      if (!lead) return prev
      return {
        ...prev,
        [from]: prev[from].filter(l => l.id !== draggingId),
        [to]:   [...prev[to], lead],
      }
    })
    reset()
  }

  function reset() {
    setDraggingId(null)
    setDragOver(null)
    fromStage.current = null
  }

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 100px)' }}>

      {/* Board */}
      <div className="flex flex-1 gap-3 overflow-x-auto p-4 lg:p-5">
        {STAGES.map(col => {
          const leads  = stageMap[col.id] ?? []
          const isOver = dragOverStage === col.id
          return (
            <div
              key={col.id}
              onDragOver={e => onDragOver(e, col.id)}
              onDrop={e => onDrop(e, col.id)}
              onDragLeave={() => setDragOver(null)}
              className={[
                'flex w-[238px] flex-shrink-0 flex-col rounded-[16px] border transition-all',
                isOver ? 'border-slate-600 bg-slate-800/50' : 'border-slate-800 bg-slate-800/30',
              ].join(' ')}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3.5 pb-2.5 pt-3.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  <span className={`text-sm font-semibold ${col.color}`}>{col.label}</span>
                </div>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-xs font-medium text-slate-400">
                  {leads.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
                {leads.length === 0 && (
                  <div className="flex flex-1 items-center justify-center py-8">
                    <p className="text-xs text-slate-600">Drop here</p>
                  </div>
                )}
                {leads.map(lead => {
                  const isDragging = draggingId === lead.id
                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => onDragStart(lead.id, col.id)}
                      onDragEnd={reset}
                      className={[
                        'cursor-grab select-none rounded-[12px] border border-slate-800 bg-slate-900 p-3 transition active:cursor-grabbing',
                        isDragging ? 'scale-95 opacity-40' : 'hover:border-slate-700',
                      ].join(' ')}
                    >
                      {/* Avatar + name */}
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-slate-800 text-[10px] font-bold text-slate-400">
                          {initials(lead.name)}
                        </div>
                        <Link
                          href={`/freehold-intelligence/crm/leads/${lead.id}`}
                          onClick={e => e.stopPropagation()}
                          className="line-clamp-1 text-xs font-medium text-slate-200 hover:text-white"
                        >
                          {lead.name}
                        </Link>
                      </div>

                      {/* Temperature badge */}
                      <div className="mt-2">
                        <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${TEMP_BADGE[lead.temperature]}`}>
                          {TEMP_LABEL[lead.temperature]}
                        </span>
                      </div>

                      {/* Budget */}
                      <div className="mt-2 text-xs font-medium text-[#D4AF37]/65">{lead.budgetAED}</div>

                      {/* Project */}
                      <div className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-500">
                        {lead.projectInterest}
                      </div>

                      {/* Footer: agent + intent score */}
                      <div className="mt-2.5 flex items-center justify-between border-t border-slate-800 pt-2">
                        <span className="truncate text-[10px] text-slate-500">{lead.assignedAgent}</span>
                        <span className="ml-1 shrink-0 text-[10px] font-medium tabular-nums text-slate-400">
                          {lead.intentScore}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Drag hint */}
      <div className="flex items-center justify-center gap-1.5 border-t border-slate-800 py-2.5 text-xs text-slate-600">
        <MoveHorizontal className="h-3.5 w-3.5" />
        Drag cards to move leads through the pipeline
      </div>
    </div>
  )
}
