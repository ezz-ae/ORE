'use client'
import { useState, useEffect, useRef } from 'react'
import { crmLeads } from '@/src/features/freehold-intelligence/server-session'
import type { CRMLeadIntelligence } from '@/src/features/freehold-intelligence/server-session'

export type { CRMLeadIntelligence }

export function useLiveLeads(): { leads: CRMLeadIntelligence[]; source: 'mock' | 'db'; loading: boolean } {
  const [leads, setLeads] = useState<CRMLeadIntelligence[]>(crmLeads)
  const [source, setSource] = useState<'mock' | 'db'>('mock')
  const [loading, setLoading] = useState(true)
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    fetch('/api/freehold/crm/leads')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.leads?.length > 0) {
          setLeads(d.leads)
          setSource(d.source ?? 'db')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { leads, source, loading }
}
