'use client'

/**
 * WHAT PEOPLE ACTUALLY TYPED, AND WHAT TO DO ABOUT IT.
 *
 * Google names every real query that triggered an ad. This product has been
 * reading that report since the Google client was written and doing exactly
 * one thing with it: printing it in a table. It is the report that lets a
 * Search account run itself, and nobody opens it.
 *
 * So the table is gone and two lists take its place: phrases worth buying, and
 * money being wasted right now. The waste number is the headline because it is
 * the one an operator can act on without reading anything else.
 *
 * THE BUTTON ONLY APPLIES THE NEGATIVES. A negative stops spend and is
 * reversible in one click; a new keyword starts spend on a forecast. They are
 * not the same risk and the screen does not pretend they are.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, TrendingDown, Plus } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import type { HarvestRow } from '@/lib/google/search-harvest'

interface HarvestResponse {
  adds: HarvestRow[]
  negatives: HarvestRow[]
  watching: HarvestRow[]
  wasteFoundAed: number
  addsCapped: number
  targetCplAed: number | null
  termsRead: number
  error?: string
}

export default function SearchHarvestPanel() {
  const t = useT()
  const [data, setData] = useState<HarvestResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  const load = useCallback(async () => {
    const d = await fetch('/api/google/search-harvest', { cache: 'no-store' })
      .then((r) => r.json()).catch(() => null)
    setData(d)
  }, [])
  useEffect(() => { void load() }, [load])

  async function applyNegatives() {
    if (busy) return
    setBusy(true); setNote('')
    try {
      const r = await fetch('/api/google/search-harvest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setNote(d?.error || t('gsh.failed')); return }
      // Report what was BLOCKED and what that was costing — not that a request
      // returned 200. "Applied successfully" is not an outcome.
      setNote(t('gsh.applied', { n: Number(d?.negativesAdded) || 0, aed: Number(d?.wasteStoppedAed) || 0 }))
      await load()
    } catch { setNote(t('gsh.failed')) } finally { setBusy(false) }
  }

  if (!data) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-line bg-surface">
        <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
      </div>
    )
  }

  if (data.error) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-white">{t('gsh.title')}</h2>
        <p className="mt-2 text-[12px] text-slate-400">{data.error}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">{t('gsh.title')}</h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            {t('gsh.sub', { terms: data.termsRead })}
          </p>
        </div>
        {data.negatives.length > 0 && (
          <button type="button" onClick={() => void applyNegatives()} disabled={busy}
            className="shrink-0 rounded-lg bg-gold px-3 py-1.5 text-[11px] font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : t('gsh.block', { n: data.negatives.length })}
          </button>
        )}
      </div>

      {/* Without a target CPL nothing can be called too expensive, and a
          guessed one would cut queries that were working. Said, not hidden. */}
      {data.targetCplAed === null && (
        <p className="mt-3 text-[11px] leading-relaxed text-amber-200">{t('gsh.noTarget')}</p>
      )}

      {data.negatives.length > 0 && (
        <section className="mt-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
            <TrendingDown className="h-3 w-3" />
            {t('gsh.wasting', { aed: data.wasteFoundAed })}
          </div>
          <ul className="mt-1.5 space-y-1">
            {data.negatives.slice(0, 8).map((n) => (
              <li key={n.term} className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="min-w-0 flex-1 truncate text-slate-300">{n.term}</span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {t('gsh.spent', { aed: Math.round(n.vars.costAed), clicks: n.vars.clicks })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.adds.length > 0 && (
        <section className="mt-5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
            <Plus className="h-3 w-3" />
            {t('gsh.worthBuying')}
          </div>
          <ul className="mt-1.5 space-y-1">
            {data.adds.map((a) => (
              <li key={a.term} className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="min-w-0 flex-1 truncate text-slate-300">{a.term}</span>
                <span className="shrink-0 tabular-nums text-emerald-300">
                  {t('gsh.converted', { n: a.vars.conversions, aed: Math.round(a.vars.cpa ?? 0) })}
                </span>
              </li>
            ))}
          </ul>
          {/* A silent cap reads as "we covered everything". It never may. */}
          {data.addsCapped > 0 && (
            <p className="mt-1.5 text-[10px] text-slate-500">{t('gsh.capped', { n: data.addsCapped })}</p>
          )}
          <p className="mt-2 text-[10px] leading-relaxed text-slate-500">{t('gsh.addsWait')}</p>
        </section>
      )}

      {data.negatives.length === 0 && data.adds.length === 0 && (
        <p className="mt-4 text-[12px] text-slate-400">{t('gsh.quiet')}</p>
      )}

      {note && <p className="mt-3 text-[11px] text-slate-400">{note}</p>}
    </div>
  )
}
