import Link from 'next/link'
import { FileText, Plus, AlertCircle, ArrowUpRight, CheckCircle2, Users, Zap } from 'lucide-react'
import { listLeadForms, MetaConfigError, MetaApiError } from '@/lib/meta/client'
import { demoForms } from '@/lib/meta/demo-data'
import type { MetaLeadForm } from '@/lib/meta/types'

interface FormsResponse {
  forms: MetaLeadForm[]
  error?: string
  demo?: boolean
}

async function getForms(): Promise<FormsResponse> {
  try {
    const forms = await listLeadForms()
    return { forms }
  } catch (err) {
    if (err instanceof MetaConfigError) return { forms: demoForms, demo: true }
    if (err instanceof MetaApiError)    return { forms: [], error: err.message }
    return { forms: [], error: 'Unexpected error loading forms' }
  }
}

function statusConfig(s: string) {
  if (s === 'ACTIVE')   return { dot: 'bg-gold', text: 'text-gold', badge: 'border-gold/20 bg-gold/10', label: 'Active'   }
  if (s === 'ARCHIVED') return { dot: 'bg-gold',   text: 'text-[#F8E7AE]',  badge: 'border-gold/20 bg-gold/10',   label: 'Archived' }
  return                       { dot: 'bg-red-400',     text: 'text-red-300',    badge: 'border-red-400/20 bg-red-400/10',       label: 'Deleted'  }
}

export default async function FormsPage() {
  const data          = await getForms()
  const isConfigError = data.demo === true
  const forms         = data.forms
  const active        = forms.filter((f) => f.status === 'ACTIVE').length
  const totalLeads    = forms.reduce((s, f) => s + (f.leads_count ?? 0), 0)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
            <FileText className="h-3.5 w-3.5" /> Lead Forms
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            Lead gen forms<br />
            <span className="text-slate-500">
              {isConfigError ? 'not connected.' : `${forms.length} total.`}
            </span>
          </h1>
        </section>

        <Link
          href="/freehold-intelligence/lead-machine/forms/new"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE] sm:mt-10"
        >
          <Plus className="h-4 w-4" /> New form
        </Link>
      </div>

      {/* Config error */}
      {isConfigError && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-sm font-semibold text-white">Meta Ads not connected</div>
              <p className="mt-1 text-sm text-slate-400">{data.error}</p>
              <Link
                href="/freehold-intelligence/integrations/meta"
                className="mt-3 inline-flex items-center gap-1 text-xs text-gold/80 transition hover:text-gold"
              >
                Set up Meta integration <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* API error */}
      {data.error && !isConfigError && (
        <div className="mt-8 rounded-[18px] border border-orange-400/20 bg-orange-400/[0.04] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <p className="text-sm text-slate-300">{data.error}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      {!isConfigError && (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: 'Active forms', value: active,      color: 'text-gold' },
            { label: 'Total forms',  value: forms.length, color: 'text-white'       },
            { label: 'Total leads',  value: totalLeads,  color: totalLeads > 0 ? 'text-gold' : 'text-white' },
          ].map((s) => (
            <div key={s.label} className="rounded-[18px] border border-line bg-surface p-4">
              <div className={`text-[26px] font-semibold leading-none ${s.color}`}>{s.value}</div>
              <div className="mt-1.5 text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Forms list */}
      {forms.length > 0 && (
        <section className="mt-12">
          <div className="text-sm font-medium uppercase tracking-wider text-slate-500">All forms</div>
          <div className="mt-4 space-y-3">
            {forms.map((form) => {
              const st = statusConfig(form.status)
              return (
                <Link
                  key={form.id}
                  href={`/freehold-intelligence/lead-machine/forms/${form.id}`}
                  className="group flex items-start justify-between gap-4 rounded-[20px] border border-line bg-surface p-5 transition hover:border-gold/25"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
                      <h3 className="text-sm font-semibold text-white group-hover:text-white truncate">{form.name}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${st.badge} ${st.text}`}>{st.label}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span className="text-slate-300">{form.leads_count ?? 0} leads captured</span>
                      </span>
                      {form.follow_up_action_url && (
                        <span className="truncate">
                          URL: <span className="font-mono text-slate-400 truncate">{form.follow_up_action_url.replace('https://', '').slice(0, 40)}</span>
                        </span>
                      )}
                      <span>
                        Created: <span className="text-slate-400">{new Date(form.created_time).toLocaleDateString('en-AE', { dateStyle: 'medium' })}</span>
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-gold" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!isConfigError && !data.error && forms.length === 0 && (
        <div className="mt-16 rounded-[28px] border border-line bg-surface-2 px-7 py-14 text-center">
          <Zap className="mx-auto h-8 w-8 text-gold/40" />
          <div className="mt-4 text-[18px] font-semibold text-white">No lead forms yet</div>
          <p className="mt-2 text-[14px] text-slate-500">Create your first Meta lead gen form to start capturing leads from campaigns.</p>
          <Link
            href="/freehold-intelligence/lead-machine/forms/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-[#F8E7AE]"
          >
            <Plus className="h-4 w-4" /> Create first form
          </Link>
        </div>
      )}

      {/* What forms do */}
      {!isConfigError && (
        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            { icon: FileText, title: 'Instant capture',   body: 'Lead details filled automatically by Meta — no manual typing required from the buyer.' },
            { icon: CheckCircle2, title: 'CRM sync',      body: 'Leads flow into your CRM and WhatsApp sequence the moment the form is submitted.' },
            { icon: Users, title: 'Native experience',    body: 'Forms open inside Meta — no redirect, no page load. 3× higher completion rate than external pages.' },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-[18px] border border-line bg-surface p-5">
              <Icon className="h-5 w-5 text-gold/60 mb-3" />
              <div className="text-sm font-semibold text-white">{title}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{body}</p>
            </div>
          ))}
        </section>
      )}


    </div>
  )
}
