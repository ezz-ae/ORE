'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, Radio } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

/**
 * Manual lead sync + real-time health for Meta instant forms. Exists because
 * lead ingestion used to depend entirely on a CRON_SECRET-gated nightly job:
 * with that env var unset, the sweep 401'd forever, the leadgen webhook never
 * got subscribed, and no form lead ever reached the CRM — with zero visible
 * signal. This puts both the trigger and the health signal in the operator's
 * hands.
 */
export function FormsSyncControls() {
  const t = useT()
  const router = useRouter()
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [connected, setConnected] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/meta/forms/sync', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setConnected(d.connected !== false)
        setSubscribed(typeof d.subscribed === 'boolean' ? d.subscribed : null)
      })
      .catch(() => {})
  }, [])

  async function syncNow() {
    setSyncing(true); setResult(null); setError(null)
    try {
      const res = await fetch('/api/meta/forms/sync', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Sync failed')
      setResult(t('lm.forms.sync.result', { n: String(d.totalSynced ?? 0), m: String(d.formsChecked ?? 0) }))
      if (d.resubscribed) setSubscribed(true)
      // Server-rendered counts (forms list, lead totals) refresh with the sync.
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  if (!connected) return null

  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-[18px] border border-line bg-surface-2/40 px-4 py-3">
      <button
        type="button"
        onClick={syncNow}
        disabled={syncing}
        className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/20 disabled:opacity-50"
      >
        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {syncing ? t('lm.forms.sync.syncing') : t('lm.forms.sync.button')}
      </button>

      {subscribed !== null && (
        <span className={`inline-flex items-center gap-1.5 text-xs ${subscribed ? 'text-emerald-400' : 'text-amber-400'}`}>
          <Radio className="h-3.5 w-3.5" />
          {subscribed ? t('lm.forms.sync.realtimeOn') : t('lm.forms.sync.realtimeOff')}
        </span>
      )}

      {result && <span className="text-xs text-slate-300">{result}</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}
