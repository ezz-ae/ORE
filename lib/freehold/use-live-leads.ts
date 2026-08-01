'use client'
import { useState, useEffect, useRef } from 'react'
import type { CRMLeadIntelligence } from '@/src/features/freehold-intelligence/server-session'

export type { CRMLeadIntelligence }

// Operational system: leads come only from the database. Initial state is empty
// (no seed/mock) — the UI shows a clean empty state until real leads load.
export function useLiveLeads(): {
  leads: CRMLeadIntelligence[]
  source: 'db' | 'empty'
  loading: boolean
  /** New leads with no owner. Auto-distribution only runs in 'auto' mode, so
   *  otherwise a lead that arrives from a Meta form or a landing page belongs
   *  to nobody: invisible to every broker (they are filtered to their own
   *  leads) and just another row to management. Zero for broker sessions. */
  unassigned: number
} {
  const [leads, setLeads] = useState<CRMLeadIntelligence[]>([])
  const [source, setSource] = useState<'db' | 'empty'>('empty')
  const [loading, setLoading] = useState(true)
  const [unassigned, setUnassigned] = useState(0)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    fetch('/api/freehold/crm/leads')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d?.leads)) {
          setLeads(d.leads)
          setSource(d.leads.length > 0 ? 'db' : 'empty')
        }
        if (typeof d?.unassigned === 'number') setUnassigned(d.unassigned)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { leads, source, loading, unassigned }
}
