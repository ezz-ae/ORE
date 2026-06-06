'use client'

import { useState, useMemo } from 'react'
import {
  Activity, Search, ChevronDown, Megaphone, TrendingUp,
  MessageSquare, Briefcase, Settings, AlertTriangle,
  CheckCircle2, Info, XCircle, Clock,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'Ads' | 'Sales' | 'Marketing' | 'Deals' | 'System'
type Severity = 'info' | 'warning' | 'success' | 'error'

interface Event {
  id: number
  time: string
  category: Category
  user: string
  description: string
  severity: Severity
  tags: string[]
  important: boolean
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

const EVENTS: Event[] = [
  {
    id: 1,
    time: '08:47 AM',
    category: 'Ads',
    user: 'Meta Ads · Auto',
    description: 'Meta campaign "Dubai Hills Q3" — CPL dropped to AED 38 (was AED 52)',
    severity: 'success',
    tags: ['CPL', 'Meta', 'Dubai Hills'],
    important: true,
  },
  {
    id: 2,
    time: '08:44 AM',
    category: 'Sales',
    user: 'Sara Al Mansoori',
    description: 'Closed villa deal — AED 3.2M — Dubai Hills Estate',
    severity: 'success',
    tags: ['Deal Closed', 'Villa', 'Dubai Hills'],
    important: true,
  },
  {
    id: 3,
    time: '09:02 AM',
    category: 'System',
    user: 'Ahmad Khalil',
    description: 'User logged in successfully from Dubai, UAE',
    severity: 'info',
    tags: ['Login', 'Session'],
    important: false,
  },
  {
    id: 4,
    time: '09:15 AM',
    category: 'Marketing',
    user: 'Landing Page System',
    description: 'Landing page "Palm Summer" reached 1,000 unique visitors this week',
    severity: 'warning',
    tags: ['Traffic', 'Milestone', 'Palm Jumeirah'],
    important: true,
  },
  {
    id: 5,
    time: '09:20 AM',
    category: 'Deals',
    user: 'Fatima Hassan',
    description: 'Deal #D-1047 moved to "Contract Review" stage — Palm Jumeirah villa',
    severity: 'info',
    tags: ['Pipeline', 'Contract', 'Palm'],
    important: true,
  },
  {
    id: 6,
    time: '04:30 AM',
    category: 'System',
    user: 'Nightly Sync',
    description: 'Nightly sync complete — 2,813 listings indexed across all portals',
    severity: 'success',
    tags: ['Sync', 'Listings', 'Automated'],
    important: false,
  },
  {
    id: 7,
    time: '08:55 AM',
    category: 'Sales',
    user: 'Lead Assignment · Auto',
    description: '14 new leads from Meta campaign assigned to team — avg quality score 74',
    severity: 'info',
    tags: ['Leads', 'Meta', 'Assignment'],
    important: true,
  },
  {
    id: 8,
    time: '07:30 AM',
    category: 'Ads',
    user: 'Google Ads · Auto',
    description: 'Google campaign "Marina Residences" budget exceeded by 12% — paused automatically',
    severity: 'error',
    tags: ['Budget', 'Paused', 'Google'],
    important: true,
  },
  {
    id: 9,
    time: '10:05 AM',
    category: 'Deals',
    user: 'Ahmad Khalil',
    description: 'Client Ahmed Hassan sent counter-offer AED 4.8M on Palm Jumeirah villa #PJ-211',
    severity: 'warning',
    tags: ['Counter-Offer', 'Palm', 'Negotiation'],
    important: true,
  },
  {
    id: 10,
    time: '11:00 AM',
    category: 'Marketing',
    user: 'WhatsApp Broadcast',
    description: 'Broadcast sent to 340 contacts — 87% open rate · 28 replies received',
    severity: 'success',
    tags: ['WhatsApp', 'Broadcast', '87% Open Rate'],
    important: true,
  },
  {
    id: 11,
    time: '09:45 AM',
    category: 'Sales',
    user: 'Omar Al Rashid',
    description: 'Scheduled viewing for 3BR apartment at Business Bay with client Layla Al Nasser',
    severity: 'info',
    tags: ['Viewing', 'Business Bay', 'Appointment'],
    important: false,
  },
  {
    id: 12,
    time: '08:10 AM',
    category: 'Ads',
    user: 'Meta Ads · Auto',
    description: 'New creative set "Downtown Luxury" went live — A/B testing 3 variants',
    severity: 'info',
    tags: ['Creative', 'A/B Test', 'Downtown'],
    important: false,
  },
  {
    id: 13,
    time: '07:15 AM',
    category: 'System',
    user: 'Fatima Hassan',
    description: 'User logged in successfully — 6 pending lead follow-ups detected',
    severity: 'info',
    tags: ['Login', 'Follow-Up Alert'],
    important: false,
  },
  {
    id: 14,
    time: '10:30 AM',
    category: 'Deals',
    user: 'Sara Al Mansoori',
    description: 'Deal #D-1050 created — new buyer inquiry for JVC townhouse AED 1.95M',
    severity: 'info',
    tags: ['New Deal', 'JVC', 'Townhouse'],
    important: true,
  },
  {
    id: 15,
    time: '11:20 AM',
    category: 'Marketing',
    user: 'Email Campaign',
    description: 'Monthly newsletter sent to 1,240 subscribers — 24% open rate · 6.2% CTR',
    severity: 'success',
    tags: ['Email', 'Newsletter', 'CTR'],
    important: false,
  },
  {
    id: 16,
    time: '06:00 AM',
    category: 'System',
    user: 'Backup System',
    description: 'Daily database backup completed — 2.4 GB archived to cloud storage',
    severity: 'success',
    tags: ['Backup', 'Automated'],
    important: false,
  },
  {
    id: 17,
    time: '09:55 AM',
    category: 'Ads',
    user: 'Google Ads · Auto',
    description: 'Keyword "luxury villa Dubai" CTR dropped from 4.2% to 2.8% — review recommended',
    severity: 'warning',
    tags: ['CTR Drop', 'Keywords', 'Google'],
    important: true,
  },
  {
    id: 18,
    time: '10:45 AM',
    category: 'Sales',
    user: 'Hassan Al Ali',
    description: 'Added meeting notes for lead #L-892 — client interested in off-plan Emaar units',
    severity: 'info',
    tags: ['CRM Note', 'Emaar', 'Off-Plan'],
    important: false,
  },
  {
    id: 19,
    time: '11:35 AM',
    category: 'Deals',
    user: 'Legal System',
    description: 'MOU signed for Deal #D-1038 — Downtown penthouse AED 8.5M · docs uploaded',
    severity: 'success',
    tags: ['MOU', 'Signed', 'Downtown'],
    important: true,
  },
  {
    id: 20,
    time: '08:00 AM',
    category: 'Marketing',
    user: 'SEO Monitor',
    description: 'Organic ranking for "Dubai Marina apartments" improved to position 3 (was 7)',
    severity: 'success',
    tags: ['SEO', 'Ranking', 'Marina'],
    important: true,
  },
  {
    id: 21,
    time: '12:10 PM',
    category: 'System',
    user: 'Security Monitor',
    description: 'Failed login attempt from unrecognized IP — account temporarily locked',
    severity: 'error',
    tags: ['Security', 'Alert', 'Login'],
    important: true,
  },
  {
    id: 22,
    time: '11:55 AM',
    category: 'Sales',
    user: 'Nour Ibrahim',
    description: 'Called lead #L-901 (3rd attempt) — left voicemail, flagged for WhatsApp follow-up',
    severity: 'info',
    tags: ['Call', 'Follow-Up', 'Voicemail'],
    important: false,
  },
  {
    id: 23,
    time: '12:30 PM',
    category: 'Ads',
    user: 'Meta Ads · Auto',
    description: 'Lookalike audience "High-Value Buyers UAE" generated — 520K estimated reach',
    severity: 'success',
    tags: ['Audience', 'Lookalike', 'Meta'],
    important: false,
  },
  {
    id: 24,
    time: '01:00 PM',
    category: 'Deals',
    user: 'Yasmin Mohammed',
    description: 'Deal #D-1041 marked as Lost — client chose competitor · feedback: price too high',
    severity: 'error',
    tags: ['Lost Deal', 'Feedback'],
    important: true,
  },
  {
    id: 25,
    time: '01:15 PM',
    category: 'Marketing',
    user: 'Google Analytics',
    description: 'Ad traffic spike detected — 340 sessions in last 30 minutes from campaign "Summer24"',
    severity: 'warning',
    tags: ['Traffic', 'Spike', 'Analytics'],
    important: false,
  },
  {
    id: 26,
    time: '01:30 PM',
    category: 'System',
    user: 'CRM Automation',
    description: 'Auto-assigned 7 stale leads (>5 days no contact) to team manager for review',
    severity: 'warning',
    tags: ['Auto-Assign', 'Stale Leads', 'CRM'],
    important: false,
  },
  {
    id: 27,
    time: '02:00 PM',
    category: 'Sales',
    user: 'Layla Nasser',
    description: 'Completed property tour for Dubai Creek Harbour — client very interested in 2BR unit',
    severity: 'success',
    tags: ['Tour', 'Creek Harbour', 'Interested'],
    important: false,
  },
  {
    id: 28,
    time: '02:20 PM',
    category: 'Ads',
    user: 'TikTok Ads · Auto',
    description: 'Video ad "Palm Residences Reveal" reached 12,000 views — 4.1% engagement rate',
    severity: 'success',
    tags: ['TikTok', 'Video', 'Engagement'],
    important: false,
  },
]

// ─── Config ───────────────────────────────────────────────────────────────────

type Tab = 'Smart' | Category

const TABS: Tab[] = ['Smart', 'Ads', 'Sales', 'Marketing', 'Deals', 'System']

const CATEGORY_STYLES: Record<Category, { bg: string; text: string; border: string }> = {
  Ads:       { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
  Sales:     { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  Marketing: { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  Deals:     { bg: 'bg-sky-500/15', text: 'text-sky-400', border: 'border-sky-500/30' },
  System:    { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30' },
}

const CATEGORY_ICONS: Record<Category, React.ElementType> = {
  Ads:       Megaphone,
  Sales:     TrendingUp,
  Marketing: MessageSquare,
  Deals:     Briefcase,
  System:    Settings,
}

const SEVERITY_CONFIG: Record<Severity, { dot: string; icon: React.ElementType; label: string }> = {
  info:    { dot: 'bg-slate-500',   icon: Info,          label: 'Info' },
  warning: { dot: 'bg-amber-400',   icon: AlertTriangle, label: 'Warning' },
  success: { dot: 'bg-emerald-400', icon: CheckCircle2,  label: 'Success' },
  error:   { dot: 'bg-red-400',     icon: XCircle,       label: 'Error' },
}

const VISIBLE_COUNT_STEP = 15

// ─── Component ────────────────────────────────────────────────────────────────

export default function EventsLogPage() {
  const [activeTab, setActiveTab]   = useState<Tab>('Smart')
  const [search,    setSearch]      = useState('')
  const [visible,   setVisible]     = useState(VISIBLE_COUNT_STEP)

  const filtered = useMemo(() => {
    let list = EVENTS
    if (activeTab === 'Smart') {
      list = list.filter(e => e.important)
    } else {
      list = list.filter(e => e.category === activeTab)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        e =>
          e.description.toLowerCase().includes(q) ||
          e.user.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return list
  }, [activeTab, search])

  const shown      = filtered.slice(0, visible)
  const hasMore    = visible < filtered.length
  const importantCount = EVENTS.filter(e => e.important).length

  return (
    <div className="min-h-screen bg-[#0D1117] pb-20">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 border-b border-slate-800 bg-[#090C12]/90 backdrop-blur-xl px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800">
              <Activity className="h-4 w-4 text-slate-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-white">Events Log</h1>
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-medium text-emerald-400">Live</span>
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {EVENTS.length} events today &middot; {importantCount} important
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setVisible(VISIBLE_COUNT_STEP) }}
              placeholder="Search events…"
              className="w-full rounded-lg border border-slate-700 bg-slate-800/60 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 outline-none focus:border-slate-600 transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 pt-5 space-y-5">

        {/* ── Filter tabs ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {TABS.map(tab => {
            const active = activeTab === tab
            const catStyle = tab !== 'Smart' ? CATEGORY_STYLES[tab as Category] : null
            return (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setVisible(VISIBLE_COUNT_STEP) }}
                className={[
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all whitespace-nowrap',
                  active
                    ? tab === 'Smart'
                      ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30'
                      : `${catStyle!.bg} ${catStyle!.text} border ${catStyle!.border}`
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent',
                ].join(' ')}
              >
                {tab === 'Smart' ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
                ) : (
                  (() => {
                    const Icon = CATEGORY_ICONS[tab as Category]
                    return <Icon className="h-3.5 w-3.5" />
                  })()
                )}
                {tab}
                {tab === 'Smart' && (
                  <span className="rounded-full bg-[#D4AF37]/20 px-1.5 py-0.5 text-xs font-semibold text-[#D4AF37]">
                    {importantCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Events table ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-800 bg-slate-900">

          {/* Table header */}
          <div className="hidden md:grid grid-cols-[90px_110px_160px_1fr_auto_80px] gap-4 border-b border-slate-800 px-5 py-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Time</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Category</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Source</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Description</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tags</span>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 text-right">Severity</span>
          </div>

          {shown.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-500">No events match your search.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {shown.map(event => {
                const catStyle  = CATEGORY_STYLES[event.category]
                const sevConfig = SEVERITY_CONFIG[event.severity]
                const CatIcon   = CATEGORY_ICONS[event.category]
                return (
                  <div
                    key={event.id}
                    className="group px-5 py-3.5 hover:bg-slate-800/30 transition-colors"
                  >
                    {/* Desktop layout */}
                    <div className="hidden md:grid grid-cols-[90px_110px_160px_1fr_auto_80px] gap-4 items-start">
                      {/* Time */}
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <Clock className="h-3 w-3 text-slate-600 shrink-0" />
                        <span className="text-xs text-slate-500 font-mono tabular-nums">{event.time}</span>
                      </div>

                      {/* Category badge */}
                      <div>
                        <span className={[
                          'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
                          catStyle.bg, catStyle.text, catStyle.border,
                        ].join(' ')}>
                          <CatIcon className="h-3 w-3" />
                          {event.category}
                        </span>
                      </div>

                      {/* User/source */}
                      <p className="text-xs text-slate-400 truncate pt-0.5">{event.user}</p>

                      {/* Description */}
                      <p className="text-sm text-slate-200 leading-relaxed">{event.description}</p>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                        {event.tags.map(tag => (
                          <span key={tag} className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs text-slate-500">
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Severity */}
                      <div className="flex justify-end items-center gap-1.5">
                        <span className={['h-2 w-2 rounded-full shrink-0', sevConfig.dot].join(' ')} />
                        <span className={[
                          'text-xs font-medium',
                          event.severity === 'success' ? 'text-emerald-400' :
                          event.severity === 'warning' ? 'text-amber-400' :
                          event.severity === 'error'   ? 'text-red-400' :
                                                          'text-slate-500',
                        ].join(' ')}>
                          {sevConfig.label}
                        </span>
                      </div>
                    </div>

                    {/* Mobile layout */}
                    <div className="md:hidden space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={[
                            'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium',
                            catStyle.bg, catStyle.text, catStyle.border,
                          ].join(' ')}>
                            <CatIcon className="h-3 w-3" />
                            {event.category}
                          </span>
                          <span className="text-xs text-slate-600 font-mono">{event.time}</span>
                        </div>
                        <span className={['h-2 w-2 rounded-full shrink-0 mt-1', sevConfig.dot].join(' ')} />
                      </div>
                      <p className="text-xs text-slate-500">{event.user}</p>
                      <p className="text-sm text-slate-200">{event.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {event.tags.map(tag => (
                          <span key={tag} className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs text-slate-500">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Load more ────────────────────────────────────────────────────── */}
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              onClick={() => setVisible(v => v + VISIBLE_COUNT_STEP)}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white"
            >
              <ChevronDown className="h-4 w-4" />
              Load more ({filtered.length - visible} remaining)
            </button>
          </div>
        )}

        {!hasMore && shown.length > 0 && (
          <p className="pb-2 text-center text-xs text-slate-600">
            All {filtered.length} events shown
          </p>
        )}
      </div>
    </div>
  )
}
