'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Building2, ChevronDown, ChevronRight, TrendingUp, Sparkles, Search } from 'lucide-react'
import type { InventoryProperty } from '@/src/features/freehold-intelligence/inventory'
import { useT } from '@/lib/i18n/provider'

function formatPrice(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `AED ${(n / 1_000_000).toFixed(1)}M`
  return `AED ${(n / 1_000).toFixed(0)}K`
}

const DEV_COLORS: Record<string, string> = {
  Emaar:          'bg-sky-400/15 text-sky-300',
  Nakheel:        'bg-emerald-400/15 text-emerald-300',
  DAMAC:          'bg-amber-400/15 text-amber-300',
  'Sobha Realty': 'bg-violet-400/15 text-violet-300',
  Meraas:         'bg-cyan-400/15 text-cyan-300',
  Ellington:      'bg-pink-400/15 text-pink-300',
  Binghatti:      'bg-rose-400/15 text-rose-300',
  Azizi:          'bg-orange-400/15 text-orange-300',
}
function devInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
}
function devColor(name: string) {
  return DEV_COLORS[name] ?? 'bg-surface-2 text-slate-400'
}

export default function ProjectsClient({ initialProperties }: { initialProperties: InventoryProperty[] }) {
  const t = useT()
  const [query,    setQuery]    = useState('')
  const [expanded, setExpanded] = useState<string[]>([])

  const filtered = query
    ? initialProperties.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.developer.toLowerCase().includes(query.toLowerCase()) ||
        p.area.toLowerCase().includes(query.toLowerCase())
      )
    : initialProperties

  const byDeveloper = filtered.reduce<Record<string, InventoryProperty[]>>((acc, p) => {
    if (!acc[p.developer]) acc[p.developer] = []
    acc[p.developer].push(p)
    return acc
  }, {})

  const developers = Object.entries(byDeveloper).sort((a, b) => b[1].length - a[1].length)

  function toggle(name: string) {
    setExpanded((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name])
  }

  function expandAll()   { setExpanded(developers.map(([n]) => n)) }
  function collapseAll() { setExpanded([]) }

  const totalDevelopers  = Object.keys(byDeveloper).length
  const totalUnits        = filtered.length
  const liveLandings      = filtered.filter((p) => p.landingStatus === 'live').length
  const totalActiveCampaigns = filtered.reduce((s, p) => s + p.linkedCampaigns, 0)

  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-7 sm:px-8">

      <div className="mb-7">
        <h1 className="text-[20px] font-semibold text-white">{t('inv.projects.title')}</h1>
        <p className="mt-1 text-xs text-slate-500">{t('inv.projects.subtitle')}</p>
      </div>

      {/* Tiles */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t('inv.projects.tile.developers'),  value: totalDevelopers,      color: 'text-amber-400'   },
          { label: t('inv.projects.tile.totalUnits'),  value: totalUnits,           color: 'text-slate-200'     },
          { label: t('inv.projects.tile.livePages'),   value: liveLandings,         color: 'text-emerald-400'  },
          { label: t('inv.projects.tile.activeCamps'), value: totalActiveCampaigns, color: 'text-gold'    },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-[14px] border border-line bg-surface p-3.5">
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
            <div className={`mt-1.5 text-[20px] font-semibold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Search + controls */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder={t('inv.projects.searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[10px] border border-line bg-surface py-2 pl-8 pr-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400/30"
          />
        </div>
        <button onClick={expandAll}   className="text-xs text-slate-500 hover:text-slate-400 transition">{t('inv.projects.expandAll')}</button>
        <button onClick={collapseAll} className="text-xs text-slate-500 hover:text-slate-400 transition">{t('inv.projects.collapse')}</button>
      </div>

      {/* Developer groups */}
      <div className="space-y-2">
        {developers.map(([developer, props]) => {
          const isOpen       = expanded.includes(developer)
          const totalLeads   = props.reduce((s, p) => s + p.leads30d, 0)
          const avgReadiness = Math.round(props.reduce((s, p) => s + p.adReadiness, 0) / props.length)
          const liveLandCount = props.filter((p) => p.landingStatus === 'live').length

          return (
            <div key={developer} className="rounded-[16px] border border-line bg-surface overflow-hidden">
              <button className="w-full flex items-center gap-4 px-5 py-4 text-left"
                onClick={() => toggle(developer)}>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-xs font-bold ${devColor(developer)}`}>
                  {devInitials(developer)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{developer}</span>
                    <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[10px] text-slate-500">
                      {props.length} {props.length === 1 ? t('inv.projects.project') : t('inv.projects.projects')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                    <span>{t('inv.projects.avgReady', { pct: avgReadiness })}</span>
                    <span>·</span>
                    <span>{t('inv.projects.livePagesCount', { count: liveLandCount })}</span>
                    {totalLeads > 0 && <><span>·</span><span className="text-amber-400/70">{t('inv.projects.leads30d', { count: totalLeads })}</span></>}
                  </div>
                </div>
                {/* Readiness bar */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="h-1 w-16 rounded-full bg-surface-2">
                    <div className={`h-1 rounded-full ${avgReadiness >= 80 ? 'bg-amber-400' : 'bg-amber-400/40'}`}
                      style={{ width: `${avgReadiness}%` }} />
                  </div>
                  {isOpen ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-line divide-y divide-line">
                  {props.map((p) => (
                    <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-surface-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-200 truncate">{p.name}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                          <span className="capitalize">{p.area}</span>
                          <span>·</span>
                          <span className="capitalize">{p.type}</span>
                          <span>·</span>
                          <span>{p.bedrooms} BR</span>
                          {p.leads30d > 0 && <><span>·</span><span className="text-amber-400/60">{t('inv.projects.leads', { count: p.leads30d })}</span></>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-xs text-slate-400 tabular-nums">{formatPrice(p.startingPriceAED)}</div>
                        <div className="h-1.5 w-10 rounded-full bg-surface-2">
                          <div className="h-1.5 rounded-full bg-amber-400/60" style={{ width: `${p.adReadiness}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-500">{p.adReadiness}%</span>
                        <Link href={`/freehold-intelligence/inventory/${p.id}`}
                          className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs text-slate-400 hover:text-slate-300 transition">
                          {t('inv.action.view')} <ArrowUpRight className="h-3 w-3" />
                        </Link>
                        <Link href={`/freehold-intelligence/inventory/${p.id}/generate`}
                          className="flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-2.5 py-1 text-xs text-amber-400/70 hover:text-amber-400 transition">
                          <Sparkles className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
