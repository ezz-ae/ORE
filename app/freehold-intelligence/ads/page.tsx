'use client'

import Link from 'next/link'
import {
  Megaphone, Facebook, Chrome, Activity, Rocket, FileText,
  ImageIcon, Sparkles, LayoutTemplate, Target, GitBranch,
  TrendingUp, Inbox, ArrowUpRight,
} from 'lucide-react'

type SubApp = {
  id: string
  label: string
  sub: string
  href: string
  Icon: typeof Megaphone
  metric: string
  accent: string
  card: string
  icon: string
}

const PLATFORMS: SubApp[] = [
  {
    id: 'meta', label: 'Meta Ads', sub: 'Facebook · Instagram · Lead Gen',
    href: '/freehold-intelligence/ads-live/meta', Icon: Facebook,
    metric: 'Campaigns · forms · audiences',
    accent: '#60A5FA', card: 'border-blue-400/15 hover:border-blue-400/35',
    icon: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  {
    id: 'google', label: 'Google Ads', sub: 'Search · PMax · Display · Video',
    href: '/freehold-intelligence/lead-machine/google', Icon: Chrome,
    metric: 'Campaigns · keywords · RSAs',
    accent: '#34D399', card: 'border-emerald-400/15 hover:border-emerald-400/35',
    icon: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
  {
    id: 'live', label: 'Live Performance', sub: 'Real-time spend · leads · CPL',
    href: '/freehold-intelligence/ads-live', Icon: Activity,
    metric: 'All platforms · live feed',
    accent: '#F472B6', card: 'border-pink-400/15 hover:border-pink-400/35',
    icon: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  },
]

const BUILD: SubApp[] = [
  {
    id: 'campaigns', label: 'Campaigns', sub: 'Launch · manage · monitor',
    href: '/freehold-intelligence/lead-machine/campaigns', Icon: Rocket,
    metric: 'Meta + Google campaigns',
    accent: '#D4AF37', card: 'border-[#D4AF37]/15 hover:border-[#D4AF37]/35',
    icon: 'text-[#D4AF37] bg-[#D4AF37]/10 border-[#D4AF37]/20',
  },
  {
    id: 'forms', label: 'Lead Forms', sub: 'Instant forms · lead capture',
    href: '/freehold-intelligence/lead-machine/forms', Icon: FileText,
    metric: 'Meta lead forms',
    accent: '#A78BFA', card: 'border-violet-400/15 hover:border-violet-400/30',
    icon: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  },
  {
    id: 'creatives', label: 'Creatives', sub: 'Ad images · video · copy',
    href: '/freehold-intelligence/lead-machine/creatives', Icon: ImageIcon,
    metric: 'Creative library',
    accent: '#38BDF8', card: 'border-sky-400/15 hover:border-sky-400/30',
    icon: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  },
  {
    id: 'rsa', label: 'RSA Generator', sub: 'AI search-ad copywriter',
    href: '/freehold-intelligence/lead-machine/google/ads/generate', Icon: Sparkles,
    metric: 'AI headlines + descriptions',
    accent: '#FBBF24', card: 'border-amber-400/15 hover:border-amber-400/30',
    icon: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  },
  {
    id: 'landings', label: 'Landing Pages', sub: 'Build · publish · convert',
    href: '/freehold-intelligence/lead-machine/landings', Icon: LayoutTemplate,
    metric: 'Campaign landing pages',
    accent: '#34D399', card: 'border-emerald-400/15 hover:border-emerald-400/30',
    icon: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
]

const OPTIMIZE: SubApp[] = [
  {
    id: 'targeting', label: 'Targeting', sub: 'Audiences · geo · interests',
    href: '/freehold-intelligence/lead-machine/targeting', Icon: Target,
    metric: 'Audience rules',
    accent: '#F472B6', card: 'border-pink-400/15 hover:border-pink-400/30',
    icon: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  },
  {
    id: 'attribution', label: 'Attribution', sub: 'Source · channel · ROI',
    href: '/freehold-intelligence/lead-machine/campaigns/attribution', Icon: GitBranch,
    metric: 'Lead source tracking',
    accent: '#60A5FA', card: 'border-blue-400/15 hover:border-blue-400/30',
    icon: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  {
    id: 'optimizer', label: 'Optimizer', sub: 'Budget · bids · scaling',
    href: '/freehold-intelligence/lead-machine/campaigns/optimize', Icon: TrendingUp,
    metric: 'Spend optimization',
    accent: '#A78BFA', card: 'border-violet-400/15 hover:border-violet-400/30',
    icon: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  },
  {
    id: 'requests', label: 'Ad Requests', sub: 'Briefs · approvals · queue',
    href: '/freehold-intelligence/lead-machine/ad-requests', Icon: Inbox,
    metric: 'Campaign brief queue',
    accent: 'rgba(255,255,255,0.4)', card: 'border-slate-800 hover:border-white/[0.15]',
    icon: 'text-slate-400 bg-slate-800/40 border-slate-800',
  },
]

function Grid({ apps }: { apps: SubApp[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {apps.map((app) => (
        <Link
          key={app.id}
          href={app.href}
          className={`group relative flex flex-col rounded-xl border bg-slate-900 p-5 transition-colors ${app.card}`}
        >
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${app.icon}`}>
            <app.Icon className="h-5 w-5" />
          </div>
          <div className="mt-4 flex-1">
            <div className="text-sm font-semibold text-slate-100 group-hover:text-white">{app.label}</div>
            <div className="mt-1 text-sm text-slate-400">{app.sub}</div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-slate-400 font-medium">{app.metric}</div>
            <ArrowUpRight className="h-4 w-4 text-slate-600 transition-colors group-hover:text-slate-400" />
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function AdsLauncher() {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pt-10">

      {/* Header */}
      <section className="mb-8 overflow-hidden rounded-2xl border border-[#D4AF37]/15 bg-gradient-to-br from-[#D4AF37]/[0.05] to-transparent">
        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10">
              <Megaphone className="h-5 w-5 text-[#D4AF37]" />
            </div>
            <div>
              <div className="text-base font-semibold text-white">Ads</div>
              <div className="text-sm text-slate-400 mt-0.5">
                Every advertising tool in one place — Meta, Google, forms, creatives & live performance
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platforms */}
      <section className="mb-8">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Platforms</div>
        <Grid apps={PLATFORMS} />
      </section>

      {/* Build */}
      <section className="mb-8">
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Build &amp; Create</div>
        <Grid apps={BUILD} />
      </section>

      {/* Optimize */}
      <section>
        <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">Optimize &amp; Track</div>
        <Grid apps={OPTIMIZE} />
      </section>

    </div>
  )
}
