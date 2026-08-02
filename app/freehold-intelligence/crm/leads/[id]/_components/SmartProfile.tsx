'use client'

import { useState } from 'react'
import { Sparkles, ExternalLink, AlertCircle } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import type { ProfileFact } from '@/lib/freehold/lead-profile'

/**
 * The smart profile — dynamic cells, honest by construction. A cell exists
 * only because the research agent FOUND that fact on the public web with a
 * source; a lead with no findable workplace simply has no workplace cell.
 * Every cell shows its source link and confidence, so a broker can judge the
 * fact before trusting it in a conversation.
 */
const KEY_LABEL: Record<string, string> = {
  workplace: 'crm.profile.k.workplace',
  job_title: 'crm.profile.k.jobTitle',
  company_industry: 'crm.profile.k.industry',
  linkedin: 'crm.profile.k.linkedin',
  social_profile: 'crm.profile.k.social',
  location_city: 'crm.profile.k.city',
  nationality: 'crm.profile.k.nationality',
  education: 'crm.profile.k.education',
  business_interests: 'crm.profile.k.interests',
  family: 'crm.profile.k.family',
  age_range: 'crm.profile.k.ageRange',
}

const CONF_DOT: Record<string, string> = {
  high: 'bg-emerald-400',
  medium: 'bg-amber-400',
  low: 'bg-slate-500',
}

export function SmartProfile({ leadId, initialFacts }: { leadId: string; initialFacts: ProfileFact[] }) {
  const t = useT()
  const [facts, setFacts] = useState<ProfileFact[]>(initialFacts)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function complete() {
    setBusy(true)
    setNote(null)
    setError(null)
    try {
      const res = await fetch(`/api/freehold/crm/leads/${leadId}/enrich`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.note || data.error || t('crm.profile.failed'))
      setFacts(data.facts ?? [])
      setNote(data.note ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('crm.profile.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-[20px] border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-gold/60" /> {t('crm.profile.title')}
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={complete}
          className="rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-[11px] font-semibold text-gold-bright transition hover:bg-gold/20 disabled:opacity-40"
        >
          {busy ? t('crm.profile.researching') : facts.length ? t('crm.profile.refresh') : t('crm.profile.complete')}
        </button>
      </div>

      {facts.length === 0 && !busy && (
        <p className="mt-3 text-xs leading-relaxed text-slate-500">{t('crm.profile.empty')}</p>
      )}
      {busy && (
        <p className="mt-3 text-xs text-slate-400">{t('crm.profile.searchingNote')}</p>
      )}

      {facts.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {facts.map((f) => (
            <div key={f.id} className="rounded-[14px] border border-line bg-surface-2 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                <span className={`h-1.5 w-1.5 rounded-full ${CONF_DOT[f.confidence] ?? CONF_DOT.low}`} title={t(`crm.profile.conf.${f.confidence}`)} />
                {f.factKey === 'other' && f.factLabel ? f.factLabel : t(KEY_LABEL[f.factKey] ?? 'crm.profile.k.other')}
              </div>
              <div className="mt-1 break-words text-sm text-white">{f.factValue}</div>
              {f.evidence && <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{f.evidence}</p>}
              {f.sourceUrl && (
                <a
                  href={f.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-[10px] text-gold/70 transition hover:text-gold"
                >
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{f.sourceUrl.replace(/^https?:\/\//, '').slice(0, 60)}</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {note && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
          <AlertCircle className="mt-px h-3 w-3 shrink-0 text-slate-500" /> {note}
        </p>
      )}
      {error && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-red-300">
          <AlertCircle className="mt-px h-3 w-3 shrink-0" /> {error}
        </p>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-slate-600">{t('crm.profile.note')}</p>
    </div>
  )
}
