'use client'

import Link from 'next/link'
import { Key, ArrowRight, Book, Zap, Globe } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'

const ENDPOINTS = [
  { method: 'GET',    path: '/v1/leads',           descKey: 'settings.api.ep.list_leads' },
  { method: 'POST',   path: '/v1/leads',           descKey: 'settings.api.ep.create_lead' },
  { method: 'GET',    path: '/v1/leads/{id}',      descKey: 'settings.api.ep.get_lead' },
  { method: 'PATCH',  path: '/v1/leads/{id}',      descKey: 'settings.api.ep.update_lead' },
  { method: 'GET',    path: '/v1/campaigns',       descKey: 'settings.api.ep.list_campaigns' },
  { method: 'GET',    path: '/v1/analytics',       descKey: 'settings.api.ep.analytics' },
  { method: 'GET',    path: '/v1/inventory',       descKey: 'settings.api.ep.inventory' },
  { method: 'GET',    path: '/v1/finance/summary', descKey: 'settings.api.ep.finance_summary' },
]

const METHOD_COLOR: Record<string, string> = {
  GET:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  POST:  'text-fuchsia-400    bg-fuchsia-400/10    border-fuchsia-400/20',
  PATCH: 'text-amber-400   bg-amber-400/10   border-amber-400/20',
  DELETE:'text-red-400     bg-red-400/10     border-red-400/20',
}

const WEBHOOKS = [
  { event: 'lead.created',      descKey: 'settings.api.wh.lead_created' },
  { event: 'lead.stage_changed',descKey: 'settings.api.wh.lead_stage_changed' },
  { event: 'campaign.paused',   descKey: 'settings.api.wh.campaign_paused' },
  { event: 'invoice.issued',    descKey: 'settings.api.wh.invoice_issued' },
]

export default function ApiPage() {
  const t = useT()
  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">{t('settings.api.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">
          {t('settings.api.subtitlePrefix')}{' '}
          <Link href="/freehold-intelligence/settings/security" className="text-gold/80 hover:text-gold underline underline-offset-2">{t('settings.api.securityLink')}</Link>
        </p>
      </div>

      {/* Base URL */}
      <section className="mb-6 rounded-[16px] border border-gold/15 bg-gold/[0.04] p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{t('settings.api.baseUrl')}</div>
        <code className="font-mono text-sm text-gold">https://api.freeholdproperty.ae</code>
        <div className="mt-2 text-xs text-slate-500">
          {t('settings.api.authPrefix')} <code className="text-slate-400">Authorization: Bearer fh_prod_...</code>
        </div>
      </section>

      {/* Quick links */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { Icon: Book, labelKey: 'settings.api.quick.fullDocs', color: 'text-violet-400', href: 'https://docs.freeholdproperty.ae' },
          { Icon: Zap,  labelKey: 'settings.api.quick.zapier',   color: 'text-amber-400',  href: 'https://zapier.com/apps/freehold-intelligence' },
          { Icon: Globe,labelKey: 'settings.api.quick.openapi',  color: 'text-teal-400',    href: '/api/openapi.json' },
        ].map(({ Icon, labelKey, color, href }) => (
          <a key={labelKey} href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-[12px] border border-line bg-surface px-4 py-3 text-sm font-medium text-slate-400 transition hover:border-line-strong hover:text-slate-100">
            <Icon className={`h-4 w-4 shrink-0 ${color}`} />
            {t(labelKey)}
            <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-600" />
          </a>
        ))}
      </div>

      {/* Endpoints */}
      <section className="mb-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('settings.api.endpoints')}</div>
        <div className="rounded-[16px] border border-line bg-surface divide-y divide-line overflow-hidden">
          {ENDPOINTS.map((ep) => {
            const mc = METHOD_COLOR[ep.method] ?? METHOD_COLOR.GET
            return (
              <div key={ep.path} className="flex items-center gap-4 px-5 py-3.5">
                <span className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold ${mc}`}>
                  {ep.method}
                </span>
                <code className="font-mono text-sm text-slate-400 min-w-0 truncate">{ep.path}</code>
                <span className="ml-auto text-xs text-slate-500 whitespace-nowrap hidden sm:block">{t(ep.descKey)}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Webhooks */}
      <section>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{t('settings.api.webhooks')}</div>
        <div className="rounded-[16px] border border-line bg-surface divide-y divide-line overflow-hidden">
          {WEBHOOKS.map((wh) => (
            <div key={wh.event} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2">
                <Zap className="h-3.5 w-3.5 text-amber-400/60" />
              </div>
              <code className="font-mono text-sm text-slate-300">{wh.event}</code>
              <span className="ml-auto text-xs text-slate-500 hidden sm:block">{t(wh.descKey)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-slate-500">
          {t('settings.api.webhookConfigPrefix')} <Link href="/freehold-intelligence/integrations" className="text-gold/70 hover:text-gold underline underline-offset-2">{t('settings.api.integrationsLink')}</Link>
        </div>
      </section>

    </div>
  )
}
