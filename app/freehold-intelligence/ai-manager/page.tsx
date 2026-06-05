'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Bot, MapPin, Building2, FileText, BookOpen, Sparkles, ArrowUpRight, Activity, CheckCircle, Loader2 } from 'lucide-react'

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

const GENERATED_SAMPLES: Record<string, string> = {
  default: `**Dubai Hills Estate — Premium Lifestyle Living**\n\nNestled within Mohammed Bin Rashid City, Dubai Hills Estate offers an unparalleled blend of nature, luxury, and connectivity. With an 18-hole championship golf course, world-class retail at Dubai Hills Mall, and easy access to both Downtown Dubai and Dubai Marina, this master community redefines what premium living means in the UAE.\n\nStarting from AED 1.2M, Dubai Hills presents exceptional value for end-users and investors alike, with consistent appreciation and high rental yields averaging 6–7% annually.\n\n*Ready-to-publish · freeholdproperty.ae*`,
}

function generateContent(prompt: string): string {
  const p = prompt.toLowerCase()
  if (p.includes('palm') || p.includes('jumeirah')) {
    return `**Palm Jumeirah — Dubai's Iconic Island Address**\n\nPalm Jumeirah remains one of the most recognised addresses in the world. Offering beachfront living, panoramic sea views, and access to world-class hospitality — including Atlantis and FIVE Palm — it attracts both residents and investors seeking unmatched prestige.\n\nProperties range from AED 2.5M to AED 120M+ for ultra-luxury penthouses. Rental yields average 5–6%, with strong capital appreciation driven by limited supply.\n\n*Ready-to-publish · freeholdproperty.ae*`
  }
  if (p.includes('whatsapp') || p.includes('message') || p.includes('lead')) {
    return `Hi [Name], this is [Agent] from Freehold Property.\n\nI noticed you were interested in [Project] — we currently have a few exclusive units available at competitive prices, and I'd love to walk you through the options.\n\nWould you be free for a quick 10-minute call this week? I can share floor plans, payment plans, and our latest ROI projections.\n\nLooking forward to connecting! 🏙️`
  }
  if (p.includes('golden visa') || p.includes('investor')) {
    return `**Golden Visa — UAE Property Pathway**\n\nThe UAE Golden Visa offers 5 or 10-year renewable residency for property investors. To qualify through real estate, you must own property worth AED 2M or more — either outright or through a mortgage.\n\n**Key Benefits:**\n• Long-term residency without employer sponsorship\n• Sponsor family members including parents\n• Business-friendly — operate companies under your own name\n• Access to premium UAE banking and services\n\nFreehold Property specialises in Golden Visa-eligible properties. Book a free consultation today.\n\n*Ready-to-publish · freeholdproperty.ae*`
  }
  return GENERATED_SAMPLES.default
}

export default function AiManagerPage() {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleGenerate() {
    if (!prompt.trim() || generating) return
    setGenerating(true)
    setResult(null)
    setTimeout(() => {
      setResult(generateContent(prompt))
      setGenerating(false)
    }, 1600)
  }

  function handleCopy() {
    if (!result) return
    navigator.clipboard.writeText(result.replace(/\*\*/g, '').replace(/\*/g, ''))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-rose-400" />
            <h2 className="text-sm font-semibold text-white/90">Quick Generate</h2>
          </div>
          <p className="mb-4 text-xs text-white/40">
            Describe a piece of content and AI will generate it for freeholdproperty.ae.
          </p>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Palm Jumeirah listing description, or WhatsApp follow-up for a hot lead…"
            className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 py-3 text-sm text-white/80 placeholder:text-white/25 focus:border-rose-500/40 focus:outline-none"
          />
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generating}
            className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-40"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generating ? 'Generating…' : 'Generate'}
          </button>

          {result && (
            <div className="mt-4 rounded-xl border border-rose-500/15 bg-rose-500/[0.04] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-rose-400/70">Generated</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] text-white/35 transition hover:text-white/65"
                >
                  {copied ? <CheckCircle className="h-3 w-3 text-emerald-400" /> : null}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <p className="whitespace-pre-line text-[13px] leading-[1.7] text-white/75">{result.replace(/\*\*/g, '').replace(/\*/g, '')}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setResult(null)}
                  className="rounded-full border border-white/[0.08] px-3 py-1 text-[11px] text-white/40 transition hover:text-white/65"
                >
                  Clear
                </button>
                <Link
                  href="/freehold-intelligence/notebook"
                  className="rounded-full border border-rose-500/20 bg-rose-500/[0.08] px-3 py-1 text-[11px] text-rose-400 transition hover:bg-rose-500/15"
                >
                  Save to Notebook
                </Link>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
