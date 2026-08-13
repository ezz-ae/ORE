'use client'

/**
 * SMART VIEWS — the saved report, asked for in property words.
 *
 * Meta's Ads Manager has the same idea and makes you assemble it: Filters,
 * Columns, Sorting, Breakdowns, Attribution settings. Before you can see
 * anything you have to already know which twelve of three hundred columns
 * matter for a property lead, and that Frequency is the fatigue number.
 *
 * Here you pick the QUESTION. It brings its own columns, its own order and its
 * own narrowing — see lib/freehold/smart-view.ts. There is no column picker
 * and there is nothing on this screen a person has to translate.
 *
 * And the sheet is already built when you open it. It says when, because an
 * answer from 2am is a fine answer as long as nobody thinks it is live.
 */
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus, X, RefreshCw, Trash2, AlertTriangle } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import {
  VIEW_TEMPLATES, VIEW_RANGES, VIEW_ACCESS, VIEW_SCHEDULES, TEMPLATE_SPEC,
  type SmartView, type ViewRow, type ViewColumn, type ViewTemplate,
  type ViewRange, type ViewAccess, type ViewSchedule, type SheetTotals,
} from '@/lib/freehold/smart-view'

/** Money and counts read differently and must not share a formatter — an
 *  enquiry count with a currency in front of it is a bug people screenshot. */
const aed = (n: number) =>
  n >= 1_000_000 ? `AED ${(n / 1_000_000).toFixed(1)}M`
    : n >= 1000 ? `AED ${Math.round(n / 1000)}k`
    : `AED ${Math.round(n)}`
const mins = (n: number) => (n >= 120 ? `${Math.round(n / 60)}h` : `${Math.round(n)}m`)

const MONEY: ViewColumn[] = ['spend', 'moneyIn', 'costPerEnquiry', 'costPerSale']

function cellText(row: ViewRow, col: ViewColumn): string {
  const raw = ((): number | null => {
    switch (col) {
      case 'costPerEnquiry': return row.enquiries > 0 ? row.spend / row.enquiries : null
      case 'costPerSale':    return row.sold > 0 ? row.spend / row.sold : null
      case 'seenBy':         return row.seenBy > 0 ? row.seenBy : null
      case 'timesSeen':      return row.timesSeen > 0 ? row.timesSeen : null
      case 'answeredIn':     return row.answeredIn
      default:               return row[col as keyof ViewRow] as number
    }
  })()
  // AN EMPTY CELL, NEVER A ZERO. "Nothing bought" and "free" are different
  // sentences and only one of them is true.
  if (raw === null || raw === undefined) return '—'
  if (MONEY.includes(col)) return aed(raw)
  if (col === 'answeredIn') return mins(raw)
  if (col === 'timesSeen') return raw.toFixed(1)
  return Math.round(raw).toLocaleString('en-US')
}

interface Sheet {
  view: SmartView
  builtAt: string | null
  columns: ViewColumn[]
  rows: ViewRow[]
  totals: SheetTotals
}

export default function SmartViewsPage() {
  const t = useT()
  const [views, setViews] = useState<SmartView[] | null>(null)
  const [me, setMe] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [loadingSheet, setLoadingSheet] = useState(false)
  const [creating, setCreating] = useState(false)

  const loadViews = useCallback(async () => {
    const d = await fetch('/api/ads/smart-views', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    setViews(d?.views ?? [])
    setMe(d?.me ?? '')
    if (d?.views?.length && !openId) setOpenId(d.views[0].id)
  }, [openId])
  useEffect(() => { void loadViews() }, [loadViews])

  const loadSheet = useCallback(async (id: string, rebuild = false) => {
    setLoadingSheet(true)
    const d = await fetch(`/api/ads/smart-views/${id}${rebuild ? '?rebuild=1' : ''}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
    setSheet(d)
    setLoadingSheet(false)
  }, [])
  useEffect(() => { if (openId) void loadSheet(openId) }, [openId, loadSheet])

  async function remove(id: string) {
    await fetch(`/api/ads/smart-views/${id}`, { method: 'DELETE' }).catch(() => null)
    setOpenId(null); setSheet(null); void loadViews()
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">{t('sv.title')}</h1>
          <p className="mt-1 text-[12px] text-slate-400">{t('sv.sub')}</p>
        </div>
        <button type="button" onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-[13px] font-semibold text-ink transition hover:bg-gold-bright">
          <Plus className="h-3.5 w-3.5" /> {t('sv.new')}
        </button>
      </div>

      {/* The views bar — the saved questions, one tap each. */}
      {views === null ? (
        <div className="mt-8 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-slate-500" /></div>
      ) : views.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-line bg-surface px-6 py-10 text-center">
          <p className="text-sm text-slate-300">{t('sv.empty')}</p>
          <p className="mx-auto mt-1 max-w-md text-[12px] text-slate-500">{t('sv.emptySub')}</p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {views.map((v) => (
              <button key={v.id} type="button" onClick={() => setOpenId(v.id)}
                className={`rounded-full border px-3.5 py-1.5 text-[12px] transition ${
                  v.id === openId
                    ? 'border-gold/40 bg-gold/10 text-white'
                    : 'border-line bg-surface-2 text-slate-300 hover:border-gold/30'
                }`}>
                {v.name}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-2xl border border-line bg-surface">
            {loadingSheet || !sheet ? (
              <div className="flex min-h-[200px] items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-white">
                      {t(`sv.q.${sheet.view.template}`)}
                    </p>
                    {sheet.view.description
                      ? <p className="mt-0.5 text-[11px] text-slate-500">{sheet.view.description}</p>
                      : <p className="mt-0.5 text-[11px] text-slate-500">{t(`sv.qsub.${sheet.view.template}`)}</p>}
                    {/* AN ANSWER FROM 2AM IS A FINE ANSWER as long as nobody
                        thinks it is live. */}
                    <p className="mt-1 text-[10px] text-slate-600">
                      {sheet.builtAt
                        ? t('sv.builtAt', { when: new Date(sheet.builtAt).toLocaleString() })
                        : t('sv.neverBuilt')}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button type="button" onClick={() => openId && void loadSheet(openId, true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1 text-[11px] text-slate-200 transition hover:border-gold/40">
                      <RefreshCw className="h-3 w-3" /> {t('sv.rebuild')}
                    </button>
                    {sheet.view.createdBy === me && (
                      <button type="button" onClick={() => void remove(sheet.view.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-2 px-2.5 py-1 text-[11px] text-slate-400 transition hover:border-rose-400/40 hover:text-rose-300">
                        <Trash2 className="h-3 w-3" /> {t('sv.delete')}
                      </button>
                    )}
                  </div>
                </div>

                {sheet.rows.length === 0 ? (
                  <p className="px-5 py-10 text-center text-[12px] text-slate-500">{t('sv.nothing')}</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left">
                      <thead>
                        <tr className="border-b border-line text-[10px] uppercase tracking-wider text-slate-500">
                          <th className="px-5 py-2.5 font-medium">{t('sv.col.name')}</th>
                          {sheet.columns.map((c) => (
                            <th key={c} className="px-3 py-2.5 text-right font-medium">{t(`sv.col.${c}`)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.rows.map((r) => (
                          <tr key={r.id} className="border-b border-line/50 last:border-0">
                            <td className="px-5 py-2.5">
                              <span className="text-[12px] text-slate-200">{r.label}</span>
                              {r.risks.length > 0 && (
                                <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                  {r.risks.map((k) => (
                                    <span key={k} className="inline-flex items-center gap-1 text-[10px] text-amber-200">
                                      <AlertTriangle className="h-2.5 w-2.5" />{t(`sv.risk.${k}`)}
                                    </span>
                                  ))}
                                </span>
                              )}
                            </td>
                            {sheet.columns.map((c) => (
                              <td key={c} className="px-3 py-2.5 text-right text-[12px] tabular-nums text-slate-300">
                                {cellText(r, c)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        {/* Prices here are re-derived from the totals, never
                            averaged across rows — an average weights a
                            campaign that spent AED 40 like one that spent
                            AED 40,000. */}
                        <tr className="border-t border-line text-[12px] font-semibold text-white">
                          <td className="px-5 py-3">{t('sv.total', { n: sheet.totals.rows })}</td>
                          {sheet.columns.map((c) => (
                            <td key={c} className="px-3 py-3 text-right tabular-nums">
                              {c === 'spend' ? aed(sheet.totals.spend)
                                : c === 'enquiries' ? sheet.totals.enquiries.toLocaleString('en-US')
                                : c === 'worthCalling' ? sheet.totals.worthCalling.toLocaleString('en-US')
                                : c === 'viewings' ? sheet.totals.viewings.toLocaleString('en-US')
                                : c === 'sold' ? sheet.totals.sold.toLocaleString('en-US')
                                : c === 'moneyIn' ? aed(sheet.totals.moneyIn)
                                : c === 'costPerEnquiry' ? (sheet.totals.costPerEnquiry === null ? '—' : aed(sheet.totals.costPerEnquiry))
                                : c === 'costPerSale' ? (sheet.totals.costPerSale === null ? '—' : aed(sheet.totals.costPerSale))
                                : ''}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {creating && (
        <CreateView t={t} onClose={() => setCreating(false)}
          onSaved={(v) => { setCreating(false); setOpenId(v.id); void loadViews() }} />
      )}
    </div>
  )
}

function CreateView({ t, onClose, onSaved }: {
  t: ReturnType<typeof useT>
  onClose: () => void
  onSaved: (v: SmartView) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [template, setTemplate] = useState<ViewTemplate>('sellingProjects')
  const [range, setRange] = useState<ViewRange>('last30')
  const [access, setAccess] = useState<ViewAccess>('onlyMe')
  const [schedule, setSchedule] = useState<ViewSchedule>('everyMorning')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setSaving(true); setErr('')
    const d = await fetch('/api/ads/smart-views', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, description, template, range, access, schedule }),
    }).then((r) => r.json()).catch(() => null)
    setSaving(false)
    if (!d?.view) { setErr(d?.error ?? 'Could not save that.'); return }
    onSaved(d.view)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div className="h-full w-full max-w-[420px] overflow-y-auto border-l border-line bg-chrome p-5"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">{t('sv.create.title')}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-5 block text-[11px] font-medium text-slate-400">{t('sv.create.name')}</label>
        <input value={name} onChange={(e) => setName(e.target.value.slice(0, 100))}
          placeholder={t('sv.create.namePlaceholder')}
          className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-gold/40" />

        <label className="mt-4 block text-[11px] font-medium text-slate-400">{t('sv.create.note')}</label>
        <input value={description} onChange={(e) => setDescription(e.target.value.slice(0, 350))}
          placeholder={t('sv.create.notePlaceholder')}
          className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-gold/40" />

        {/* THE WHOLE FEATURE. Not columns, not breakdowns, not attribution
            windows — the question, and it brings the rest with it. */}
        <p className="mt-6 text-[11px] font-medium text-slate-400">{t('sv.create.question')}</p>
        <div className="mt-2 space-y-2">
          {VIEW_TEMPLATES.map((tpl) => (
            <button key={tpl} type="button" onClick={() => setTemplate(tpl)}
              className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${
                tpl === template ? 'border-gold/40 bg-gold/10' : 'border-line bg-surface hover:border-gold/25'
              }`}>
              <span className="block text-[13px] font-medium text-white">{t(`sv.q.${tpl}`)}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{t(`sv.qsub.${tpl}`)}</span>
              <span className="mt-1.5 block text-[10px] text-slate-600">
                {TEMPLATE_SPEC[tpl].columns.map((c) => t(`sv.col.${c}`)).join(' · ')}
              </span>
            </button>
          ))}
        </div>

        <label className="mt-6 block text-[11px] font-medium text-slate-400">{t('sv.create.range')}</label>
        <select value={range} onChange={(e) => setRange(e.target.value as ViewRange)}
          className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-gold/40">
          {VIEW_RANGES.map((r) => <option key={r} value={r}>{t(`sv.range.${r}`)}</option>)}
        </select>

        <label className="mt-4 block text-[11px] font-medium text-slate-400">{t('sv.create.schedule')}</label>
        <select value={schedule} onChange={(e) => setSchedule(e.target.value as ViewSchedule)}
          className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-gold/40">
          {VIEW_SCHEDULES.map((s) => <option key={s} value={s}>{t(`sv.sched.${s}`)}</option>)}
        </select>

        <label className="mt-4 block text-[11px] font-medium text-slate-400">{t('sv.create.access')}</label>
        <select value={access} onChange={(e) => setAccess(e.target.value as ViewAccess)}
          className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-slate-200 outline-none focus:border-gold/40">
          {VIEW_ACCESS.map((a) => <option key={a} value={a}>{t(`sv.access.${a}`)}</option>)}
        </select>

        {err && <p className="mt-4 text-[11px] text-rose-300">{err}</p>}

        <button type="button" onClick={() => void save()} disabled={saving || !name.trim()}
          className="mt-6 w-full rounded-full bg-gold py-2.5 text-[13px] font-semibold text-ink transition hover:bg-gold-bright disabled:opacity-50">
          {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t('sv.create.save')}
        </button>
      </div>
    </div>
  )
}
