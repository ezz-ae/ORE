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
  const [failed, setFailed] = useState<string[]>([])
  const [skipped, setSkipped] = useState(0)
  const [pageCoverage, setPageCoverage] = useState<{ on: number; total: number; names: string[] } | null>(null)

  useEffect(() => {
    fetch('/api/meta/forms/sync', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setConnected(d.connected !== false)
        setSubscribed(typeof d.subscribed === 'boolean' ? d.subscribed : null)
        // Which Pages are NOT pushing. "Real-time off" alone doesn't say
        // whether that's all Pages or one of four — and only the second case
        // tells you where to go fix it.
        setPageCoverage(
          typeof d.totalPages === 'number' && d.totalPages > 0
            ? { on: Number(d.subscribedPages) || 0, total: d.totalPages,
                names: (Array.isArray(d.unsubscribed) ? d.unsubscribed : [])
                  .map((p: { pageId: string; pageName: string | null }) => p.pageName || p.pageId) }
            : null,
        )
      })
      .catch(() => {})
  }, [])

  async function syncNow() {
    setSyncing(true); setResult(null); setError(null); setFailed([]); setSkipped(0)
    try {
      const res = await fetch('/api/meta/forms/sync', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error || 'Sync failed')
      setResult(t('lm.forms.sync.result', { n: String(d.totalSynced ?? 0), m: String(d.formsChecked ?? 0) }))
      // THE FIX: the sweep has always reported a per-form error list, and this
      // UI has always thrown it away — so a run where EVERY form failed (an
      // access token without leads_retrieval, say) rendered as "synced 0 leads
      // from 12 forms", which reads as success with nothing to do. Zero synced
      // and zero errors is a real, different state from zero synced because
      // nothing could be read, and the operator has to be able to tell them
      // apart. Same for leads dropped for having no phone or email.
      const failures = (Array.isArray(d.perForm) ? d.perForm : [])
        .filter((f: { error?: string }) => f.error)
        .map((f: { formName?: string; formId: string; error?: string }) => `${f.formName || f.formId}: ${f.error}`)
      setFailed(failures)
      setSkipped(Number(d.totalSkipped) || 0)
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
          {/* Partial coverage is the dangerous middle state: some Pages push,
              some don't, and the forms on the silent ones look identical. */}
          {pageCoverage && pageCoverage.total > 1 && (
            <span className="text-slate-500">
              ({t('lm.forms.sync.pageCoverage', { on: String(pageCoverage.on), total: String(pageCoverage.total) })})
            </span>
          )}
        </span>
      )}

      {pageCoverage && pageCoverage.names.length > 0 && (
        <div className="w-full rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2">
          <p className="text-[11px] leading-relaxed text-amber-200">
            {t('lm.forms.sync.pagesNotPushing', { pages: pageCoverage.names.join(', ') })}
          </p>
        </div>
      )}

      {result && <span className="text-xs text-slate-300">{result}</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}

      {/* Per-form failures — the reason a sweep can report "0 synced" and be
          reporting a total outage rather than an empty inbox. */}
      {failed.length > 0 && (
        <div className="w-full rounded-lg border border-red-400/30 bg-red-400/[0.07] px-3 py-2">
          <p className="text-xs font-semibold text-red-200">
            {t('lm.forms.sync.failedTitle', { n: String(failed.length) })}
          </p>
          <ul className="mt-1 space-y-0.5">
            {failed.map((f) => (
              <li key={f} className="text-[11px] leading-relaxed text-red-200/90">• {f}</li>
            ))}
          </ul>
        </div>
      )}

      {skipped > 0 && (
        <div className="w-full rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2">
          <p className="text-[11px] leading-relaxed text-amber-200">
            {t('lm.forms.sync.skipped', { n: String(skipped) })}
          </p>
        </div>
      )}
    </div>
  )
}
