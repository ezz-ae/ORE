'use client'

import { Sparkles, ArrowUpRight } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { sendToExpert } from '@/lib/freehold/expert-bus'

/** Lead-scoped "Ask the Expert" strip for the CRM lead detail page. */
export function LeadExpertStrip({ name }: { name: string }) {
  const t = useT()
  const qs = ['crm.lead.ask.q1', 'crm.lead.ask.q2', 'crm.lead.ask.q3']
  return (
    <section className="overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.08] via-gold/[0.02] to-transparent p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/25 bg-gold/10"><Sparkles className="h-4 w-4 text-gold" /></div>
        <div className="text-sm font-semibold text-white">{t('crm.lead.askTitle')}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {qs.map((q) => (
          <button key={q} type="button" onClick={() => sendToExpert(t(q, { name }))}
            className="group inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-sm text-slate-300 transition-colors hover:border-gold/40 hover:text-white">
            {t(q, { name })}
            <ArrowUpRight className="h-3.5 w-3.5 text-slate-500 transition-colors group-hover:text-gold" />
          </button>
        ))}
      </div>
    </section>
  )
}
