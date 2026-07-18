'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShieldCheck, Users, ListChecks, Loader2, ArrowUpRight } from 'lucide-react'
import { StatCard, Panel, PanelHeader } from '@/components/freehold/ui'
import { useT, useI18n } from '@/lib/i18n/provider'

interface Burst {
  actor: string
  leadIds: string[]
  count: number
  windowStart: string
  windowEnd: string
}

interface Report {
  bursts: Burst[]
  excludedLeadIds: string[]
}

function fmtDateTime(iso: string, locale: string) {
  const dateLocale = locale === 'ar' ? 'ar-AE' : locale === 'ru' ? 'ru-RU' : 'en-AE'
  return new Date(iso).toLocaleString(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function TrainingIntegrityPage() {
  const t = useT()
  const { locale } = useI18n()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/freehold/management/training-integrity', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setReport(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const actorCount = report ? new Set(report.bursts.map((b) => b.actor)).size : 0

  return (
    <div className="min-h-screen pb-16 bg-ink">
      <div className="border-b border-line bg-app/80 px-6 py-5 backdrop-blur-xl sticky top-0 z-30">
        <div className="mx-auto max-w-5xl flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-surface-2">
            <ShieldCheck className="h-4 w-4 text-slate-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">{t('mgmt.trainingIntegrity.title')}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{t('mgmt.trainingIntegrity.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pt-6 space-y-6">
        <div className="rounded-xl border border-line bg-surface-2/40 px-5 py-4 text-sm leading-relaxed text-slate-400">
          {t('mgmt.trainingIntegrity.explainer')}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-500"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : !report ? (
          <div className="py-20 text-center text-sm text-slate-500">{t('mgmt.trainingIntegrity.noBursts')}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label={t('mgmt.trainingIntegrity.statBursts')} value={report.bursts.length} Icon={ListChecks} hint={t('mgmt.trainingIntegrity.lookback')} />
              <StatCard label={t('mgmt.trainingIntegrity.statExcluded')} value={report.excludedLeadIds.length} Icon={ShieldCheck} hint={t('mgmt.trainingIntegrity.lookback')} />
              <StatCard label={t('mgmt.trainingIntegrity.statActors')} value={actorCount} Icon={Users} hint={t('mgmt.trainingIntegrity.lookback')} />
            </div>

            <Panel>
              <PanelHeader title={t('mgmt.trainingIntegrity.burstsTitle')} action={<span className="text-xs text-slate-500">{t('mgmt.trainingIntegrity.notPunitive')}</span>} />
              <div className="p-5 space-y-3">
                {report.bursts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">{t('mgmt.trainingIntegrity.noBursts')}</p>
                ) : report.bursts.map((b, i) => (
                  <div key={`${b.actor}-${b.windowStart}-${i}`} className="rounded-xl border border-line bg-surface-2/40 p-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{b.actor}</p>
                        <p className="text-xs text-slate-500">
                          {t('mgmt.trainingIntegrity.burstLine', { count: b.count, minutes: Math.max(1, Math.round((new Date(b.windowEnd).getTime() - new Date(b.windowStart).getTime()) / 60000)) })}
                        </p>
                      </div>
                      <div className="text-right shrink-0 text-xs text-slate-500 whitespace-nowrap">
                        {fmtDateTime(b.windowStart, locale)} → {fmtDateTime(b.windowEnd, locale)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {b.leadIds.map((id) => (
                        <Link
                          key={id}
                          href={`/freehold-intelligence/crm/leads/${id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-line-strong bg-surface px-2.5 py-1 text-xs text-slate-400 hover:border-gold/30 hover:text-gold transition-colors"
                        >
                          {t('mgmt.trainingIntegrity.viewLead')}
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}
