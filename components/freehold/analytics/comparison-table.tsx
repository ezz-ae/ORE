'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Save, Loader2, Check } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

export type CmpColumn = {
  key: string
  /** dictionary key for the column label */
  labelKey: string
  /** which direction is "better" (for best-cell highlight); omit = no highlight */
  better?: 'high' | 'low'
  /** value formatter */
  fmt?: (n: number) => string
}
export type CmpItem = { id: string; label: string; values: Record<string, number> }
export type CmpPreset = { labelKey: string; columns: string[] }

const intl = (n: number) => (Number.isFinite(n) ? n.toLocaleString('en-US') : '—')
// Round an average to 1 dp before formatting so percentage/ratio columns don't
// render long floats (e.g. 33.33333%) on screen or in the saved Notebook HTML.
const avgDisplay = (n: number) => (Number.isInteger(n) ? n : Math.round(n * 10) / 10)

export function ComparisonTable({
  titleKey = 'analytics.cmp.title',
  items,
  columns,
  presets = [],
  defaultColumns,
  saveType = 'comparison',
  loading,
}: {
  titleKey?: string
  items: CmpItem[]
  columns: CmpColumn[]
  presets?: CmpPreset[]
  defaultColumns?: string[]
  saveType?: string
  loading?: boolean
}) {
  const t = useT()
  const [selItems, setSelItems] = useState<string[]>([])
  const [selCols, setSelCols] = useState<string[]>(defaultColumns ?? columns.slice(0, 4).map((c) => c.key))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Default to all items once data arrives (only while the user hasn't chosen).
  const effectiveItems = selItems.length > 0 ? items.filter((i) => selItems.includes(i.id)) : items
  const cols = columns.filter((c) => selCols.includes(c.key))

  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  function applyPreset(p: CmpPreset) {
    setSelCols(p.columns.filter((k) => columns.some((c) => c.key === k)))
    setSelItems([]) // all items
    setSaved(false)
  }

  const rows = useMemo(() => cols.map((col) => {
    const cells = effectiveItems.map((it) => ({ id: it.id, v: it.values[col.key] ?? 0 }))
    const vals = cells.map((c) => c.v)
    const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
    let bestId: string | null = null
    if (col.better && cells.length > 1) {
      bestId = cells.reduce((b, c) => (col.better === 'high' ? c.v > b.v : c.v < b.v) ? c : b, cells[0]).id
    }
    return { col, cells, avg, bestId }
  }), [cols, effectiveItems])

  async function save() {
    if (cols.length === 0 || effectiveItems.length === 0) return
    setSaving(true)
    try {
      const fmt = (col: CmpColumn, v: number) => (col.fmt ? col.fmt(v) : intl(v))
      const head = `<tr><th style="text-align:left;padding:8px 12px;border-bottom:1px solid #334155">${t('analytics.cmp.metric')}</th>${effectiveItems.map((i) => `<th style="text-align:right;padding:8px 12px;border-bottom:1px solid #334155">${i.label}</th>`).join('')}<th style="text-align:right;padding:8px 12px;border-bottom:1px solid #334155">${t('analytics.cmp.average')}</th></tr>`
      const body = rows.map((r) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #1e293b">${t(r.col.labelKey)}</td>${r.cells.map((c) => `<td style="text-align:right;padding:8px 12px;border-bottom:1px solid #1e293b${c.id === r.bestId ? ';color:#D4AF37;font-weight:600' : ''}">${fmt(r.col, c.v)}</td>`).join('')}<td style="text-align:right;padding:8px 12px;border-bottom:1px solid #1e293b;color:#94a3b8">${fmt(r.col, avgDisplay(r.avg))}</td></tr>`).join('')
      const html = `<table style="border-collapse:collapse;width:100%;font-family:system-ui,sans-serif;font-size:14px;color:#e2e8f0"><thead>${head}</thead><tbody>${body}</tbody></table>`
      const title = `${t(titleKey)} — ${effectiveItems.length} × ${cols.length}`
      const res = await fetch('/api/freehold/notebook/save-output', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type: saveType, content: html }),
      })
      if (!res.ok) throw new Error('save failed')
      setSaved(true)
      toast.success(t('analytics.cmp.saved'))
      setTimeout(() => setSaved(false), 2500)
    } catch {
      toast.error(t('analytics.cmp.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-800/50">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 p-5">
        <div>
          <h3 className="text-sm font-semibold text-white">{t(titleKey)}</h3>
          <p className="mt-0.5 text-xs text-slate-400">{t('analytics.cmp.subtitle')}</p>
        </div>
        <button
          onClick={save}
          disabled={saving || cols.length === 0 || effectiveItems.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3.5 py-1.5 text-sm font-semibold text-[#06080A] transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? t('analytics.cmp.saving') : saved ? t('analytics.cmp.saved') : t('analytics.cmp.save')}
        </button>
      </div>

      <div className="space-y-3 p-5">
        {/* presets */}
        {presets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('analytics.cmp.presets')}</span>
            {presets.map((p) => (
              <button key={p.labelKey} onClick={() => applyPreset(p)}
                className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs font-medium text-violet-300 transition hover:bg-violet-400/20">
                {t(p.labelKey)}
              </button>
            ))}
          </div>
        )}

        {/* metric chooser */}
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('analytics.cmp.columns')}</div>
          <div className="flex flex-wrap gap-1.5">
            {columns.map((c) => {
              const on = selCols.includes(c.key)
              return (
                <button key={c.key} onClick={() => { setSelCols(toggle(selCols, c.key)); setSaved(false) }}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? 'border border-gold/35 bg-gold/10 text-gold' : 'border border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200'}`}>
                  {t(c.labelKey)}
                </button>
              )
            })}
          </div>
        </div>

        {/* item chooser */}
        <div>
          <div className="mb-1.5 flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{t('analytics.cmp.items')}</span>
            <button onClick={() => setSelItems([])} className="text-[10px] text-slate-500 hover:text-slate-300">{t('analytics.cmp.selectAll')}</button>
            <button onClick={() => setSelItems(['__none__'])} className="text-[10px] text-slate-500 hover:text-slate-300">{t('analytics.cmp.clear')}</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((it) => {
              const on = selItems.length === 0 || selItems.includes(it.id)
              return (
                <button key={it.id} onClick={() => { setSelItems(toggle(selItems.filter((x) => x !== '__none__'), it.id)); setSaved(false) }}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? 'border border-sky-400/35 bg-sky-400/10 text-sky-200' : 'border border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200'}`}>
                  {it.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* comparison table */}
        {cols.length === 0 || effectiveItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{loading ? t('analytics.loading') : t('analytics.cmp.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/40">
                  <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.cmp.metric')}</th>
                  {effectiveItems.map((it) => (
                    <th key={it.id} className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-slate-300 whitespace-nowrap">{it.label}</th>
                  ))}
                  <th className="px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-slate-500">{t('analytics.cmp.average')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.col.key} className="hover:bg-slate-800/30">
                    <td className="px-3 py-2.5 font-medium text-slate-300 whitespace-nowrap">{t(r.col.labelKey)}</td>
                    {r.cells.map((c) => (
                      <td key={c.id} className={`px-3 py-2.5 text-right tabular-nums ${c.id === r.bestId ? 'font-semibold text-[#D4AF37]' : 'text-slate-300'}`}>
                        {r.col.fmt ? r.col.fmt(c.v) : intl(c.v)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{r.col.fmt ? r.col.fmt(avgDisplay(r.avg)) : intl(Math.round(r.avg))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
