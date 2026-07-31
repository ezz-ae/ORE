import Link from 'next/link'
import { FileText, Plus, AlertCircle, ArrowUpRight, CheckCircle2, Users, Zap } from 'lucide-react'
import { MetaConfigError, MetaApiError } from '@/lib/meta/client'
import { listLeadFormsMerged } from '@/lib/meta/form-registry'
import type { MetaLeadForm } from '@/lib/meta/types'
import { getServerT } from '@/lib/i18n/server'
import { query } from '@/lib/db'
import { DemoNotice } from '@/components/freehold/demo-badge'
import { FormsSyncControls } from './_sync'

interface FormsResponse {
  forms: MetaLeadForm[]
  error?: string
  demo?: boolean
}

async function getForms(): Promise<FormsResponse> {
  try {
    // Meta's paginated list merged with locally-registered (platform-created)
    // forms — Meta's list edge omits DRAFT forms, so without the merge a form
    // created here could silently vanish from this page.
    const forms = await listLeadFormsMerged()
    return { forms }
  } catch (err) {
    // Not connected → nothing fake: an empty list plus the connect notice.
    if (err instanceof MetaConfigError) return { forms: [], demo: true }
    if (err instanceof MetaApiError)    return { forms: [], error: err.message }
    return { forms: [], error: 'Unexpected error loading forms' }
  }
}

// Honest status rendering: only DELETED is red. DRAFT/PAUSED get an amber
// "goes live when attached to a running ad" badge, and any status we don't
// recognize renders neutral with Meta's raw text (labelKey null) — never
// defaulting to "deleted".
function statusConfig(s: string): { dot: string; text: string; badge: string; labelKey: string | null } {
  if (s === 'ACTIVE')   return { dot: 'bg-emerald-400', text: 'text-emerald-300', badge: 'border-emerald-500/25 bg-emerald-500/10', labelKey: 'lm.forms.status.active'   }
  if (s === 'DRAFT' || s === 'PAUSED')
    return                     { dot: 'bg-amber-400',   text: 'text-amber-300',  badge: 'border-amber-400/20 bg-amber-400/10',   labelKey: 'lm.forms.status.draft'    }
  if (s === 'ARCHIVED') return { dot: 'bg-slate-500',   text: 'text-slate-400',  badge: 'border-slate-500/20 bg-slate-500/10',   labelKey: 'lm.forms.status.archived' }
  if (s === 'DELETED')  return { dot: 'bg-red-400',     text: 'text-red-300',    badge: 'border-red-400/20 bg-red-400/10',       labelKey: 'lm.forms.status.deleted'  }
  return                       { dot: 'bg-slate-500',   text: 'text-slate-400',  badge: 'border-slate-500/20 bg-slate-500/10',   labelKey: null                       }
}

/**
 * How many leads from each Meta form actually made it into the CRM. The forms
 * page only ever showed Meta's own `leads_count`, so a form could report 47
 * captured leads while the CRM held zero of them and nothing on screen
 * disagreed. This is the number that makes the gap visible.
 */
async function getCrmCountsByForm(): Promise<Map<string, number>> {
  try {
    const rows = await query<{ meta_form_id: string; n: string }>(
      `SELECT meta_form_id, COUNT(*)::text AS n
         FROM freehold_site_leads
        WHERE meta_form_id IS NOT NULL AND archived IS NOT TRUE
        GROUP BY meta_form_id`,
    )
    return new Map(rows.map((r) => [r.meta_form_id, Number(r.n) || 0]))
  } catch {
    // The column may not exist until the first sync — an empty map degrades to
    // "0 in CRM", never to a crashed page.
    return new Map()
  }
}

export default async function FormsPage() {
  const { t }         = await getServerT()
  const data          = await getForms()
  const crmByForm     = await getCrmCountsByForm()
  const isConfigError = data.demo === true
  const forms         = data.forms
  const active        = forms.filter((f) => f.status === 'ACTIVE').length
  const totalLeads    = forms.reduce((s, f) => s + (f.leads_count ?? 0), 0)

  const infoCards = [
    { icon: FileText,     titleKey: 'lm.forms.info.instantTitle', bodyKey: 'lm.forms.info.instantBody' },
    { icon: CheckCircle2, titleKey: 'lm.forms.info.crmTitle',     bodyKey: 'lm.forms.info.crmBody'     },
    { icon: Users,        titleKey: 'lm.forms.info.nativeTitle',  bodyKey: 'lm.forms.info.nativeBody'  },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">

      <div className="flex flex-wrap items-start justify-between gap-4">
        <section>
          <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-gold/85">
            <FileText className="h-3.5 w-3.5" /> {t('lm.forms.eyebrow')}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            {t('lm.forms.title')}<br />
            <span className="text-slate-500">
              {isConfigError ? t('lm.forms.titleNotConnected') : t('lm.forms.titleTotal', { n: String(forms.length) })}
            </span>
          </h1>
        </section>

        <Link
          href="/freehold-intelligence/lead-machine/forms/new"
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright sm:mt-10"
        >
          <Plus className="h-4 w-4" /> {t('lm.forms.newForm')}
        </Link>
      </div>

      {/* Manual sync + real-time webhook health — lead ingestion must never
          again depend invisibly on a cron env var being configured. */}
      {!isConfigError && <FormsSyncControls />}

      {/* Config error */}
      {isConfigError && (
        <div className="mt-8 rounded-[20px] border border-red-400/20 bg-red-400/[0.05] p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <div className="text-sm font-semibold text-white">{t('lm.forms.metaNotConnected')}</div>
              <p className="mt-1 text-sm text-slate-400">{data.error}</p>
              <Link
                href="/freehold-intelligence/integrations/meta"
                className="mt-3 inline-flex items-center gap-1 text-xs text-gold/80 transition hover:text-gold"
              >
                {t('lm.forms.setupMeta')} <ArrowUpRight className="h-3 w-3" />
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
            { labelKey: 'lm.forms.stat.activeForms', value: active,      color: 'text-emerald-300' },
            { labelKey: 'lm.forms.stat.totalForms',  value: forms.length, color: 'text-white'       },
            { labelKey: 'lm.forms.stat.totalLeads',  value: totalLeads,  color: totalLeads > 0 ? 'text-gold' : 'text-white' },
          ].map((s) => (
            <div key={s.labelKey} className="rounded-[18px] border border-line bg-surface p-4">
              <div className={`text-[26px] font-semibold leading-none ${s.color}`}>{s.value}</div>
              <div className="mt-1.5 text-sm text-slate-500">{t(s.labelKey)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Demo data must never read as real forms/leads. */}
      {isConfigError && forms.length > 0 && (
        <DemoNotice badge={t('lm.demo.badge')} note={t('lm.demo.note')} />
      )}

      {/* Forms list */}
      {forms.length > 0 && (
        <section className="mt-12">
          <div className="text-sm font-medium uppercase tracking-wider text-slate-500">{t('lm.forms.allForms')}</div>
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
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${st.badge} ${st.text}`}>{st.labelKey ? t(st.labelKey) : form.status}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        <span className="text-slate-300">{t('lm.forms.leadsCapture', { n: String(form.leads_count ?? 0) })}</span>
                      </span>
                      {/* Meta's count vs OURS. This page used to show only
                          Meta's number, so a form reading "47 leads" looked
                          healthy while the CRM held none of them — the exact
                          gap that made "leads aren't showing" invisible here. */}
                      {(() => {
                        const inCrm = crmByForm.get(form.id) ?? 0
                        const missing = (form.leads_count ?? 0) - inCrm
                        return missing > 0 ? (
                          <span className="flex items-center gap-1 font-medium text-amber-300">
                            <AlertCircle className="h-3 w-3" />
                            {t('lm.forms.notInCrm', { n: String(missing) })}
                          </span>
                        ) : (
                          <span className="text-slate-500">{t('lm.forms.inCrm', { n: String(inCrm) })}</span>
                        )
                      })()}
                      {form.follow_up_action_url && (
                        <span className="truncate">
                          URL: <span className="font-mono text-slate-400 truncate">{form.follow_up_action_url.replace('https://', '').slice(0, 40)}</span>
                        </span>
                      )}
                      <span>
                        {t('lm.forms.created')} <span className="text-slate-400">{new Date(form.created_time).toLocaleDateString('en-AE', { dateStyle: 'medium' })}</span>
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
          <div className="mt-4 text-[18px] font-semibold text-white">{t('lm.forms.emptyTitle')}</div>
          <p className="mt-2 text-[14px] text-slate-500">{t('lm.forms.emptyDesc')}</p>
          <Link
            href="/freehold-intelligence/lead-machine/forms/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-bright"
          >
            <Plus className="h-4 w-4" /> {t('lm.forms.createFirst')}
          </Link>
        </div>
      )}

      {/* What forms do */}
      {!isConfigError && (
        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {infoCards.map(({ icon: Icon, titleKey, bodyKey }) => (
            <div key={titleKey} className="rounded-[18px] border border-line bg-surface p-5">
              <Icon className="h-5 w-5 text-gold/60 mb-3" />
              <div className="text-sm font-semibold text-white">{t(titleKey)}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{t(bodyKey)}</p>
            </div>
          ))}
        </section>
      )}


    </div>
  )
}
