'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Users, TrendingUp, Briefcase, Megaphone, Activity } from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'
import { prettySource, fmtAed } from '@/lib/freehold/analytics-format'

type Profile = {
  agent: { id: string; name: string; email: string; phone: string | null; role: string; tenureDays: number | null }
  leadStats: { total: number; new: number; closed: number; hot: number; overdue: number; closingRate: number }
  leads: { id: string; name: string; status: string; priority: string; source: string; budgetAed: number; createdAt: string }[]
  activity: { type: string; description: string | null; leadName: string | null; createdAt: string }[]
  deals: { id: string; leadName: string; projectName: string; status: string; propertyValueAed: number; netCommissionAed: number; receivedAed: number; paymentStatus: string; coAgentName: string | null; createdAt: string }[]
  finance: { totalDeals: number; approvedDeals: number; closedDeals: number; pendingDeals: number; salesVolumeAed: number; commissionAed: number; receivedAed: number; outstandingAed: number }
  ads: { totalCredits: number; totalAed: number; activeCampaigns: number; campaigns: { name: string; creditsSpent: number; status: string; createdAt: string }[] }
} | null

const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
function statusTone(s: string) {
  if (s === 'closed' || s === 'approved') return 'text-emerald-400 border-emerald-400/25 bg-emerald-400/10'
  if (s === 'lost' || s === 'rejected') return 'text-red-400 border-red-400/25 bg-red-400/10'
  if (s.startsWith('pending')) return 'text-amber-400 border-amber-400/25 bg-amber-400/10'
  return 'text-slate-300 border-slate-700 bg-slate-800/60'
}
function priorityTone(p: string) {
  if (p === 'hot' || p === 'priority') return 'text-red-400'
  if (p === 'warm') return 'text-amber-400'
  return 'text-slate-400'
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-800/50 p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</div>
      <div className={`mt-2 text-xl font-semibold tabular-nums ${accent ? 'text-[#D4AF37]' : 'text-slate-100'}`}>{value}</div>
    </div>
  )
}

export default function AgentProfilePage() {
  const { t, locale } = useI18n()
  const localeTag = locale === 'ar' ? 'ar-AE' : locale === 'ru' ? 'ru-RU' : 'en-AE'
  const params = useParams()
  const agentId = String(params.agentId || '')
  const [data, setData] = useState<Profile>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!agentId) return
    fetch(`/api/freehold/analytics/agent/${agentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setData(d && d.agent ? d : null); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [agentId])

  const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(localeTag, { day: 'numeric', month: 'short', timeZone: 'Asia/Dubai' }) : '—')

  if (!data) {
    return (
      <div className="p-6 lg:p-8">
        <Link href="/freehold-intelligence/analytics/team" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-100">
          <ArrowLeft className="h-4 w-4" /> {t('analytics.agent.back')}
        </Link>
        <p className="py-16 text-center text-sm text-slate-500">{loaded ? t('analytics.agent.notFound') : t('analytics.loading')}</p>
      </div>
    )
  }

  const { agent, leadStats, leads, activity, deals, finance, ads } = data

  return (
    <div className="p-6 lg:p-8 space-y-8">
      <Link href="/freehold-intelligence/analytics/team" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-100">
        <ArrowLeft className="h-4 w-4" /> {t('analytics.agent.back')}
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-700 text-lg font-bold text-slate-100">{initials(agent.name)}</span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{agent.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
            <span>{agent.email}</span>
            {agent.phone && <span>· {agent.phone}</span>}
            {agent.tenureDays != null && <span>· {t('analytics.agent.tenureDays', { days: agent.tenureDays })}</span>}
          </div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label={t('analytics.agent.sec.leads')} value={leadStats.total.toLocaleString('en-US')} />
        <Kpi label={t('analytics.agent.kpi.closing')} value={`${leadStats.closingRate}%`} />
        <Kpi label={t('analytics.agent.kpi.overdue')} value={leadStats.overdue.toLocaleString('en-US')} />
        <Kpi label={t('analytics.agent.kpi.deals')} value={`${finance.approvedDeals}/${finance.totalDeals}`} />
        <Kpi label={t('analytics.agent.kpi.salesVolume')} value={fmtAed(finance.salesVolumeAed)} />
        <Kpi label={t('analytics.agent.kpi.commission')} value={fmtAed(finance.commissionAed)} accent />
        <Kpi label={t('analytics.agent.kpi.outstanding')} value={fmtAed(finance.outstandingAed)} />
        <Kpi label={t('analytics.agent.kpi.adSpend')} value={fmtAed(ads.totalAed)} />
      </div>

      {/* Leads */}
      <Section icon={<Users className="h-4 w-4 text-slate-400" />} title={t('analytics.agent.sec.leads')}>
        {leads.length ? (
          <Table head={[t('analytics.agent.col.lead'), t('common.status'), t('analytics.agent.col.priority'), t('analytics.th.source'), t('analytics.agent.col.budget'), t('analytics.agent.col.created')]}>
            {leads.map((l) => (
              <tr key={l.id} className="transition hover:bg-slate-800/40">
                <td className="px-4 py-2.5 font-medium text-slate-200">{l.name}</td>
                <td className="px-4 py-2.5"><span className={`inline-flex rounded-md border px-2 py-0.5 text-xs capitalize ${statusTone(l.status)}`}>{l.status}</span></td>
                <td className={`px-4 py-2.5 capitalize ${priorityTone(l.priority)}`}>{l.priority}</td>
                <td className="px-4 py-2.5 text-slate-400">{prettySource(l.source)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{l.budgetAed > 0 ? fmtAed(l.budgetAed) : '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{fmtDate(l.createdAt)}</td>
              </tr>
            ))}
          </Table>
        ) : <Empty text={t('analytics.agent.noLeads')} />}
      </Section>

      {/* Deals & commission */}
      <Section icon={<Briefcase className="h-4 w-4 text-slate-400" />} title={t('analytics.agent.sec.deals')}>
        {deals.length ? (
          <Table head={[t('analytics.agent.col.client'), t('analytics.agent.col.project'), t('analytics.agent.col.value'), t('analytics.agent.kpi.commission'), t('analytics.agent.col.received'), t('analytics.agent.col.payment'), t('common.status')]}>
            {deals.map((d) => (
              <tr key={d.id} className="transition hover:bg-slate-800/40">
                <td className="px-4 py-2.5 font-medium text-slate-200">
                  {d.leadName || '—'}{d.coAgentName ? <span className="ml-1.5 text-xs text-slate-500">({t('analytics.agent.coAgent')}: {d.coAgentName})</span> : null}
                </td>
                <td className="px-4 py-2.5 text-slate-400">{d.projectName || '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{fmtAed(d.propertyValueAed)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-[#D4AF37]">{fmtAed(d.netCommissionAed)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{fmtAed(d.receivedAed)}</td>
                <td className="px-4 py-2.5 capitalize text-slate-400">{String(d.paymentStatus || '').replace(/_/g, ' ')}</td>
                <td className="px-4 py-2.5"><span className={`inline-flex rounded-md border px-2 py-0.5 text-xs capitalize ${statusTone(d.status)}`}>{String(d.status).replace(/_/g, ' ')}</span></td>
              </tr>
            ))}
          </Table>
        ) : <Empty text={t('analytics.agent.noDeals')} />}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Activity & comments */}
        <Section icon={<Activity className="h-4 w-4 text-slate-400" />} title={t('analytics.agent.sec.activity')}>
          {activity.length ? (
            <ul className="divide-y divide-slate-800">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold/60" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-slate-200">
                      <span className="font-medium capitalize">{String(a.type || '').replace(/_/g, ' ')}</span>
                      {a.leadName ? <span className="text-slate-400"> · {a.leadName}</span> : null}
                    </div>
                    {a.description && <div className="mt-0.5 text-xs leading-relaxed text-slate-400">{a.description}</div>}
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">{fmtDate(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty text={t('analytics.agent.noActivity')} />}
        </Section>

        {/* Ad spend & campaigns */}
        <Section icon={<Megaphone className="h-4 w-4 text-slate-400" />} title={t('analytics.agent.sec.ads')}>
          {ads.campaigns.length ? (
            <Table head={[t('analytics.agent.col.campaign'), t('analytics.agent.col.spend'), t('common.status'), t('analytics.agent.col.when')]}>
              {ads.campaigns.map((c, i) => (
                <tr key={i} className="transition hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-medium text-slate-200">{c.name || '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{fmtAed(c.creditsSpent * 10)}</td>
                  <td className="px-4 py-2.5 capitalize text-slate-400">{c.status}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{fmtDate(c.createdAt)}</td>
                </tr>
              ))}
            </Table>
          ) : <Empty text={t('analytics.agent.noAds')} />}
        </Section>
      </div>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-slate-400">{icon}{title}</div>
      {children}
    </section>
  )
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-800/50">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {head.map((h, i) => (
                <th key={i} className={`px-4 py-3 text-xs font-medium uppercase tracking-wider text-slate-500 ${i === 0 ? 'text-left' : i >= 2 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">{children}</tbody>
        </table>
      </div>
    </div>
  )
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-800/50 px-4 py-8 text-center text-sm text-slate-500">{text}</div>
}
