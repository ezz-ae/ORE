'use client'

/**
 * THE THREE LOCAL AUDIENCES — built, measured, and only then saved.
 *
 * Every earlier defence in this product was a rule about how an audience is
 * BUILT, and each one was correct and each one was bypassed: by a saved spec
 * that predated the fix, by a `mass: true` flag nobody read, by an interest id
 * that meant something else. This screen checks the finished thing instead —
 * it asks Meta how many people the assembled audience actually reaches, and
 * refuses to store one that comes back wider than the ceiling.
 *
 * The reach number is not decoration here. It is the pass mark: 728k worked on
 * this account, 2.2M cost AED 27,873.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Check, AlertTriangle, ShieldOff } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

interface Built {
  key: string
  name: string
  language: string
  gate: string[]
  droppedTooWide: string[]
  reach: { lower: number; upper: number } | null
  verdict: 'good' | 'tooWide' | 'tooNarrow' | 'unknown'
  audienceId: string | null
  refusal: string | null
}
interface Response {
  connected: boolean
  built?: Built[]
  missing?: string[]
  refused?: string[]
  ceiling?: number
  floor?: number
  error?: string
}

const n = (v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}k`

export function LocalAudiences({ onSaved }: { onSaved: () => void }) {
  const t = useT()
  const [data, setData] = useState<Response | null>(null)
  const [busy, setBusy] = useState(false)

  const look = useCallback(async () => {
    setBusy(true)
    const d = await fetch('/api/freehold/ads/audiences/local', { cache: 'no-store' })
      .then((r) => r.json()).catch(() => null)
    setData(d)
    setBusy(false)
  }, [])
  useEffect(() => { void look() }, [look])

  async function save() {
    setBusy(true)
    const d = await fetch('/api/freehold/ads/audiences/local', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    }).then((r) => r.json()).catch(() => null)
    setData(d)
    setBusy(false)
    onSaved()
  }

  if (!data) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-line bg-surface">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
      </div>
    )
  }
  if (!data.connected) return null

  const built = data.built ?? []
  const good = built.filter((b) => b.verdict === 'good')
  const gate = built[0]?.gate ?? []

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <h3 className="text-sm font-semibold text-white">{t('local.title')}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-400">{t('local.sub')}</p>

      {/* WHAT THE GATE TURNED OUT TO BE. Resolved live against Meta's own
          vocabulary — no interest id in this product is typed from memory. */}
      {gate.length > 0 && (
        <p className="mt-3 text-[12px] text-slate-300">
          {t('local.gate')} <span className="text-white">{gate.join(' · ')}</span>
        </p>
      )}

      {/* DROPPED BECAUSE META ITSELF SAYS THEY ARE TOO BIG. The old defence was
          a flag in a file; this is the platform's own number. */}
      {(built[0]?.droppedTooWide.length ?? 0) > 0 && (
        <p className="mt-1 text-[11px] text-slate-500">
          {t('local.dropped', { names: built[0].droppedTooWide.join(', ') })}
        </p>
      )}
      {(data.missing?.length ?? 0) > 0 && (
        <p className="mt-1 text-[11px] text-slate-500">
          {t('local.missing', { names: (data.missing ?? []).join(', ') })}
        </p>
      )}
      {/* SAID, NEVER SILENT. A segment refused on principle has to be visible,
          or the refusal is just a thing that mysteriously did not happen. */}
      {(data.refused?.length ?? 0) > 0 && (
        <p className="mt-2 flex items-start gap-2 text-[11px] text-amber-200/90">
          <ShieldOff className="mt-0.5 h-3 w-3 shrink-0" />
          {t('local.refused', { names: (data.refused ?? []).join(', ') })}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {built.map((b) => (
          <li key={b.key} className={`rounded-xl border p-3 ${
            b.verdict === 'good' ? 'border-emerald-400/25 bg-emerald-400/[0.05]'
              : b.verdict === 'unknown' ? 'border-line bg-surface-2/40'
              : 'border-amber-400/25 bg-amber-400/[0.05]'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-slate-100">{b.name}</span>
              <span className="text-[12px] tabular-nums text-slate-300">
                {b.reach ? `${n(b.reach.lower)}–${n(b.reach.upper)}` : '—'}
              </span>
            </div>
            <p className={`mt-0.5 text-[11px] ${
              b.verdict === 'good' ? 'text-emerald-300/90' : 'text-amber-200/90'
            }`}>
              {b.audienceId ? t('local.saved') : t(`local.verdict.${b.verdict}`)}
            </p>
          </li>
        ))}
      </ul>

      {/* Nothing is stored until somebody presses this. An audience that
          appeared on its own is one nobody feels responsible for — and this
          account already has three of those. */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={busy || good.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold transition hover:bg-gold/20 disabled:opacity-40">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {t('local.save', { n: good.length })}
        </button>
        <button type="button" onClick={() => void look()} disabled={busy}
          className="text-xs text-slate-400 transition hover:text-white disabled:opacity-40">
          {t('local.recheck')}
        </button>
      </div>

      {good.length === 0 && (
        <p className="mt-3 flex items-start gap-2 text-[12px] text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('local.noneGood')}
        </p>
      )}
    </div>
  )
}
