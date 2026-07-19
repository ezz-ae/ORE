'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

/**
 * Recompute button for the Opportunity panel. POSTs to the role-gated
 * opportunity API (management/marketing — the server page only renders this
 * for those roles) and refreshes the server component so the new computed_at
 * and scores come straight from the table.
 */
export function OpportunityRefreshButton() {
  const t = useT()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/freehold/opportunity', { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error((body && typeof body.error === 'string' && body.error) || `HTTP ${res.status}`)
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={refresh}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 bg-gold/[0.06] px-3 py-1 text-xs font-medium text-gold/80 transition hover:border-gold/40 hover:text-gold disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        {busy ? t('inv.opp.refreshing') : t('inv.opp.refresh')}
      </button>
      {error && <span className="text-xs text-rose-300">{error}</span>}
    </span>
  )
}
