'use client'

import Link from 'next/link'
import { Bot, MapPin, Building2, FileText, BookOpen, ArrowUpRight, Activity } from 'lucide-react'
import { AiPrompt } from '@/components/freehold/ai-prompt'

const CONTENT_TYPES = [
  { label: 'Listings',   href: '/freehold-intelligence/ai-manager/listings',   icon: Bot,      summary: '28 listings',          alert: '5 need updates',       alertColor: 'text-slate-400' },
  { label: 'Areas',      href: '/freehold-intelligence/ai-manager/areas',      icon: MapPin,   summary: '12 area guides',        alert: '3 missing content',    alertColor: 'text-amber-400' },
  { label: 'Developers', href: '/freehold-intelligence/ai-manager/developers', icon: Building2,summary: '18 developer profiles', alert: '2 incomplete',         alertColor: 'text-amber-400' },
  { label: 'Pages',      href: '/freehold-intelligence/ai-manager/pages',      icon: FileText, summary: '34 pages',              alert: '8 need AI review',     alertColor: 'text-slate-400' },
  { label: 'Topics',     href: '/freehold-intelligence/ai-manager/topics',     icon: BookOpen, summary: '47 topics',             alert: '12 unpublished',       alertColor: 'text-slate-400' },
]

const ACTIVITY = [
  { text: 'Generated content for Emaar Beachfront listing',       time: '4m ago' },
  { text: 'Updated Dubai Hills Estate area guide',                 time: '18m ago' },
  { text: 'Published 3 blog topics on Golden Visa eligibility',   time: '1h ago' },
  { text: 'Added developer profile: Binghatti Properties',         time: '2h ago' },
  { text: 'AI review completed for 8 landing pages',              time: '3h ago' },
]

const SITE_CONTEXT = {
  site: 'freeholdproperty.ae',
  counts: { listings: 28, areaGuides: 12, developers: 18, pages: 34, topics: 47 },
  alerts: { areasWithMissingContent: 3, incompleteDevProfiles: 2, pagesNeedingAiReview: 8, unpublishedTopics: 12 },
}

export default function AiManagerPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">AI Manager</h1>
        <p className="mt-1 text-sm text-slate-400">AI-powered content management for freeholdproperty.ae</p>
      </div>

      {/* Content type cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENT_TYPES.map((ct) => {
          const Icon = ct.icon
          return (
            <Link
              key={ct.label}
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
                <div className="text-sm font-semibold text-slate-100">{ct.label}</div>
                <div className="mt-0.5 text-sm text-slate-400">{ct.summary}</div>
                <div className={`mt-1 text-sm font-medium ${ct.alertColor}`}>{ct.alert}</div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Two-column: Activity + Quick Generate */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">

        {/* AI Activity feed */}
        <div className="rounded-2xl border border-line bg-surface-2 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-100">AI Activity</h2>
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

        {/* Web Manager AI */}
        <div className="rounded-2xl border border-line bg-surface-2 p-6">
          <div className="mb-4 text-sm font-semibold text-slate-100">Web Manager</div>
          <p className="mb-4 text-sm text-slate-400">
            Ask about content gaps, publishing priorities, SEO fixes, or landing page health.
          </p>
          <AiPrompt
            skill="web_manager"
            placeholder="What content needs publishing or fixing?"
            suggestions={[
              'What pages or listings are missing content?',
              'Which landing pages should be published first?',
              'Prioritise SEO fixes by traffic impact.',
              'Any live ads pointing at missing or draft pages?',
            ]}
            context={SITE_CONTEXT}
          />
        </div>

      </div>
    </div>
  )
}
