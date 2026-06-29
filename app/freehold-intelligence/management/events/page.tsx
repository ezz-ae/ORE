'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Activity, Search, UserPlus, TrendingUp,
  MessageSquare, Clock, CheckCircle2, Loader2, Users,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/provider'

type TFn = (key: string, vars?: Record<string, string | number>) => string

interface EventItem {
  id: string
  time: string
  user: string
  description: string
  category: string
  severity: 'info' | 'success' | 'warning'
}

const SEVERITY_STYLES = {
  info:    { dot: 'bg-teal-400',     text: 'text-teal-400',     bg: 'border-teal-500/20 bg-teal-500/10'       },
  success: { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'border-emerald-500/20 bg-emerald-500/10' },
  warning: { dot: 'bg-amber-400',   text: 'text-amber-400',   bg: 'border-amber-500/20 bg-amber-500/10'   },
}

function timeLabel(iso: string, t: TFn, locale: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const h = diff / 3_600_000
  if (h < 1)  return t('mgmt.events.minAgo', { n: Math.round(h * 60) })
  if (h < 24) return t('mgmt.events.hourAgo', { n: Math.round(h) })
  const dateLocale = locale === 'ar' ? 'ar-AE' : locale === 'ru' ? 'ru-RU' : 'en-AE'
  return d.toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' })
}

function leadToEvents(lead: any, t: TFn): EventItem[] {
  const events: EventItem[] = []
  const name = lead.name || t('mgmt.events.unknownLead')
  const source = lead.source || 'direct'

  events.push({
    id:          `${lead.id}_created`,
    time:        lead.lastContactAt || new Date().toISOString(),
    user:        source,
    description: lead.projectInterest && lead.projectInterest !== 'General enquiry'
      ? t('mgmt.events.newLeadInterested', { name, project: lead.projectInterest })
      : t('mgmt.events.newLead', { name }),
    category:    t('mgmt.events.cat.leads'),
    severity:    lead.temperature === 'hot' || lead.temperature === 'priority' ? 'success' : 'info',
  })

  if (lead.pipelineStage && lead.pipelineStage !== 'new') {
    events.push({
      id:          `${lead.id}_stage`,
      time:        lead.lastContactAt || new Date().toISOString(),
      user:        lead.assignedAgent || t('mgmt.events.system'),
      description: t('mgmt.events.movedStage', { name, stage: lead.pipelineStage }),
      category:    t('mgmt.events.cat.pipeline'),
      severity:    lead.pipelineStage === 'closed' ? 'success' : lead.pipelineStage === 'lost' ? 'warning' : 'info',
    })
  }

  return events
}

export default function EventsPage() {
  const { t, locale } = useI18n()
  const [events,  setEvents]  = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    fetch('/api/freehold/crm/leads')
      .then(r => r.ok ? r.json() : { leads: [] })
      .then(data => {
        const leads: any[] = (data.leads ?? []).slice(0, 50)
        const items = leads.flatMap((lead) => leadToEvents(lead, t))
        items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        setEvents(items.slice(0, 60))
      })
      .finally(() => setLoading(false))
  }, [t])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return events
    return events.filter(e =>
      e.description.toLowerCase().includes(q) ||
      e.user.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q),
    )
  }, [events, search])

  return (
    <div className="min-h-screen bg-ink pb-20">

      <div className="sticky top-0 z-30 border-b border-line bg-app/90 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-surface-2">
              <Activity className="h-4 w-4 text-slate-300" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">{t('mgmt.events.title')}</h1>
              <p className="mt-0.5 text-xs text-slate-500">{t('mgmt.events.subtitle')}</p>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={t('mgmt.events.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 w-56 rounded-lg border border-line-strong bg-surface-2 pl-8 pr-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-gold/40"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pt-6">
        {loading && (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">{t('mgmt.events.loading')}</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <Activity className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">{search ? t('mgmt.events.noMatch') : t('mgmt.events.noActivity')}</p>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((event) => {
              const s = SEVERITY_STYLES[event.severity]
              return (
                <div key={event.id} className="flex items-start gap-4 rounded-[14px] border border-line bg-surface px-5 py-4 transition hover:border-white/10">
                  <div className={`mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs ${s.bg}`}>
                    <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-100">{event.description}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                      <span>{event.user}</span>
                      <span>·</span>
                      <span className={`font-medium ${s.text}`}>{event.category}</span>
                      <span>·</span>
                      <span>{timeLabel(event.time, t, locale)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
