'use client'

import Link from 'next/link'
import { Bot, MapPin, Building2, FileText, BookOpen, Sparkles, ArrowUpRight, Activity } from 'lucide-react'

const contentTypes = [
  {
    label: 'Listings',
    href: '/freehold-intelligence/ai-manager/listings',
    icon: Bot,
    summary: '28 listings',
    alert: '5 need updates',
    alertColor: 'text-rose-400',
  },
  {
    label: 'Areas',
    href: '/freehold-intelligence/ai-manager/areas',
    icon: MapPin,
    summary: '12 area guides',
    alert: '3 missing content',
    alertColor: 'text-amber-400',
  },
  {
    label: 'Developers',
    href: '/freehold-intelligence/ai-manager/developers',
    icon: Building2,
    summary: '18 developer profiles',
    alert: '2 incomplete',
    alertColor: 'text-amber-400',
  },
  {
    label: 'Pages',
    href: '/freehold-intelligence/ai-manager/pages',
    icon: FileText,
    summary: '34 pages',
    alert: '8 need AI review',
    alertColor: 'text-rose-400',
  },
  {
    label: 'Topics',
    href: '/freehold-intelligence/ai-manager/topics',
    icon: BookOpen,
    summary: '47 topics',
    alert: '12 unpublished',
    alertColor: 'text-white/40',
  },
]

const activityFeed = [
  { text: 'Generated content for Emaar Beachfront listing', time: '4m ago' },
  { text: 'Updated Dubai Hills area guide', time: '18m ago' },
  { text: 'Published 3 blog topics', time: '1h ago' },
  { text: 'Added developer profile: Binghatti', time: '2h ago' },
  { text: 'Reviewed 8 landing pages', time: '3h ago' },
]

export default function AiManagerPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">

      {/* Header */}
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-rose-400/80">
        <Bot className="h-3.5 w-3.5" />
        AI Manager
      </div>
      <h1 className="mt-4 text-[36px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[48px]">
        AI Manager
      </h1>
      <p className="mt-3 text-white/50 text-sm">
        AI-powered content management for{' '}
        <span className="text-white/70">freeholdproperty.ae</span>
      </p>

      {/* Content type cards */}
      <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {contentTypes.map((ct) => {
          const Icon = ct.icon
          return (
            <Link
              key={ct.label}
              href={ct.href}
              className="group flex flex-col gap-4 rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5 transition hover:border-rose-500/20 hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10">
                  <Icon className="h-4.5 w-4.5 text-rose-400" />
                </div>
                <ArrowUpRight className="h-4 w-4 text-white/20 transition group-hover:text-rose-400/60" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white/90">{ct.label}</div>
                <div className="mt-0.5 text-xs text-white/50">{ct.summary}</div>
                <div className={`mt-1 text-xs font-medium ${ct.alertColor}`}>{ct.alert}</div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Two-column: Activity + Quick Generate */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">

        {/* AI Activity feed */}
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-rose-400" />
            <h2 className="text-sm font-semibold text-white/90">AI Activity</h2>
          </div>
          <ul className="space-y-3">
            {activityFeed.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-400/60" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/70 leading-snug">{item.text}</p>
                  <p className="mt-0.5 text-[11px] text-white/30">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Generate */}
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.03] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-rose-400" />
            <h2 className="text-sm font-semibold text-white/90">Quick Generate</h2>
          </div>
          <p className="text-xs text-white/40 mb-4">
            Describe a piece of content and AI will generate it for freeholdproperty.ae.
          </p>
          <textarea
            rows={4}
            placeholder="Describe what to create..."
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3 text-sm text-white/80 placeholder:text-white/25 focus:border-rose-500/40 focus:outline-none resize-none"
          />
          <button className="mt-3 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-rose-400 transition hover:bg-rose-500/20">
            <Sparkles className="h-4 w-4" />
            Generate
          </button>
        </div>

      </div>
    </div>
  )
}
