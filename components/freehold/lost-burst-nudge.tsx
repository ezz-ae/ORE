'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Clock, X } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { useLostBurst, clearLostBurst } from '@/lib/freehold/lost-burst'

const DRIP_DAYS = 60

/**
 * Non-blocking nudge shown when an agent marks several leads lost in quick
 * succession. Offers a one-click "drip them into a 60-day nurture instead"
 * macro: each lead is moved back to `contacted` and snoozed 60 days, so it
 * resurfaces in the follow-up queue rather than being written off. Dismissible
 * and never modal — it floats above the board and blocks nothing.
 *
 * `onDripped` lets the host surface reconcile its optimistic state (e.g. move
 * the cards out of the Lost column) without waiting for a refetch.
 */
export function LostBurstNudge({ onDripped }: { onDripped?: (ids: string[]) => void }) {
  const t = useT()
  const { marks, active } = useLostBurst()
  const [busy, setBusy] = useState(false)
  if (!active) return null

  async function drip() {
    setBusy(true)
    const until = new Date(Date.now() + DRIP_DAYS * 86_400_000).toISOString()
    const nowIso = new Date().toISOString()
    const ids: string[] = []
    await Promise.all(
      marks.map(async (m) => {
        try {
          const res = await fetch(`/api/freehold/crm/leads/${m.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'contacted', snooze_until: until, last_contact_at: nowIso }),
          })
          if (res.ok) ids.push(m.id)
        } catch {
          /* skip this one — partial success is fine */
        }
      }),
    )
    setBusy(false)
    clearLostBurst()
    if (ids.length) {
      toast.success(t('crm.lostBurst.dripped', { count: ids.length, days: DRIP_DAYS }))
      onDripped?.(ids)
    } else {
      toast.error(t('crm.updateFailed'))
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex w-full max-w-xl items-center gap-3 rounded-xl border border-amber-400/30 bg-surface/95 px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/12 text-amber-300">
          <Clock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-100">{t('crm.lostBurst.title', { count: marks.length })}</p>
          <p className="text-xs text-slate-400">{t('crm.lostBurst.body', { days: DRIP_DAYS })}</p>
        </div>
        <button
          onClick={drip}
          disabled={busy}
          className="shrink-0 rounded-lg bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/25 disabled:opacity-50"
        >
          {busy ? t('crm.lostBurst.dripping') : t('crm.lostBurst.cta', { days: DRIP_DAYS })}
        </button>
        <button
          onClick={() => clearLostBurst()}
          aria-label={t('crm.lostBurst.dismiss')}
          className="shrink-0 rounded-md p-1 text-slate-500 transition hover:text-slate-300"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
