'use client'

import Link from 'next/link'
import { Bot, MapPin, Building2, FileText, BookOpen, ArrowUpRight, Activity, Sparkles } from 'lucide-react'
import { useT } from '@/lib/i18n/provider'
import { sendToExpert } from '@/lib/freehold/expert-bus'
const CONTENT_TYPES = [
  { labelKey: 'studio.ct.listings',   href: '/freehold-intelligence/ai-manager/listings',   icon: Bot,      summary: '28 listings',          alert: '5 need updates',       alertColor: 'text-slate-400' },
  { labelKey: 'studio.ct.areas',      href: '/freehold-intelligence/ai-manager/areas',      icon: MapPin,   summary: '12 area guides',        alert: '3 missing content',    alertColor: 'text-amber-400' },
  { labelKey: 'studio.ct.developers', href: '/freehold-intelligence/ai-manager/developers', icon: Building2,summary: '18 developer profiles', alert: '2 incomplete',         alertColor: 'text-amber-400' },
  { labelKey: 'studio.ct.pages',      href: '/freehold-intelligence/ai-manager/pages',      icon: FileText, summary: '34 pages',              alert: '8 need AI review',     alertColor: 'text-slate-400' },
  { labelKey: 'studio.ct.topics',     href: '/freehold-intelligence/ai-manager/topics',     icon: BookOpen, summary: '47 topics',             alert: '12 unpublished',       alertColor: 'text-slate-400' },
]

// Sample recent-activity feed (illustrative until the content event log is wired).
const ACTIVITY = [
  { text: 'Generated content for Emaar Beachfront listing',       time: '4m ago' },
  { text: 'Updated Dubai Hills Estate area guide',                 time: '18m ago' },
  { text: 'Published 3 blog topics on Golden Visa eligibility',   time: '1h ago' },
  { text: 'Added developer profile: Binghatti Properties',         time: '2h ago' },
  { text: 'AI review completed for 8 landing pages',              time: '3h ago' },
]

export default function AiManagerPage() {
  const t = useT()
  const depth = ['studio.ai.q1', 'studio.ai.q2', 'studio.ai.q3', 'studio.ai.q4']
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{t('studio.title')}</h1>
        <p className="mt-1 text-sm text-slate-400">{t('studio.subtitle')}</p>
      </div>

      {/* Expert depth — plan / fix / audit content via the single docked Expert */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.08] via-gold/[0.02] to-transparent p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/25 bg-gold/10">
            <Sparkles className="h-4 w-4 text-gold" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">{t('studio.ai.title')}</div>
            <div className="text-xs text-slate-400">{t('studio.ai.subtitle')}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {depth.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => sendToExpert(t(q))}
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-1.5 text-sm text-slate-300 transition-colors hover:border-gold/40 hover:text-white"
            >
              {t(q)}
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-500 transition-colors group-hover:text-gold" />
            </button>
          ))}
        </div>
      </section>

      {/* Content type cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENT_TYPES.map((ct) => {
          const Icon = ct.icon
          return (
            <Link
              key={ct.labelKey}
              href={ct.href}
              className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface-2 p-5 transition hover:border-gold/20 hover:bg-surface-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gold/20 bg-gold/10">
                  <Icon className="h-4 w-4 text-gold" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:text-slate-300" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100">{t(ct.labelKey)}</div>
                <div className="mt-0.5 text-sm text-slate-400">{ct.summary}</div>
                <div className={`mt-1 text-sm font-medium ${ct.alertColor}`}>{ct.alert}</div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* AI Activity feed */}
      <div className="mt-8 rounded-2xl border border-line bg-surface-2 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Activity className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-100">{t('studio.activity')}</h2>
        </div>
        <ul className="space-y-4">
          {ACTIVITY.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-gold/50" />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-slate-400">{item.text}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.time}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
