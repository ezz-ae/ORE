'use client'
import { useState, useEffect, useRef } from 'react'
import type { CRMLeadIntelligence } from '@/src/features/freehold-intelligence/server-session'

export type { CRMLeadIntelligence }

// Operational system: leads come only from the database. Initial state is empty
// (no seed/mock) — the UI shows a clean empty state until real leads load.
export function useLiveLeads(): { leads: CRMLeadIntelligence[]; source: 'db' | 'empty'; loading: boolean } {
  const [leads, setLeads] = useState<CRMLeadIntelligence[]>([])
  const [source, setSource] = useState<'db' | 'empty'>('empty')
  const [loading, setLoading] = useState(true)
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
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { leads, source, loading }
}
