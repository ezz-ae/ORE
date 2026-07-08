'use client'

import { useEffect, useState } from 'react'
import { Users, TrendingUp, Mail } from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'

// The platform is sold white-label: account billing is handled offline by the
// account manager, so this page shows the REAL workspace usage that matters
// (team size, lead volume) instead of a fabricated invoice/pricing screen.
export default function BillingPage() {
  const { t } = useI18n()
  const [agents, setAgents] = useState<number | null>(null)
  const [leads30d, setLeads30d] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/freehold/team', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const members = (d?.members ?? []) as Array<{ role?: string; dbRole?: string }>
        setAgents(members.filter((m) => String(m.role ?? m.dbRole ?? '').toLowerCase() === 'broker').length)
      })
      .catch(() => {})
    fetch('/api/freehold/analytics/leads', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.last30d != null) setLeads30d(d.last30d) })
      .catch(() => {})
  }, [])

  const usage = [
    { labelKey: 'settings.billing.activeAgents',   value: agents == null ? '—' : String(agents), Icon: Users },
    { labelKey: 'settings.billing.leadsThisMonth', value: leads30d == null ? '—' : leads30d.toLocaleString(), Icon: TrendingUp },
  ]

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <h1 className="mb-2 text-xl font-semibold text-white">{t('settings.billing.title')}</h1>
      <p className="mb-8 text-sm text-slate-400">{t('settings.billing.managedNote')}</p>

      {/* Real workspace usage */}
      <section className="mb-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('settings.billing.usageThisMonth')}</div>
        <div className="grid grid-cols-2 gap-3">
          {usage.map(({ labelKey, value, Icon }) => (
            <div key={labelKey} className="rounded-[14px] border border-line bg-surface p-4">
              <Icon className="h-4 w-4 text-gold/70" />
              <div className="mt-2 text-lg font-semibold text-white tabular-nums">{value}</div>
              <div className="mt-0.5 text-xs text-slate-500">{t(labelKey)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Billing contact — real mailto, no fake invoices or card capture */}
      <section className="rounded-[18px] border border-line bg-surface p-6">
        <div className="text-sm font-semibold text-white">{t('settings.billing.contactTitle')}</div>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{t('settings.billing.contactBody')}</p>
        <a
          href="mailto:support@freeholdproperty.ae?subject=Billing enquiry"
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-gold/[0.07] px-4 py-2 text-xs font-medium text-gold transition hover:bg-gold/15"
        >
          <Mail className="h-3.5 w-3.5" /> {t('settings.billing.contactBilling')}
        </a>
      </section>
    </div>
  )
}
