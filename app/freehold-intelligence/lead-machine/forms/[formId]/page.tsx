'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Clock, Download, RefreshCw, AlertCircle, FileText, Gauge, Megaphone } from 'lucide-react'
import { isMetaConfigErrorMessage } from '@/lib/meta/error-messages'
import { contactLabelKey } from '@/lib/meta/form-templates'
import { useT } from '@/lib/i18n/provider'
import { LeadValueChips } from '@/components/freehold/lead-value-chips'
import type { FormAnalysis } from '@/lib/freehold/form-analysis'
import { FormAudienceBuilder } from '../_audience'

interface FormQuestion {
  type: string
  label?: string
  id?: string
  key?: string
  options?: { value?: string; label?: string }[]
}

interface LeadForm {
  id: string
  name: string
  status: string
  leads_count: number
  created_time: string
  follow_up_action_url?: string
  questions?: FormQuestion[]
  // Richer read fields — absent on forms/API versions that don't return them,
  // in which case the matching cards simply don't render.
  is_optimized_for_quality?: boolean
  question_page_custom_headline?: string
  context_card?: { title?: string; style?: string; content?: string[]; button_text?: string }
  thank_you_page?: {
    title?: string
    body?: string
    button_type?: string
    button_text?: string
    website_url?: string
    business_phone_number?: string
  }
}

interface FormLead {
  id: string
  created_time: string
  field_data: { name: string; values: string[] }[]
  ad_id?: string
}

function getField(lead: FormLead, name: string): string {
  return lead.field_data.find((f) => f.name.toLowerCase().includes(name))?.values?.[0] ?? '—'
}

export default function FormDetailPage({ params }: { params: Promise<{ formId: string }> }) {
  const t = useT()
  const [formId, setFormId]   = useState<string | null>(null)
  const [form, setForm]       = useState<LeadForm | null>(null)
  const [leads, setLeads]     = useState<FormLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [analysis, setAnalysis] = useState<FormAnalysis | null>(null)
  // Local overlay of ratings clicked on THIS page, so a chip press paints
  // immediately without waiting for a full analysis refetch.
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [rateError, setRateError] = useState<string | null>(null)
  // Monotonic token so a slow analysis refetch can't overwrite the result of a
  // later, faster one (two quick ratings would otherwise race the panel).
  const analysisSeq = useRef(0)

  async function loadAnalysis(id: string) {
    const seq = ++analysisSeq.current
    const aRes = await fetch(`/api/meta/forms/${id}/analysis`)
    if (!aRes.ok) return
    const next = (await aRes.json()).analysis ?? null
    if (seq === analysisSeq.current) setAnalysis(next)
  }

  useEffect(() => {
    params.then(({ formId: id }) => setFormId(id))
  }, [params])

  async function fetchData(id: string) {
    setLoading(true)
    setError(null)
    try {
      const [formRes, leadsRes, analysisRes] = await Promise.all([
        fetch(`/api/meta/forms/${id}`),
        fetch(`/api/meta/forms/${id}/leads`),
        fetch(`/api/meta/forms/${id}/analysis`),
      ])
      const formData  = await formRes.json()
      const leadsData = await leadsRes.json()

      if (!formRes.ok)  throw new Error(formData.error  ?? t('pforms.detail.loadFailed'))
      if (!leadsRes.ok) throw new Error(leadsData.error ?? t('pforms.detail.loadLeadsFailed'))

      setForm(formData.form)
      setLeads(leadsData.leads ?? [])
      // Analysis is additive — its failure must not take down the form page.
      if (analysisRes.ok) {
        const a = await analysisRes.json()
        setAnalysis(a.analysis ?? null)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(isMetaConfigErrorMessage(msg) ? t('lm.meta.notConnectedHint') : msg || t('pforms.error.unexpected'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (formId) fetchData(formId)
  }, [formId])

  async function refreshLeads() {
    if (!formId) return
    setLoadingLeads(true)
    try {
      const res  = await fetch(`/api/meta/forms/${formId}/leads`)
      const data = await res.json()
      if (res.ok) setLeads(data.leads ?? [])
      await loadAnalysis(formId)
    } finally {
      setLoadingLeads(false)
    }
  }

  // One click writes the lead's canonical 0–10 value — the same PATCH the CRM
  // and follow-up queue use, so rating from the form page feeds the identical
  // scale the Ads Machine and the shared brain learn from.
  async function rateLead(crmId: string, metaLeadId: string, v: number) {
    setRatings((r) => ({ ...r, [metaLeadId]: v }))
    setRateError(null)
    try {
      const res = await fetch(`/api/freehold/crm/leads/${crmId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value_rating: v }),
      })
      if (!res.ok) {
        const msg = await res.json().then((d) => d?.error).catch(() => '')
        throw new Error(msg || t('pforms.rate.failed'))
      }
      // Refresh the aggregates so the verdict/distribution follow — race-guarded.
      if (formId) await loadAnalysis(formId)
    } catch (e) {
      // Roll the optimistic chip back AND tell the user, instead of a silent
      // revert that reads as "the rating didn't stick" with no reason.
      setRatings((r) => {
        const { [metaLeadId]: _dropped, ...rest } = r
        return rest
      })
      setRateError(e instanceof Error ? e.message : t('pforms.rate.failed'))
    }
  }

  function exportCsv() {
    if (!leads.length) return
    const allFields = [...new Set(leads.flatMap((l) => (l.field_data ?? []).map((f) => f.name)))]
    const header    = ['id', 'created_time', ...allFields].join(',')
    const rows      = leads.map((l) => {
      const cells = [l.id, l.created_time, ...allFields.map((f) => {
        const val = (l.field_data ?? []).find((fd) => fd.name === f)?.values?.[0] ?? ''
        return `"${val.replace(/"/g, '""')}"`
      })]
      return cells.join(',')
    })
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${form?.name ?? 'leads'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 text-center">
        <div className="text-sm text-slate-400">{t('pforms.detail.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        <Link href="/freehold-intelligence/lead-machine/forms" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> {t('pforms.allForms')}
        </Link>
        <div className="mt-8 flex items-start gap-3 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <div className="text-sm font-semibold text-white">{t('pforms.detail.loadFailed')}</div>
            <p className="mt-1 text-sm text-slate-300">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!form) return null

  // Same vocabulary as the forms list. Only DELETED reads as deleted —
  // DRAFT/PAUSED are amber "goes live when attached", and an unknown status
  // shows Meta's raw text in neutral gray rather than being mislabeled.
  const statusColor = form.status === 'ACTIVE' ? 'text-emerald-300'
    : form.status === 'DRAFT' || form.status === 'PAUSED' ? 'text-amber-300'
    : form.status === 'DELETED' ? 'text-red-300'
    : 'text-slate-500'
  const statusLabel = form.status === 'ACTIVE' ? t('lm.forms.status.active')
    : form.status === 'DRAFT' || form.status === 'PAUSED' ? t('lm.forms.status.draft')
    : form.status === 'ARCHIVED' ? t('lm.forms.status.archived')
    : form.status === 'DELETED' ? t('lm.forms.status.deleted')
    : form.status
  // The stat tile needs a single word — the full draft explanation stays in
  // the header line above.
  const statusShort = form.status === 'DRAFT' || form.status === 'PAUSED'
    ? t('lm.forms.status.draftShort')
    : statusLabel

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/lead-machine/forms" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('pforms.allForms')}
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
          <FileText className="h-3.5 w-3.5" /> {t('pforms.detail.eyebrow')}
        </div>
        <h1 className="mt-3 text-[32px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[44px]">
          {form.name}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t('pforms.detail.created', { date: new Date(form.created_time).toLocaleDateString('en-AE', { dateStyle: 'medium' }) })}
          {' · '}
          <span className={statusColor}>{statusLabel}</span>
        </p>
      </section>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t('pforms.stat.totalLeads'),  value: form.leads_count ?? 0,        color: 'text-gold' },
          { label: t('pforms.stat.questions'),   value: form.questions?.length ?? '—', color: 'text-white'     },
          { label: t('pforms.stat.status'),      value: statusShort,                   color: statusColor      },
          { label: t('pforms.stat.syncedLeads'), value: leads.length,                  color: 'text-white'     },
        ].map((s) => (
          <div key={s.label} className="rounded-[18px] border border-line bg-surface p-4 text-center">
            <div className={`text-[22px] font-semibold leading-none ${s.color}`}>{s.value}</div>
            <div className="mt-1.5 text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Lead analysis — what this form PRODUCED, judged by value ──────── */}
      {analysis && (
        <section className="mt-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Gauge className="h-3.5 w-3.5 text-gold/60" /> {t('pforms.an.title')}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
            {/* Verdict — the learnable summary. Unrated forms get no verdict. */}
            {(() => {
              const v = analysis.verdict
              const tone = v === 'valuable' ? 'border-emerald-400/25 bg-emerald-400/[0.06]'
                : v === 'poor' ? 'border-red-400/25 bg-red-400/[0.06]'
                : v === 'mixed' ? 'border-amber-400/20 bg-amber-400/[0.05]'
                : 'border-line bg-surface'
              const text = v === 'valuable' ? 'text-emerald-300' : v === 'poor' ? 'text-red-300' : v === 'mixed' ? 'text-amber-300' : 'text-slate-400'
              return (
                <div className={`rounded-[20px] border p-5 ${tone}`}>
                  <div className={`text-sm font-semibold ${text}`}>{t(`pforms.an.verdict.${v}`)}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    {analysis.value.rated > 0
                      ? t('pforms.an.verdictDetail', {
                          avg: (analysis.value.avg ?? 0).toFixed(1),
                          rated: String(analysis.value.rated),
                          total: String(analysis.crm.total),
                        })
                      : t('pforms.an.verdictUnrated')}
                    {analysis.value.rated > 0 && !analysis.value.decisive && ` ${t('pforms.an.earlySignal')}`}
                  </p>
                  {/* Value distribution bar: red 0–2 / amber 3–5 / emerald 6–10 / gray unrated */}
                  {analysis.crm.total > 0 && (
                    <div className="mt-3">
                      <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
                        {[
                          { n: analysis.value.avoid, cls: 'bg-red-400/70' },
                          { n: analysis.value.mid, cls: 'bg-amber-400/70' },
                          { n: analysis.value.valuable, cls: 'bg-emerald-400/70' },
                          { n: analysis.value.unrated, cls: 'bg-slate-700' },
                        ].map((seg, i) => seg.n > 0 && (
                          <div key={i} className={seg.cls} style={{ width: `${(seg.n / analysis.crm.total) * 100}%` }} />
                        ))}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                        <span><span className="text-red-300">{analysis.value.avoid}</span> {t('pforms.an.zoneAvoid')}</span>
                        <span><span className="text-amber-300">{analysis.value.mid}</span> {t('pforms.an.zoneMid')}</span>
                        <span><span className="text-emerald-300">{analysis.value.valuable}</span> {t('pforms.an.zoneValuable')}</span>
                        <span><span className="text-slate-400">{analysis.value.unrated}</span> {t('pforms.an.zoneUnrated')}</span>
                      </div>
                    </div>
                  )}
                  <p className="mt-3 text-[10px] leading-relaxed text-slate-600">{t('pforms.an.feedsBrain')}</p>
                </div>
              )
            })()}

            {/* CRM overview — the pipeline truth for this form's leads */}
            <div className="rounded-[20px] border border-line bg-surface p-5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('pforms.an.overview')}</div>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[
                  { label: t('pforms.an.inCrm'),      value: analysis.crm.total,       cls: 'text-white' },
                  { label: t('pforms.an.unassigned'), value: analysis.crm.unassigned,  cls: analysis.crm.unassigned > 0 ? 'text-amber-300' : 'text-white' },
                  { label: t('pforms.an.last7d'),     value: analysis.recency.d7,      cls: 'text-white' },
                  { label: t('pforms.an.last30d'),    value: analysis.recency.d30,     cls: 'text-white' },
                  { label: t('pforms.an.wrongNumber'), value: analysis.crm.wrongNumber, cls: analysis.crm.wrongNumber > 0 ? 'text-red-300' : 'text-white' },
                  { label: t('pforms.an.duplicates'), value: analysis.crm.duplicates,  cls: analysis.crm.duplicates > 0 ? 'text-amber-300' : 'text-white' },
                ].map((s) => (
                  <div key={s.label}>
                    <div className={`text-lg font-semibold leading-none tabular-nums ${s.cls}`}>{s.value}</div>
                    <div className="mt-1 text-[11px] text-slate-500">{s.label}</div>
                  </div>
                ))}
              </div>
              {analysis.crm.stages.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {analysis.crm.stages.map((s) => (
                    <span key={s.stage} className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10px] text-slate-400">
                      {s.stage} · {s.n}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ad setup — which ad fed which value. The same form fed by two ads
              can produce a 7-average and a 2-average; this is where it shows. */}
          {analysis.ads.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-[20px] border border-line bg-surface">
              <div className="flex items-center gap-2 border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Megaphone className="h-3.5 w-3.5 text-gold/60" /> {t('pforms.an.adSetup')}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-start text-[10px] uppercase tracking-wider text-slate-600">
                      <th className="px-5 py-2 text-start font-medium">{t('pforms.an.ad')}</th>
                      <th className="px-3 py-2 text-end font-medium">{t('pforms.an.metaLeads')}</th>
                      <th className="px-3 py-2 text-end font-medium">{t('pforms.an.inCrm')}</th>
                      <th className="px-3 py-2 text-end font-medium">{t('pforms.an.rated')}</th>
                      <th className="px-5 py-2 text-end font-medium">{t('pforms.an.avgValue')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {analysis.ads.map((row) => (
                      <tr key={row.adId}>
                        <td className="px-5 py-2.5">
                          {row.adId === 'organic'
                            ? <span className="text-slate-400">{t('pforms.an.noAd')}</span>
                            : <span className="font-mono text-slate-300">{row.adId.slice(0, 14)}</span>}
                          {row.campaignId && (
                            <span className="ms-2 font-mono text-[10px] text-slate-600">{t('pforms.an.campaign')} {row.campaignId.slice(0, 12)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-end tabular-nums text-slate-300">{row.metaLeads}</td>
                        <td className="px-3 py-2.5 text-end tabular-nums text-slate-300">{row.inCrm}</td>
                        <td className="px-3 py-2.5 text-end tabular-nums text-slate-400">{row.rated}</td>
                        <td className="px-5 py-2.5 text-end">
                          {row.avgValue === null ? (
                            <span className="text-slate-600">—</span>
                          ) : (
                            <span className={`font-semibold tabular-nums ${row.avgValue >= 6 ? 'text-emerald-300' : row.avgValue <= 2.5 ? 'text-red-300' : 'text-amber-300'}`}>
                              {row.avgValue.toFixed(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_280px]">

        {/* Leads table */}
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('pforms.leads.title')}</div>
              <h2 className="mt-1 text-lg font-semibold text-white">{t('pforms.leads.synced', { n: leads.length })}</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={refreshLeads}
                disabled={loadingLeads}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2 text-xs text-slate-400 transition hover:text-white disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLeads ? 'animate-spin' : ''}`} />
                {t('pforms.leads.refresh')}
              </button>
              {leads.length > 0 && (
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-line-strong bg-surface-2 px-3 py-2 text-xs text-slate-400 transition hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" /> {t('pforms.leads.exportCsv')}
                </button>
              )}
            </div>
          </div>

          {rateError && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/[0.06] px-4 py-2.5 text-xs text-red-300">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" /> {rateError}
            </div>
          )}
          {leads.length === 0 ? (
            <div className="rounded-[22px] border border-line bg-surface px-6 py-12 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-700 mb-3" />
              <div className="text-sm text-slate-400">{t('pforms.leads.emptyTitle')}</div>
              <p className="mt-1 text-xs text-slate-500">{t('pforms.leads.emptyBody')}</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[22px] border border-line bg-surface">
              <div className="divide-y divide-line">
                {leads.map((lead) => {
                  const name  = getField(lead, 'name')
                  const phone = getField(lead, 'phone')
                  const email = getField(lead, 'email')
                  const budget = getField(lead, 'budget')
                  return (
                    <div key={lead.id} className="flex items-start gap-4 px-5 py-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-sm font-semibold text-slate-400">
                        {name !== '—' ? name.split(' ').map((p) => p[0]).slice(0, 2).join('') : '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white">{name}</span>
                          {budget !== '—' && (
                            <span className="rounded-full border border-gold/20 bg-gold/10 px-2 py-0.5 text-xs text-gold-bright">{budget}</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-slate-400">
                          {phone !== '—' && <span>{phone}</span>}
                          {email !== '—' && <span>{email}</span>}
                          {lead.ad_id && <span className="font-mono text-xs">{t('pforms.leads.ad', { id: lead.ad_id.slice(0, 8) })}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-slate-500">
                          {lead.field_data
                            .filter((f) => !['full_name', 'phone_number', 'email'].some((k) => f.name.includes(k)))
                            .map((f) => <span key={f.name}>{f.name}: {f.values[0] ?? '—'}</span>)
                          }
                        </div>
                        {/* Rate the lead HERE — same canonical 0–10 the CRM
                            writes, so judging leads never requires leaving the
                            form you are analysing. Only for synced leads: an
                            unsynced lead has no CRM row to rate. */}
                        {(() => {
                          const join = analysis?.leadJoin[lead.id]
                          if (!join) return null
                          const current = ratings[lead.id] ?? join.valueRating
                          return (
                            <div className="mt-2">
                              <LeadValueChips size="sm" value={current} onRate={(v) => rateLead(join.crmId, lead.id, v)} />
                            </div>
                          )
                        })()}
                      </div>
                      <div className="shrink-0 flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" />
                        {new Date(lead.created_time).toLocaleDateString('en-AE', { dateStyle: 'medium' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* The sellable click: this form's leads → Custom Audience → ready
              lookalike. Counts come from the analysis, gates are honest. */}
          {analysis && (
            <FormAudienceBuilder
              formId={form.id}
              formName={form.name}
              contactable={analysis.audience.contactable}
              qualified={analysis.audience.qualified}
              compact
            />
          )}

          {/* Form type — only when Meta actually returned the flag. */}
          {typeof form.is_optimized_for_quality === 'boolean' && (
            <div className="rounded-[20px] border border-line bg-surface p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('pforms.kind.title')}</div>
              <div className="text-sm font-medium text-white">
                {form.is_optimized_for_quality ? t('pforms.kind.intent') : t('pforms.kind.volume')}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {form.is_optimized_for_quality ? t('pforms.kind.intentDesc') : t('pforms.kind.volumeDesc')}
              </p>
            </div>
          )}

          {/* Intro card */}
          {form.context_card?.title && (
            <div className="rounded-[20px] border border-line bg-surface p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('pforms.sidebar.introCard')}</div>
              <div className="text-sm font-medium text-white">{form.context_card.title}</div>
              {(form.context_card.content ?? []).length > 0 && (
                <ul className="mt-2 space-y-1">
                  {form.context_card.content!.map((line, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-slate-400">
                      <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-gold/60" />
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Questions — type-aware: prefill fields show their catalog name,
              customs show their options or "open text". */}
          {form.questions && form.questions.length > 0 && (
            <div className="rounded-[20px] border border-line bg-surface p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('pforms.sidebar.questions')}</div>
              {form.question_page_custom_headline && (
                <p className="mb-3 text-xs italic text-slate-400">“{form.question_page_custom_headline}”</p>
              )}
              <div className="space-y-2.5">
                {form.questions.map((q, i) => {
                  const catalogKey = contactLabelKey(q.type)
                  const display = q.label ?? (catalogKey ? t(catalogKey) : q.type)
                  return (
                    <div key={q.id ?? `${q.type}_${i}`} className="flex items-start gap-2.5 text-xs">
                      <span className="text-slate-500 w-4 text-right shrink-0">{i + 1}.</span>
                      <div className="min-w-0">
                        <span className="text-slate-300">{display}</span>
                        <span className="ms-2 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-slate-500">
                          {q.type === 'CUSTOM'
                            ? (q.options?.length
                                ? t('pforms.review.customWithOptions', { n: q.options.length })
                                : t('pforms.review.customOpenText'))
                            : t('pforms.review.standardAutofill')}
                        </span>
                        {q.type === 'CUSTOM' && (q.options?.length ?? 0) > 0 && (
                          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                            {q.options!.map((o, j) => <span key={j}>{o.label ?? o.value}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Thank-you page */}
          {form.thank_you_page?.title && (
            <div className="rounded-[20px] border border-line bg-surface p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('pforms.review.thankYouPage')}</div>
              <div className="text-sm font-medium text-white">{form.thank_you_page.title}</div>
              {form.thank_you_page.body && <p className="mt-1 text-xs text-slate-400">{form.thank_you_page.body}</p>}
              {form.thank_you_page.button_type && (
                <p className="mt-2 text-[11px] text-slate-500">
                  {t('pforms.detail.button')}{': '}
                  <span className="text-slate-300">
                    {form.thank_you_page.button_type === 'CALL_BUSINESS' ? t('pforms.thankYou.btn.call')
                      : form.thank_you_page.button_type === 'DOWNLOAD' ? t('pforms.thankYou.btn.download')
                      : form.thank_you_page.button_type === 'VIEW_WEBSITE' ? t('pforms.thankYou.btn.website')
                      : form.thank_you_page.button_type}
                  </span>
                  {form.thank_you_page.business_phone_number ? ` · ${form.thank_you_page.business_phone_number}` : ''}
                  {form.thank_you_page.website_url ? ` · ${form.thank_you_page.website_url}` : ''}
                </p>
              )}
            </div>
          )}

          {/* Landing URL */}
          {form.follow_up_action_url && (
            <div className="rounded-[20px] border border-line bg-surface p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('pforms.sidebar.landingPage')}</div>
              <a
                href={form.follow_up_action_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-gold/70 hover:text-gold transition break-all"
              >
                {form.follow_up_action_url}
              </a>
            </div>
          )}

          {/* Form ID */}
          <div className="rounded-[20px] border border-line bg-surface p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('pforms.sidebar.formId')}</div>
            <code className="text-xs text-slate-400 break-all">{form.id}</code>
            <p className="mt-2 text-xs text-slate-500">{t('pforms.sidebar.formIdNote')}</p>
          </div>
        </aside>
      </div>

    </div>
  )
}
