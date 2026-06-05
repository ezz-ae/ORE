import Link from 'next/link'
import { FileText, Plus, AlertCircle, ArrowUpRight, CheckCircle2, Users, Zap } from 'lucide-react'
import { AiPrompt } from '@/components/freehold/ai-prompt'

interface LeadForm {
  id: string
  name: string
  status: string
  leads_count: number
  created_time: string
  follow_up_action_url?: string
}

interface FormsResponse {
  forms?: LeadForm[]
  error?: string
  type?: string
}

async function getForms(): Promise<FormsResponse> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/meta/forms`, { next: { revalidate: 60 } })
    return res.json()
  } catch {
    return { error: 'Failed to reach Meta API', type: 'network' }
  }
}

function statusConfig(s: string) {
  if (s === 'ACTIVE')   return { dot: 'bg-[#D4AF37]', text: 'text-[#D4AF37]', badge: 'border-emerald-400/20 bg-[#D4AF37]/10', label: 'Active'   }
  if (s === 'ARCHIVED') return { dot: 'bg-[#D4AF37]',   text: 'text-[#F8E7AE]',  badge: 'border-[#D4AF37]/20 bg-[#D4AF37]/10',   label: 'Archived' }
  return                       { dot: 'bg-red-400',     text: 'text-red-300',    badge: 'border-red-400/20 bg-red-400/10',       label: 'Deleted'  }
}

export default async function FormsPage() {
  const data          = await getForms()
  const isConfigError = data.type === 'config'
  const forms         = data.forms ?? []
  const active        = forms.filter((f) => f.status === 'ACTIVE').length
  const totalLeads    = forms.reduce((s, f) => s + (f.leads_count ?? 0), 0)

  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.22em] text-[#D4AF37]/85">
            <FileText className="h-3.5 w-3.5" /> Lead Forms
          </div>
          <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
            Lead gen forms<br />
            <span className="text-white/35">
              {isConfigError ? 'not connected.' : `${forms.length} total.`}
            </span>
          </h1>
        </section>

        <Link
          href="/freehold-intelligence/lead-machine/forms/new"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-[#F8E7AE] sm:mt-10"
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
              <div className="text-[13px] font-semibold text-white">Meta Ads not connected</div>
              <p className="mt-1 text-[13px] text-white/60">{data.error}</p>
              <Link
                href="/freehold-intelligence/integrations/meta"
                className="mt-3 inline-flex items-center gap-1 text-[12px] text-[#D4AF37]/80 transition hover:text-[#D4AF37]"
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
            <p className="text-[13px] text-white/65">{data.error}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      {!isConfigError && (
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: 'Active forms', value: active,      color: 'text-[#D4AF37]' },
            { label: 'Total forms',  value: forms.length, color: 'text-white'       },
            { label: 'Total leads',  value: totalLeads,  color: totalLeads > 0 ? 'text-[#D4AF37]' : 'text-white' },
          ].map((s) => (
            <div key={s.label} className="rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-4">
              <div className={`text-[26px] font-semibold leading-none ${s.color}`}>{s.value}</div>
              <div className="mt-1.5 text-[13px] text-white/40">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Forms list */}
      {forms.length > 0 && (
        <section className="mt-12">
          <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-white/40">All forms</div>
          <div className="mt-4 space-y-3">
            {forms.map((form) => {
              const st = statusConfig(form.status)
              return (
                <Link
                  key={form.id}
                  href={`/freehold-intelligence/lead-machine/forms/${form.id}`}
                  className="group flex items-start justify-between gap-4 rounded-[20px] border border-white/[0.08] bg-[#1A1F2A] p-5 transition hover:border-[#D4AF37]/25"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`} />
                      <h3 className="text-[15px] font-semibold text-white/90 group-hover:text-white truncate">{form.name}</h3>
                      <span className={`rounded-full border px-2 py-0.5 text-[12px] font-medium ${st.badge} ${st.text}`}>{st.label}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-white/45">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span className="text-white/70">{form.leads_count ?? 0} leads captured</span>
                      </span>
                      {form.follow_up_action_url && (
                        <span className="truncate">
                          URL: <span className="font-mono text-white/55 truncate">{form.follow_up_action_url.replace('https://', '').slice(0, 40)}</span>
                        </span>
                      )}
                      <span>
                        Created: <span className="text-white/55">{new Date(form.created_time).toLocaleDateString('en-AE', { dateStyle: 'medium' })}</span>
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-white/20 transition group-hover:text-[#D4AF37]" />
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!isConfigError && !data.error && forms.length === 0 && (
        <div className="mt-16 rounded-[28px] border border-white/[0.08] bg-white/[0.02] px-7 py-14 text-center">
          <Zap className="mx-auto h-8 w-8 text-[#D4AF37]/40" />
          <div className="mt-4 text-[18px] font-semibold text-white">No lead forms yet</div>
          <p className="mt-2 text-[14px] text-white/40">Create your first Meta lead gen form to start capturing leads from campaigns.</p>
          <Link
            href="/freehold-intelligence/lead-machine/forms/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2.5 text-[13px] font-semibold text-[#06080A] transition hover:bg-[#F8E7AE]"
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
            <div key={title} className="rounded-[18px] border border-white/[0.08] bg-[#1A1F2A] p-5">
              <Icon className="h-5 w-5 text-[#D4AF37]/60 mb-3" />
              <div className="text-[13px] font-semibold text-white">{title}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-white/45">{body}</p>
            </div>
          ))}
        </section>
      )}

      <section className="mt-12">
        <AiPrompt
          placeholder="Ask about forms, lead quality, submission rates…"
          suggestions={[
            'Which form has the best lead quality?',
            'How many leads came from forms this month?',
            'What questions convert best on UAE real estate forms?',
          ]}
        />
      </section>

    </div>
  )
}
