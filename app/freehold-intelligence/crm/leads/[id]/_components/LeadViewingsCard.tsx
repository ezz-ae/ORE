'use client'

import { useState } from 'react'
import { formatInstant } from '@/lib/freehold/clock'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarPlus, Home, HandCoins, CheckCircle, XCircle, Clock, X } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

// Serialized subset of lib/calendar's LeadViewing — passed from the server page.
export interface ViewingItem {
  id: string
  startsAt: string
  status: string
  outcome: '' | 'held' | 'no_show'
  note: string
  location: string
}

interface Props {
  leadId: string
  leadName: string
  brokerId: string
  projectSlug: string
  dateLocale: string
  viewings: ViewingItem[]
}

/**
 * Viewings as first-class objects on the lead: book one (calendar event of
 * kind 'viewing' + 'viewing_scheduled' activity, both written server-side in
 * one request), record the honest outcome once the time has passed
 * (held / no-show), and log an offer. No new pipeline stage.
 */
export function LeadViewingsCard({ leadId, leadName, brokerId, projectSlug, dateLocale, viewings }: Props) {
  const t = useT()
  const router = useRouter()
  const [mode, setMode] = useState<null | 'book' | 'offer'>(null)
  const [busy, setBusy] = useState(false)

  // Book form
  const [when, setWhen] = useState('')
  const [note, setNote] = useState('')

  // Offer form
  const [amount, setAmount] = useState('')
  const [offerNote, setOfferNote] = useState('')

  async function bookViewing() {
    if (!when) { toast.error(t('crm.viewings.pickTime')); return }
    const start = new Date(when)
    if (Number.isNaN(start.getTime())) { toast.error(t('crm.viewings.pickTime')); return }
    setBusy(true)
    try {
      const res = await fetch('/api/freehold/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'viewing',
          title: `${t('crm.viewings.eventTitle')} — ${leadName}`,
          startsAt: start.toISOString(),
          endsAt: new Date(start.getTime() + 60 * 60 * 1000).toISOString(),
          description: note.trim(),
          leadId,
          brokerId,
          projectSlug,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('crm.viewings.booked'))
      setMode(null); setWhen(''); setNote('')
      router.refresh()
    } catch {
      toast.error(t('crm.viewings.bookFailed'))
    } finally { setBusy(false) }
  }

  async function recordOutcome(id: string, outcome: 'held' | 'no_show') {
    setBusy(true)
    try {
      const res = await fetch(`/api/freehold/calendar/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'outcome', outcome }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('crm.viewings.outcomeSaved'))
      router.refresh()
    } catch {
      toast.error(t('crm.viewings.outcomeFailed'))
    } finally { setBusy(false) }
  }

  async function logOffer() {
    const num = Number(amount.replace(/[^0-9.]/g, ''))
    // The amount is optional and only stored when actually entered — the
    // description records exactly what was provided, nothing invented.
    const parts = [
      Number.isFinite(num) && num > 0 ? `Offer made — AED ${num.toLocaleString('en-US')}` : 'Offer made',
      offerNote.trim(),
    ].filter(Boolean)
    setBusy(true)
    try {
      const res = await fetch('/api/freehold/crm/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, activityType: 'offer_made', description: parts.join(' · ') }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('crm.offer.logged'))
      setMode(null); setAmount(''); setOfferNote('')
      router.refresh()
    } catch {
      toast.error(t('crm.offer.failed'))
    } finally { setBusy(false) }
  }

  const input = 'w-full rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-gold/40'
  const fmt = (iso: string) => formatInstant(iso, dateLocale, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t('crm.viewings.title')}</p>

      {/* Existing viewings — real events only; honest empty state */}
      {viewings.length > 0 ? (
        <div className="mb-4 space-y-2">
          {viewings.map((v) => {
            const past = new Date(v.startsAt).getTime() <= Date.now()
            return (
              <div key={v.id} className="rounded-[10px] border border-line bg-surface-2/50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-slate-300">
                    <Home className="h-3 w-3 shrink-0 text-teal-300" /> {fmt(v.startsAt)}
                  </span>
                  {v.outcome === 'held' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                      <CheckCircle className="h-2.5 w-2.5" /> {t('crm.viewings.held')}
                    </span>
                  ) : v.outcome === 'no_show' ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-red-400/25 bg-red-400/10 px-2 py-0.5 text-[10px] font-medium text-red-300">
                      <XCircle className="h-2.5 w-2.5" /> {t('crm.viewings.noShow')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface px-2 py-0.5 text-[10px] font-medium text-slate-400">
                      <Clock className="h-2.5 w-2.5" /> {t('crm.viewings.scheduled')}
                    </span>
                  )}
                </div>
                {v.note && <p className="mt-1 text-xs text-slate-500">{v.note}</p>}
                {/* Time has passed and no outcome recorded → one-click truth */}
                {past && v.outcome === '' && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-slate-500">{t('crm.viewings.awaitingOutcome')}</span>
                    <button disabled={busy} onClick={() => recordOutcome(v.id, 'held')}
                      className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.06] px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-400/15 disabled:opacity-50">
                      {t('crm.viewings.held')}
                    </button>
                    <button disabled={busy} onClick={() => recordOutcome(v.id, 'no_show')}
                      className="rounded-full border border-red-400/25 bg-red-400/[0.06] px-2.5 py-1 text-[11px] font-medium text-red-300 transition hover:bg-red-400/15 disabled:opacity-50">
                      {t('crm.viewings.noShow')}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="mb-4 text-xs text-slate-500">{t('crm.viewings.empty')}</p>
      )}

      {/* Book viewing */}
      {mode === 'book' ? (
        <div className="space-y-2 rounded-[10px] border border-line bg-surface-2/40 p-3">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={input} />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('crm.viewings.note')} className={input} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={bookViewing}
              className="flex-1 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1.5 text-xs font-medium text-teal-200 transition hover:bg-teal-400/20 disabled:opacity-50">
              {t('crm.viewings.confirm')}
            </button>
            <button onClick={() => setMode(null)} className="rounded-full border border-line px-3 py-1.5 text-xs text-slate-400 transition hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : mode === 'offer' ? (
        <div className="space-y-2 rounded-[10px] border border-line bg-surface-2/40 p-3">
          <input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('crm.offer.amount')} className={input} />
          <input value={offerNote} onChange={(e) => setOfferNote(e.target.value)} placeholder={t('crm.offer.note')} className={input} />
          <div className="flex gap-2">
            <button disabled={busy} onClick={logOffer}
              className="flex-1 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold transition hover:bg-gold/20 disabled:opacity-50">
              {t('crm.offer.log')}
            </button>
            <button onClick={() => setMode(null)} className="rounded-full border border-line px-3 py-1.5 text-xs text-slate-400 transition hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button onClick={() => setMode('book')}
            className="flex w-full items-center gap-2.5 rounded-[12px] border border-teal-400/25 bg-teal-400/[0.06] px-4 py-2.5 text-sm font-medium text-teal-200 transition hover:bg-teal-400/15">
            <CalendarPlus className="h-3.5 w-3.5" />
            {t('crm.viewings.book')}
          </button>
          <button onClick={() => setMode('offer')}
            className="flex w-full items-center gap-2.5 rounded-[12px] border border-gold/25 bg-gold/[0.06] px-4 py-2.5 text-sm font-medium text-gold transition hover:bg-gold/15">
            <HandCoins className="h-3.5 w-3.5" />
            {t('crm.offer.button')}
          </button>
        </div>
      )}
    </div>
  )
}
