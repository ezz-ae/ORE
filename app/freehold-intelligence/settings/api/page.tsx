'use client'

import Link from 'next/link'
import { toast } from 'sonner'
import { Key, ArrowRight, Book, Zap, Globe } from 'lucide-react'

const ENDPOINTS = [
  { method: 'GET',    path: '/v1/leads',           desc: 'List all CRM leads with filters' },
  { method: 'POST',   path: '/v1/leads',           desc: 'Create or upsert a lead' },
  { method: 'GET',    path: '/v1/leads/{id}',      desc: 'Retrieve a single lead' },
  { method: 'PATCH',  path: '/v1/leads/{id}',      desc: 'Update lead stage or metadata' },
  { method: 'GET',    path: '/v1/campaigns',       desc: 'List all campaigns across platforms' },
  { method: 'GET',    path: '/v1/analytics',       desc: 'Traffic and conversion metrics' },
  { method: 'GET',    path: '/v1/inventory',       desc: 'Property listings with readiness scores' },
  { method: 'GET',    path: '/v1/finance/summary', desc: 'Budget, spend, and commission summary' },
]

const METHOD_COLOR: Record<string, string> = {
  GET:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  POST:  'text-blue-400    bg-blue-400/10    border-blue-400/20',
  PATCH: 'text-amber-400   bg-amber-400/10   border-amber-400/20',
  DELETE:'text-red-400     bg-red-400/10     border-red-400/20',
}

const WEBHOOKS = [
  { event: 'lead.created',      desc: 'Fires when a new lead enters the CRM' },
  { event: 'lead.stage_changed',desc: 'Fires on any pipeline stage transition' },
  { event: 'campaign.paused',   desc: 'Fires when a campaign is paused or blocked' },
  { event: 'invoice.issued',    desc: 'Fires when a new invoice is generated' },
]

export default function ApiPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-8">
        <h1 className="text-xl font-semibold text-white">API Reference</h1>
        <p className="mt-1 text-sm text-slate-400">
          RESTful API for integrating Freehold Intelligence with external tools.
          Manage keys in <Link href="/freehold-intelligence/settings/security" className="text-gold/80 hover:text-gold underline underline-offset-2">Security →</Link>
        </p>
      </div>

      {/* Base URL */}
      <section className="mb-6 rounded-[16px] border border-gold/15 bg-gold/[0.04] p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Base URL</div>
        <code className="font-mono text-sm text-gold">https://api.freeholdproperty.ae</code>
        <div className="mt-2 text-xs text-slate-500">
          All requests require <code className="text-slate-400">Authorization: Bearer fh_prod_...</code>
        </div>
      </section>

      {/* Quick links */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { Icon: Book, label: 'Full docs',      color: 'text-violet-400' },
          { Icon: Zap,  label: 'Zapier plugin',  color: 'text-amber-400'  },
          { Icon: Globe,label: 'OpenAPI spec',   color: 'text-sky-400'    },
        ].map(({ Icon, label, color }) => (
          <button key={label} onClick={() => toast.info('Opening ' + label)} className="flex items-center gap-2 rounded-[12px] border border-line bg-surface px-4 py-3 text-sm font-medium text-slate-400 transition hover:border-line-strong hover:text-slate-100">
            <Icon className={`h-4 w-4 shrink-0 ${color}`} />
            {label}
            <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-600" />
          </button>
        ))}
      </div>

      {/* Endpoints */}
      <section className="mb-6">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Endpoints</div>
        <div className="rounded-[16px] border border-line bg-surface divide-y divide-line overflow-hidden">
          {ENDPOINTS.map((ep) => {
            const mc = METHOD_COLOR[ep.method] ?? METHOD_COLOR.GET
            return (
              <div key={ep.path} className="flex items-center gap-4 px-5 py-3.5">
                <span className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold ${mc}`}>
                  {ep.method}
                </span>
                <code className="font-mono text-sm text-slate-400 min-w-0 truncate">{ep.path}</code>
                <span className="ml-auto text-xs text-slate-500 whitespace-nowrap hidden sm:block">{ep.desc}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* Webhooks */}
      <section>
        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Webhooks</div>
        <div className="rounded-[16px] border border-line bg-surface divide-y divide-line overflow-hidden">
          {WEBHOOKS.map((wh) => (
            <div key={wh.event} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2">
                <Zap className="h-3.5 w-3.5 text-amber-400/60" />
              </div>
              <code className="font-mono text-sm text-slate-300">{wh.event}</code>
              <span className="ml-auto text-xs text-slate-500 hidden sm:block">{wh.desc}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Configure webhook URLs in <Link href="/freehold-intelligence/integrations" className="text-gold/70 hover:text-gold underline underline-offset-2">Integrations →</Link>
        </div>
      </section>

    </div>
  )
}
