'use client'

import Link from 'next/link'
import { useState, useRef, DragEvent } from 'react'
import { Users, Plus, Phone, MessageCircle, MoveHorizontal } from 'lucide-react'

type LeadSource = 'Meta' | 'Google' | 'WhatsApp'
type ColumnId = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won-lost'

interface Lead {
  id: string
  name: string
  propertyInterest: string
  source: LeadSource
  timeAgo: string
  budget: string
  note?: string
}

interface Column {
  id: ColumnId
  label: string
  dotColor: string
  headerColor: string
  leads: Lead[]
}

const initialColumns: Column[] = [
  {
    id: 'new',
    label: 'New Lead',
    dotColor: 'bg-sky-400',
    headerColor: 'text-white/55',
    leads: [
      { id: 'l1', name: 'Ahmed Al Rashid',  propertyInterest: 'Palm Jumeirah',  source: 'Meta',      timeAgo: '1h ago',  budget: 'AED 3–5M' },
      { id: 'l2', name: 'Sarah Johnson',    propertyInterest: 'Dubai Hills',    source: 'Google',    timeAgo: '3h ago',  budget: 'AED 1.5–2.5M' },
      { id: 'l3', name: 'Mohammed Al Farsi', propertyInterest: 'JVC',           source: 'WhatsApp',  timeAgo: '5h ago',  budget: 'AED 700K–1M' },
    ],
  },
  {
    id: 'contacted',
    label: 'Contacted',
    dotColor: 'bg-amber-400',
    headerColor: 'text-amber-400',
    leads: [
      { id: 'l4', name: 'David Chen',       propertyInterest: 'Sobha Hartland', source: 'Meta',      timeAgo: '1d ago',  budget: 'AED 5–8M' },
      { id: 'l5', name: 'Priya Sharma',     propertyInterest: 'Creek Harbour',  source: 'Google',    timeAgo: '2d ago',  budget: 'AED 1.2–2M' },
      { id: 'l6', name: 'Omar Hassan',      propertyInterest: 'Business Bay',   source: 'Meta',      timeAgo: '3d ago',  budget: 'AED 900K–1.5M' },
    ],
  },
  {
    id: 'qualified',
    label: 'Qualified',
    dotColor: 'bg-violet-400',
    headerColor: 'text-white/55',
    leads: [
      { id: 'l7', name: 'Elena Petrova',    propertyInterest: 'Marina Luxury',  source: 'Meta',      timeAgo: '4d ago',  budget: 'AED 5–10M' },
      { id: 'l8', name: 'James Wilson',     propertyInterest: 'Dubai Hills',    source: 'Google',    timeAgo: '5d ago',  budget: 'AED 2–3M' },
    ],
  },
  {
    id: 'proposal',
    label: 'Proposal Sent',
    dotColor: 'bg-orange-400',
    headerColor: 'text-orange-400',
    leads: [
      { id: 'l9',  name: 'Fatima Al Zaabi', propertyInterest: 'Palm Jumeirah',  source: 'WhatsApp',  timeAgo: '6d ago',  budget: 'AED 4–6M' },
      { id: 'l10', name: 'Ali Khalid',      propertyInterest: 'JVC',            source: 'Meta',      timeAgo: '7d ago',  budget: 'AED 800K–1.2M' },
    ],
  },
  {
    id: 'won-lost',
    label: 'Won / Lost',
    dotColor: 'bg-[#D4AF37]',
    headerColor: 'text-[#D4AF37]',
    leads: [
      { id: 'l11', name: 'Carlos Mendez',   propertyInterest: 'Sobha Hartland', source: 'Google',    timeAgo: '10d ago', budget: 'AED 6M',  note: 'WON' },
      { id: 'l12', name: 'Noor Al Saeed',   propertyInterest: 'Dubai Hills',    source: 'Meta',      timeAgo: '12d ago', budget: 'AED 2M',  note: 'LOST' },
    ],
  },
]

function sourceBadge(source: LeadSource) {
  if (source === 'Meta')      return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
  if (source === 'Google')    return 'text-white/55 bg-sky-500/10 border-sky-500/20'
  return 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20'
}

function sourceIcon(source: LeadSource) {
  if (source === 'WhatsApp') return <MessageCircle className="h-3 w-3" />
  if (source === 'Google')   return <Phone className="h-3 w-3" />
  return null
}

export default function CrmBoardPage() {
  const [columns, setColumns] = useState<Column[]>(initialColumns)
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [dragOverColumnId, setDragOverColumnId] = useState<ColumnId | null>(null)
  const dragSourceColumnId = useRef<ColumnId | null>(null)

  function handleDragStart(cardId: string, fromColumnId: ColumnId) {
    setDraggingCardId(cardId)
    dragSourceColumnId.current = fromColumnId
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, colId: ColumnId) {
    e.preventDefault()
    setDragOverColumnId(colId)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, toColumnId: ColumnId) {
    e.preventDefault()
    const fromColumnId = dragSourceColumnId.current
    if (!draggingCardId || !fromColumnId || fromColumnId === toColumnId) {
      setDraggingCardId(null)
      setDragOverColumnId(null)
      dragSourceColumnId.current = null
      return
    }

    setColumns((prev: Column[]) => {
      const fromCol = prev.find((c: Column) => c.id === fromColumnId)
      const card = fromCol?.leads.find((l: Lead) => l.id === draggingCardId)
      if (!card) return prev
      return prev.map((col: Column) => {
        if (col.id === fromColumnId) {
          return { ...col, leads: col.leads.filter((l: Lead) => l.id !== draggingCardId) }
        }
        if (col.id === toColumnId) {
          return { ...col, leads: [...col.leads, card] }
        }
        return col
      })
    })

    setDraggingCardId(null)
    setDragOverColumnId(null)
    dragSourceColumnId.current = null
  }

  function handleDragEnd() {
    setDraggingCardId(null)
    setDragOverColumnId(null)
    dragSourceColumnId.current = null
  }

  return (
    <div className="flex h-full min-h-screen flex-col bg-[#111318]">

      {/* Page header */}
      <div className="border-b border-white/[0.05] px-6 py-5 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/80">
              <Users className="h-3.5 w-3.5" />
              CRM · Kanban Board
            </div>
            <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-white/90">Lead Pipeline</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <MoveHorizontal className="h-3.5 w-3.5" />
              Drag cards to move leads
            </div>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex flex-1 gap-4 overflow-x-auto p-6 lg:p-8">
        {columns.map((col: Column) => {
          const isDragOver = dragOverColumnId === col.id
          return (
            <div
              key={col.id}
              onDragOver={(e: DragEvent<HTMLDivElement>) => handleDragOver(e, col.id)}
              onDrop={(e: DragEvent<HTMLDivElement>) => handleDrop(e, col.id)}
              className={`flex w-72 flex-shrink-0 flex-col rounded-2xl border transition-all duration-150 ${
                isDragOver
                  ? 'border-white/20 bg-white/[0.05]'
                  : 'border-white/[0.05] bg-white/[0.02]'
              }`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                  <span className={`text-sm font-semibold ${col.headerColor}`}>{col.label}</span>
                </div>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.06] text-[13px] font-medium text-white/50">
                  {col.leads.length}
                </span>
              </div>

              {/* Add Lead button — only on New Lead column */}
              {col.id === 'new' && (
                <div className="px-3 pb-2">
                  <button className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.10] py-2 text-xs font-medium text-white/30 transition hover:border-white/20 hover:text-white/60">
                    <Plus className="h-3.5 w-3.5" />
                    Add Lead
                  </button>
                </div>
              )}

              {/* Cards */}
              <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3 pt-1">
                {col.leads.length === 0 && (
                  <div className="flex flex-1 items-center justify-center py-8">
                    <p className="text-xs text-white/20">Drop leads here</p>
                  </div>
                )}
                {col.leads.map((lead: Lead) => {
                  const isDragging = draggingCardId === lead.id
                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => handleDragStart(lead.id, col.id)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-grab select-none rounded-xl border border-white/[0.08] bg-white/[0.04] p-3.5 transition active:cursor-grabbing ${
                        isDragging ? 'opacity-50 scale-95' : 'hover:border-white/10 hover:bg-white/[0.06]'
                      }`}
                    >
                      {/* Name + note */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug text-white/90">{lead.name}</p>
                        {lead.note && (
                          <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[12px] font-bold ${
                            lead.note === 'WON'
                              ? 'bg-[#D4AF37]/20 text-[#D4AF37]'
                              : 'bg-rose-500/20 text-white/55'
                          }`}>
                            {lead.note}
                          </span>
                        )}
                      </div>

                      {/* Property interest */}
                      <p className="mt-1 text-xs text-white/50">{lead.propertyInterest}</p>

                      {/* Budget */}
                      <p className="mt-1.5 text-xs font-medium text-[#D4AF37]/80">{lead.budget}</p>

                      {/* Footer */}
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium ${sourceBadge(lead.source)}`}>
                          {sourceIcon(lead.source)}
                          {lead.source}
                        </span>
                        <span className="text-[12px] text-white/30">{lead.timeAgo}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
