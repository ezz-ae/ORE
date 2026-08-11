'use client'

/**
 * PULL FORMS — bring Meta's instant-form leads into the CRM, on demand.
 *
 * The sweep already existed and was reachable from exactly one place nobody
 * standing in the CRM would think to visit. A lead that Meta holds and the
 * CRM does not is invisible to every screen a broker works in, to the lead
 * ratings that steer delivery, and to the value write-back that teaches Meta
 * who to find next. The button belongs where the leads are read.
 *
 * IT ALSO RUNS ITSELF ON MOUNT, once per session and quietly:
 *
 *  · Meta's real-time webhook is the primary path and this is the safety net
 *    — webhooks are dropped, re-subscribed, and silently unsubscribed by Page
 *    permission changes. A CRM that only sees pushed leads is a CRM that
 *    trusts a channel nobody is watching.
 *  · ONCE PER SESSION, not per navigation: the sweep pages through every
 *    form's history and re-asserts the webhook subscription, so running it on
 *    every CRM click would be minutes of Graph calls for nothing. sessionStorage
 *    is the right scope — a fresh tab means a fresh look, a click between CRM
 *    screens does not.
 *  · Failure is SILENT on the automatic path and LOUD on the pressed one. An
 *    operator who pressed a button is owed an answer; a background refresh
 *    that could not reach Meta must not throw an error banner over a CRM
 *    someone is trying to work in.
 */
import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Check } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

const ONCE_KEY = 'fh_crm_pulled_forms'

export default function PullFormsButton({ onDone }: { onDone?: () => void }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string>('')
  const started = useRef(false)

  async function pull(manual: boolean) {
    if (busy) return
    setBusy(true)
    if (manual) setResult('')
    try {
      const r = await fetch('/api/meta/forms/sync', { method: 'POST' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) {
        // Only the pressed path speaks. See the header.
        if (manual) setResult(d?.error || t('crm.pull.failed'))
        return
      }
      const n = Number(d?.totalSynced) || 0
      if (manual || n > 0) {
        setResult(n > 0 ? t('crm.pull.got', { n }) : t('crm.pull.none'))
      }
      // New leads landed — let the screen reload its list rather than making
      // the operator wonder whether the number is stale.
      if (n > 0) onDone?.()
    } catch {
      if (manual) setResult(t('crm.pull.failed'))
    } finally { setBusy(false) }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    try {
      if (sessionStorage.getItem(ONCE_KEY)) return
      sessionStorage.setItem(ONCE_KEY, '1')
    } catch { /* private mode — then it simply runs each mount */ }
    void pull(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => void pull(true)} disabled={busy}
        title={t('crm.pull.hint')}
        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-gold/40 hover:text-white disabled:opacity-50">
        <RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} />
        {busy ? t('crm.pull.working') : t('crm.pull.button')}
      </button>
      {result && (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          <Check className="h-3 w-3 text-emerald-400" /> {result}
        </span>
      )}
    </div>
  )
}
