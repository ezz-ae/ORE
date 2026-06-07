'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Clock, Download, RefreshCw, AlertCircle, FileText } from 'lucide-react'

interface FormQuestion { type: string; label: string; id: string }

interface LeadForm {
  id: string
  name: string
  status: string
  leads_count: number
  created_time: string
  follow_up_action_url?: string
  questions?: FormQuestion[]
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
  const [formId, setFormId]   = useState<string | null>(null)
  const [form, setForm]       = useState<LeadForm | null>(null)
  const [leads, setLeads]     = useState<FormLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [loadingLeads, setLoadingLeads] = useState(false)

  useEffect(() => {
    params.then(({ formId: id }) => setFormId(id))
  }, [params])

  async function fetchData(id: string) {
    setLoading(true)
    setError(null)
    try {
      const [formRes, leadsRes] = await Promise.all([
        fetch(`/api/meta/forms/${id}`),
        fetch(`/api/meta/forms/${id}/leads`),
      ])
      const formData  = await formRes.json()
      const leadsData = await leadsRes.json()

      if (!formRes.ok)  throw new Error(formData.error  ?? 'Failed to load form')
      if (!leadsRes.ok) throw new Error(leadsData.error ?? 'Failed to load leads')

      setForm(formData.form)
      setLeads(leadsData.leads ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error')
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
    } finally {
      setLoadingLeads(false)
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
        <div className="text-sm text-slate-400">Loading form…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
        <Link href="/freehold-intelligence/lead-machine/forms" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> All forms
        </Link>
        <div className="mt-8 flex items-start gap-3 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <div>
            <div className="text-sm font-semibold text-white">Failed to load form</div>
            <p className="mt-1 text-sm text-slate-300">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!form) return null

  const statusColor = form.status === 'ACTIVE' ? 'text-[#D4AF37]' : 'text-slate-500'

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <Link href="/freehold-intelligence/lead-machine/forms" className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> All forms
      </Link>

      {/* Header */}
      <section className="mt-7">
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-[#D4AF37]/85">
          <FileText className="h-3.5 w-3.5" /> Lead Form
        </div>
        <h1 className="mt-3 text-[32px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[44px]">
          {form.name}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Created {new Date(form.created_time).toLocaleDateString('en-AE', { dateStyle: 'medium' })}
          {' · '}
          <span className={statusColor}>{form.status}</span>
        </p>
      </section>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Total leads',   value: form.leads_count ?? 0,        color: 'text-[#D4AF37]' },
          { label: 'Questions',     value: form.questions?.length ?? '—', color: 'text-white'     },
          { label: 'Status',        value: form.status,                   color: statusColor      },
          { label: 'Synced leads',  value: leads.length,                  color: 'text-white'     },
        ].map((s) => (
          <div key={s.label} className="rounded-[18px] border border-slate-800 bg-slate-900 p-4 text-center">
            <div className={`text-[22px] font-semibold leading-none ${s.color}`}>{s.value}</div>
            <div className="mt-1.5 text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_280px]">

        {/* Leads table */}
        <div className="min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Lead submissions</div>
              <h2 className="mt-1 text-lg font-semibold text-white">{leads.length} synced</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={refreshLeads}
                disabled={loadingLeads}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-400 transition hover:text-white disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLeads ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {leads.length > 0 && (
                <button
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1.5 rounded-[10px] border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-400 transition hover:text-white"
                >
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              )}
            </div>
          </div>

          {leads.length === 0 ? (
            <div className="rounded-[22px] border border-slate-800 bg-slate-900 px-6 py-12 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-700 mb-3" />
              <div className="text-sm text-slate-400">No leads synced yet</div>
              <p className="mt-1 text-xs text-slate-500">Attach this form to a campaign to start capturing leads.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[22px] border border-slate-800 bg-slate-900">
              <div className="divide-y divide-slate-800">
                {leads.map((lead) => {
                  const name  = getField(lead, 'name')
                  const phone = getField(lead, 'phone')
                  const email = getField(lead, 'email')
                  const budget = getField(lead, 'budget')
                  return (
                    <div key={lead.id} className="flex items-start gap-4 px-5 py-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800/50 text-sm font-semibold text-slate-400">
                        {name !== '—' ? name.split(' ').map((p) => p[0]).slice(0, 2).join('') : '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white">{name}</span>
                          {budget !== '—' && (
                            <span className="rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-2 py-0.5 text-xs text-[#F8E7AE]">{budget}</span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-slate-400">
                          {phone !== '—' && <span>{phone}</span>}
                          {email !== '—' && <span>{email}</span>}
                          {lead.ad_id && <span className="font-mono text-xs">Ad: {lead.ad_id.slice(0, 8)}</span>}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-slate-500">
                          {lead.field_data
                            .filter((f) => !['full_name', 'phone_number', 'email'].some((k) => f.name.includes(k)))
                            .map((f) => <span key={f.name}>{f.name}: {f.values[0] ?? '—'}</span>)
                          }
                        </div>
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
          {/* Questions */}
          {form.questions && form.questions.length > 0 && (
            <div className="rounded-[20px] border border-slate-800 bg-slate-900 p-5">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Questions</div>
              <div className="space-y-2">
                {form.questions.map((q, i) => (
                  <div key={q.id} className="flex items-center gap-2.5 text-xs">
                    <span className="text-slate-500 w-4 text-right shrink-0">{i + 1}.</span>
                    <span className="text-slate-300">{q.label ?? q.type}</span>
                    <span className="ml-auto text-xs font-mono text-slate-500">{q.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Landing URL */}
          {form.follow_up_action_url && (
            <div className="rounded-[20px] border border-slate-800 bg-slate-900 p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Landing page</div>
              <a
                href={form.follow_up_action_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#D4AF37]/70 hover:text-[#D4AF37] transition break-all"
              >
                {form.follow_up_action_url}
              </a>
            </div>
          )}

          {/* Form ID */}
          <div className="rounded-[20px] border border-slate-800 bg-slate-900 p-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Form ID</div>
            <code className="text-xs text-slate-400 break-all">{form.id}</code>
            <p className="mt-2 text-xs text-slate-500">Use this ID when attaching the form to a campaign ad set.</p>
          </div>
        </aside>
      </div>

    </div>
  )
}
