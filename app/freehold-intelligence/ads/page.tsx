'use client'

import Link from 'next/link'
import {
  Megaphone, Facebook, Chrome, Activity, Rocket, FileText,
  ImageIcon, Sparkles, LayoutTemplate, Target, GitBranch,
  TrendingUp, Inbox, ArrowUpRight,
} from 'lucide-react'
import { Section } from '@/components/freehold/ui'
import { useT } from '@/lib/i18n/provider'

type SubApp = {
  id: string
  labelKey: string
  subKey: string
  href: string
  Icon: typeof Megaphone
  metricKey: string
  accent: string
  card: string
  icon: string
}

const PLATFORMS: SubApp[] = [
  {
    id: 'meta', labelKey: 'lm.ads.meta.label', subKey: 'lm.ads.meta.sub',
    href: '/freehold-intelligence/ads-live/meta', Icon: Facebook,
    metricKey: 'lm.ads.meta.metric',
    accent: '#60A5FA', card: 'border-blue-400/15 hover:border-blue-400/35',
    icon: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  {
    id: 'google', labelKey: 'lm.ads.google.label', subKey: 'lm.ads.google.sub',
    href: '/freehold-intelligence/lead-machine/google', Icon: Chrome,
    metricKey: 'lm.ads.google.metric',
    accent: '#34D399', card: 'border-emerald-400/15 hover:border-emerald-400/35',
    icon: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
  {
    id: 'live', labelKey: 'lm.ads.live.label', subKey: 'lm.ads.live.sub',
    href: '/freehold-intelligence/ads-live', Icon: Activity,
    metricKey: 'lm.ads.live.metric',
    accent: '#F472B6', card: 'border-pink-400/15 hover:border-pink-400/35',
    icon: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  },
]

const BUILD: SubApp[] = [
  {
    id: 'campaigns', labelKey: 'lm.ads.campaigns.label', subKey: 'lm.ads.campaigns.sub',
    href: '/freehold-intelligence/lead-machine/campaigns', Icon: Rocket,
    metricKey: 'lm.ads.campaigns.metric',
    accent: '#D4AF37', card: 'border-gold/15 hover:border-gold/35',
    icon: 'text-gold bg-gold/10 border-gold/20',
  },
  {
    id: 'forms', labelKey: 'lm.ads.forms.label', subKey: 'lm.ads.forms.sub',
    href: '/freehold-intelligence/lead-machine/forms', Icon: FileText,
    metricKey: 'lm.ads.forms.metric',
    accent: '#A78BFA', card: 'border-violet-400/15 hover:border-violet-400/30',
    icon: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  },
  {
    id: 'creatives', labelKey: 'lm.ads.creatives.label', subKey: 'lm.ads.creatives.sub',
    href: '/freehold-intelligence/lead-machine/creatives', Icon: ImageIcon,
    metricKey: 'lm.ads.creatives.metric',
    accent: '#38BDF8', card: 'border-sky-400/15 hover:border-sky-400/30',
    icon: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  },
  {
    id: 'rsa', labelKey: 'lm.ads.rsa.label', subKey: 'lm.ads.rsa.sub',
    href: '/freehold-intelligence/lead-machine/google/ads/generate', Icon: Sparkles,
    metricKey: 'lm.ads.rsa.metric',
    accent: '#FBBF24', card: 'border-amber-400/15 hover:border-amber-400/30',
    icon: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  },
  {
    id: 'landings', labelKey: 'lm.ads.landings.label', subKey: 'lm.ads.landings.sub',
    href: '/freehold-intelligence/lead-machine/landings', Icon: LayoutTemplate,
    metricKey: 'lm.ads.landings.metric',
    accent: '#34D399', card: 'border-emerald-400/15 hover:border-emerald-400/30',
    icon: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
]

const OPTIMIZE: SubApp[] = [
  {
    id: 'targeting', labelKey: 'lm.ads.targeting.label', subKey: 'lm.ads.targeting.sub',
    href: '/freehold-intelligence/lead-machine/targeting', Icon: Target,
    metricKey: 'lm.ads.targeting.metric',
    accent: '#F472B6', card: 'border-pink-400/15 hover:border-pink-400/30',
    icon: 'text-pink-400 bg-pink-400/10 border-pink-400/20',
  },
  {
    id: 'attribution', labelKey: 'lm.ads.attribution.label', subKey: 'lm.ads.attribution.sub',
    href: '/freehold-intelligence/lead-machine/campaigns/attribution', Icon: GitBranch,
    metricKey: 'lm.ads.attribution.metric',
    accent: '#60A5FA', card: 'border-blue-400/15 hover:border-blue-400/30',
    icon: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  },
  {
    id: 'optimizer', labelKey: 'lm.ads.optimizer.label', subKey: 'lm.ads.optimizer.sub',
    href: '/freehold-intelligence/lead-machine/campaigns/optimize', Icon: TrendingUp,
    metricKey: 'lm.ads.optimizer.metric',
    accent: '#A78BFA', card: 'border-violet-400/15 hover:border-violet-400/30',
    icon: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  },
  {
    id: 'requests', labelKey: 'lm.ads.requests.label', subKey: 'lm.ads.requests.sub',
    href: '/freehold-intelligence/lead-machine/ad-requests', Icon: Inbox,
    metricKey: 'lm.ads.requests.metric',
    accent: 'rgba(255,255,255,0.4)', card: 'border-line hover:border-white/[0.15]',
    icon: 'text-slate-400 bg-surface-2 border-line',
  },
]

function Grid({ apps }: { apps: SubApp[] }) {
  const t = useT()
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {apps.map((app) => (
        <Link
          key={app.id}
          href={app.href}
          className={`group relative flex flex-col rounded-xl border bg-surface p-5 transition-all duration-200 ${app.card}`}
        >
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${app.icon}`}>
            <app.Icon className="h-5 w-5" />
          </div>
          <div className="mt-4 flex-1">
            <div className="text-sm font-semibold text-slate-100 group-hover:text-white">{t(app.labelKey)}</div>
            <div className="mt-1 text-sm text-slate-400">{t(app.subKey)}</div>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-slate-400 font-medium">{t(app.metricKey)}</div>
            <ArrowUpRight className="h-4 w-4 text-slate-600 transition-colors group-hover:text-white" />
          </div>
        </Link>
      ))}
    </div>
  )
}

export default function AdsLauncher() {
  const t = useT()
  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8 sm:pt-10">

      {/* Header */}
      <section className="mb-8 overflow-hidden rounded-2xl border border-gold/20 bg-gradient-to-br from-gold/[0.09] via-gold/[0.03] to-transparent">
        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/25 bg-gold/10">
              <Megaphone className="h-5 w-5 text-gold" />
            </div>
            <div>
              <div className="text-base font-semibold text-white">{t('lm.ads.title')}</div>
              <div className="text-sm text-slate-400 mt-0.5">
                {t('lm.ads.subtitle')}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Platforms */}
      <Section title={t('lm.ads.section.platforms')} className="mb-8">
        <Grid apps={PLATFORMS} />
      </Section>

      {/* Build */}
      <Section title={t('lm.ads.section.build')} className="mb-8">
        <Grid apps={BUILD} />
      </Section>

      {/* Optimize */}
      <Section title={t('lm.ads.section.optimize')}>
        <Grid apps={OPTIMIZE} />
      </Section>

    </div>
  )
}
