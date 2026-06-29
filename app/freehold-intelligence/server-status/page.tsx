import { ShieldCheck } from 'lucide-react'
import { getAuditEvents, getDashboardSnapshot } from '@/src/features/freehold-intelligence/data-access'
import { getServerT } from '@/lib/i18n/server'

function statusTone(s: string, t: (key: string, vars?: Record<string, string | number>) => string) {
  if (s === 'live') return { dot: 'bg-gold', label: t('pss.status.live'),     text: 'text-gold' }
  if (s === 'pending') return { dot: 'bg-gold', label: t('pss.status.pending'), text: 'text-[#F8E7AE]' }
  return { dot: 'bg-red-400', label: t('pss.status.down'), text: 'text-red-300' }
}

export default async function ServerStatusPage() {
  const { t } = await getServerT()
  const INFRA = [
    { label: t('pss.infra.neon.label'),    status: 'live',    note: t('pss.infra.neon.note') },
    { label: t('pss.infra.vercel.label'),  status: 'live',    note: t('pss.infra.vercel.note') },
    { label: t('pss.infra.mcp.label'),     status: 'live',    note: t('pss.infra.mcp.note') },
    { label: t('pss.infra.auth.label'),    status: 'pending', note: t('pss.infra.auth.note') },
  ] as const
  const [snapshot, audit] = await Promise.all([
    getDashboardSnapshot(),
    getAuditEvents(),
  ])

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-6 sm:pt-16">

      <section>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gold/85">
          <ShieldCheck className="h-3.5 w-3.5" /> {t('pss.eyebrow')}
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">
          {t('pss.heading.line1')}
          <br />
          <span className="text-slate-400">{t('pss.heading.line2')}</span>
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-[1.6] text-slate-300">
          <span className="text-white">{t('pss.summary.projects', { n: Number(snapshot.total_projects).toLocaleString() })}</span> {t('pss.summary.rest', { areas: snapshot.total_areas, developers: snapshot.total_developers, actions: snapshot.audit_events_24h })}
        </p>
      </section>

      <section className="mt-20">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('pss.infra.eyebrow')}</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('pss.infra.title')}</h2>
        <div className="mt-7 grid gap-3">
          {INFRA.map((i) => {
            const tone = statusTone(i.status, t)
            return (
              <div key={i.label} className="flex items-center justify-between gap-5 rounded-2xl border border-line bg-surface p-5">
                <div className="min-w-0">
                  <div className="text-base font-semibold text-white">{i.label}</div>
                  <div className="mt-0.5 text-sm text-slate-400">{i.note}</div>
                </div>
                <span className={`flex shrink-0 items-center gap-1.5 text-xs ${tone.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  {tone.label}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-20">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('pss.audit.eyebrow')}</div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{t('pss.audit.title')}</h2>
        <div className="mt-7 overflow-hidden rounded-3xl border border-line bg-surface">
          {audit.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              {t('pss.audit.empty')}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {audit.slice(0, 12).map((event) => (
                <li key={String(event.log_id)} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm">
                  <div className="min-w-0">
                    <span className="text-slate-100">{event.actor ?? t('pss.audit.system')}</span>
                    <span className="text-slate-600"> · </span>
                    <span className="text-gold/85">{event.action}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-400">
                    <span className="font-mono text-xs text-slate-500">{event.target_table}</span>
                    <span className="text-xs">{String(event.created_at).slice(0, 16).replace('T', ' ')}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
