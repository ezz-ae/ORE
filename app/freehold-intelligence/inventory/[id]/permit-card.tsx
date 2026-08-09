'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck, AlertTriangle, AlertCircle } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { permitState, qrApiPath, permitVerificationUrl, type PermitState } from '@/lib/freehold/trakheesi'

/**
 * THE PERMIT, ON THE PROPERTY.
 *
 * A Trakheesi permit could only ever arrive with ingested project data. The
 * number typed at launch review is stored on the campaign plan, so a manually
 * added listing had no permit anywhere — and both the ad set's end_time and
 * the Ads Machine's compliance gate read the PROPERTY. Both read null, so the
 * permit stop had nothing to stop on.
 *
 * The state shown here is computed by the same `permitState` the launch gate
 * and the alert strip use. One classification: the screen cannot say "fine"
 * about something the machine will refuse.
 */
export function PermitCard({
  slug, permitNumber, permitExpiry, canEdit,
}: {
  slug: string
  permitNumber: string | null
  permitExpiry: string | null
  canEdit: boolean
}) {
  const t = useT()
  const [num, setNum] = useState(permitNumber ?? '')
  const [exp, setExp] = useState(permitExpiry ?? '')
  const [saved, setSaved] = useState<{ number: string | null; expiry: string | null }>({
    number: permitNumber, expiry: permitExpiry,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const state: PermitState = permitState(saved.number, saved.expiry)
  const TONE: Record<PermitState, string> = {
    ok:        'border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200',
    expiring:  'border-amber-400/25 bg-amber-400/[0.06] text-amber-100',
    expired:   'border-rose-400/25 bg-rose-400/[0.07] text-rose-100',
    no_expiry: 'border-amber-400/25 bg-amber-400/[0.06] text-amber-100',
    missing:   'border-line bg-surface text-slate-400',
  }

  async function save() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/freehold/inventory/${encodeURIComponent(slug)}/permit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permitNumber: num, permitExpiry: exp }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d?.error || t('inv.permit.saveFailed')); return }
      // Take back what the SERVER normalised, not what was typed — the two can
      // differ, and showing the typed value would claim a record we do not hold.
      setSaved({ number: d.permitNumber ?? null, expiry: d.permitExpiry ?? null })
      setNum(d.permitNumber ?? '')
      setExp(d.permitExpiry ?? '')
    } catch {
      setError(t('inv.permit.saveFailed'))
    } finally { setBusy(false) }
  }

  return (
    <div className="rounded-[20px] border border-line bg-surface-2 p-5">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-gold" />
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">{t('inv.permit.title')}</p>
      </div>

      <div className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${TONE[state]}`}>
        {state === 'expired' ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          : state === 'ok' ? <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          : <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
        <span>{t(`inv.permit.state.${state}`, { date: saved.expiry ?? '' })}</span>
      </div>

      {canEdit ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_170px_auto]">
          <input
            value={num}
            onChange={(e) => setNum(e.target.value)}
            placeholder={t('inv.permit.numberPh')}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-gold/40"
          />
          <input
            type="date"
            value={exp}
            onChange={(e) => setExp(e.target.value)}
            aria-label={t('inv.permit.expiryLabel')}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
          />
          <button type="button" onClick={() => void save()} disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {t('inv.permit.save')}
          </button>
        </div>
      ) : null}

      {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}

      {/* The QR is ours and it encodes DLD's own validator, so a scan lands on
          the official verification page rather than on a number. Shown only
          for a permit that is actually usable today. */}
      {saved.number && state !== 'expired' && (
        <div className="mt-4 flex items-center gap-3 border-t border-line pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrApiPath(saved.number)} alt="" className="h-16 w-16 rounded bg-white p-1" />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white">{saved.number}</div>
            <a href={permitVerificationUrl(saved.number)} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-gold underline">{t('inv.permit.verify')}</a>
          </div>
        </div>
      )}
    </div>
  )
}
